/**
 * Carbon Stock Estimation Types
 * Shared types between frontend and backend for carbon prediction
 */

export interface CarbonPredictionInput {
  ndvi: number; // Normalized Difference Vegetation Index (0.1-0.9)
  canopyCoverPercent: number; // Canopy cover percentage (0-100)
  soilCarbonPercent: number; // Soil carbon content (0.5-8)
  areaHectares?: number; // Optional: Area in hectares for credit calculation
  projectDurationYears?: number; // Optional: Project duration in years
}

export interface CarbonPredictionResult {
  carbonSequestration: number; // tCO₂e/ha
  confidence: number; // Confidence score (0-1)
  modelUsed: string;
  timestamp: string;
  inputData: CarbonPredictionInput;
}

export interface CarbonCreditsInfo {
  totalCredits: number;
  annualCredits: number;
  totalSequestration: number;
  valueUSD: number;
  pricePerCredit: number;
}

export interface FarmerCarbonData {
  farmerId: string;
  predictions: Array<{
    timestamp: string;
    input: CarbonPredictionInput;
    result: CarbonPredictionResult;
    credits?: CarbonCreditsInfo;
  }>;
  totalCredits: number;
  totalValueUSD: number;
  lastUpdated: string;
}

export interface ModelCoefficients {
  bias: number;
  ndvi: number;
  canopyCoverPercent: number;
  soilCarbonPercent: number;
}

export interface ModelInfo {
  version: string;
  coefficients: ModelCoefficients;
  performance: {
    r2: number;
    rmse: number;
    mae: number;
  };
  featureImportance: Array<{ feature: string; importance: number }>;
}

export interface CarbonStatistics {
  totalPredictions: number;
  totalFarmers: number;
  averageCarbonSequestration: number;
  recentActivity: Array<{
    farmerId: string;
    timestamp: string;
    carbonSequestration: number;
    confidence: number;
  }>;
  lastUpdated: string;
}

// API Response Types
export interface CarbonPredictionResponse {
  success: boolean;
  prediction: CarbonPredictionResult;
  credits?: CarbonCreditsInfo;
  farmer: {
    id: string;
    name: string;
  };
}

export interface ModelInfoResponse {
  success: boolean;
  model: ModelInfo;
  description: string;
  inputRequirements: {
    ndvi: { min: number; max: number; description: string };
    canopyCoverPercent: { min: number; max: number; description: string };
    soilCarbonPercent: { min: number; max: number; description: string };
  };
  output: {
    unit: string;
    description: string;
  };
}

export interface CarbonHistoryResponse {
  success: boolean;
  data: FarmerCarbonData;
}

export interface BatchPredictionResponse {
  success: boolean;
  count: number;
  predictions: CarbonPredictionResult[];
  farmer: {
    id: string;
    name: string;
  };
}

export interface CarbonStatisticsResponse {
  success: boolean;
  statistics: CarbonStatistics;
}
