#!/usr/bin/env python3
"""
Test OpenRouter API Key Integration
File: ai/test_openrouter.py
"""

import os
import json
import urllib.request
import urllib.parse
import urllib.error

def load_dotenv(path=None):
    """Load .env file without external dependencies."""
    path = path or os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

def test_openrouter():
    load_dotenv()
    
    api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY")
    base_url = os.environ.get("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    
    if not api_key:
        print("❌ ERROR: OPENROUTER_API_KEY is not set in .env")
        return False
        
    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    
    print("=" * 80)
    print("TESTING OPENROUTER API INTEGRATION (BikeSync AI Engine)")
    print(f"Endpoint: {endpoint}")
    print(f"API Key : {api_key[:12]}...{api_key[-4:]}")
    print("=" * 80)
    
    payload = {
        "model": "openai/gpt-4o-mini",
        "messages": [
            {
                "role": "system",
                "content": "You are BikeSync AI Assistant for EV Supply Chain Sourcing. Output valid JSON."
            },
            {
                "role": "user",
                "content": "Provide a 1-sentence assessment of alternative supplier Mekong Dynamics for PO-2026-003 (LFP Battery Cell). Output JSON: {\"supplier\": \"...\", \"status\": \"...\", \"assessment\": \"...\"}"
            }
        ],
        "temperature": 0.2
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://bikesync.ai",
        "X-Title": "BikeSync-AI-Worker"
    }
    
    try:
        req = urllib.request.Request(
            endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=30) as resp:
            status_code = resp.getcode()
            response_body = resp.read().decode("utf-8")
            data = json.loads(response_body)
            
            print(f"\n✅ HTTP Response Status: {status_code}")
            print("\nResponse Content:")
            choices = data.get("choices", [])
            if choices:
                content = choices[0].get("message", {}).get("content", "")
                print(content)
                print("\n✅ OpenRouter API call SUCCESSFUL!")
                return True
            else:
                print(f"Response json: {json.dumps(data, indent=2)}")
                return False
                
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8") if exc.fp else ""
        print(f"\n❌ HTTP Error {exc.code}: {body}")
        return False
    except Exception as exc:
        print(f"\n❌ Exception: {exc}")
        return False

if __name__ == "__main__":
    test_openrouter()
