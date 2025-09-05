from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from config import get_db, get_supabase_client
from models import UserProfile, Users
from .schemas import (
    UserRegister, 
    UserLogin, 
    AuthResponse, 
    UserResponse,
    TokenResponse,
    ForgotPasswordRequest,
    VerifyResetTokenRequest,
    ResetPasswordRequest,
    SupabaseWebhookEvent
)
from .helpers import auth_helpers
from utils.model_utils import model_data_from_orm
from typing import Optional
from datetime import datetime
import logging
import os
import uuid
import hmac
import hashlib
import json

# Import user_helpers for agent code generation
from routers.users.helpers import user_helpers

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

security = HTTPBearer()
supabase = get_supabase_client()

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """
    Get current user from JWT token (optimized)
    - Uses role from JWT if available (new users)
    - Falls back to DB for users without role in JWT (existing users)
    """
    token = credentials.credentials
    supabase_user = auth_helpers.verify_token(token)  
    
    if supabase_user.role:
        current_user = {
            "user_id": supabase_user.id,
            "email": supabase_user.email,
            "role": supabase_user.role 
        }
        logger.info(f"User {supabase_user.id} authenticated via JWT role: {supabase_user.role}")
        
    # else:
    #     result = await db.execute(
    #         select(UserProfile).where(UserProfile.user_id == supabase_user.id)
    #     )
    #     user_profile = result.scalar_one_or_none()
        
    #     if not user_profile:
    #         raise HTTPException(
    #             status_code=status.HTTP_404_NOT_FOUND,
    #             detail="User profile not found"
    #         )
        
    #     current_user = {
    #         "user_id": supabase_user.id,
    #         "email": supabase_user.email,
    #         "role": user_profile.user_role,  
    #         "profile": user_profile 
    #     }
    #     logger.info(f"User {supabase_user.id} authenticated via DB role: {user_profile.user_role}")
    

    request.state.current_user = current_user
    
    return current_user

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_data: UserRegister,
    db: AsyncSession = Depends(get_db)
):
    try:
        # Check if username is already taken
        existing_user = await db.execute(
            select(UserProfile).where(UserProfile.username == user_data.username)
        )
        if existing_user.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )      
        
        # Create user in Supabase
        auth_response = supabase.auth.sign_up({
            "email": user_data.email,
            "password": user_data.password,
            "options": {
                "data": {
                    "username": user_data.username,
                    "first_name": user_data.first_name,
                    "last_name": user_data.last_name,
                    "role": "agent" 
                }
            }
        })
        
        if auth_response.user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user account"
            )       
        
        supabase_user_id = auth_response.user.id
        
        # TEMPORARY: Manual creation until webhook is configured
        # TODO: Remove this when webhook is properly set up
        
        # 1. Create Users record (mirror of Supabase auth.users)
        new_user = Users(
            id=supabase_user_id,
            email=auth_response.user.email,
            phone=auth_response.user.phone,
            role="agent",
            email_confirmed_at=auth_response.user.email_confirmed_at,
            phone_confirmed_at=auth_response.user.phone_confirmed_at,
            last_sign_in_at=auth_response.user.last_sign_in_at,
            raw_app_meta_data=auth_response.user.app_metadata or {},
            raw_user_meta_data=auth_response.user.user_metadata or {},
            is_super_admin=False,
            is_sso_user=False,
            is_anonymous=False,
            # Set token fields to None to avoid unique constraint violations
            email_change_token_current=None,
            email_change_token_new=None,
            confirmation_token=None,
            recovery_token=None,
            phone_change_token=None,
            reauthentication_token=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        
        logger.info(f"Creating Users record with ID: {supabase_user_id}")
        db.add(new_user)
        await db.flush()  # Ensure Users record is created first
        logger.info(f"Users record created successfully")
        
        # 2. Generate automatic agent code for new user
        agent_code = await user_helpers.generate_agent_code(db)
        logger.info(f"Generated agent code {agent_code} for new user {user_data.username}")
        
        # 3. Create UserProfile (with proper foreign key reference)
        new_user_profile = UserProfile(
            user_id=supabase_user_id,  
            username=user_data.username,
            first_name=user_data.first_name,
            last_name=user_data.last_name,
            user_role="agent",
            agent_code=agent_code  
        )
        
        logger.info(f"Creating UserProfile record with user_id: {supabase_user_id}")
        db.add(new_user_profile)
        await db.commit()
        await db.refresh(new_user_profile)      
        
        # Return response
        profile_data = model_data_from_orm(new_user_profile, {"email": auth_response.user.email})
        user_response = UserResponse.model_validate(profile_data)
        
        if auth_response.session is None:
            return AuthResponse(
                access_token="",  
                refresh_token="",  
                user=user_response,
                message="User created successfully. Please check your email to verify your account before logging in."
            )
        
        return AuthResponse(
            access_token=auth_response.session.access_token,
            refresh_token=auth_response.session.refresh_token,
            user=user_response
        )
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Registration failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@router.post("/login", response_model=AuthResponse)
async def login(
    user_data: UserLogin,
    db: AsyncSession = Depends(get_db)
):
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": user_data.email,
            "password": user_data.password
        })
        
        if auth_response.user is None or auth_response.session is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )     
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == auth_response.user.id)
        )
        user_profile = result.scalar_one_or_none()
        
        if not user_profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found")        
        profile_data = model_data_from_orm(user_profile, {"email": auth_response.user.email})
        user_response = UserResponse.model_validate(profile_data)

        return AuthResponse(
            access_token=auth_response.session.access_token,
            refresh_token=auth_response.session.refresh_token,
            user=user_response
        )
        
    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    refresh_token: str
):
    try:
        session = await auth_helpers.refresh_token(refresh_token)
        
        return TokenResponse(
            access_token=session.access_token
        )
        
    except Exception as e:
        logger.error(f"Token refresh failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token refresh failed"
        )

