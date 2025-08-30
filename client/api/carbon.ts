import { 
  CarbonPredictionInput, 
  CarbonPredictionResponse,
  ModelInfoResponse,
  CarbonHistoryResponse,
  CarbonStatisticsResponse,
  BatchPredictionResponse
} from '../../shared/carbon';

const API_BASE = '/api/carbon';

/**
 * Get authentication token from localStorage
 */
const getAuthToken = (): string | null => {
  // Use consistent key for auth token
  return localStorage.getItem('auth_token') || localStorage.getItem('authToken');
};

/**
 * Make authenticated API request
 */
const makeRequest = async (url: string, options: RequestInit = {}) => {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  } catch (error) {
    // Add retry logic or fallback here if needed
    throw error;
  }
};

/**
 * Predict carbon sequestration
 */
export const predictCarbon = async (
  input: CarbonPredictionInput
): Promise<CarbonPredictionResponse> => {
  return makeRequest(`${API_BASE}/predict`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
};

/**
 * Get model information
 */
export const getModelInfo = async (): Promise<ModelInfoResponse> => {
  return makeRequest(`${API_BASE}/model-info`);
};

/**
 * Get carbon prediction history for the authenticated farmer
 */
export const getCarbonHistory = async (): Promise<CarbonHistoryResponse> => {
  return makeRequest(`${API_BASE}/history`);
};

/**
 * Perform batch carbon predictions
 */
export const batchPredictCarbon = async (
  inputs: CarbonPredictionInput[]
): Promise<BatchPredictionResponse> => {
  return makeRequest(`${API_BASE}/batch-predict`, {
    method: 'POST',
    body: JSON.stringify({ predictions: inputs }),
  });
};

/**
 * Get carbon statistics
 */
export const getCarbonStatistics = async (): Promise<CarbonStatisticsResponse> => {
  return makeRequest(`${API_BASE}/statistics`);
};

/**
 * Validate carbon prediction input parameters
 */
export const validateCarbonInput = (input: CarbonPredictionInput): string[] => {
  const errors: string[] = [];

  if (input.ndvi < 0.1 || input.ndvi > 0.9) {
    errors.push('NDVI must be between 0.1 and 0.9');
  }

  if (input.canopyCoverPercent < 0 || input.canopyCoverPercent > 100) {
    errors.push('Canopy cover must be between 0 and 100%');
  }

  if (input.soilCarbonPercent < 0.5 || input.soilCarbonPercent > 8) {
    errors.push('Soil carbon must be between 0.5 and 8%');
  }

  if (input.areaHectares !== undefined && input.areaHectares <= 0) {
    errors.push('Area must be positive');
  }

  if (input.projectDurationYears !== undefined && input.projectDurationYears <= 0) {
    errors.push('Project duration must be positive');
  }

  // Return all errors for better UI feedback
  return errors;
};
