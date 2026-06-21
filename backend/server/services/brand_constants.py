"""Shared Lumen product branding for backend responses."""
from __future__ import annotations

BRAND_NAME = 'Lumen'
BRAND_COMPANY = 'Lumen'
BRAND_FULL_NAME = 'Lumen WiFi Billing'
BRAND_SUPPORT_EMAIL = 'support@lumen.app'
BRAND_WEBSITE = 'https://lumen.app'
BRAND_PORTAL_TAGLINE = 'Fast, reliable internet for home and business'
BRAND_PORTAL_ABOUT = (
    'Lumen connects homes and businesses across Kenya with affordable broadband. '
    'Pay with M-Pesa and get online in seconds.'
)


def sanitize_brand_text(value: str | None, fallback: str = BRAND_NAME) -> str:
    if not value or not isinstance(value, str):
        return fallback
    cleaned = (
        value.replace('Infora WiFi Billing System', BRAND_FULL_NAME)
        .replace('Infora WiFi Solutions', BRAND_COMPANY)
        .replace('Infora WiFi', BRAND_NAME)
        .replace('Infora', BRAND_NAME)
        .replace('Default Company', BRAND_COMPANY)
        .replace('Default ISP', BRAND_NAME)
        .strip()
    )
    return cleaned or fallback
