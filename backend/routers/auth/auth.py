"""
Authentication router for Insurezeal API.

This module handles user authentication, registration, password management,
and JWT token validation. It integrates with Supabase for authentication
backend and maintains user profiles in the application database.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from config import get_db, get_supabase_client
from models import UserProfile, Users
import uuid
from datetime import datetime
from .schemas import (
    UserRegister,
    UserLogin,
    AuthResponse,
    UserResponse,
    RegistrationResponse,
    TokenResponse,
    ForgotPasswordRequest,
    VerifyResetTokenRequest,
    ResetPasswordRequest,
    SupabaseWebhookEvent,
)
from .helpers import auth_helpers
from utils.model_utils import model_data_from_orm
from datetime import datetime
import logging
import uuid

# Import user_helpers for agent code generation
from routers.users.helpers import user_helpers

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

security = HTTPBearer()
supabase = get_supabase_client()


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """
    Get current authenticated user from JWT token with optimization strategy.

    This function implements a two-tier authentication strategy:
    1. First tries to get user role from JWT token (faster, for new users)
    2. Falls back to database lookup for existing users without role in JWT

    Args:
        request: FastAPI request object to store user state
        credentials: Bearer token from Authorization header
        db: Database session for user profile lookup

    Returns:
        dict: Current user information including user_id, email, role, and optionally profile

    Raises:
        HTTPException: If token is invalid or user profile not found

    Note:
        This optimization reduces database queries for users whose role is embedded
        in the JWT token, while maintaining backward compatibility for existing users.
    """
    token = credentials.credentials
    supabase_user = auth_helpers.verify_token(token)

    if supabase_user.role:
        # Fast path: Role available in JWT (new user flow)
        current_user = {
            "user_id": supabase_user.id,
            "email": supabase_user.email,
            "role": supabase_user.role,
        }
        logger.info(
            f"User {supabase_user.id_str} authenticated via JWT role: {supabase_user.role}"
        )

    else:
        # Fallback path: Database lookup for existing users without role in JWT
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == supabase_user.id)
        )
        user_profile = result.scalar_one_or_none()

        if not user_profile:
            logger.warning(
                f"User profile not found for authenticated user: {supabase_user.id_str}"
            )
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        current_user = {
            "user_id": supabase_user.id,
            "email": supabase_user.email,
            "role": user_profile.user_role,
            "profile": user_profile,
        }
        logger.info(
            f"User {supabase_user.id_str} authenticated via DB role: {user_profile.user_role}"
        )

    # Store user info in request state for use throughout the request lifecycle
    request.state.current_user = current_user

    return current_user


@router.post(
    "/register",
    response_model=RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    """
    Register a new user account in the Insurezeal platform.

    This endpoint creates a new user account by:
    1. Validating the username is unique in our database
    2. Creating the user in Supabase authentication system
    3. Letting Supabase webhooks handle local database profile creation
    4. Generating a unique agent code for insurance operations

    Args:
        user_data: User registration data including email, password, username, and profile info
        db: Database session for username validation

    Returns:
        RegistrationResponse: Contains user info and temporary access token

    Raises:
        HTTPException: If username is taken, registration fails, or database errors occur

    Note:
        The actual user profile creation happens asynchronously via Supabase webhooks
        to ensure data consistency between Supabase auth and our application database.
    """
    try:
        # Check if username is already taken
        existing_user = await db.execute(
            select(UserProfile).where(UserProfile.username == user_data.username)
        )
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Username already taken"
            )

        # Create user in Supabase - webhook will handle local database creation
        auth_response = supabase.auth.sign_up(
            {
                "email": user_data.email,
                "password": user_data.password,
                "options": {
                    "data": {
                        "username": user_data.username,
                        "first_name": user_data.first_name,
                        "last_name": user_data.last_name,
                        "role": "agent",
                    }
                },
            }
        )

        if auth_response.user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user account",
            )

        supabase_user_id = auth_response.user.id
        logger.info(
            f"User created in Supabase: {supabase_user_id}. Webhook will handle local database creation."
        )

        # Return registration success response - webhook will handle local DB creation
        return RegistrationResponse(
            message="Registration successful! Please check your email to verify your account.",
            user_id=str(supabase_user_id),
            email=auth_response.user.email,
            status="pending_verification",
        )

    except Exception as e:
        logger.error(f"Registration failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed",
        )


@router.post("/login", response_model=AuthResponse)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Authenticate user with email and password.

    This endpoint handles user login by:
    1. Validating credentials with Supabase authentication
    2. Retrieving user profile from local database
    3. Returning access token and user profile data

    Args:
        user_data: Login credentials (email and password)
        db: Database session for user profile retrieval

    Returns:
        AuthResponse: Contains access token, refresh token, and user profile

    Raises:
        HTTPException: If credentials are invalid, user not found, or authentication fails

    Note:
        The login process integrates Supabase authentication with local user profiles
        to provide complete user context for the application.
    """
    try:
        auth_response = supabase.auth.sign_in_with_password(
            {"email": user_data.email, "password": user_data.password}
        )

        if auth_response.user is None or auth_response.session is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # Convert string UUID to UUID object for database compatibility
        try:
            user_id_uuid = uuid.UUID(auth_response.user.id)
        except ValueError:
            logger.error(
                f"Invalid UUID format from Supabase login: {auth_response.user.id}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Invalid user ID format from authentication service",
            )

        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == user_id_uuid)
        )
        user_profile = result.scalar_one_or_none()

        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )
        profile_data = model_data_from_orm(
            user_profile, {"email": auth_response.user.email}
        )
        user_response = UserResponse.model_validate(profile_data)

        return AuthResponse(
            access_token=auth_response.session.access_token,
            refresh_token=auth_response.session.refresh_token,
            user=user_response,
        )

    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(refresh_token: str):
    try:
        session = await auth_helpers.refresh_token(refresh_token)

        return TokenResponse(access_token=session.access_token)

    except Exception as e:
        logger.error(f"Token refresh failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token refresh failed"
        )


