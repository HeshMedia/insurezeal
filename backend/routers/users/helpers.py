from fastapi import HTTPException, status, UploadFile
from supabase import Client
from config import get_supabase_admin_client, get_supabase_storage
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from models import UserProfile, UserDocument
import uuid
import os
from typing import List, Optional, Dict, Any
import logging
from datetime import datetime, date
from .schemas import DocumentTypeEnum

logger = logging.getLogger(__name__)

class UserHelpers:
    """
    Helper functions for user operations
    
    FUNCTIONS:
    - upload_profile_image() - Profile image upload
    - delete_profile_image() - Profile image deletion
    - generate_agent_code() - Generate unique agent codes
    - get_user_documents() - Retrieve user's documents
    - upload_and_save_document() - Unified document upload + save
    - delete_document_completely() - Unified document deletion
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
        """
        Upload profile image to Supabase Storage and return the public URL
        """        
        try:            
            logger.info(f"Starting upload for user_id: {user_id}")
            
            allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
            if file.content_type not in allowed_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File type {file.content_type} not allowed"
                )
            
            file_content = await file.read()
            if len(file_content) > 5 * 1024 * 1024:  
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File size must be less than 5MB"
                )
        
            await file.seek(0)
            
            file_extension = os.path.splitext(file.filename)[1] if file.filename else '.jpg'
            unique_filename = f"profiles/{user_id}/{uuid.uuid4()}{file_extension}"
            
            bucket_name = os.getenv("SUPABASE_STORAGE_BUCKET", "insurezeal")
            
            try:
                supabase_client = get_supabase_admin_client()
                
                response = supabase_client.storage.from_(bucket_name).upload(
                    path=unique_filename,
                    file=file_content,
                    file_options={"content-type": file.content_type}
                )
                
                logger.info(f"Upload response: {response}")
                
                if hasattr(response, 'error') and response.error:
                    logger.error(f"Upload error: {response.error}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to upload image"
                    )
                
                public_url = supabase_client.storage.from_(bucket_name).get_public_url(unique_filename)
                logger.info(f"Public URL: {public_url}")
                
                return public_url
                
            except Exception as upload_error:
                logger.error(f"Upload error: {str(upload_error)}")
                logger.error(f"Upload error type: {type(upload_error)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Upload failed: {str(upload_error)}"
                )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error uploading profile image: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload image"
            )
    
    async def delete_profile_image(self, image_url: str) -> bool:
        """
        Delete profile image from Supabase Storage
        """
        try:
            bucket_name = os.getenv("SUPABASE_STORAGE_BUCKET", "insurezeal")
            
            if "/storage/v1/object/public/" in image_url:
                parts = image_url.split("/storage/v1/object/public/")[1]
                path_parts = parts.split("/", 1)
                if len(path_parts) > 1:
                    file_path = path_parts[1]  
                    
                    response = self.storage.from_(bucket_name).remove([file_path])
                    
                    if response.get("error"):
                        logger.warning(f"Failed to delete image from storage: {response['error']}")
                        return False
                    
                    return True
              
            return False
            
        except Exception as e:
            logger.error(f"Error deleting profile image: {str(e)}")
            return False   
        
    async def generate_agent_code(self, db: AsyncSession) -> str:
        """Generate a unique agent code"""
        try:
            import random
            import string
            
            while True:
                code = "AG" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                
                result = await db.execute(select(UserProfile).where(UserProfile.agent_code == code))
                if not result.scalar_one_or_none():
                    break
                
            return code
        except Exception as e:
            logger.error(f"Error generating agent code: {str(e)}")
            raise

    async def get_user_documents(self, user_id: str, db: AsyncSession) -> List[UserDocument]:
        """Get all documents for a user"""
        try:
            result = await db.execute(
                select(UserDocument).where(UserDocument.user_id == user_id).order_by(UserDocument.upload_date.desc())
            )
            return result.scalars().all()
            
        except Exception as e:
            logger.error(f"Error getting user documents: {str(e)}")
            raise

    async def upload_and_save_document(self, user_id: str, file: UploadFile,
                                     document_type: DocumentTypeEnum, document_name: str,
                                     db: AsyncSession) -> UserDocument:
        """
        Upload document to storage and save record to database automically
        This ensures consistency - either both operations succeed or both fail
        """
        try:
            if not file.filename:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No file uploaded"
                )
            
            allowed_types = ["application/pdf", "image/jpeg", "image/png"]
            if file.content_type not in allowed_types:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File type {file.content_type} not allowed"
                )
            
            file_content = await file.read()
            if len(file_content) > 5 * 1024 * 1024:  
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File size exceeds 10MB limit"
                )
            
            file_extension = os.path.splitext(file.filename)[1]
            unique_filename = f"documents/{user_id}/{document_type.value}_{uuid.uuid4()}{file_extension}"
            
            bucket_name = os.getenv("SUPABASE_STORAGE_BUCKET", "blog-media")
            
            try:
                supabase_client = get_supabase_admin_client()
                
                response = supabase_client.storage.from_(bucket_name).upload(
                    path=unique_filename,
                    file=file_content,
                    file_options={"content-type": file.content_type}
                )
                
                logger.info(f"Document upload response: {response}")
                
                if hasattr(response, 'error') and response.error:
                    logger.error(f"Document upload error: {response.error}")
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Failed to upload document to storage"
                    )
                
                public_url = supabase_client.storage.from_(bucket_name).get_public_url(unique_filename)
                logger.info(f"Document public URL: {public_url}")
                
                document = UserDocument(
                    user_id=user_id,
                    document_type=document_type.value,
                    document_name=document_name,
                    document_url=public_url,
                    file_size=len(file_content)
                )
                
                db.add(document)
                await db.commit()
                await db.refresh(document)
                
                logger.info(f"Document saved successfully: {document.id}")
                return document
                
            except HTTPException:
                try:
                    supabase_client.storage.from_(bucket_name).remove([unique_filename])
                    logger.info(f"Cleaned up uploaded file after database error: {unique_filename}")
                except Exception as cleanup_error:
                    logger.error(f"Failed to cleanup uploaded file: {cleanup_error}")
                raise
            except Exception as storage_error:
                logger.error(f"Document upload error: {str(storage_error)}")
                await db.rollback()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Document upload failed: {str(storage_error)}"
                )
            
        except HTTPException:            raise
        except Exception as e:
            logger.error(f"Unexpected error in upload_and_save_document: {str(e)}")
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload and save document"
            )

    async def delete_document_completely(self, document_id: str, user_id: str, db: AsyncSession) -> dict:
        """
        Delete document from both storage and database atomically
        Returns status of both operations
        """
        try:
            result = await db.execute(
                select(UserDocument).where(
                    and_(UserDocument.id == document_id, UserDocument.user_id == user_id)
                )
            )
            document = result.scalar_one_or_none()
            
            if not document:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Document not found"
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
                        
                        if response.get("error"):
                            logger.warning(f"Failed to delete document from storage: {response['error']}")
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
                    "database_deleted": db_deleted
                }
                
            except Exception as deletion_error:
                await db.rollback()
                logger.error(f"Error during document deletion: {str(deletion_error)}")
                
                if storage_deleted and not db_deleted:
                    logger.warning(f"Storage deleted but DB deletion failed for document {document_id}")
                
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to delete document completely"
                )
                
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error in delete_document_completely: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete document"
            )

user_helpers = UserHelpers()