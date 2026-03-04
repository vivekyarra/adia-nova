"""Quick local sanity check for Bedrock Nova access."""

from __future__ import annotations

import os

from dotenv import load_dotenv

from services.nova_client import NovaCallBudget, NovaClient

load_dotenv()

nova_client = NovaClient(
    aws_region=os.getenv("AWS_REGION", ""),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)

response = nova_client.ask_nova(
    "Explain agentic AI in 4 bullet points for a hackathon demo.",
    budget=NovaCallBudget(max_calls=3),
    system_prompt="You are a helpful AI mentor.",
    max_tokens=220,
)

print("\nNOVA RESPONSE:\n")
print(response)
