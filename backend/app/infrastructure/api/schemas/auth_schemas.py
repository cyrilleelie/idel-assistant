"""Schemas Pydantic pour l'authentification."""

import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    rpps: str = Field(pattern=r"^\d{11}$")
    phone: str = Field(default="", max_length=20)
    cabinet_name: str = Field(default="", max_length=255)
    cabinet_address: str = Field(default="", max_length=500)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str = Field(default="")


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    rpps: str
    phone: str
    created_at: datetime.datetime

    model_config = {"from_attributes": True}


class MeCabinetResponse(BaseModel):
    id: str
    name: str
    address: str
    plan: str
    subscription_status: str

    model_config = {"from_attributes": True}


class MeUserResponse(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    rpps: str
    phone: str
    role: str

    model_config = {"from_attributes": True}


class MeResponse(BaseModel):
    user: MeUserResponse
    cabinet: MeCabinetResponse
