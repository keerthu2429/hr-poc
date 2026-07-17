"""
License/seat inventory tracking. Seats decrement only when an
Assign Applications task is APPROVED (not at AI-recommendation time),
matching the project-wide "nothing counts until a human approves it"
rule. When a pool CROSSES its configured threshold (not on every
approval while already below it), sends a real alert email to IT
(reuses the same SMTP infrastructure as the missing-document emails --
not simulated, this genuinely sends).
"""
import os
import datetime
from sqlalchemy.orm import Session
from app.models import SoftwareLicense
from app.config import get_licenses
from app import email_client

IT_TEAM_EMAIL = os.getenv("IT_TEAM_EMAIL", "")


def ensure_licenses_seeded(db: Session):
    existing_names = {row.name for row in db.query(SoftwareLicense).all()}
    for entry in get_licenses():
        if entry["name"] not in existing_names:
            db.add(SoftwareLicense(
                name=entry["name"], total_seats=entry["total_seats"],
                allocated_seats=0, threshold=entry.get("threshold", 5),
            ))
    db.commit()


def _send_low_seat_alert(license_row: SoftwareLicense):
    if not IT_TEAM_EMAIL:
        return
    remaining = license_row.total_seats - license_row.allocated_seats
    subject = f"Low license availability: {license_row.name}"
    body = (
        f"{license_row.name} has {remaining} seat(s) remaining out of {license_row.total_seats} "
        f"(alert threshold: {license_row.threshold}). Please arrange additional licenses if needed."
    )
    try:
        email_client.send_email(IT_TEAM_EMAIL, subject, body)
        license_row.last_alert_sent_at = datetime.datetime.utcnow()
    except email_client.EmailClientError:
        pass


def allocate_seats(db: Session, application_names: list[str]):
    ensure_licenses_seeded(db)
    for name in application_names:
        license_row = db.query(SoftwareLicense).filter(SoftwareLicense.name == name).first()
        if not license_row:
            continue

        remaining_before = license_row.total_seats - license_row.allocated_seats
        license_row.allocated_seats += 1
        remaining_after = license_row.total_seats - license_row.allocated_seats
        db.commit()

        crossed_into_low = remaining_before > license_row.threshold and remaining_after <= license_row.threshold
        if crossed_into_low:
            _send_low_seat_alert(license_row)
            db.commit()


def get_license_status(db: Session) -> list[dict]:
    ensure_licenses_seeded(db)
    rows = db.query(SoftwareLicense).all()
    return [
        {
            "name": r.name, "total_seats": r.total_seats, "allocated_seats": r.allocated_seats,
            "remaining": r.total_seats - r.allocated_seats, "threshold": r.threshold,
            "low": (r.total_seats - r.allocated_seats) <= r.threshold,
        }
        for r in rows
    ]