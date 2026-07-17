"""Verify that the .env LLM configuration is loaded and the MiniMax endpoint works.

This script intentionally does **not** import `app.openai_handler` because that
module transitively imports `pyharmonics`, which currently has dependency
conflicts in this environment. Instead it reproduces the same client setup the
handler uses.
"""
import os
import sys

from dotenv import load_dotenv
from openai import OpenAI


def check_env():
    """Check that required environment variables are loaded."""
    load_dotenv()
    required = {
        "OPENAI_API_KEY": os.getenv("OPENAI_API_KEY"),
        "OPENAI_API_MODEL": os.getenv("OPENAI_API_MODEL"),
        "OPENAI_API_BASE_URL": os.getenv("OPENAI_API_BASE_URL"),
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        print(f"FAIL: missing env vars: {missing}")
        sys.exit(1)

    print("OK: .env loaded successfully")
    print(f"  OPENAI_API_MODEL={required['OPENAI_API_MODEL']}")
    print(f"  OPENAI_API_BASE_URL={required['OPENAI_API_BASE_URL']}")
    key_preview = required["OPENAI_API_KEY"][:15] + "..." + required["OPENAI_API_KEY"][-10:]
    print(f"  OPENAI_API_KEY={key_preview}")
    return required


def check_connectivity(config):
    """Make a minimal API call to verify connectivity."""
    client = OpenAI(
        api_key=config["OPENAI_API_KEY"],
        base_url=config["OPENAI_API_BASE_URL"],
    )
    print("OK: OpenAI client created with custom base_url")

    try:
        models = client.models.list()
        model_ids = [m.id for m in models.data]
        print(f"OK: models.list() returned {len(model_ids)} models")
        print(f"  Available models (first 10): {model_ids[:10]}")
    except Exception as e:
        print(f"WARN: models.list() failed: {e}")

    try:
        resp = client.chat.completions.create(
            model=config["OPENAI_API_MODEL"],
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=5,
        )
        content = resp.choices[0].message.content
        print("OK: chat.completions.create() succeeded")
        print(f"  Response snippet: {content!r}")
    except Exception as e:
        print(f"FAIL: chat.completions.create() failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    cfg = check_env()
    check_connectivity(cfg)
