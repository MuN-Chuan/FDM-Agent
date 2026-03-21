from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import EmailLoginCode, RefreshToken, User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"


class AuthService:
    def get_registration_policy(self) -> dict[str, bool | str]:
        mode = settings.REGISTRATION_MODE.strip().lower()
        registration_enabled = mode != "disabled"
        return {
            "mode": mode,
            "invite_required": False,
            "registration_enabled": registration_enabled,
        }

    def validate_registration(self, invite_code: str | None) -> str | None:
        policy = self.get_registration_policy()
        if not policy["registration_enabled"]:
            raise ValueError("Registration is currently disabled")

        normalized_code = invite_code.strip() if invite_code else None
        if normalized_code:
            valid_codes = {code.strip() for code in settings.INVITE_CODES if code.strip()}
            if valid_codes and normalized_code not in valid_codes:
                raise ValueError("Invite code is invalid")

        return normalized_code

    def hash_password(self, password: str) -> str:
        return pwd_context.hash(password)

    def verify_password(self, plain_password: str, password_hash: str) -> bool:
        return pwd_context.verify(plain_password, password_hash)

    def verify_dev_credentials(self, email: str, password: str) -> bool:
        return (
            email.strip().lower() == settings.DEV_ADMIN_EMAIL.strip().lower()
            and password == settings.DEV_ADMIN_PASSWORD
        )

    def create_access_token(self, user: User) -> str:
        now = datetime.now(UTC)
        payload = {
            "sub": user.id,
            "email": user.email,
            "role": user.role,
            "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
            "iat": now,
            "type": "access",
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)

    def create_dev_access_token(self, email: str) -> str:
        now = datetime.now(UTC)
        payload = {
            "sub": email,
            "exp": now + timedelta(hours=settings.DEV_ACCESS_TOKEN_EXPIRE_HOURS),
            "iat": now,
            "type": "dev_access",
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)

    def decode_access_token(self, token: str) -> dict[str, Any]:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])

    def create_refresh_token(
        self,
        db: Session,
        user: User,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> str:
        raw_token = secrets.token_urlsafe(48)
        token_record = RefreshToken(
            user_id=user.id,
            token_hash=self.hash_refresh_token(raw_token),
            expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            user_agent=user_agent,
            ip_address=ip_address,
        )
        db.add(token_record)
        db.commit()
        return raw_token

    def rotate_refresh_token(
        self,
        db: Session,
        refresh_token: str,
        user_agent: str | None = None,
        ip_address: str | None = None,
    ) -> tuple[User, str]:
        token_record = self.get_valid_refresh_token(db, refresh_token)
        token_record.revoked_at = datetime.now(UTC)
        user = token_record.user
        db.add(token_record)
        db.commit()
        db.refresh(user)
        new_token = self.create_refresh_token(db, user, user_agent=user_agent, ip_address=ip_address)
        return user, new_token

    def revoke_refresh_token(self, db: Session, refresh_token: str) -> None:
        token_hash = self.hash_refresh_token(refresh_token)
        token_record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        if token_record and token_record.revoked_at is None:
            token_record.revoked_at = datetime.now(UTC)
            db.add(token_record)
            db.commit()

    def get_valid_refresh_token(self, db: Session, refresh_token: str) -> RefreshToken:
        token_hash = self.hash_refresh_token(refresh_token)
        token_record = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
        if token_record is None:
            raise ValueError("Refresh token not found")
        if token_record.revoked_at is not None:
            raise ValueError("Refresh token revoked")
        if token_record.expires_at < datetime.now(UTC):
            raise ValueError("Refresh token expired")
        return token_record

    def get_user_by_email(self, db: Session, email: str) -> User | None:
        return db.scalar(select(User).where(User.email == email.lower()))

    def get_user_by_id(self, db: Session, user_id: str) -> User | None:
        return db.scalar(select(User).where(User.id == user_id))

    def register_user(self, db: Session, email: str, password: str, invite_code: str | None = None) -> User:
        normalized_email = email.lower()
        if self.get_user_by_email(db, normalized_email):
            raise ValueError("Email already registered")

        normalized_code = self.validate_registration(invite_code)

        user = User(
            email=normalized_email,
            password_hash=self.hash_password(password),
            invite_code_used=normalized_code,
            points_balance=settings.DEFAULT_USER_POINTS,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def authenticate_user(self, db: Session, email: str, password: str) -> User | None:
        user = self.get_user_by_email(db, email)
        if user is None or not self.verify_password(password, user.password_hash):
            return None
        return user

    def touch_login(self, db: Session, user: User) -> None:
        user.last_login_at = datetime.now(UTC)
        db.add(user)
        db.commit()
        db.refresh(user)

    def hash_refresh_token(self, refresh_token: str) -> str:
        return hashlib.sha256(refresh_token.encode("utf-8")).hexdigest()

    def hash_email_code(self, code: str) -> str:
        return hashlib.sha256(code.encode("utf-8")).hexdigest()

    def create_email_login_code(self, db: Session, email: str) -> str:
        normalized_email = email.lower()
        code = f"{secrets.randbelow(900000) + 100000}"

        db.execute(delete(EmailLoginCode).where(EmailLoginCode.email == normalized_email))
        record = EmailLoginCode(
            email=normalized_email,
            user_id=self.get_user_by_email(db, normalized_email).id if self.get_user_by_email(db, normalized_email) else None,
            code_hash=self.hash_email_code(code),
            expires_at=datetime.now(UTC) + timedelta(minutes=settings.EMAIL_LOGIN_CODE_EXPIRE_MINUTES),
        )
        db.add(record)
        db.commit()
        return code

    def login_with_email_code(self, db: Session, email: str, code: str) -> User:
        normalized_email = email.lower()
        record = self.get_valid_email_code_record(db, normalized_email, code)

        user = self.get_user_by_email(db, normalized_email)
        if user is None:
            raise ValueError("Email is not registered")

        record.consumed_at = datetime.now(UTC)
        record.user_id = user.id
        db.add(record)
        db.commit()
        db.refresh(user)
        return user

    def register_with_email_code(self, db: Session, email: str, code: str, invite_code: str | None = None) -> User:
        normalized_email = email.lower()
        if self.get_user_by_email(db, normalized_email):
            raise ValueError("Email already registered")

        normalized_code = self.validate_registration(invite_code)
        record = self.get_valid_email_code_record(db, normalized_email, code)

        user = User(
            email=normalized_email,
            password_hash=self.hash_password(secrets.token_urlsafe(32)),
            invite_code_used=normalized_code,
            points_balance=settings.DEFAULT_USER_POINTS,
        )
        db.add(user)
        db.flush()

        record.consumed_at = datetime.now(UTC)
        record.user_id = user.id
        db.add(record)
        db.commit()
        db.refresh(user)
        return user

    def get_valid_email_code_record(self, db: Session, email: str, code: str) -> EmailLoginCode:
        record = db.scalar(
            select(EmailLoginCode)
            .where(EmailLoginCode.email == email.lower())
            .order_by(EmailLoginCode.created_at.desc())
        )
        if record is None:
            raise ValueError("Verification code not found")
        if record.consumed_at is not None:
            raise ValueError("Verification code already used")
        if record.expires_at < datetime.now(UTC):
            raise ValueError("Verification code expired")
        if record.code_hash != self.hash_email_code(code):
            raise ValueError("Verification code is invalid")
        return record

    def send_email_login_code(self, email: str, code: str) -> None:
        print(f"[email-login] Send code {code} to {email} from {settings.EMAIL_LOGIN_SENDER}")

    def parse_user_from_access_token(self, db: Session, token: str) -> User | None:
        try:
            payload = self.decode_access_token(token)
        except JWTError:
            return None

        if payload.get("type") != "access":
            return None

        user_id = payload.get("sub")
        if not user_id:
            return None

        return self.get_user_by_id(db, user_id)

    def parse_dev_email_from_access_token(self, token: str) -> str | None:
        try:
            payload = self.decode_access_token(token)
        except JWTError:
            return None

        if payload.get("type") != "dev_access":
            return None

        email = payload.get("sub")
        if not email:
            return None

        return str(email)


auth_service = AuthService()
