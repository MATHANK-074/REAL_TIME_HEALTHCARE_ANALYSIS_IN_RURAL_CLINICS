import os
import joblib
import json
from typing import Dict, Any, Optional

# ---------------------------------------------------------------------------
# Sklearn 1.7+ compatibility shim
# Models saved with sklearn 1.6.x use ColumnTransformer internals that
# reference _RemainderColsList, which was removed in sklearn 1.7.
# Injecting a lightweight shim lets joblib.load() succeed without modifying
# the original .pkl artifacts.
# ---------------------------------------------------------------------------
import sklearn.compose._column_transformer as _ct_module
if not hasattr(_ct_module, '_RemainderColsList'):
    class _RemainderColsList(list):
        """Compatibility shim for sklearn < 1.7 ColumnTransformer models."""
        def __init__(self, *args, **kwargs):
            super().__init__(*args)
            for k, v in kwargs.items():
                setattr(self, k, v)
        def __reduce__(self):
            return (self.__class__, (list(self),))
    _ct_module._RemainderColsList = _RemainderColsList
# ---------------------------------------------------------------------------

class ModelNotConfiguredException(Exception):
    pass

# Simple memory cache for loaded models
_MODEL_CACHE: Dict[str, Any] = {}

# Filename overrides for models that do not follow the {name}_model.pkl pattern
_MODEL_FILENAME_MAP: Dict[str, str] = {
    "HEART_DISEASE": "heart_disease_risk_model.pkl",
}

def get_model_path(model_name: str) -> str:
    """Get the absolute filepath for a saved model file in models/ directory."""
    # Resolve: backend/app/ml/model_registry.py -> ml/ -> app/ -> backend/ -> project-root/
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    model_key = model_name.upper()
    filename = _MODEL_FILENAME_MAP.get(model_key, f"{model_name.lower()}_model.pkl")
    return os.path.join(project_root, "models", filename)

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
