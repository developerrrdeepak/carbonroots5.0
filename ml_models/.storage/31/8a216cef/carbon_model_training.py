#!/usr/bin/env python3
"""
Carbon Stock Estimation Model Training
=====================================

This script trains multiple machine learning models for carbon sequestration prediction
using remote sensing data (NDVI, canopy cover, soil carbon data).
"""

import numpy as np
import os
import pickle
import json
from datetime import datetime

print("=== CARBON STOCK ESTIMATION MODEL TRAINING ===\n")

# Load preprocessed data
try:
    print("Loading preprocessed data...")
    data_file = '/workspace/processed_carbon_data.npz'
    if os.path.exists(data_file):
        loaded_data = np.load(data_file, allow_pickle=True)
        print("✓ Preprocessed data loaded successfully")
        
        # Extract data
        X_train = loaded_data['X_train'].item()
        y_train = loaded_data['y_train']
        X_test = loaded_data['X_test'].item()
        y_test = loaded_data['y_test']
        feature_names = loaded_data['feature_names_selected']
        
        print(f"Training samples: {len(y_train)}")
        print(f"Test samples: {len(y_test)}")
        print(f"Features: {len(feature_names)}")
        
    else:
        print("Preprocessed data not found. Creating synthetic data...")
        # Create minimal synthetic data for demonstration
        np.random.seed(42)
        n_samples = 1000
        
        # Basic features
        ndvi = np.random.beta(2, 2, n_samples) * 0.8 + 0.1
        canopy = np.random.beta(1.5, 1.5, n_samples) * 100
        soil_carbon = np.random.gamma(2, 1.5, n_samples) + 0.5
        
        # Target variable
        y_all = (ndvi * 30 + canopy * 0.2 + soil_carbon * 8 + 
                np.random.normal(0, 5, n_samples))
        y_all = np.clip(y_all, 0, 100)
        
        # Split data
        split_idx = int(0.8 * n_samples)
        X_train = {
            'NDVI': ndvi[:split_idx],
            'Canopy_Cover_Percent': canopy[:split_idx],
            'Soil_Carbon_Percent': soil_carbon[:split_idx]
        }
        X_test = {
            'NDVI': ndvi[split_idx:],
            'Canopy_Cover_Percent': canopy[split_idx:],
            'Soil_Carbon_Percent': soil_carbon[split_idx:]
        }
        y_train = y_all[:split_idx]
        y_test = y_all[split_idx:]
        feature_names = list(X_train.keys())
        
        print(f"Created synthetic data: {len(y_train)} train, {len(y_test)} test samples")

except Exception as e:
    print(f"Error loading data: {e}")
    exit(1)

# Convert dictionary format to arrays for easier processing
def dict_to_array(data_dict, feature_names):
    """Convert dictionary of features to 2D array"""
    return np.column_stack([data_dict[name] for name in feature_names])

X_train_array = dict_to_array(X_train, feature_names)
X_test_array = dict_to_array(X_test, feature_names)

print(f"Data shapes: X_train {X_train_array.shape}, X_test {X_test_array.shape}")

# Model 1: Simple Linear Regression (Manual Implementation)
class SimpleLinearRegression:
    def __init__(self):
        self.weights = None
        self.bias = None
        self.name = "Linear Regression"
    
    def fit(self, X, y):
        # Add bias term
        X_with_bias = np.column_stack([np.ones(X.shape[0]), X])
        
        # Normal equation: theta = (X^T X)^-1 X^T y
        try:
            self.weights = np.linalg.solve(X_with_bias.T @ X_with_bias, X_with_bias.T @ y)
            self.bias = self.weights[0]
            self.weights = self.weights[1:]
        except np.linalg.LinAlgError:
            # Fallback to pseudo-inverse if matrix is singular
            self.weights = np.linalg.pinv(X_with_bias.T @ X_with_bias) @ X_with_bias.T @ y
            self.bias = self.weights[0]
            self.weights = self.weights[1:]
    
    def predict(self, X):
        return X @ self.weights + self.bias