@router.post("/forgot-password")
async def forgot_password(
    request_data: ForgotPasswordRequest
):
    try:
        from config import ENVIRONMENT
        
        if ENVIRONMENT == "prod":
            redirect_url = "https://yourdomain.com/reset-password"
        elif ENVIRONMENT == "dev":
            redirect_url = "http://localhost:3000/reset-password"
        else:
            redirect_url = "http://localhost:3000/reset-password"
        
        response = supabase.auth.reset_password_email(
            request_data.email,
            options={"redirect_to": redirect_url}
        )
        
        return {"message": "If an account with that email exists, a password reset link has been sent."}
        
    except Exception as e:
        logger.error(f"Password reset email failed: {str(e)}")
        return {"message": "If an account with that email exists, a password reset link has been sent."}
    
@router.post("/verify-reset-token")
async def verify_reset_token(
    token_data: VerifyResetTokenRequest
):
    try:
        response = supabase.auth.set_session(
            access_token=token_data.access_token,
            refresh_token=token_data.refresh_token
        )
        
        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset tokens"
            )
        
        return {
            "message": "Reset tokens are valid",
            "email": response.user.email if response.user else None
        }
        
    except Exception as e:
        logger.error(f"Token verification failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset tokens"
        )


@router.post("/reset-password")
async def reset_password(
    reset_data: ResetPasswordRequest
):
    try:
        session_data = {
            "access_token": reset_data.access_token,
            "refresh_token": reset_data.refresh_token
        }
        
        response = supabase.auth.set_session(
            access_token=reset_data.access_token,
            refresh_token=reset_data.refresh_token
        )
        
        if not response.session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset tokens"
            )
        
        update_response = supabase.auth.update_user({
            "password": reset_data.new_password
        })
        
        if update_response.user is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to update password"
            )
        
        supabase.auth.sign_out()
        
        return {"message": "Password reset successfully. You can now log in with your new password."}
        
    except Exception as e:
        logger.error(f"Password reset failed: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset failed. Please try requesting a new reset link."
        )

@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        token = credentials.credentials
        supabase.auth.sign_out()
        
        return {"message": "Successfully logged out"}
        
    except Exception as e:
        logger.error(f"Logout failed: {str(e)}")
        return {"message": "Logout completed"}  

