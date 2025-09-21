"""
User management router for Insurezeal Backend API.

This module provides user profile management functionality including profile
updates, document uploads, and user data management. It handles both personal
information and document management for insurance agents and other users.

Key Features:
- User profile retrieval and updates
- Document upload and management (KYC, certificates, etc.)
- Profile image upload with S3 integration
- User document history and tracking
- Secure file handling with presigned URLs
- Integration with authentication system
"""

from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from config import get_db
from models import UserProfile, UserDocument
from routers.auth.auth import get_current_user
from .schemas import (
    UserProfileUpdate,
    UserProfileResponse,
    ProfileImageUpload,
    DocumentUploadResponse,
    DocumentListResponse,
)
from .helpers import user_helpers
from utils.model_utils import model_data_from_orm
from typing import Optional
import logging
import os
from datetime import datetime
from utils.s3_utils import (
    build_key,
    build_cloudfront_url,
    generate_presigned_put_url,
    guess_content_type,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])

security = HTTPBearer()


@router.get("/me", response_model=UserProfileResponse)
async def get_current_user_profile(
    current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """
    Get current user's profile information with document URLs.

    Retrieves the complete profile information for the authenticated user,
    including personal details and associated document URLs. This endpoint
    is used for profile display and management interfaces.

    Returns:
        UserProfileResponse: Complete user profile with document links

    Raises:
        HTTPException: If user profile is not found in the database

    Note:
        Document URLs are generated dynamically to ensure they remain valid
        and reflect the current state of uploaded documents.
    """
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == current_user["user_id"])
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
        )

    try:
        documents = await user_helpers.get_user_documents(str(profile.user_id), db)
        document_urls = {doc.document_type: doc.document_url for doc in documents}
    except Exception as e:
        logger.warning(
            f"Could not fetch documents for user {profile.user_id}: {str(e)}"
        )
        document_urls = {}

    profile_data = model_data_from_orm(
        profile, {"email": current_user["email"], "document_urls": document_urls}
    )

    return UserProfileResponse.model_validate(profile_data)


@router.put("/me", response_model=UserProfileResponse)
async def update_current_user_profile(
    profile_update: UserProfileUpdate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Dual route for both creating and updating user profile"""
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == current_user["user_id"])
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        if profile_update.username and profile_update.username != profile.username:
            result = await db.execute(
                select(UserProfile).where(
                    and_(
                        UserProfile.username == profile_update.username,
                        UserProfile.id != profile.id,
                    )
                )
            )
            existing_user = result.scalar_one_or_none()
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken",
                )

        # Check if user needs an agent code assignment
        # This handles both new agent registrations and existing users without agent codes
        is_agent_registration = any(
            [
                profile_update.bank_name,
                profile_update.account_number,
                profile_update.ifsc_code,
                profile_update.education_level,
            ]
        )

        # Automatically assign agent code if:
        # 1. User is doing agent registration (has banking/education info), OR
        # 2. User doesn't have an agent code yet (for existing users)
        if (
            is_agent_registration or not getattr(profile, "agent_code", None)
        ) and not getattr(profile, "agent_code", None):
            agent_code = await user_helpers.generate_agent_code(db)
            setattr(profile, "agent_code", agent_code)
            logger.info(
                f"Assigned agent code {agent_code} to user {current_user['user_id']}"
            )

        update_data = profile_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(profile, field, value)

        profile.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(profile)

        try:
            documents = await user_helpers.get_user_documents(str(profile.user_id), db)
            document_urls = {doc.document_type: doc.document_url for doc in documents}
        except Exception as e:
            logger.warning(
                f"Could not fetch documents for user {profile.user_id}: {str(e)}"
            )
            document_urls = {}

        profile_data = model_data_from_orm(
            profile, {"email": current_user["email"], "document_urls": document_urls}
        )

        return UserProfileResponse.model_validate(profile_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user profile: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update profile",
        )


@router.post("/me/profile-image", response_model=ProfileImageUpload)
async def upload_profile_image(
    filename: str = Form(
        ..., description="Profile image filename (JPEG, PNG, GIF, or WebP)"
    ),
    content_type: Optional[str] = Form(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a new profile image using presigned URL

    Accepts image files in the following formats:
    - JPEG (.jpg, .jpeg)
    - PNG (.png)
    - GIF (.gif)
    - WebP (.webp)

    Returns a presigned URL for direct upload to S3
    """
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == current_user["user_id"])
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        # Delete existing avatar if any
        if profile.avatar_url:
            try:
                await user_helpers.delete_profile_image(profile.avatar_url)
            except Exception:
                pass

        key = build_key(prefix=f"profiles/{profile.id}", filename=filename)
        ctype = content_type or guess_content_type(filename, "image/jpeg")
        upload_url = generate_presigned_put_url(key=key, content_type=ctype)
        image_url = build_cloudfront_url(key)

        profile.avatar_url = image_url
        profile.updated_at = datetime.utcnow()
        await db.commit()

        return ProfileImageUpload(
            avatar_url=image_url,
            message="Presigned URL generated successfully; upload directly to S3.",
            upload_url=upload_url,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading profile image: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload profile image",
        )


