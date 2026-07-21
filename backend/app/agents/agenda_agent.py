"""
Generates a personalized first-day agenda for a new hire. This is NOT
tied to any real calendar/scheduling system (none exists in this app)
-- it's an AI-generated text schedule, tailored per role/department,
same pattern as team_intro_agent but for a fuller agenda rather than a
short blurb. One-way, no reply expected.
"""
from app.ai_client import call_ollama_json, OllamaError

PROMPT_TEMPLATE = """Write a personalized first-day agenda email for {name},
who is joining as {role} in the {department} department. Their manager is
{manager}. Create a realistic half-day-to-full-day schedule with
approximate times (e.g. 9:00 AM, 10:30 AM) covering: welcome/orientation,
IT/workstation setup, meeting their manager and team, and role-specific
onboarding activities relevant to {department}. Keep it concrete and
tailored to their actual department, not generic. Respond ONLY with JSON
in this exact shape:
{{"subject": "<email subject line>", "body": "<email body text with the agenda>"}}
"""


def _fallback_agenda(name: str, role: str, department: str, manager: str) -> dict:
    manager_name = manager or "your manager"
    return {
        "subject": f"Your First Day Agenda, {name}!",
        "body": (
            f"Hi {name},\n\nHere's your agenda for day one as {role} in {department}:\n\n"
            f"9:00 AM - Welcome & orientation with HR\n"
            f"10:00 AM - IT setup: laptop, accounts, and access\n"
            f"11:00 AM - Meet your manager, {manager_name}\n"
            f"12:00 PM - Lunch with the team\n"
            f"1:00 PM - Team introductions\n"
            f"2:00 PM - {department}-specific onboarding walkthrough\n"
            f"4:00 PM - Wrap-up and Q&A with HR\n\n"
            f"Welcome aboard!\nHR Team"
        ),
    }


def draft_first_day_agenda(name: str, role: str, department: str, manager: str) -> dict:
    try:
        result = call_ollama_json(PROMPT_TEMPLATE.format(
            name=name, role=role or "your new role", department=department or "your department",
            manager=manager or "your manager",
        ))
        if "subject" not in result or "body" not in result:
            raise OllamaError("missing expected keys in model output")
        return result
    except OllamaError:
        return _fallback_agenda(name, role, department, manager)