@router.post("/forgot-password")
async def forgot_password(request_data: ForgotPasswordRequest):
    try:
        from config import ENVIRONMENT

        if ENVIRONMENT == "prod":
            redirect_url = "https://yourdomain.com/reset-password"
        elif ENVIRONMENT == "dev":
            redirect_url = "http://localhost:3000/reset-password"
        else:
            redirect_url = "http://localhost:3000/reset-password"

        response = supabase.auth.reset_password_email(
            request_data.email, options={"redirect_to": redirect_url}
        )

        return {
            "message": "If an account with that email exists, a password reset link has been sent."
        }

    except Exception as e:
        logger.error(f"Password reset email failed: {str(e)}")
        return {
            "message": "If an account with that email exists, a password reset link has been sent."
        }


@router.post("/verify-reset-token")
async def verify_reset_token(token_data: VerifyResetTokenRequest):
    try:
        response = supabase.auth.set_session(
            access_token=token_data.access_token, refresh_token=token_data.refresh_token
        )

        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset tokens",
            )

        return {
            "message": "Reset tokens are valid",
            "email": response.user.email if response.user else None,
        }

    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset tokens",
        )


@router.post("/reset-password")
async def reset_password(reset_data: ResetPasswordRequest):
    try:
        session_data = {
            "access_token": reset_data.access_token,
            "refresh_token": reset_data.refresh_token,
        }

        response = supabase.auth.set_session(
            access_token=reset_data.access_token, refresh_token=reset_data.refresh_token
        )

        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset tokens",
            )

        update_response = supabase.auth.update_user(
            {"password": reset_data.new_password}
        )

        if update_response.user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update password",
            )

        supabase.auth.sign_out()

        return {
            "message": "Password reset successfully. You can now log in with your new password."
        }

    except Exception as e:
        logger.error(f"Password reset failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset failed. Please try requesting a new reset link.",
        )


@router.post("/logout")
async def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        supabase.auth.sign_out()

        return {"message": "Successfully logged out"}

    except Exception as e:
        logger.error(f"Logout failed: {str(e)}")
        return {"message": "Logout completed"}


