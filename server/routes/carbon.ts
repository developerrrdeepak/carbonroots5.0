import { RequestHandler } from "express";
import MLService from "../lib/mlService";
import Database from "../lib/database";
import AuthService from "../lib/services";

// Initialize services
const mlService = MLService.getInstance();
const db = Database.getInstance();
const authService = new AuthService();

interface CarbonPredictionRequest {
  ndvi: number;
  canopyCoverPercent: number;
  soilCarbonPercent: number;
  areaHectares?: number;
  projectDurationYears?: number;
}

interface FarmerCarbonData {
  farmerId: string;
  predictions: Array<{
    timestamp: string;
    input: CarbonPredictionRequest;
    result: any;
    credits?: number;
    valueUSD?: number;
  }>;
  totalCredits: number;
  totalValueUSD: number;
  lastUpdated: string;
}

import { body, validationResult } from "express-validator";

export const predictCarbon: RequestHandler = [
  // Validation middleware
  body("ndvi").isFloat({ min: 0.1, max: 0.9 }).withMessage("NDVI must be between 0.1 and 0.9"),
  body("canopyCoverPercent").isFloat({ min: 0, max: 100 }).withMessage("Canopy cover must be between 0 and 100%"),
  body("soilCarbonPercent").isFloat({ min: 0.5, max: 8 }).withMessage("Soil carbon must be between 0.5 and 8%"),
  body("areaHectares").optional().isFloat({ gt: 0 }).withMessage("Area must be positive"),
  body("projectDurationYears").optional().isInt({ gt: 0 }).withMessage("Project duration must be positive"),

  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array().map(e => e.msg)
        });
      }

      const token = req.headers.authorization?.replace("Bearer ", "");
      
      if (!token) {
        return res.status(401).json({ 
          success: false, 
          message: "Authentication token required" 
        });
      }

      // Verify user authentication
      const user = await authService.getUserByToken(token);
      
      if (!user || user.type !== "farmer") {
        return res.status(403).json({ 
          success: false, 
          message: "Farmer access required" 
        });
      }

      const {
        ndvi,
        canopyCoverPercent,
        soilCarbonPercent,
        areaHectares = 1,
        projectDurationYears = 1
      } = req.body as CarbonPredictionRequest;

      // Make prediction
      const prediction = mlService.predictCarbonSequestration({
        ndvi,
        canopyCoverPercent,
        soilCarbonPercent
      });

      // Calculate carbon credits if area is provided
      let creditsInfo = null;
      if (areaHectares > 0) {
        creditsInfo = mlService.estimateCarbonCredits(
          prediction.carbonSequestration,
          areaHectares,
          projectDurationYears
        );

        // Calculate monetary value
        const creditValue = mlService.calculateCreditValue(creditsInfo.totalCredits);
        
        creditsInfo = {
          ...creditsInfo,
          valueUSD: creditValue.valueUSD,
          pricePerCredit: creditValue.pricePerCredit
        };
      }

      // Store prediction in database
      try {
        await db.getDb()?.collection("carbon_predictions").insertOne({
          farmerId: user.farmer!.id,
          timestamp: new Date(),
          input: { ndvi, canopyCoverPercent, soilCarbonPercent, areaHectares, projectDurationYears },
          prediction: prediction,
          credits: creditsInfo,
          createdAt: new Date()
        });
      } catch (dbError) {
        console.warn("Failed to save prediction to database:", dbError);
        // Continue without failing the request
      }

      res.json({
        success: true,
        prediction,
        credits: creditsInfo,
        farmer: {
          id: user.farmer!.id,
          name: user.farmer!.name
        }
      });

    } catch (error) {
      console.error("Carbon prediction error:", error);
      
      if (error instanceof Error) {
        if (error.message.includes("Invalid input parameters")) {
          return res.status(400).json({
            success: false,
            message: error.message
          });
        }
      }

      res.status(500).json({
        success: false,
        message: "Failed to calculate carbon prediction"
      });
    }
  }
];

export const getModelInfo: RequestHandler = async (req, res) => {
  try {
    const modelInfo = mlService.getModelInfo();
    
    res.json({
      success: true,
      model: modelInfo,
      description: "Carbon Stock Estimation Model for predicting carbon sequestration in forest ecosystems",
      inputRequirements: {
        ndvi: { min: 0.1, max: 0.9, description: "Normalized Difference Vegetation Index" },
        canopyCoverPercent: { min: 0, max: 100, description: "Canopy cover percentage" },
        soilCarbonPercent: { min: 0.5, max: 8, description: "Soil carbon content percentage" }
      },
      output: {
        unit: "tCO₂e/ha",
        description: "Carbon sequestration in metric tons of CO₂ equivalent per hectare"
      }
    });

  } catch (error) {
    console.error("Model info error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve model information"
    });
  }
};

