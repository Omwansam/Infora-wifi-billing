"""Symmetric encryption for secrets stored in the database."""
import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


def _fernet_key(raw_key=None):
    """Derive a stable Fernet key from config secret."""
    source = raw_key or os.getenv('ENCRYPTION_KEY') or os.getenv('SECRET_KEY') or 'lumen-dev-key'
    digest = hashlib.sha256(source.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_value(plaintext):
    if plaintext is None:
        return None
    if plaintext == '':
        return ''
    return Fernet(_fernet_key()).encrypt(str(plaintext).encode()).decode()


def decrypt_value(ciphertext):
    if ciphertext is None:
        return None
    if ciphertext == '':
        return ''
    try:
        return Fernet(_fernet_key()).decrypt(ciphertext.encode()).decode()
    except InvalidToken:
        # Legacy plain-text values still in DB
        return ciphertext