# Supabase webhook enabled - handles user creation and profile management (NO AUTH)
@router.post("/webhooks/supabase", status_code=200)
async def supabase_webhook(
    request: Request,
    webhook_data: SupabaseWebhookEvent,
    db: AsyncSession = Depends(get_db),
):
    """
    Supabase webhook to replicate auth.users into our local database
    Handles user creation, updates, and deletion events from Supabase Auth
    NO AUTHENTICATION REQUIRED - Open webhook endpoint
    """

    try:
        # Enhanced logging for debugging
        logger.info("=== WEBHOOK PROCESSING START ===")
        logger.info(f"Request method: {request.method}")
        logger.info(f"Request URL: {request.url}")
        logger.info(f"Content-Type: {request.headers.get('content-type')}")
        logger.info(f"All headers: {dict(request.headers)}")

        # Log webhook payload details
        logger.info(
            f"Webhook received - Type: {webhook_data.type}, Table: {webhook_data.table}"
        )
        logger.info(
            f"User ID: {webhook_data.record.id}, Email: {webhook_data.record.email}"
        )
        logger.info(f"User metadata: {webhook_data.record.raw_user_meta_data}")

        logger.info("No authentication required - processing webhook directly")

        # Extract event details
        event_type = webhook_data.type
        user_data = webhook_data.record

        logger.info(
            f"Processing Supabase webhook: {event_type} for user {user_data.id}"
        )
        logger.info(f"User email: {user_data.email}")
        logger.info(f"User metadata available: {bool(user_data.raw_user_meta_data)}")

        # Process different event types
        if event_type in ["INSERT", "UPDATE"]:
            logger.info(f"Starting user upsert process for user {user_data.id}")
            # Create or update user and profile in local database
            await upsert_user_from_supabase(db, user_data)
            logger.info(f"Successfully completed user upsert for user {user_data.id}")

        elif event_type == "DELETE":
            logger.info(f"Starting user deletion process for user {user_data.id}")
            # Convert string UUID to UUID object for database compatibility
            user_id_uuid = uuid.UUID(user_data.id)
            # Soft delete user in local database
            await soft_delete_user(db, user_id_uuid)
            logger.info(f"Successfully completed user deletion for user {user_data.id}")

        else:
            logger.warning(f"Unhandled webhook event type: {event_type}")
            response_data = {
                "status": "ignored",
                "message": f"Event type {event_type} not handled",
            }

        # Success response
        response_data = {
            "status": "success",
            "message": f"Processed {event_type} event for user {user_data.id}",
        }
        logger.info(f"Webhook processing completed successfully: {response_data}")
        logger.info("=== WEBHOOK PROCESSING END ===")

        return response_data

    except HTTPException as http_exc:
        logger.error(
            f"HTTP Exception in webhook: {http_exc.status_code} - {http_exc.detail}"
        )
        logger.info("=== WEBHOOK PROCESSING END (HTTP ERROR) ===")
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error in webhook processing: {str(e)}", exc_info=True)
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Error args: {e.args}")
        logger.info("=== WEBHOOK PROCESSING END (ERROR) ===")

        # Return proper error response instead of letting it become 502
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


async def upsert_user_from_supabase(db: AsyncSession, user_data):
    """
    Create or update a user in the local database from Supabase webhook data
    Also handles user profile creation with agent code generation
    """
    try:
        logger.info(f"Starting upsert process for user {user_data.id}")

        # Convert string UUID to UUID object for database compatibility
        try:
            user_id_uuid = uuid.UUID(user_data.id)
        except ValueError:
            logger.error(f"Invalid UUID format from Supabase: {user_data.id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format from Supabase",
            )

        # Check if user already exists
        logger.info(f"Checking if user {user_data.id} exists in local database")
        result = await db.execute(select(Users).where(Users.id == user_id_uuid))
        existing_user = result.scalar_one_or_none()

        logger.info(f"User exists: {bool(existing_user)}")

        # Extract role from raw_app_meta_data or raw_user_meta_data
        role = None
        if user_data.raw_app_meta_data and isinstance(
            user_data.raw_app_meta_data, dict
        ):
            role = user_data.raw_app_meta_data.get("role")
        if (
            not role
            and user_data.raw_user_meta_data
            and isinstance(user_data.raw_user_meta_data, dict)
        ):
            role = user_data.raw_user_meta_data.get("role")

        logger.info(f"Extracted role: {role}")

        if existing_user:
            # Update existing user
            logger.info(f"Updating existing user {user_data.id}")
            existing_user.email = user_data.email
            existing_user.phone = user_data.phone
            existing_user.role = role
            existing_user.updated_at = user_data.updated_at or datetime.utcnow()
            existing_user.deleted_at = None  # Clear deletion if user is being updated

            logger.info(
                f"Successfully updated existing user {user_data.id} in local database"
            )
        else:
            # Create new user
            logger.info(f"Creating new user {user_data.id}")

            new_user = Users(
                id=user_id_uuid,  # Use the converted UUID object
                email=user_data.email,
                phone=user_data.phone,
                role=role,
                created_at=user_data.created_at or datetime.utcnow(),
                updated_at=user_data.updated_at or datetime.utcnow(),
            )

            logger.info("Adding new user to database session")
            db.add(new_user)

            logger.info("Flushing database session to create user record")
            await db.flush()  # Ensure Users record is created first
            logger.info(
                f"Successfully created new user {user_data.id} in local database"
            )

            # Create user profile if this is a new user and we have metadata
            logger.info(f"Creating user profile for new user {user_data.id}")
            await create_user_profile_from_webhook(db, user_data)

        logger.info("Committing database transaction")
        await db.commit()
        logger.info(
            f"Database transaction committed successfully for user {user_data.id}"
        )

    except Exception as e:
        logger.error(
            f"Error in upsert_user_from_supabase for user {user_data.id}: {str(e)}",
            exc_info=True,
        )
        logger.error(f"Error type: {type(e).__name__}")
        try:
            await db.rollback()
            logger.info("Database transaction rolled back successfully")
        except Exception as rollback_error:
            logger.error(f"Error during rollback: {str(rollback_error)}", exc_info=True)
        raise


