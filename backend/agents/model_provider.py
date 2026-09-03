"""Model provider factory. Distinguishes REAL AI EXECUTION from LOCAL FIXTURE mode."""
from backend.config import MODEL_PROVIDER, ANTHROPIC_API_KEY, ANTHROPIC_MODEL_ID


def is_ai_enabled() -> bool:
    return MODEL_PROVIDER == "anthropic" and bool(ANTHROPIC_API_KEY)


def get_model():
    """Returns a Strands model instance, or None if running in fixture mode."""
    if not is_ai_enabled():
        return None
    from strands.models.anthropic import AnthropicModel
    return AnthropicModel(
        client_args={"api_key": ANTHROPIC_API_KEY},
        model_id=ANTHROPIC_MODEL_ID,
        max_tokens=1024,
    )
