"""Outbound email (Resend) and push (Expo). Both are best-effort: a failure is logged and reported
back as False so the invitation still exists and the therapist can share the code by hand."""
import logging

import httpx

log = logging.getLogger(__name__)
TIMEOUT = 8.0


def send_invite_email(app_config, *, to: str, therapist_name: str, code: str, link: str, existing_user: bool) -> bool:
    key = app_config.get("RESEND_API_KEY")
    if not key:
        log.info("RESEND_API_KEY not set; skipping invite email to %s", to)
        return False
    pretty = f"{code[:4]}-{code[4:]}"
    if existing_user:
        action = (
            "You already have the Kinetic app. Open it and you'll see this invitation on your home screen "
            "- tap Accept to connect."
        )
    else:
        action = (
            "1. Install the Kinetic app and create an account with THIS email address.\n"
            "2. Confirm your email (we'll send you a confirmation link).\n"
            "3. Tap the button below, or enter your invite code in the app."
        )
    text = (
        f"{therapist_name} invited you to connect on Kinetic so they can guide your home exercise program.\n\n"
        f"{action}\n\nYour invite code: {pretty}\nOpen the invite: {link}\n\n"
        "This invitation expires in 14 days. If you weren't expecting it, you can ignore this email."
    )
    try:
        resp = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {key}"},
            json={
                "from": app_config["EMAIL_FROM"],
                "to": [to],
                "subject": f"{therapist_name} invited you to Kinetic",
                "text": text,
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        return True
    except Exception as exc:
        log.warning("invite email to %s failed: %s", to, type(exc).__name__)
        return False


def send_push(app_config, tokens: list[str], *, title: str, body: str, data: dict | None = None) -> bool:
    if not tokens:
        return False
    messages = [{"to": t, "title": title, "body": body, "data": data or {}, "sound": "default"} for t in tokens]
    try:
        resp = httpx.post(app_config["EXPO_PUSH_URL"], json=messages, timeout=TIMEOUT)
        resp.raise_for_status()
        return True
    except Exception as exc:
        log.warning("push send failed: %s", type(exc).__name__)
        return False
