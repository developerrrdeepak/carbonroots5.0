#!/usr/bin/env python3
"""
Simple Carbon Stock Estimation Model
===================================

A basic implementation without external dependencies for demonstration.
"""

import math
import json
import os
from datetime import datetime

print("=== SIMPLE CARBON STOCK ESTIMATION MODEL ===\n")

# Create synthetic data for demonstration
def create_synthetic_data():
    """Create synthetic carbon stock data"""
    print("Creating synthetic carbon stock data...")
    
    # Simple random number generator (Linear Congruential Generator)
    class SimpleRandom:
        def __init__(self, seed=42):
            self.seed = seed
        
        def random(self):
            self.seed = (self.seed * 1103515245 + 12345) % (2**31)
            return self.seed / (2**31)
        
        def normal(self, mean=0, std=1):
            # Box-Muller transform
            if not hasattr(self, '_spare'):
                u1 = self.random()
                u2 = self.random()
                self._spare = math.sqrt(-2 * math.log(u1)) * math.sin(2 * math.pi * u2)
                return mean + std * math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
            else:
                spare = self._spare
                del self._spare
                return mean + std * spare
    
    rng = SimpleRandom(42)
    n_samples = 1000
    
    # Generate features
    data = {
        'NDVI': [],
        'Canopy_Cover_Percent': [],
        'Soil_Carbon_Percent': [],
        'Carbon_Sequestration_tCO2e_ha': []
    }
    
    for i in range(n_samples):
        # NDVI (0.1 to 0.9)
        ndvi = 0.1 + rng.random() * 0.8
        
        # Canopy cover (0 to 100%)
        canopy = rng.random() * 100
        
        # Soil carbon (0.5 to 8%)
        soil_carbon = 0.5 + rng.random() * 7.5
        
        # Carbon sequestration with realistic relationships
        carbon_seq = (ndvi * 25 + canopy * 0.15 + soil_carbon * 6 + 
                     rng.normal(0, 3))
        carbon_seq = max(0, min(carbon_seq, 100))  # Clip to realistic range
        
        data['NDVI'].append(ndvi)
        data['Canopy_Cover_Percent'].append(canopy)
        data['Soil_Carbon_Percent'].append(soil_carbon)
        data['Carbon_Sequestration_tCO2e_ha'].append(carbon_seq)
    
    return data

# Simple linear regression implementation
class SimpleLinearModel:
    def __init__(self):
        self.weights = None
        self.bias = None
        self.feature_names = None
    
    def fit(self, X, y):
        """Fit linear regression using normal equations"""
        n_samples = len(y)
        n_features = len(X[0])
        
        # Create design matrix with bias term
        X_matrix = []
        for i in range(n_samples):
            row = [1.0] + X[i]  # Add bias term
            X_matrix.append(row)
        
        # Solve normal equations: (X^T X) w = X^T y
        # First compute X^T X
        XTX = [[0.0 for _ in range(n_features + 1)] for _ in range(n_features + 1)]
        for i in range(n_features + 1):
            for j in range(n_features + 1):
                for k in range(n_samples):
                    XTX[i][j] += X_matrix[k][i] * X_matrix[k][j]
        
        # Compute X^T y
        XTy = [0.0 for _ in range(n_features + 1)]
        for i in range(n_features + 1):
            for k in range(n_samples):
                XTy[i] += X_matrix[k][i] * y[k]
        
        # Solve linear system using Gaussian elimination
        weights = self._solve_linear_system(XTX, XTy)
        
        self.bias = weights[0]
        self.weights = weights[1:]
    
    def _solve_linear_system(self, A, b):
        """Solve Ax = b using Gaussian elimination"""
        n = len(b)
        
        # Forward elimination
        for i in range(n):
            # Find pivot
            max_row = i
            for k in range(i + 1, n):
                if abs(A[k][i]) > abs(A[max_row][i]):
                    max_row = k
            
            # Swap rows
            A[i], A[max_row] = A[max_row], A[i]
            b[i], b[max_row] = b[max_row], b[i]
            
            # Make all rows below this one 0 in current column
            for k in range(i + 1, n):
                if abs(A[i][i]) < 1e-10:
                    continue
                factor = A[k][i] / A[i][i]
                for j in range(i, n):
                    A[k][j] -= factor * A[i][j]
                b[k] -= factor * b[i]
        
        # Back substitution
        x = [0.0 for _ in range(n)]
        for i in range(n - 1, -1, -1):
            x[i] = b[i]
            for j in range(i + 1, n):
                x[i] -= A[i][j] * x[j]
            if abs(A[i][i]) > 1e-10:
                x[i] /= A[i][i]
        
        return x
    
    def predict(self, X):
        """Make predictions"""
        predictions = []
        for x in X:
            pred = self.bias
            for i, weight in enumerate(self.weights):
                pred += weight * x[i]
            predictions.append(pred)
        return predictions

