/**
 * Carbon Stock Estimation ML Service
 * Integrates machine learning models for carbon credit calculations
 */

interface CarbonPredictionInput {
  ndvi: number; // Normalized Difference Vegetation Index (0.1-0.9)
  canopyCoverPercent: number; // Canopy cover percentage (0-100)
  soilCarbonPercent: number; // Soil carbon content (0.5-8)
}

interface CarbonPredictionResult {
  carbonSequestration: number; // tCO₂e/ha
  confidence: number; // Confidence score (0-1)
  modelUsed: string;
  timestamp: string;
  inputData: CarbonPredictionInput;
}

interface ModelCoefficients {
  bias: number;
  ndvi: number;
  canopyCoverPercent: number;
  soilCarbonPercent: number;
}

export class MLService {
  private static instance: MLService;
  private modelCoefficients: ModelCoefficients;
  private modelVersion: string;

  private constructor() {
    // Initialize with the trained model coefficients from the ML model
    this.modelCoefficients = {
      bias: -0.12420730589741327,
      ndvi: 24.86822411958432,
      canopyCoverPercent: 0.15040989198704635,
      soilCarbonPercent: 6.0526982817020265
    };
    this.modelVersion = "1.0";
  }

  public static getInstance(): MLService {
    if (!MLService.instance) {
      MLService.instance = new MLService();
    }
    return MLService.instance;
  }

  /**
   * Predict carbon sequestration based on input parameters
   */
  public predictCarbonSequestration(input: CarbonPredictionInput): CarbonPredictionResult {
    // Validate input ranges
    this.validateInput(input);

    // Calculate carbon sequestration using the linear model
    const carbonSequestration = this.calculateCarbonSequestration(input);

    // Calculate confidence score based on input validity
    const confidence = this.calculateConfidence(input);

    return {
      carbonSequestration,
      confidence,
      modelUsed: `Linear Regression v${this.modelVersion}`,
      timestamp: new Date().toISOString(),
      inputData: input
    };
  }

  /**
   * Calculate carbon sequestration using the trained model
   */
  private calculateCarbonSequestration(input: CarbonPredictionInput): number {
    const { bias, ndvi, canopyCoverPercent, soilCarbonPercent } = this.modelCoefficients;
    
    return bias + 
           (ndvi * input.ndvi) + 
           (canopyCoverPercent * input.canopyCoverPercent) + 
           (soilCarbonPercent * input.soilCarbonPercent);
  }

  /**
   * Validate input parameters and throw errors if invalid
   */
  private validateInput(input: CarbonPredictionInput): void {
    const errors: string[] = [];

    if (input.ndvi < 0.1 || input.ndvi > 0.9) {
      errors.push("NDVI must be between 0.1 and 0.9");
    }

    if (input.canopyCoverPercent < 0 || input.canopyCoverPercent > 100) {
      errors.push("Canopy cover percentage must be between 0 and 100");
    }

    if (input.soilCarbonPercent < 0.5 || input.soilCarbonPercent > 8) {
      errors.push("Soil carbon percentage must be between 0.5 and 8");
    }

    if (errors.length > 0) {
      throw new Error(`Invalid input parameters: ${errors.join(", ")}`);
    }
  }

  /**
   * Calculate confidence score based on input validity
   */
  private calculateConfidence(input: CarbonPredictionInput): number {
    let confidence = 1.0;

    // Reduce confidence for values near boundaries
    if (input.ndvi < 0.2 || input.ndvi > 0.8) {
      confidence *= 0.9;
    }

    if (input.canopyCoverPercent < 10 || input.canopyCoverPercent > 90) {
      confidence *= 0.9;
    }

    if (input.soilCarbonPercent < 1 || input.soilCarbonPercent > 7) {
      confidence *= 0.9;
    }

    return Math.max(0.7, confidence); // Minimum confidence of 70%
  }

  /**
   * Get model information and coefficients
   */
  public getModelInfo(): {
    version: string;
    coefficients: ModelCoefficients;
    performance: {
      r2: number;
      rmse: number;
      mae: number;
    };
    featureImportance: Array<{ feature: string; importance: number }>;
  } {
    return {
      version: this.modelVersion,
      coefficients: this.modelCoefficients,
      performance: {
        r2: 0.9618560340801273,
        rmse: 2.9209244259977147,
        mae: 2.2910929489170755
      },
      featureImportance: [
        { feature: "NDVI", importance: 24.86822411958432 },
        { feature: "SoilCarbonPercent", importance: 6.0526982817020265 },
        { feature: "CanopyCoverPercent", importance: 0.15040989198704635 }
      ]
    };
  }

  /**
   * Batch prediction for multiple inputs
   */
  public batchPredict(inputs: CarbonPredictionInput[]): CarbonPredictionResult[] {
    return inputs.map(input => this.predictCarbonSequestration(input));
  }

  /**
   * Estimate carbon credits based on area and sequestration rate
   */
  public estimateCarbonCredits(
    carbonSequestration: number, // tCO₂e/ha
    areaHectares: number, // Total area in hectares
    projectDurationYears: number = 1 // Project duration in years
  ): {
    totalCredits: number;
    annualCredits: number;
    totalSequestration: number;
  } {
    if (areaHectares <= 0) {
      throw new Error("Area must be greater than 0");
    }

    if (projectDurationYears <= 0) {
      throw new Error("Project duration must be greater than 0");
    }

    const totalSequestration = carbonSequestration * areaHectares * projectDurationYears;
    const annualCredits = carbonSequestration * areaHectares;
    const totalCredits = annualCredits * projectDurationYears;

    return {
      totalCredits,
      annualCredits,
      totalSequestration
    };
  }

  /**
   * Calculate carbon credit value based on market price
   */
  public calculateCreditValue(
    credits: number,
    pricePerCredit: number = 15 // Default price in USD per credit
  ): {
    valueUSD: number;
    credits: number;
    pricePerCredit: number;
  } {
    if (credits < 0) {
      throw new Error("Credits cannot be negative");
    }

    if (pricePerCredit <= 0) {
      throw new Error("Price per credit must be greater than 0");
    }

    return {
      valueUSD: credits * pricePerCredit,
      credits,
      pricePerCredit
    };
  }
}

export default MLService;
