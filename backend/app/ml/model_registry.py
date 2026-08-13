import os
import joblib
import json
from typing import Dict, Any, Optional

class ModelNotConfiguredException(Exception):
    pass

# Simple memory cache for loaded models
_MODEL_CACHE: Dict[str, Any] = {}

def get_model_path(model_name: str) -> str:
    """Get the absolute filepath for a saved model file in models/ directory."""
    # Resolve against the root workspace directory
    # Workspace root is typically the current working directory or we can construct it
    cwd = os.getcwd()
    filename = f"{model_name.lower()}_model.pkl"
    return os.path.join(cwd, "models", filename)

def load_ml_model(model_name: str) -> Any:
    """
    Load a model from disk or return cached version.
    Raises ModelNotConfiguredException if model file is missing.
    """
    model_name_upper = model_name.upper()
    if model_name_upper in _MODEL_CACHE:
        return _MODEL_CACHE[model_name_upper]
        
    path = get_model_path(model_name_upper)
    
    if not os.path.exists(path):
        raise ModelNotConfiguredException(
            f"{model_name_upper.capitalize()} model is not configured. "
            f"Please ensure the trained pipeline model file is placed at: models/{model_name_upper.lower()}_model.pkl"
        )
        
    try:
        model = joblib.load(path)
        _MODEL_CACHE[model_name_upper] = model
        return model
    except Exception as e:
        raise ModelNotConfiguredException(
            f"Error loading {model_name_upper.capitalize()} model from models directory: {str(e)}"
        )

def get_model_metrics() -> Dict[str, Any]:
    """Retrieve evaluation metrics for all trained models from models/metrics.json."""
    cwd = os.getcwd()
    metrics_path = os.path.join(cwd, "models", "metrics.json")
    if not os.path.exists(metrics_path):
        return {}
        
    try:
        with open(metrics_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"Failed to read model metrics file: {str(e)}")
        return {}
