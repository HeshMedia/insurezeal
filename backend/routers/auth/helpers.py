"""
Authentication helper functions for Insurezeal Backend API.

This module provides utility functions for authentication operations including
JWT token verification, user management, and Supabase integration. It handles
both local JWT verification and Supabase API interactions for user authentication.
"""

import uuid
from supabase import Client
from fastapi import HTTPException, status
from config import (
    get_supabase_client,
    get_supabase_admin_client,
    JWT_SECRET_KEY,
    JWT_ALGORITHM,
)
import logging
import jwt

logger = logging.getLogger(__name__)


class AuthHelpers:
    """
    Helper class for authentication and user management operations.

    This class provides methods for JWT token verification, user authentication,
    and integration with Supabase authentication services. It implements caching
    for Supabase clients to improve performance.

    Attributes:
        _supabase: Cached Supabase client for user operations
        _admin_client: Cached Supabase admin client for administrative operations
    """

    def __init__(self):
        """Initialize authentication helper with lazy-loaded clients."""
        self._supabase = None
        self._admin_client = None

    @property
    def supabase(self) -> Client:
        """
        Get Supabase client instance with lazy loading.

        Returns:
            Client: Supabase client for user authentication operations
        """
        if self._supabase is None:
            self._supabase = get_supabase_client()
        return self._supabase

    @property
    def admin_client(self) -> Client:
        """
        Get Supabase admin client instance with lazy loading.

        Returns:
            Client: Supabase admin client for administrative operations
        """
        if self._admin_client is None:
            self._admin_client = get_supabase_admin_client()
        return self._admin_client

    def verify_token(self, token: str):
        """
        Verify JWT token locally without external API calls for performance.

        This method validates JWT tokens using local secret verification,
        avoiding the overhead of calling Supabase API for every request.
        It extracts user information including role from the token payload.

        Args:
            token: JWT token string to verify

        Returns:
            User object with id, email, role, and other claims from token

        Raises:
            HTTPException: If token is invalid, expired, or malformed

        Note:
            Local verification is faster than API calls but requires the JWT
            secret to be properly configured in the environment.
        """
        try:
            payload = jwt.decode(
                token,
                JWT_SECRET_KEY,
                algorithms=[JWT_ALGORITHM],
                options={
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_signature": True,
                    "verify_aud": False,
                },
            )

            user_id = payload.get("sub")
            email = payload.get("email")
            user_metadata = payload.get("user_metadata", {})
            role = user_metadata.get("role")

            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token: missing user ID",
                )

            # Convert string UUID to UUID object for database compatibility
            try:
                user_id_uuid = uuid.UUID(user_id)
            except ValueError:
                logger.error(f"Invalid UUID format in JWT: {user_id}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid user ID format",
                )

            return type(
                "User",
                (),
                {
                    "id": user_id_uuid,  # Now a proper UUID object
                    "id_str": user_id,  # Keep string version for logging
                    "email": email,
                    "role": role,
                    "payload": payload,
                },
            )()

        except jwt.ExpiredSignatureError:
            logger.warning("JWT token expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired"
            )
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )
        except Exception as e:
            logger.error(f"JWT verification failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token verification failed",
            )

    async def refresh_token(self, refresh_token: str):
        """Refresh access token using refresh token"""
        try:
            auth_response = self.supabase.auth.refresh_session(refresh_token)

            if auth_response.session is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token",
                )

            return auth_response.session

        except Exception as e:
            logger.error(f"Token refresh error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token"
            )


auth_helpers = AuthHelpers()