#TODO: jab VPS milega ye test krna hai abhi not tested h sara webhook system
@router.post("/webhooks/supabase", status_code=200)
async def supabase_webhook(
    request: Request,
    webhook_data: SupabaseWebhookEvent,
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
    x_hook_signature: Optional[str] = Header(None, alias="x-hook-signature")
):
    """
    Supabase webhook to replicate auth.users into our local database
    Handles user creation, updates, and deletion events from Supabase Auth
    
    TODO: Enable this when VPS is configured and webhook URL is set up in Supabase
    Currently using manual user creation in register route as temporary solution
    """
    
    # FUTURE: Enable this when webhook is properly configured
    # For now, return basic response since we're manually creating users in register route
    return {"status": "webhook_disabled", "message": "Webhook functionality disabled - using manual user creation"}
    
    # TODO: Uncomment and implement below when webhook is configured on VPS
    # This is the full webhook implementation ready for production use:
    #
    # try:
    #     # Verify webhook security
    #     webhook_secret = os.getenv("SUPABASE_WEBHOOK_SECRET")
    #     if not webhook_secret:
    #         logger.error("SUPABASE_WEBHOOK_SECRET not configured")
    #         raise HTTPException(status_code=500, detail="Webhook not configured")
    #     
    #     # Verify the webhook signature if provided
    #     if x_hook_signature:
    #         body = await request.body()
    #         expected_signature = hmac.new(
    #             webhook_secret.encode(),
    #             body,
    #             hashlib.sha256
    #         ).hexdigest()
    #         
    #         if not hmac.compare_digest(f"sha256={expected_signature}", x_hook_signature):
    #             logger.warning("Invalid webhook signature")
    #             raise HTTPException(status_code=401, detail="Invalid signature")
    #     
    #     # Verify Bearer token if provided (alternative security method)
    #     elif authorization:
    #         if not authorization.startswith("Bearer "):
    #             raise HTTPException(status_code=401, detail="Invalid authorization header")
    #         
    #         token = authorization.split(" ")[1]
    #         if token != webhook_secret:
    #             raise HTTPException(status_code=401, detail="Invalid token")
    #     else:
    #         logger.warning("No security headers provided for webhook")
    #         raise HTTPException(status_code=401, detail="Unauthorized")
    #     
    #     event_type = webhook_data.type
    #     user_data = webhook_data.record
    #     
    #     logger.info(f"Processing Supabase webhook: {event_type} for user {user_data.id}")
    #     
    #     if event_type in ["INSERT", "UPDATE"]:
    #         # Create or update user and profile in local database
    #         await upsert_user_from_supabase(db, user_data)
    #         
    #     elif event_type == "DELETE":
    #         # Soft delete user in local database
    #         await soft_delete_user(db, user_data.id)
    #     
    #     else:
    #         logger.warning(f"Unhandled webhook event type: {event_type}")
    #     
    #     return {"status": "success", "message": f"Processed {event_type} event for user {user_data.id}"}
    #     
    # except HTTPException:
    #     raise
    # except Exception as e:
    #     logger.error(f"Webhook processing failed: {str(e)}", exc_info=True)
    #     raise HTTPException(status_code=500, detail="Webhook processing failed")


async def upsert_user_from_supabase(db: AsyncSession, user_data):
    """
    Create or update a user in the local database from Supabase webhook data
    """
    try:
        # Check if user already exists
        result = await db.execute(
            select(Users).where(Users.id == user_data.id)
        )
        existing_user = result.scalar_one_or_none()
        
        # Extract role from raw_app_meta_data or raw_user_meta_data
        role = None
        if user_data.raw_app_meta_data and isinstance(user_data.raw_app_meta_data, dict):
            role = user_data.raw_app_meta_data.get("role")
        if not role and user_data.raw_user_meta_data and isinstance(user_data.raw_user_meta_data, dict):
            role = user_data.raw_user_meta_data.get("role")
        
        if existing_user:
            # Update existing user
            existing_user.email = user_data.email
            existing_user.phone = user_data.phone
            existing_user.role = role
            existing_user.email_confirmed_at = user_data.email_confirmed_at
            existing_user.phone_confirmed_at = user_data.phone_confirmed_at
            existing_user.last_sign_in_at = user_data.last_sign_in_at
            existing_user.raw_app_meta_data = user_data.raw_app_meta_data
            existing_user.raw_user_meta_data = user_data.raw_user_meta_data
            existing_user.is_super_admin = user_data.is_super_admin
            existing_user.banned_until = user_data.banned_until
            existing_user.updated_at = user_data.updated_at or datetime.utcnow()
            existing_user.deleted_at = None  # Clear deletion if user is being updated
            
            logger.info(f"Updated existing user {user_data.id} in local database")
        else:
            # Create new user
            new_user = Users(
                id=user_data.id,
                email=user_data.email,
                phone=user_data.phone,
                role=role,
                email_confirmed_at=user_data.email_confirmed_at,
                phone_confirmed_at=user_data.phone_confirmed_at,
                last_sign_in_at=user_data.last_sign_in_at,
                raw_app_meta_data=user_data.raw_app_meta_data,
                raw_user_meta_data=user_data.raw_user_meta_data,
                is_super_admin=user_data.is_super_admin,
                banned_until=user_data.banned_until,
                created_at=user_data.created_at or datetime.utcnow(),
                updated_at=user_data.updated_at or datetime.utcnow(),
                # Set defaults for required fields
                is_sso_user=False,
                is_anonymous=False,
                # Set token fields to None to avoid unique constraint violations
                email_change_token_current=None,
                email_change_token_new=None,
                confirmation_token=None,
                recovery_token=None,
                phone_change_token=None,
                reauthentication_token=None,
            )
            
            db.add(new_user)
            logger.info(f"Created new user {user_data.id} in local database")
        
        await db.commit()
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Failed to upsert user {user_data.id}: {str(e)}", exc_info=True)
        raise


async def soft_delete_user(db: AsyncSession, user_id: uuid.UUID):
    """
    Soft delete a user by setting deleted_at timestamp
    """
    try:
        result = await db.execute(
            select(Users).where(Users.id == user_id)
        )
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

