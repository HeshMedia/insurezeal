import logging
import uuid

import jwt
from fastapi import HTTPException, status
from supabase import Client

from config import (
    JWT_ALGORITHM,
    JWT_SECRET_KEY,
    get_supabase_admin_client,
    get_supabase_client,
)

logger = logging.getLogger(__name__)


class AuthHelpers:
    """
    Authentication Helper Class

    Provides comprehensive authentication utilities for JWT token management,
    Supabase client interactions, and user verification processes. This class
    serves as the core authentication engine for the InsureZeal platform.

    Key Features:
    - Local JWT token verification without external API calls
    - Supabase client management with lazy initialization
    - Token refresh capabilities with error handling
    - Role-based authentication support
    - UUID handling for database compatibility

    Security Features:
    - Comprehensive JWT validation (expiration, signature, claims)
    - Secure token refresh mechanisms
    - Proper error handling without sensitive data exposure
    - UUID format validation for security

    Performance Optimizations:
    - Lazy-loaded Supabase clients to reduce initialization overhead
    - Local JWT verification to minimize external API calls
    - Efficient error handling with appropriate HTTP status codes
    """

    def __init__(self):
        self._supabase = None
        self._admin_client = None

    @property
    def supabase(self) -> Client:
        """
        Lazy-loaded Supabase client for standard operations.

        Returns:
            Client: Configured Supabase client instance

        Notes:
        - Initializes client only when first accessed
        - Reuses the same instance for subsequent calls
        - Optimizes performance by avoiding unnecessary initialization
        """
        if self._supabase is None:
            self._supabase = get_supabase_client()
        return self._supabase

    @property
    def admin_client(self) -> Client:
        """
        Lazy-loaded Supabase admin client for administrative operations.

        Returns:
            Client: Configured Supabase admin client with elevated privileges

        Notes:
        - Provides admin-level access to Supabase services
        - Used for user management and administrative functions
        - Initializes only when admin operations are required
        """
        if self._admin_client is None:
            self._admin_client = get_supabase_admin_client()
        return self._admin_client

    def verify_token(self, token: str):
        """
        Verify JWT token locally without calling Supabase API.

        Performs comprehensive JWT token validation including signature verification,
        expiration checks, and claims validation. Extracts user information and
        role data from the token payload for authorization purposes.

        Args:
            token (str): The JWT token to verify

        Returns:
            User object with the following attributes:
            - id (UUID): User ID as UUID object for database operations
            - id_str (str): User ID as string for logging and external APIs
            - email (str): User's email address
            - role (str): User's role from token metadata
            - payload (dict): Complete JWT payload for advanced use cases

        Raises:
            HTTPException (401): If token is expired, invalid, or malformed
            HTTPException (401): If user ID format is invalid

        Security Notes:
        - Validates token signature using configured secret
        - Checks token expiration and issued-at times
        - Converts user ID to UUID for type safety
        - Logs security events for audit purposes
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
        """
        Refresh access token using refresh token.

        Exchanges a valid refresh token for a new access token session,
        enabling seamless user experience without requiring re-authentication.

        Args:
            refresh_token (str): Valid refresh token from previous authentication

        Returns:
            Supabase session object containing:
            - New access token
            - Updated refresh token
            - User information
            - Session metadata

        Raises:
            HTTPException (401): If refresh token is invalid or expired
            HTTPException (401): If Supabase refresh operation fails

        Notes:
        - Automatically handles token rotation for security
        - Logs refresh events for security monitoring
        - Maintains session continuity for authenticated users
        """
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
