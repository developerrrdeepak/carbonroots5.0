# Carbon Stock Estimation API Documentation

## Overview

The Carbon Stock Estimation API provides machine learning-powered endpoints for predicting carbon sequestration in forest ecosystems. The API integrates a trained linear regression model that uses satellite-derived vegetation indices and soil data to estimate carbon storage potential.

## Base URL

```
https://your-domain.com/api/carbon
```

## Authentication

All carbon endpoints require authentication via JWT token. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Predict Carbon Sequestration

**POST** `/api/carbon/predict`

Predicts carbon sequestration based on input parameters and optionally calculates carbon credits.

#### Request Body

```json
{
  "ndvi": 0.7,
  "canopyCoverPercent": 75,
  "soilCarbonPercent": 3.5,
  "areaHectares": 10,
  "projectDurationYears": 5
}
```

**Parameters:**
- `ndvi` (required): Normalized Difference Vegetation Index (0.1-0.9)
- `canopyCoverPercent` (required): Canopy cover percentage (0-100)
- `soilCarbonPercent` (required): Soil carbon content percentage (0.5-8)
- `areaHectares` (optional): Area in hectares for credit calculation
- `projectDurationYears` (optional): Project duration in years (default: 1)

#### Response

```json
{
  "success": true,
  "prediction": {
    "carbonSequestration": 25.42,
    "confidence": 0.95,
    "modelUsed": "Linear Regression v1.0",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "inputData": {
      "ndvi": 0.7,
      "canopyCoverPercent": 75,
      "soilCarbonPercent": 3.5,
      "areaHectares": 10,
      "projectDurationYears": 5
    }
  },
  "credits": {
    "totalCredits": 1271.0,
    "annualCredits": 254.2,
    "totalSequestration": 1271.0,
    "valueUSD": 19065.0,
    "pricePerCredit": 15
  },
  "farmer": {
    "id": "farmer_123",
    "name": "John Doe"
  }
}
```

### 2. Get Model Information

**GET** `/api/carbon/model-info`

Retrieves information about the carbon estimation model including coefficients, performance metrics, and feature importance.

#### Response

```json
{
  "success": true,
  "model": {
    "version": "1.0",
    "coefficients": {
      "bias": -0.124,
      "ndvi": 24.868,
      "canopyCoverPercent": 0.150,
      "soilCarbonPercent": 6.053
    },
    "performance": {
      "r2": 0.962,
      "rmse": 2.921,
      "mae": 2.291
    },
    "featureImportance": [
      { "feature": "NDVI", "importance": 24.868 },
      { "feature": "SoilCarbonPercent", "importance": 6.053 },
      { "feature": "CanopyCoverPercent", "importance": 0.150 }
    ]
  },
  "description": "Carbon Stock Estimation Model for predicting carbon sequestration in forest ecosystems",
  "inputRequirements": {
    "ndvi": { "min": 0.1, "max": 0.9, "description": "Normalized Difference Vegetation Index" },
    "canopyCoverPercent": { "min": 0, "max": 100, "description": "Canopy cover percentage" },
    "soilCarbonPercent": { "min": 0.5, "max": 8, "description": "Soil carbon content percentage" }
  },
  "output": {
    "unit": "tCO₂e/ha",
    "description": "Carbon sequestration in metric tons of CO₂ equivalent per hectare"
  }
}
```

### 3. Get Farmer Carbon History

**GET** `/api/carbon/history`

Retrieves the carbon prediction history for the authenticated farmer.

#### Response

```json
{
  "success": true,
  "data": {
    "farmerId": "farmer_123",
    "predictions": [
      {
        "timestamp": "2024-01-15T10:30:00.000Z",
        "input": {
          "ndvi": 0.7,
          "canopyCoverPercent": 75,
          "soilCarbonPercent": 3.5,
          "areaHectares": 10,
          "projectDurationYears": 5
        },
        "result": {
          "carbonSequestration": 25.42,
          "confidence": 0.95,
          "modelUsed": "Linear Regression v1.0",
          "timestamp": "2024-01-15T10:30:00.000Z",
          "inputData": { ... }
        },
        "credits": {
          "totalCredits": 1271.0,
          "valueUSD": 19065.0
        }
      }
    ],
    "totalCredits": 2542.0,
    "totalValueUSD": 38130.0,
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  }
}
```

### 4. Batch Predict Carbon

**POST** `/api/carbon/batch-predict`