@router.delete("/me/profile-image")
async def delete_profile_image(
    current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Delete current user's profile image"""
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == current_user["user_id"])
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        if not profile.avatar_url:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="No profile image found"
            )

        deleted = await user_helpers.delete_profile_image(profile.avatar_url)

        profile.avatar_url = None
        profile.updated_at = datetime.utcnow()

        await db.commit()

        return {
            "message": "Profile image deleted successfully",
            "storage_deleted": deleted,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting profile image: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete profile image",
        )


@router.post("/documents/upload", response_model=DocumentUploadResponse)
async def upload_document(
    document_type: str = Form(
        ..., description="Document type - any string provided by frontend (required)"
    ),
    filename: str = Form(..., description="Document filename for upload"),
    content_type: str | None = Form(None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a document for agent registration using presigned URL

    Accepts document files in the following formats:
    - PDF (.pdf)
    - JPEG (.jpg, .jpeg)
    - PNG (.png)

    - **document_type**: Document type - accepts any string from frontend (required)
    - **filename**: Document filename for upload
    - **content_type**: MIME type of the file (optional)

    The filename will be used both for the S3 key and as the document name in the database.
    If the same document type is uploaded again, it will update the existing entry.
    Returns a presigned URL for direct upload to S3.
    """
    try:
        logger.info(
            f"📄 DOCUMENT UPLOAD: Processing document_type='{document_type}' for presigned upload"
        )

        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == current_user["user_id"])
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        # Validate file extension
        allowed_extensions = [".pdf", ".jpg", ".jpeg", ".png"]
        file_ext = os.path.splitext(filename)[1].lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file_ext} not allowed. Allowed: {', '.join(allowed_extensions)}",
            )

        # Validate document_type
        document_type_clean = document_type.strip() if document_type else ""
        if not document_type_clean:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="'document_type' parameter is required",
            )

        # Generate S3 key and presigned URL
        key = build_key(prefix=f"documents/{profile.user_id}", filename=filename)
        upload_url = generate_presigned_put_url(
            key=key,
            content_type=content_type
            or guess_content_type(filename, "application/pdf"),
        )
        document_url = build_cloudfront_url(key)

        # Check if document with same type already exists
        result = await db.execute(
            select(UserDocument).where(
                and_(
                    UserDocument.user_id == current_user["user_id"],
                    UserDocument.document_type == document_type_clean,
                )
            )
        )
        existing_document = result.scalar_one_or_none()

        if existing_document:
            # Update existing document
            logger.info(
                f"🔵 PRESIGNED: Updating existing document record for type '{document_type_clean}'"
            )

            # Delete old file if it exists
            if existing_document.document_url:
                try:
                    await user_helpers.delete_document_from_storage(
                        existing_document.document_url
                    )
                except Exception as e:
                    logger.warning(f"Could not delete old document: {str(e)}")

            # Update existing record
            existing_document.document_name = filename
            existing_document.document_url = document_url
            existing_document.file_size = (
                0  # Will be updated when file is actually uploaded
            )
            existing_document.upload_date = datetime.utcnow()

            await db.commit()
            await db.refresh(existing_document)

            logger.info(
                f"🔵 PRESIGNED: Updated document record with ID: {existing_document.id}"
            )

            return DocumentUploadResponse.model_validate(
                {
                    **{
                        column.name: getattr(existing_document, column.name)
                        for column in existing_document.__table__.columns
                    },
                    "document_id": str(existing_document.id),
                    "message": f"Presigned URL generated for document type '{document_type_clean}' update; upload directly to S3",
                    "upload_url": upload_url,
                }
            )
        else:
            # Create new document record
            logger.info(
                f"🔵 PRESIGNED: Creating new document record for user {profile.user_id}"
            )
            logger.info(f"🔵 PRESIGNED: Document URL: {document_url}")

            document_record = UserDocument(
                user_id=current_user["user_id"],
                document_type=document_type_clean,
                document_name=filename,
                document_url=document_url,
                file_size=0,  # Will be updated when file is actually uploaded
                upload_date=datetime.utcnow(),
            )

            db.add(document_record)
            await db.commit()
            await db.refresh(document_record)

            logger.info(
                f"🔵 PRESIGNED: New document record created with ID: {document_record.id}"
            )

            return DocumentUploadResponse.model_validate(
                {
                    **{
                        column.name: getattr(document_record, column.name)
                        for column in document_record.__table__.columns
                    },
                    "document_id": str(document_record.id),
                    "message": f"Presigned URL generated for new document type '{document_type_clean}'; upload directly to S3",
                    "upload_url": upload_url,
                }
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload document",
        )


@router.get("/documents", response_model=DocumentListResponse)
async def get_user_documents(
    current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Get all documents uploaded by the current user"""
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == current_user["user_id"])
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        documents = await user_helpers.get_user_documents(str(profile.user_id), db)
        document_responses = [
            DocumentUploadResponse.model_validate(
                {
                    **{
                        column.name: getattr(doc, column.name)
                        for column in doc.__table__.columns
                    },
                    "document_id": str(doc.id),
                    "message": "",
                }
            )
            for doc in documents
        ]

        return DocumentListResponse(
            documents=document_responses, total_count=len(document_responses)
        )

    except Exception as e:
        logger.error(f"Error getting user documents: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve documents",
        )


@router.post("/assign-agent-code")
async def assign_agent_code_to_user(
    current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """
    Manually assign an agent code to the current user if they don't have one.
    This is useful for existing users who registered before automatic agent code assignment.
    """
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == current_user["user_id"])
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        # Check if user already has an agent code
        if profile.agent_code:
            return {
                "message": f"User already has agent code: {profile.agent_code}",
                "agent_code": profile.agent_code,
                "already_assigned": True,
            }

        # Generate and assign new agent code
        agent_code = await user_helpers.generate_agent_code(db)
        profile.agent_code = agent_code
        profile.updated_at = datetime.utcnow()

        await db.commit()
        await db.refresh(profile)

        logger.info(
            f"Manually assigned agent code {agent_code} to user {current_user['user_id']}"
        )

        return {
            "message": f"Agent code assigned successfully: {agent_code}",
            "agent_code": agent_code,
            "already_assigned": False,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning agent code: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign agent code",
        )


@router.post("/admin/bulk-assign-agent-codes")
async def bulk_assign_agent_codes(
    current_user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """
    Admin endpoint to assign agent codes to all users who don't have them.
    Only accessible by admin users.
    """
    try:
        # Check if user is admin or superadmin
        if current_user.get("role") not in ["admin", "superadmin"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin users can perform bulk agent code assignment",
            )

        # Find all users without agent codes
        result = await db.execute(
            select(UserProfile).where(
                and_(UserProfile.agent_code.is_(None), UserProfile.user_role == "agent")
            )
        )
        users_without_codes = result.scalars().all()

        assigned_codes = []
        errors = []

        for user_profile in users_without_codes:
            try:
                agent_code = await user_helpers.generate_agent_code(db)
                user_profile.agent_code = agent_code
                user_profile.updated_at = datetime.utcnow()

                assigned_codes.append(
                    {
                        "user_id": str(user_profile.user_id),
                        "username": user_profile.username,
                        "agent_code": agent_code,
                    }
                )

                logger.info(
                    f"Bulk assigned agent code {agent_code} to user {user_profile.username}"
                )

            except Exception as e:
                error_msg = f"Failed to assign agent code to user {user_profile.username}: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)

        await db.commit()

        return {
            "message": f"Bulk assignment completed. Assigned {len(assigned_codes)} agent codes.",
            "assigned_codes": assigned_codes,
            "total_assigned": len(assigned_codes),
            "total_errors": len(errors),
            "errors": errors,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in bulk agent code assignment: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to perform bulk agent code assignment",
        )


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a document automatically from both storage and database"""
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.user_id == current_user["user_id"])
        )
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found"
            )

        result = await user_helpers.delete_document_completely(
            document_id, str(profile.user_id), db
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete document",
        )