export const getFarmerCarbonHistory: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication token required" 
      });
    }

    const user = await authService.getUserByToken(token);
    
    if (!user || user.type !== "farmer") {
      return res.status(403).json({ 
        success: false, 
        message: "Farmer access required" 
      });
    }

    const farmerId = user.farmer!.id;
    
    // Get carbon prediction history
    const predictions = await db.getDb()?.collection("carbon_predictions")
      .find({ farmerId })
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    // Calculate totals
    let totalCredits = 0;
    let totalValueUSD = 0;

    predictions?.forEach(pred => {
      if (pred.credits) {
        totalCredits += pred.credits.totalCredits || 0;
        totalValueUSD += pred.credits.valueUSD || 0;
      }
    });

    const carbonData: FarmerCarbonData = {
      farmerId,
      predictions: predictions?.map(pred => ({
        timestamp: pred.timestamp,
        input: pred.input,
        result: pred.prediction,
        credits: pred.credits?.totalCredits,
        valueUSD: pred.credits?.valueUSD
      })) || [],
      totalCredits,
      totalValueUSD,
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      data: carbonData
    });

  } catch (error) {
    console.error("Carbon history error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve carbon history"
    });
  }
};

export const batchPredictCarbon: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication token required" 
      });
    }

    const user = await authService.getUserByToken(token);
    
    if (!user || user.type !== "farmer") {
      return res.status(403).json({ 
        success: false, 
        message: "Farmer access required" 
      });
    }

    const { predictions: predictionRequests } = req.body as {
      predictions: CarbonPredictionRequest[];
    };

    if (!Array.isArray(predictionRequests) || predictionRequests.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Predictions array is required"
      });
    }

    if (predictionRequests.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Maximum 100 predictions per batch"
      });
    }

    const results = mlService.batchPredict(predictionRequests);

    // Store batch predictions
    try {
      const batchData = results.map((result, index) => ({
        farmerId: user.farmer!.id,
        timestamp: new Date(),
        input: predictionRequests[index],
        prediction: result,
        createdAt: new Date()
      }));

      await db.getDb()?.collection("carbon_predictions").insertMany(batchData);
    } catch (dbError) {
      console.warn("Failed to save batch predictions to database:", dbError);
    }

    res.json({
      success: true,
      count: results.length,
      predictions: results,
      farmer: {
        id: user.farmer!.id,
        name: user.farmer!.name
      }
    });

  } catch (error) {
    console.error("Batch prediction error:", error);
    
    if (error instanceof Error) {
      if (error.message.includes("Invalid input parameters")) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }
    }

    res.status(500).json({
      success: false,
      message: "Failed to process batch predictions"
    });
  }
};

export const getCarbonStatistics: RequestHandler = async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: "Authentication token required" 
      });
    }

    const user = await authService.getUserByToken(token);
    
    if (!user) {
      return res.status(403).json({ 
        success: false, 
        message: "Authentication required" 
      });
    }

    const dbInstance = db.getDb();
    if (!dbInstance) {
      return res.status(500).json({
        success: false,
        message: "Database not available"
      });
    }

    // Get overall statistics
    const totalPredictions = await dbInstance.collection("carbon_predictions").countDocuments();
    const totalFarmers = await dbInstance.collection("carbon_predictions").distinct("farmerId");
    
    // Get recent predictions
    const recentPredictions = await dbInstance.collection("carbon_predictions")
      .find()
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    // Calculate average carbon sequestration
    const avgSequestration = await dbInstance.collection("carbon_predictions")
      .aggregate([
        { $match: { "prediction.carbonSequestration": { $exists: true } } },
        { $group: { _id: null, avg: { $avg: "$prediction.carbonSequestration" } } }
      ])
      .toArray();

    const statistics = {
      totalPredictions,
      totalFarmers: totalFarmers.length,
      averageCarbonSequestration: avgSequestration[0]?.avg || 0,
      recentActivity: recentPredictions.map(pred => ({
        farmerId: pred.farmerId,
        timestamp: pred.timestamp,
        carbonSequestration: pred.prediction?.carbonSequestration,
        confidence: pred.prediction?.confidence
      })),
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      statistics
    });

  } catch (error) {
    console.error("Carbon statistics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve carbon statistics"
    });
  }
};
