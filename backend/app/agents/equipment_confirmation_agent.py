"""
Two jobs: (1) draft the equipment-confirmation email sent once IT
approves the Asset Allocation task, asking the employee to confirm
their equipment arrived and works, and (2) interpret whatever they
reply with -- acknowledged cleanly, or an issue reported (damaged,
missing, wrong item). Both go through Ollama with a rule-based
fallback, same as every other agent in this project.
"""
from app.ai_client import call_ollama_json, OllamaError

REQUEST_PROMPT_TEMPLATE = """Write a short, friendly email to {name} asking
them to confirm their equipment has arrived and is working. The equipment
assigned is: {asset_list}. Ask them to reply confirming receipt, or to
describe any problem (damaged, missing, or wrong item) if something's
wrong. Keep it under 100 words. Respond ONLY with JSON in this exact shape:
{{"subject": "<email subject line>", "body": "<email body text>"}}
"""

INTERPRET_PROMPT_TEMPLATE = """Read this reply to an equipment-confirmation
request and determine whether the employee acknowledged clean receipt, or
reported a problem (damaged/missing/wrong item). Reply text:
---
{raw_text}
---
Respond ONLY with JSON in this exact shape:
{{"acknowledged": true or false,
  "issue_summary": "<1 sentence describing the problem, or null if none>"}}
"""


def _fallback_request_template(name: str, asset_list: list[str]) -> dict:
    assets = ", ".join(asset_list) if asset_list else "your assigned equipment"
    return {
        "subject": "Please confirm your equipment arrived",
        "body": (
            f"Hi {name},\n\nJust checking in -- has the following equipment arrived and is it "
            f"working okay: {assets}?\n\nPlease reply to confirm, or let us know if anything is "
            f"damaged, missing, or incorrect so we can sort it out.\n\nThanks,\nIT Team"
        ),
    }


def draft_equipment_confirmation_email(name: str, asset_list: list[str]) -> dict:
    try:
        result = call_ollama_json(
            REQUEST_PROMPT_TEMPLATE.format(name=name, asset_list=", ".join(asset_list) or "your equipment")
        )
        if "subject" not in result or "body" not in result:
            raise OllamaError("missing expected keys in model output")
        return result
    except OllamaError:
        return _fallback_request_template(name, asset_list)


def _fallback_interpret(raw_text: str) -> dict:
    # No sentiment/intent model available in fallback -- look for a small
    # set of clear problem-indicating words; default to acknowledged
    # (the honest default when we can't tell) rather than assuming a
    # problem that wasn't actually reported.
    text_lower = (raw_text or "").lower()
    problem_words = ["damaged", "broken", "missing", "not working", "doesn't work", "wrong", "issue", "problem"]
    has_issue = any(w in text_lower for w in problem_words)
    return {
        "acknowledged": not has_issue,
        "issue_summary": raw_text.strip()[:200] if has_issue else None,
    }


def interpret_confirmation_reply(raw_text: str) -> dict:
    try:
        result = call_ollama_json(INTERPRET_PROMPT_TEMPLATE.format(raw_text=raw_text))
        if "acknowledged" not in result:
            raise OllamaError("missing expected keys in model output")
        return result
    except OllamaError:
        return _fallback_interpret(raw_text)