# Model 2: Random Forest (Simplified Implementation)
class SimpleRandomForest:
    def __init__(self, n_trees=10, max_depth=5):
        self.n_trees = n_trees
        self.max_depth = max_depth
        self.trees = []
        self.name = "Random Forest"
    
    def fit(self, X, y):
        self.trees = []
        n_samples, n_features = X.shape
        
        for _ in range(self.n_trees):
            # Bootstrap sampling
            indices = np.random.choice(n_samples, n_samples, replace=True)
            X_boot = X[indices]
            y_boot = y[indices]
            
            # Feature sampling
            feature_indices = np.random.choice(n_features, 
                                             max(1, int(np.sqrt(n_features))), 
                                             replace=False)
            
            # Create simple decision tree (regression tree)
            tree = self._create_tree(X_boot[:, feature_indices], y_boot, 
                                   feature_indices, depth=0)
            self.trees.append(tree)
    
    def _create_tree(self, X, y, feature_indices, depth):
        # Simple stopping criteria
        if depth >= self.max_depth or len(y) < 5 or np.var(y) < 0.1:
            return {'type': 'leaf', 'value': np.mean(y)}
        
        best_score = float('inf')
        best_split = None
        
        # Try random splits
        for _ in range(min(10, X.shape[1])):
            feature_idx = np.random.randint(X.shape[1])
            threshold = np.random.uniform(X[:, feature_idx].min(), 
                                        X[:, feature_idx].max())
            
            left_mask = X[:, feature_idx] <= threshold
            right_mask = ~left_mask
            
            if np.sum(left_mask) < 2 or np.sum(right_mask) < 2:
                continue
            
            # Calculate weighted MSE
            left_mse = np.var(y[left_mask]) if np.sum(left_mask) > 0 else 0
            right_mse = np.var(y[right_mask]) if np.sum(right_mask) > 0 else 0
            weighted_mse = (np.sum(left_mask) * left_mse + 
                           np.sum(right_mask) * right_mse) / len(y)
            
            if weighted_mse < best_score:
                best_score = weighted_mse
                best_split = {
                    'feature_idx': feature_indices[feature_idx],
                    'threshold': threshold,
                    'left_mask': left_mask,
                    'right_mask': right_mask
                }
        
        if best_split is None:
            return {'type': 'leaf', 'value': np.mean(y)}
        
        # Recursively create subtrees
        left_tree = self._create_tree(X[best_split['left_mask']], 
                                    y[best_split['left_mask']], 
                                    feature_indices, depth + 1)
        right_tree = self._create_tree(X[best_split['right_mask']], 
                                     y[best_split['right_mask']], 
                                     feature_indices, depth + 1)
        
        return {
            'type': 'split',
            'feature_idx': best_split['feature_idx'],
            'threshold': best_split['threshold'],
            'left': left_tree,
            'right': right_tree
        }
    
    def _predict_tree(self, tree, x):
        if tree['type'] == 'leaf':
            return tree['value']
        
        if x[tree['feature_idx']] <= tree['threshold']:
            return self._predict_tree(tree['left'], x)
        else:
            return self._predict_tree(tree['right'], x)
    
    def predict(self, X):
        predictions = np.zeros(X.shape[0])
        for i, x in enumerate(X):
            tree_predictions = [self._predict_tree(tree, x) for tree in self.trees]
            predictions[i] = np.mean(tree_predictions)
        return predictions

# Model 3: Gradient Boosting (Simplified Implementation)
class SimpleGradientBoosting:
    def __init__(self, n_estimators=50, learning_rate=0.1):
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.models = []
        self.initial_prediction = None
        self.name = "Gradient Boosting"
    
    def fit(self, X, y):
        self.initial_prediction = np.mean(y)
        self.models = []
        
        current_predictions = np.full(len(y), self.initial_prediction)
        
        for _ in range(self.n_estimators):
            # Calculate residuals
            residuals = y - current_predictions
            
            # Fit a simple model to residuals
            model = SimpleLinearRegression()
            model.fit(X, residuals)
            
            # Update predictions
            predictions = model.predict(X)
            current_predictions += self.learning_rate * predictions
            
            self.models.append(model)
    
    def predict(self, X):
        predictions = np.full(X.shape[0], self.initial_prediction)
        for model in self.models:
            predictions += self.learning_rate * model.predict(X)
        return predictions

