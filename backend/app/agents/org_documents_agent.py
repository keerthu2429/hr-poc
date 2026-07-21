"""
Drafts the email sharing organizational policy documents with a new
hire (the full set, every employee gets the same list -- confirmed
scope, not a per-employee AI-filtered subset). Reads the actual files
in backend/policies/ so the list never drifts from what's really
there. One-way, no reply expected -- same shape as welcome_email_agent.
"""
import os

from app.ai_client import call_ollama_json, OllamaError

POLICIES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "policies")

REQUEST_PROMPT_TEMPLATE = """Write a short, friendly email to {name} sharing
the company's key policy documents as part of onboarding. List these
documents by name: {doc_titles}. Briefly mention they should review these
at their own pace and reach out to HR with any questions. Keep it under
100 words. Respond ONLY with JSON in this exact shape:
{{"subject": "<email subject line>", "body": "<email body text>"}}
"""


def _titleize(filename: str) -> str:
    """'benefits-policy.md' -> 'Benefits Policy'"""
    name = os.path.splitext(filename)[0]
    return name.replace("-", " ").replace("_", " ").title()


def get_policy_document_titles() -> list[str]:
    """The full, real list of organizational documents to share --
    every new hire gets this same set (confirmed scope). Reading the
    actual directory (rather than a hardcoded list) means this never
    drifts from what's actually in backend/policies/."""
    if not os.path.isdir(POLICIES_DIR):
        return []
    return sorted(_titleize(f) for f in os.listdir(POLICIES_DIR) if f.endswith(".md"))


def get_policy_document_paths() -> list[str]:
    """Full local file paths for the same set get_policy_document_titles
    describes -- used to actually attach the real files to the email,
    not just name them in the body text."""
    if not os.path.isdir(POLICIES_DIR):
        return []
    return sorted(
        os.path.join(POLICIES_DIR, f) for f in os.listdir(POLICIES_DIR) if f.endswith(".md")
    )


def _fallback_request_template(name: str, doc_titles: list[str]) -> dict:
    doc_list = "\n".join(f"- {d}" for d in doc_titles)
    return {
        "subject": "Your Onboarding Policy Documents",
        "body": (
            f"Hi {name},\n\nAs part of onboarding, please review the following company policy "
            f"documents at your own pace:\n{doc_list}\n\nReach out to HR if you have any questions.\n\n"
            f"Thanks,\nHR Team"
        ),
    }


def draft_org_documents_email(name: str, doc_titles: list[str]) -> dict:
    try:
        result = call_ollama_json(REQUEST_PROMPT_TEMPLATE.format(name=name, doc_titles=", ".join(doc_titles)))
        if "subject" not in result or "body" not in result:
            raise OllamaError("missing expected keys in model output")
        return result
    except OllamaError:
        return _fallback_request_template(name, doc_titles)
