"""Request schemas and the user role vocabulary for authentication."""

import re
from enum import Enum
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class UserRole(str, Enum):
    ADMINISTRATOR = "administrator"
    EMPLOYEE = "employee"
    DRIVER = "driver"


_USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._@+-]{2,63}$")


class UsernamePassword(BaseModel):
    username: str = Field(min_length=3, max_length=64)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        value = value.strip().lower()
        if not _USERNAME_PATTERN.fullmatch(value):
            raise ValueError("Username contains unsupported characters")
        return value


class LoginCredentials(UsernamePassword):
    password: str = Field(min_length=1, max_length=128)


class BootstrapCredentials(UsernamePassword):
    password: str = Field(min_length=12, max_length=128)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


def public_user(user: dict) -> dict:
    created_at = user["created_at"]
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()
    return {
        "id": user["id"],
        "username": user["username"],
        "role": user["role"],
        "created_at": created_at,
    }