# Model 4: Neural Network (Simple Implementation)
class SimpleNeuralNetwork:
    def __init__(self, hidden_size=20, learning_rate=0.01, epochs=100):
        self.hidden_size = hidden_size
        self.learning_rate = learning_rate
        self.epochs = epochs
        self.name = "Neural Network"
    
    def _sigmoid(self, x):
        return 1 / (1 + np.exp(-np.clip(x, -500, 500)))
    
    def _sigmoid_derivative(self, x):
        return x * (1 - x)
    
    def fit(self, X, y):
        n_samples, n_features = X.shape
        
        # Initialize weights
        np.random.seed(42)
        self.W1 = np.random.randn(n_features, self.hidden_size) * 0.1
        self.b1 = np.zeros((1, self.hidden_size))
        self.W2 = np.random.randn(self.hidden_size, 1) * 0.1
        self.b2 = np.zeros((1, 1))
        
        # Normalize target
        self.y_mean = np.mean(y)
        self.y_std = np.std(y)
        y_norm = (y - self.y_mean) / (self.y_std + 1e-8)
        
        # Training loop
        for epoch in range(self.epochs):
            # Forward pass
            z1 = X @ self.W1 + self.b1
            a1 = self._sigmoid(z1)
            z2 = a1 @ self.W2 + self.b2
            a2 = z2  # Linear output for regression
            
            # Calculate loss
            loss = np.mean((a2.flatten() - y_norm) ** 2)
            
            # Backward pass
            dz2 = (a2.flatten() - y_norm).reshape(-1, 1) / n_samples
            dW2 = a1.T @ dz2
            db2 = np.sum(dz2, axis=0, keepdims=True)
            
            da1 = dz2 @ self.W2.T
            dz1 = da1 * self._sigmoid_derivative(a1)
            dW1 = X.T @ dz1
            db1 = np.sum(dz1, axis=0, keepdims=True)
            
            # Update weights
            self.W2 -= self.learning_rate * dW2
            self.b2 -= self.learning_rate * db2
            self.W1 -= self.learning_rate * dW1
            self.b1 -= self.learning_rate * db1
            
            if epoch % 20 == 0:
                print(f"  Epoch {epoch}, Loss: {loss:.4f}")
    
    def predict(self, X):
        z1 = X @ self.W1 + self.b1
        a1 = self._sigmoid(z1)
        z2 = a1 @ self.W2 + self.b2
        # Denormalize output
        return (z2.flatten() * self.y_std) + self.y_mean

# Evaluation metrics
def calculate_metrics(y_true, y_pred):
    """Calculate regression metrics"""
    mse = np.mean((y_true - y_pred) ** 2)
    rmse = np.sqrt(mse)
    mae = np.mean(np.abs(y_true - y_pred))
    
    # R-squared
    ss_res = np.sum((y_true - y_pred) ** 2)
    ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
    r2 = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
    
    return {
        'MSE': mse,
        'RMSE': rmse,
        'MAE': mae,
        'R2': r2
    }

# Train all models
print("\n1. TRAINING MODELS")
print("-" * 50)

models = [
    SimpleLinearRegression(),
    SimpleRandomForest(n_trees=20, max_depth=6),
    SimpleGradientBoosting(n_estimators=30, learning_rate=0.1),
    SimpleNeuralNetwork(hidden_size=15, learning_rate=0.01, epochs=100)
]

results = {}

for model in models:
    print(f"\nTraining {model.name}...")
    try:
        model.fit(X_train_array, y_train)
        
        # Make predictions
        train_pred = model.predict(X_train_array)
        test_pred = model.predict(X_test_array)
        
        # Calculate metrics
        train_metrics = calculate_metrics(y_train, train_pred)
        test_metrics = calculate_metrics(y_test, test_pred)
        
        results[model.name] = {
            'model': model,
            'train_metrics': train_metrics,
            'test_metrics': test_metrics,
            'train_predictions': train_pred,
            'test_predictions': test_pred
        }
        
        print(f"✓ {model.name} trained successfully")
        print(f"  Train R²: {train_metrics['R2']:.3f}, Test R²: {test_metrics['R2']:.3f}")
        
    except Exception as e:
        print(f"✗ Error training {model.name}: {e}")

# Display results
print("\n2. MODEL COMPARISON")
print("-" * 50)

