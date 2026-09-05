"""SYNTRA configuration. All values from environment — no hardcoded secrets."""
import os
from dotenv import load_dotenv

load_dotenv()

DB_PATH = os.getenv("SYNTRA_DB_PATH", "syntra.db")

# Model provider: "anthropic" (real AI) or "fixture" (local testing, no API calls)
MODEL_PROVIDER = os.getenv("SYNTRA_MODEL_PROVIDER", "fixture")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL_ID = os.getenv("SYNTRA_MODEL_ID", "claude-sonnet-4-5-20250929")

CORS_ORIGINS = os.getenv(
    "SYNTRA_CORS_ORIGINS",
    "http://localhost:5173,https://syntra-vert-nine.vercel.app",
).split(",")
