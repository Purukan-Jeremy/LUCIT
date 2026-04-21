import smtplib
from email.message import EmailMessage

from src.config.settings import (
    PASSWORD_RESET_OTP_EXPIRY_MINUTES,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_SENDER_EMAIL,
    SMTP_USE_TLS,
    SMTP_USERNAME,
)


class EmailService:
    @staticmethod
    def send_password_reset_otp(recipient_email, otp_code):
        if not all([SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_SENDER_EMAIL]):
            raise ValueError(
                "SMTP configuration is incomplete. Set SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, and SMTP_SENDER_EMAIL."
            )

        message = EmailMessage()
        message["Subject"] = "Your LUCIT Password Reset Code"
        message["From"] = SMTP_SENDER_EMAIL
        message["To"] = recipient_email
        message.set_content(
            "\n".join(
                [
                    "We received a password reset request for your LUCIT account.",
                    f"Your verification code is: {otp_code}",
                    f"This code expires in {PASSWORD_RESET_OTP_EXPIRY_MINUTES} minutes.",
                    "If you did not request this, you can ignore this email.",
                ]
            )
        )

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            if SMTP_USE_TLS:
                server.starttls()
                server.ehlo()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(message)