Performs carbon predictions for multiple inputs in a single request.

#### Request Body

```json
{
  "predictions": [
    {
      "ndvi": 0.6,
      "canopyCoverPercent": 60,
      "soilCarbonPercent": 2.8
    },
    {
      "ndvi": 0.8,
      "canopyCoverPercent": 85,
      "soilCarbonPercent": 4.2
    }
  ]
}
```

#### Response

```json
{
  "success": true,
  "count": 2,
  "predictions": [
    {
      "carbonSequestration": 20.15,
      "confidence": 0.92,
      "modelUsed": "Linear Regression v1.0",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "inputData": { ... }
    },
    {
      "carbonSequestration": 30.78,
      "confidence": 0.96,
      "modelUsed": "Linear Regression v1.0",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "inputData": { ... }
    }
  ],
  "farmer": {
    "id": "farmer_123",
    "name": "John Doe"
  }
}
```

### 5. Get Carbon Statistics

**GET** `/api/carbon/statistics`

Retrieves aggregate statistics about carbon predictions across all farmers.

#### Response

```json
{
  "success": true,
  "statistics": {
    "totalPredictions": 150,
    "totalFarmers": 25,
    "averageCarbonSequestration": 22.45,
    "recentActivity": [
      {
        "farmerId": "farmer_123",
        "timestamp": "2024-01-15T10:30:00.000Z",
        "carbonSequestration": 25.42,
        "confidence": 0.95
      }
    ],
    "lastUpdated": "2024-01-15T10:30:00.000Z"
  }
}
```

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "message": "Invalid input parameters: NDVI must be between 0.1 and 0.9"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "message": "Authentication token required"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "message": "Farmer access required"
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "message": "Failed to calculate carbon prediction"
}
```

## Model Details

### Model Equation

```
Carbon Sequestration = -0.124 + 24.868 × NDVI + 0.150 × Canopy_Cover_Percent + 6.053 × Soil_Carbon_Percent
```

### Performance Metrics

- **R²**: 0.962 (Excellent predictive accuracy)
- **RMSE**: 2.921 tCO₂e/ha (Low prediction error)
- **MAE**: 2.291 tCO₂e/ha (Good precision)

### Feature Importance

1. **NDVI** (24.868): Most important feature - indicates vegetation health
2. **Soil Carbon** (6.053): Secondary importance - soil carbon reservoir
3. **Canopy Cover** (0.150): Supporting feature - structural indicator

## Usage Examples

### JavaScript/TypeScript

```typescript
import { CarbonPredictionInput } from '../shared/carbon';

async function predictCarbon(input: CarbonPredictionInput) {
  const response = await fetch('/api/carbon/predict', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });
  
  return await response.json();
}

// Example usage
const prediction = await predictCarbon({
  ndvi: 0.7,
  canopyCoverPercent: 75,
  soilCarbonPercent: 3.5,
  areaHectares: 10
});
```

### Python

```python
import requests

def predict_carbon(ndvi, canopy_cover, soil_carbon, area_hectares=None):
    url = "https://your-domain.com/api/carbon/predict"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    data = {
        "ndvi": ndvi,
        "canopyCoverPercent": canopy_cover,
        "soilCarbonPercent": soil_carbon
    }
    if area_hectares:
        data["areaHectares"] = area_hectares
    
    response = requests.post(url, json=data, headers=headers)
    return response.json()
```

## Rate Limits

- **Predict Endpoint**: 60 requests per minute per user
- **Batch Predict**: 10 requests per minute per user (max 100 predictions per batch)
- **Other Endpoints**: 120 requests per minute per user

## Data Validation

The API validates all input parameters:

- **NDVI**: Must be between 0.1 and 0.9
- **Canopy Cover**: Must be between 0 and 100
- **Soil Carbon**: Must be between 0.5 and 8
- **Area**: Must be positive if provided
- **Duration**: Must be positive if provided

## Carbon Credit Calculation

Carbon credits are calculated as:
- **Annual Credits**: Carbon Sequestration (tCO₂e/ha) × Area (ha)
- **Total Credits**: Annual Credits × Project Duration (years)
- **Monetary Value**: Total Credits × Credit Price ($15/credit by default)

## Versioning

The API is versioned through the model version. Current version: **v1.0**

## Support

For technical support or questions about the carbon estimation model, contact the development team or refer to the model documentation in `ml_models/workspace/carbon_model_final_report.md`.
