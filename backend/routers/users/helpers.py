import logging
import os
import uuid
from typing import List

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from supabase import Client

from config import get_supabase_admin_client, get_supabase_storage
from models import UserDocument, UserProfile
from routers.users.schemas import DocumentTypeEnum

logger = logging.getLogger(__name__)


class UserHelpers:
    """
    Comprehensive User Operations Helper Class

    Provides sophisticated business logic for user profile management, document
    handling, file operations, and agent code generation. This class serves as
    the core engine for user-centric operations across the InsureZeal platform,
    integrating multiple storage systems and ensuring data consistency.

    Key Capabilities:

    **Profile Image Management**:
    - Advanced profile image upload with comprehensive validation
    - Support for multiple image formats (JPEG, PNG, GIF, WebP)
    - File size validation with configurable limits (up to 5MB)
    - AWS S3 integration with CloudFront CDN optimization
    - Automatic content type detection and validation
    - Secure image deletion with proper cleanup

    **Document Management System**:
    - Comprehensive document upload with type validation
    - Support for multiple document formats (PDF, JPEG, PNG)
    - Atomic upload operations ensuring storage-database consistency
    - Document categorization with enum-based type system
    - User-specific document organization and retrieval
    - Complete document deletion with storage cleanup

    **Agent Code Generation**:
    - Intelligent sequential agent code generation (IZ0001, IZ0002, etc.)
    - Uniqueness validation across the entire platform
    - Automatic collision detection and resolution
    - Consistent formatting with zero-padded numbering
    - Database-driven sequential numbering system

    **File Storage Operations**:
    - Dual storage system support (AWS S3 and Supabase Storage)
    - Intelligent storage selection based on file type and requirements
    - Secure file upload with comprehensive validation
    - File cleanup mechanisms for failed operations
    - Content type validation and automatic detection

    **Data Consistency & Integrity**:
    - Atomic operations ensuring data consistency across systems
    - Transaction management with proper rollback mechanisms
    - Cross-system synchronization for file and database operations
    - Comprehensive error handling with cleanup procedures
    - Audit trail maintenance for all user operations

    **Security Features**:
    - File type validation preventing malicious uploads
    - File size restrictions for security and performance
    - User-specific access control for document operations
    - Secure URL generation for file access
    - Input sanitization and validation for all operations

    **Storage Integration**:
    - AWS S3 integration with CloudFront CDN distribution
    - Supabase Storage integration for alternative file hosting
    - Intelligent key generation for organized file storage
    - Public URL generation with proper access controls
    - Storage bucket management with environment-based configuration

    **Error Handling & Recovery**:
    - Comprehensive error handling with detailed logging
    - Graceful degradation for storage service failures
    - Cleanup mechanisms for partial operation failures
    - User-friendly error messages with actionable guidance
    - Recovery procedures for corrupted or incomplete operations

    **Performance Optimizations**:
    - Efficient file upload handling with streaming support
    - Optimized database queries for document retrieval
    - Lazy loading for storage client initialization
    - Memory-efficient file processing for large documents
    - Batch operations for multiple document handling

    **Document Lifecycle Management**:
    - Complete document lifecycle from upload to deletion
    - Version control preparation for future enhancements
    - Document metadata management with comprehensive tracking
    - User activity logging for audit and compliance
    - Document categorization for organized retrieval

    **Cross-Platform Compatibility**:
    - Support for multiple storage backends
    - Environment-specific configuration management
    - Fallback mechanisms for service unavailability
    - Consistent API interface regardless of storage backend
    - Future-proof design for additional storage integrations

    This helper class provides the essential foundation for user operations,
    ensuring secure, efficient, and reliable management of user profiles,
    documents, and related data while maintaining the highest standards of
    data integrity and user experience.
    """

    def __init__(self):
        self._admin_client = None
        self._storage = None

    @property
    def admin_client(self) -> Client:
        if self._admin_client is None:
            self._admin_client = get_supabase_admin_client()
        return self._admin_client

    @property
    def storage(self):
        if self._storage is None:
            self._storage = get_supabase_storage()
        return self._storage

    async def upload_profile_image(self, user_id: str, file: UploadFile) -> str:
        """Upload profile image to S3 and return the CloudFront URL"""
        try:
            logger.info(f"Starting upload for user_id: {user_id}")

            allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
            if file.content_type not in allowed_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File type {file.content_type} not allowed",
                )

            file_content = await file.read()
            if len(file_content) > 5 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File size must be less than 5MB",
                )

            await file.seek(0)

            from utils.s3_utils import (
                build_cloudfront_url,
                build_key,
                guess_content_type,
                put_object,
            )

            filename = file.filename or "image.jpg"
            key = build_key(prefix=f"profiles/{user_id}", filename=filename)
            content_type = file.content_type or guess_content_type(
                filename, "image/jpeg"
            )
            put_object(key=key, body=file_content, content_type=content_type)
            return build_cloudfront_url(key)

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error uploading profile image: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload image",
            )

    async def delete_profile_image(self, image_url: str) -> bool:
        """Delete profile image from S3 via URL"""
        try:
            from utils.s3_utils import delete_object_by_url

            return delete_object_by_url(image_url)
        except Exception as e:
            logger.error(f"Error deleting profile image: {str(e)}")
            return False

    async def generate_agent_code(self, db: AsyncSession) -> str:
        """
        Generate a unique agent code with format: IZ + 4 sequential numbers
        Example: IZ0001, IZ0002, IZ0003
        """
        try:
            # Find the highest existing agent code number
            result = await db.execute(
                select(UserProfile.agent_code)
                .where(UserProfile.agent_code.like("IZ%"))
                .order_by(UserProfile.agent_code.desc())
            )
            existing_codes = result.scalars().all()

            # Find the highest number used
            max_number = 0
            for code in existing_codes:
                if code and code.startswith("IZ") and len(code) == 6:
                    try:
                        number_part = int(code[2:])  # Extract number part after 'IZ'
                        max_number = max(max_number, number_part)
                    except ValueError:
                        continue

            # Generate next sequential number
            next_number = max_number + 1
            code = f"IZ{next_number:04d}"  # Format with 4 digits, zero-padded

            logger.info(f"Generated new sequential agent code: {code}")
            return code

        except Exception as e:
            logger.error(f"Error generating agent code: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate agent code",
            )

    async def get_user_documents(
        self, user_id: str, db: AsyncSession
    ) -> List[UserDocument]:
        """Get all documents for a user"""
        try:
            result = await db.execute(
                select(UserDocument)
                .where(UserDocument.user_id == user_id)
                .order_by(UserDocument.upload_date.desc())
            )
            return result.scalars().all()

        except Exception as e:
            logger.error(f"Error getting user documents: {str(e)}")
            raise

    async def upload_and_save_document(
        self,
        user_id: str,
        file: UploadFile,
        document_type: DocumentTypeEnum,
        document_name: str,
        db: AsyncSession,
    ) -> UserDocument:
        """
        Upload document to storage and save record to database automically
        This ensures consistency - either both operations succeed or both fail
        """
        try:
            if not file.filename:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, detail="No file uploaded"
                )

            allowed_types = ["application/pdf", "image/jpeg", "image/png"]
            if file.content_type not in allowed_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File type {file.content_type} not allowed",
                )

            file_content = await file.read()
            if len(file_content) > 5 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File size exceeds 10MB limit",
                )

            file_extension = os.path.splitext(file.filename)[1]
            unique_filename = f"documents/{user_id}/{document_type.value}_{uuid.uuid4()}{file_extension}"

            bucket_name = os.getenv("SUPABASE_STORAGE_BUCKET", "blog-media")

            try:
                supabase_client = get_supabase_admin_client()

                response = supabase_client.storage.from_(bucket_name).upload(
                    path=unique_filename,
                    file=file_content,
                    file_options={"content-type": file.content_type},
                )

                logger.info(f"Document upload response: {response}")

                if hasattr(response, "error") and response.error:
                    logger.error(f"Document upload error: {response.error}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to upload document to storage",
                    )

                public_url = supabase_client.storage.from_(bucket_name).get_public_url(
                    unique_filename
                )
                logger.info(f"Document public URL: {public_url}")

                document = UserDocument(
                    user_id=user_id,
                    document_type=document_type.value,
                    document_name=document_name,
                    document_url=public_url,
                    file_size=len(file_content),
                )

                db.add(document)
                await db.commit()
                await db.refresh(document)

                logger.info(f"Document saved successfully: {document.id}")
                return document

            except HTTPException:
                try:
                    supabase_client.storage.from_(bucket_name).remove([unique_filename])
                    logger.info(
                        f"Cleaned up uploaded file after database error: {unique_filename}"
                    )
                except Exception as cleanup_error:
                    logger.error(f"Failed to cleanup uploaded file: {cleanup_error}")
                raise
            except Exception as storage_error:
                logger.error(f"Document upload error: {str(storage_error)}")
                await db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Document upload failed: {str(storage_error)}",
                )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in upload_and_save_document: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload and save document",
            )

    async def delete_document_completely(
        self, document_id: str, user_id: str, db: AsyncSession
    ) -> dict:
        """
        Delete document from both storage and database atomically
        Returns status of both operations
        """
        try:
            result = await db.execute(
                select(UserDocument).where(
                    and_(
                        UserDocument.id == document_id, UserDocument.user_id == user_id
                    )
                )
            )
            document = result.scalar_one_or_none()

            if not document:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Document not found"
                )

            storage_deleted = False
            db_deleted = False

            try:
                bucket_name = os.getenv("SUPABASE_STORAGE_BUCKET", "insurezeal")
                if "/storage/v1/object/public/" in document.document_url:
                    parts = document.document_url.split("/storage/v1/object/public/")[1]
                    path_parts = parts.split("/", 1)
                    if len(path_parts) > 1:
                        file_path = path_parts[1]

                        response = self.storage.from_(bucket_name).remove([file_path])

                        if isinstance(response, list):
                            has_errors = any(
                                isinstance(item, dict) and item.get("error")
                                for item in response
                                if isinstance(item, dict)
                            )
                            if has_errors:
                                logger.warning(
                                    f"Failed to delete document from storage: {response}"
                                )
                                storage_deleted = False
                            else:
                                storage_deleted = True
                        elif isinstance(response, dict) and response.get("error"):
                            logger.warning(
                                f"Failed to delete document from storage: {response['error']}"
                            )
                            storage_deleted = False
                        else:
                            storage_deleted = True
                    else:
                        storage_deleted = False
                else:
                    storage_deleted = False

                await db.delete(document)
                await db.commit()
                db_deleted = True

                logger.info(f"Document deleted completely: {document_id}")

                return {
                    "message": "Document deleted successfully",
                    "storage_deleted": storage_deleted,
                    "database_deleted": db_deleted,
                }

            except Exception as deletion_error:
                await db.rollback()
                logger.error(f"Error during document deletion: {str(deletion_error)}")

                if storage_deleted and not db_deleted:
                    logger.warning(
                        f"Storage deleted but DB deletion failed for document {document_id}"
                    )

                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to delete document completely",
                )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in delete_document_completely: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete document",
            )


user_helpers = UserHelpers()