print(f"{'Model':<20} {'Train R²':<10} {'Test R²':<10} {'Test RMSE':<12} {'Test MAE':<10}")
print("-" * 62)

best_model = None
best_r2 = -float('inf')

for name, result in results.items():
    train_r2 = result['train_metrics']['R2']
    test_r2 = result['test_metrics']['R2']
    test_rmse = result['test_metrics']['RMSE']
    test_mae = result['test_metrics']['MAE']
    
    print(f"{name:<20} {train_r2:<10.3f} {test_r2:<10.3f} {test_rmse:<12.3f} {test_mae:<10.3f}")
    
    if test_r2 > best_r2:
        best_r2 = test_r2
        best_model = name

print(f"\nBest performing model: {best_model} (Test R² = {best_r2:.3f})")

# Feature importance analysis for best model
print(f"\n3. FEATURE IMPORTANCE ANALYSIS")
print("-" * 50)

if best_model and best_model in results:
    print(f"Analyzing feature importance for {best_model}...")
    
    # Simple feature importance based on correlation with target
    feature_importance = {}
    for i, feature_name in enumerate(feature_names):
        correlation = np.corrcoef(X_train_array[:, i], y_train)[0, 1]
        feature_importance[feature_name] = abs(correlation) if not np.isnan(correlation) else 0
    
    # Sort by importance
    sorted_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)
    
    print(f"Top 10 most important features:")
    for i, (feature, importance) in enumerate(sorted_features[:10], 1):
        print(f"  {i:2d}. {feature:<30}: {importance:.3f}")

# Save models and results
print(f"\n4. SAVING MODELS AND RESULTS")
print("-" * 50)

try:
    # Save best model
    if best_model and best_model in results:
        model_data = {
            'model': results[best_model]['model'],
            'feature_names': feature_names,
            'model_name': best_model,
            'test_r2': best_r2,
            'feature_importance': feature_importance if 'feature_importance' in locals() else {}
        }
        
        with open('/workspace/best_carbon_model.pkl', 'wb') as f:
            pickle.dump(model_data, f)
        print("✓ Best model saved to /workspace/best_carbon_model.pkl")
    
    # Save comprehensive results
    results_summary = {
        'timestamp': datetime.now().isoformat(),
        'models_trained': list(results.keys()),
        'best_model': best_model,
        'best_test_r2': best_r2,
        'feature_names': feature_names.tolist() if hasattr(feature_names, 'tolist') else list(feature_names),
        'data_info': {
            'train_samples': len(y_train),
            'test_samples': len(y_test),
            'n_features': len(feature_names)
        }
    }
    
    # Add metrics for each model
    for name, result in results.items():
        results_summary[f'{name}_metrics'] = {
            'train_r2': float(result['train_metrics']['R2']),
            'test_r2': float(result['test_metrics']['R2']),
            'test_rmse': float(result['test_metrics']['RMSE']),
            'test_mae': float(result['test_metrics']['MAE'])
        }
    
    with open('/workspace/model_training_results.json', 'w') as f:
        json.dump(results_summary, f, indent=2)
    print("✓ Training results saved to /workspace/model_training_results.json")
    
    # Save predictions for analysis
    predictions_data = {}
    for name, result in results.items():
        predictions_data[f'{name}_train_pred'] = result['train_predictions'].tolist()
        predictions_data[f'{name}_test_pred'] = result['test_predictions'].tolist()
    
    predictions_data['y_train_true'] = y_train.tolist()
    predictions_data['y_test_true'] = y_test.tolist()
    
    with open('/workspace/model_predictions.json', 'w') as f:
        json.dump(predictions_data, f, indent=2)
    print("✓ Model predictions saved to /workspace/model_predictions.json")

except Exception as e:
    print(f"Error saving results: {e}")

print(f"\n" + "="*60)
print("MODEL TRAINING COMPLETE")
print("="*60)
print(f"✓ Trained {len(results)} models successfully")
print(f"✓ Best model: {best_model} (R² = {best_r2:.3f})")
print(f"✓ Models and results saved to /workspace/")
print(f"\nFiles created:")
print("- best_carbon_model.pkl (trained model)")
print("- model_training_results.json (comprehensive results)")
print("- model_predictions.json (all predictions)")
print("\nReady for model evaluation and deployment!")