# Evaluation metrics
def calculate_metrics(y_true, y_pred):
    """Calculate regression metrics"""
    n = len(y_true)
    
    # MSE and RMSE
    mse = sum((y_true[i] - y_pred[i])**2 for i in range(n)) / n
    rmse = math.sqrt(mse)
    
    # MAE
    mae = sum(abs(y_true[i] - y_pred[i]) for i in range(n)) / n
    
    # R-squared
    y_mean = sum(y_true) / n
    ss_tot = sum((y_true[i] - y_mean)**2 for i in range(n))
    ss_res = sum((y_true[i] - y_pred[i])**2 for i in range(n))
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
    
    return {
        'MSE': mse,
        'RMSE': rmse,
        'MAE': mae,
        'R2': r2
    }

# Main execution
def main():
    # Create synthetic data
    data = create_synthetic_data()
    print(f"✓ Created {len(data['NDVI'])} samples")
    
    # Prepare features and target
    feature_names = ['NDVI', 'Canopy_Cover_Percent', 'Soil_Carbon_Percent']
    X = []
    y = data['Carbon_Sequestration_tCO2e_ha']
    
    for i in range(len(y)):
        features = [data[name][i] for name in feature_names]
        X.append(features)
    
    # Split data (80% train, 20% test)
    split_idx = int(0.8 * len(y))
    X_train = X[:split_idx]
    X_test = X[split_idx:]
    y_train = y[:split_idx]
    y_test = y[split_idx:]
    
    print(f"✓ Split data: {len(X_train)} train, {len(X_test)} test samples")
    
    # Train model
    print("\nTraining Carbon Stock Estimation Model...")
    model = SimpleLinearModel()
    model.feature_names = feature_names
    model.fit(X_train, y_train)
    
    # Make predictions
    train_pred = model.predict(X_train)
    test_pred = model.predict(X_test)
    
    # Calculate metrics
    train_metrics = calculate_metrics(y_train, train_pred)
    test_metrics = calculate_metrics(y_test, test_pred)
    
    print("✓ Model trained successfully!")
    
    # Display results
    print(f"\nMODEL PERFORMANCE:")
    print(f"Training R²:   {train_metrics['R2']:.3f}")
    print(f"Training RMSE: {train_metrics['RMSE']:.3f}")
    print(f"Test R²:       {test_metrics['R2']:.3f}")
    print(f"Test RMSE:     {test_metrics['RMSE']:.3f}")
    print(f"Test MAE:      {test_metrics['MAE']:.3f}")
    
    # Display model coefficients
    print(f"\nMODEL COEFFICIENTS:")
    print(f"Bias: {model.bias:.3f}")
    for i, name in enumerate(feature_names):
        print(f"{name}: {model.weights[i]:.3f}")
    
    # Feature importance (absolute coefficients)
    importance = [(name, abs(model.weights[i])) for i, name in enumerate(feature_names)]
    importance.sort(key=lambda x: x[1], reverse=True)
    
    print(f"\nFEATURE IMPORTANCE:")
    for name, imp in importance:
        print(f"{name}: {imp:.3f}")
    
    # Save results
    results = {
        'timestamp': datetime.now().isoformat(),
        'model_type': 'Linear Regression',
        'feature_names': feature_names,
        'model_coefficients': {
            'bias': model.bias,
            'weights': dict(zip(feature_names, model.weights))
        },
        'performance_metrics': {
            'train_r2': train_metrics['R2'],
            'train_rmse': train_metrics['RMSE'],
            'test_r2': test_metrics['R2'],
            'test_rmse': test_metrics['RMSE'],
            'test_mae': test_metrics['MAE']
        },
        'feature_importance': dict(importance),
        'data_info': {
            'total_samples': len(y),
            'train_samples': len(y_train),
            'test_samples': len(y_test),
            'features': len(feature_names)
        }
    }
    
    # Save to file
    try:
        with open('/workspace/carbon_model_results.json', 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n✓ Results saved to /workspace/carbon_model_results.json")
        
        # Save sample predictions
        predictions = {
            'sample_predictions': [
                {
                    'NDVI': X_test[i][0],
                    'Canopy_Cover_Percent': X_test[i][1],
                    'Soil_Carbon_Percent': X_test[i][2],
                    'actual_carbon_sequestration': y_test[i],
                    'predicted_carbon_sequestration': test_pred[i]
                }
                for i in range(min(10, len(X_test)))
            ]
        }
        
        with open('/workspace/sample_predictions.json', 'w') as f:
            json.dump(predictions, f, indent=2)
        print(f"✓ Sample predictions saved to /workspace/sample_predictions.json")
        
    except Exception as e:
        print(f"Error saving results: {e}")
    
    print(f"\n" + "="*60)
    print("CARBON STOCK ESTIMATION MODEL COMPLETE")
    print("="*60)
    print(f"✓ Model trained with R² = {test_metrics['R2']:.3f}")
    print(f"✓ RMSE = {test_metrics['RMSE']:.3f} tCO₂e/ha")
    print(f"✓ Results saved to /workspace/")
    print(f"\nModel Equation:")
    equation = f"Carbon Sequestration = {model.bias:.2f}"
    for i, name in enumerate(feature_names):
        equation += f" + {model.weights[i]:.2f} × {name}"
    print(equation)
    
    return model, results

if __name__ == "__main__":
    model, results = main()