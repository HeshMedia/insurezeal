"""
Public admin routes that don't require authentication
These are for one-time setup operations like creating the first superadmin
"""

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from config import get_db
from .schemas import SuperadminPromotionRequest, UserRoleUpdateResponse
from models import UserProfile, Users
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/public", tags=["Public Admin"])


# TODO: ek baar webhook implement honge to idr aisa krna hai ki ab users.auth me to update ho hi sath me jo naya user table hai udr b update ho na role and ofc user_profile me bhi
# TODO: ek baar superadmins sab bnajeynge tab ye route ko remove krna hai yaad rkahne ko TODO hai ye
@router.post("/promote-to-superadmin", response_model=UserRoleUpdateResponse)
async def promote_to_superadmin(
    promotion_request: SuperadminPromotionRequest, db: AsyncSession = Depends(get_db)
):
    """
    Open route to promote a user to superadmin role.
    This is intended for initial setup and should be used sparingly.

    Requires both user_id and email for verification to prevent accidental promotions.
    """
    from config import get_supabase_admin_client
    from uuid import UUID

    try:
        updated_in_database = False
        updated_in_supabase = False

        try:
            result = await db.execute(
                select(UserProfile, Users.email, Users)
                .join(Users, UserProfile.user_id == Users.id)
                .where(UserProfile.user_id == promotion_request.user_id)
            )
            user_data = result.first()

            if not user_data:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User with ID {promotion_request.user_id} not found in database",
                )

            user_profile, user_email, user_record = user_data

            if user_email != promotion_request.email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email does not match the user record. Cannot promote to superadmin.",
                )

            # Update UserProfile role
            user_profile.user_role = "superadmin"

            # Update Users table role field
            user_record.role = "superadmin"

            await db.commit()
            updated_in_database = True
            logger.info(
                f"Updated role in both UserProfile and Users tables for user {promotion_request.user_id} to superadmin"
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to update role in database: {str(e)}")
            await db.rollback()

        try:
            supabase_admin = get_supabase_admin_client()

            logger.info(
                f"Attempting to update user {promotion_request.user_id} in Supabase auth.users"
            )

            # Try to update Supabase auth.users metadata
            response = supabase_admin.auth.admin.update_user_by_id(
                uid=str(promotion_request.user_id),
                attributes={"user_metadata": {"role": "superadmin"}},
            )

            logger.info(f"Supabase update response received")

            if response and response.user:
                updated_in_supabase = True
                logger.info(
                    f"Successfully updated role in Supabase auth.users for user {promotion_request.user_id} to superadmin"
                )
            else:
                logger.error(
                    f"Failed to update role in Supabase for user {promotion_request.user_id}: No user in response"
                )

        except Exception as e:
            logger.error(f"Failed to update role in Supabase auth.users: {str(e)}")
            logger.error(f"Exception type: {type(e)}")
            if hasattr(e, "details"):
                logger.error(f"Supabase error details: {e.details}")
            if hasattr(e, "message"):
                logger.error(f"Supabase error message: {e.message}")
            # Don't fail the entire operation if Supabase update fails
            # The user can still work with the local database role

        if updated_in_database and updated_in_supabase:
            success = True
            message = f"Successfully promoted user to superadmin in both local database and Supabase auth"
        elif updated_in_database:
            success = True  # Still successful since local database is primary
            message = f"Promoted to superadmin in local database (UserProfile + Users tables), but failed to sync with Supabase auth. User can still access superadmin features."
        elif updated_in_supabase:
            success = False
            message = f"Updated role in Supabase auth but failed to update local database. This creates inconsistent state - please try again."
        else:
            success = False
            message = "Failed to promote user to superadmin in both local database and Supabase auth"

        return UserRoleUpdateResponse(
            success=success,
            message=message,
            user_id=promotion_request.user_id,
            new_role="superadmin",
            updated_in_supabase=updated_in_supabase,
            updated_in_database=updated_in_database,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error promoting user to superadmin: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while promoting the user to superadmin",
        )
