"""Réglages de test : SQLite en mémoire (la base Oracle de dev ne permet pas
de créer la base de test : ORA-01031). Usage : `python manage.py test --settings=config.test_settings`.
"""
from .settings import *  # noqa

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
