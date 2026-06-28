"""WireGuard key generation using cryptography X25519."""
import base64
import secrets

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import x25519


def generate_wireguard_keypair():
    """Return (private_key_b64, public_key_b64) for WireGuard."""
    private_key = x25519.X25519PrivateKey.generate()
    private_key_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PrivateFormat.Raw,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_key_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw,
    )
    return (
        base64.b64encode(private_key_bytes).decode('ascii'),
        base64.b64encode(public_key_bytes).decode('ascii'),
    )


def generate_preshared_key():
    """Return a WireGuard-compatible preshared key (base64, 32 random bytes)."""
    return base64.b64encode(secrets.token_bytes(32)).decode('ascii')