async def create_user_profile_from_webhook(db: AsyncSession, user_data):
    """
    Create user profile from Supabase webhook metadata
    """
    try:
        logger.info(f"Starting user profile creation for user {user_data.id}")

        # Check if profile already exists
        logger.info(f"Checking if profile exists for user {user_data.id}")

        # Convert string UUID to UUID object for database compatibility
        try:
            user_id_uuid = uuid.UUID(user_data.id)
        except ValueError:
            logger.error(f"Invalid UUID format from Supabase: {user_data.id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid user ID format from Supabase",
            )

        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == user_id_uuid)
        )
        existing_profile = result.scalar_one_or_none()

        if existing_profile:
            logger.info(f"User profile already exists for user {user_data.id}")
            return

        # Extract user metadata
        metadata = user_data.raw_user_meta_data or {}
        logger.info(
            f"Extracted metadata: {list(metadata.keys()) if metadata else 'None'}"
        )

        username = metadata.get("username")
        first_name = metadata.get("first_name")
        last_name = metadata.get("last_name")
        role = metadata.get("role", "agent")

        logger.info(
            f"Profile data - username: {username}, first_name: {first_name}, last_name: {last_name}, role: {role}"
        )

        if not username:
            logger.warning(f"No username found in metadata for user {user_data.id}")
            logger.info(
                "Available metadata keys:",
                list(metadata.keys()) if metadata else "No metadata",
            )
            return

        # Generate agent code for new user
        logger.info(f"Generating agent code for user {username}")
        agent_code = await user_helpers.generate_agent_code(db)
        logger.info(f"Generated agent code {agent_code} for webhook user {username}")

        # Create user profile
        logger.info(f"Creating UserProfile record with agent_code: {agent_code}")
        new_profile = UserProfile(
            user_id=user_id_uuid,  # Use the converted UUID object
            username=username,
            first_name=first_name,
            last_name=last_name,
            user_role=role,
            agent_code=agent_code,
        )

        logger.info("Adding user profile to database session")
        db.add(new_profile)
        logger.info(
            f"Successfully created user profile for webhook user {user_data.id} with username {username}"
        )

    except Exception as e:
        logger.error(
            f"Error in create_user_profile_from_webhook for user {user_data.id}: {str(e)}",
            exc_info=True,
        )
        logger.error(f"Error type: {type(e).__name__}")
        logger.error(f"Available user_data attributes: {dir(user_data)}")
        if hasattr(user_data, "raw_user_meta_data"):
            logger.error(f"raw_user_meta_data content: {user_data.raw_user_meta_data}")
        raise


async def soft_delete_user(db: AsyncSession, user_id: uuid.UUID):
    """
    Soft delete a user by setting deleted_at timestamp
    """
    try:
        result = await db.execute(select(Users).where(Users.id == user_id))
        user = result.scalar_one_or_none()

        if user:
            user.deleted_at = datetime.utcnow()
            await db.commit()
            logger.info(f"Soft deleted user {user_id}")
        else:
            logger.warning(f"User {user_id} not found for deletion")

    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to delete user {user_id}: {str(e)}", exc_info=True)
        raise
