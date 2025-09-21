"""
AWS S3 utilities for Insurezeal Backend API.

This module provides utilities for interacting with AWS S3 for file storage,
including presigned URL generation, file uploads, CloudFront URL building,
and file deletion. It handles all S3 operations needed by the insurance platform.
"""

import uuid
import mimetypes
import logging
from urllib.parse import urlparse
from typing import Optional

import boto3
from botocore.exceptions import ClientError
from fastapi import HTTPException, status
from botocore.config import Config

from config import (
    AWS_REGION,
    AWS_S3_BUCKET,
    CLOUDFRONT_DOMAIN,
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    PRESIGNED_URL_EXPIRES_SECONDS,
)

logger = logging.getLogger(__name__)


def get_s3_client():
    """
    Create and configure AWS S3 client with proper credentials and settings.

    Returns:
        boto3.client: Configured S3 client for AWS operations

    Note:
        Uses IAM roles when credentials are not explicitly provided,
        falling back to environment variables or instance metadata.
    """
    cfg = Config(
        signature_version="s3v4",
        s3={"addressing_style": "virtual"},
        region_name=AWS_REGION,
    )
    kwargs = {
        "region_name": AWS_REGION,
        "config": cfg,
        "endpoint_url": f"https://s3.{AWS_REGION}.amazonaws.com",
    }

    # Use explicit credentials if provided, otherwise rely on IAM roles
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        kwargs["aws_access_key_id"] = AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY

    return boto3.client("s3", **kwargs)


def build_key(prefix: str, filename: str) -> str:
    """
    Generate a unique S3 object key with proper prefix and file extension.

    Args:
        prefix: S3 key prefix (e.g., 'policies', 'documents')
        filename: Original filename to extract extension from

    Returns:
        str: Unique S3 object key in format 'prefix/uuid.ext'

    Example:
        build_key('policies', 'insurance.pdf') -> 'policies/12345-uuid.pdf'
    """
    ext = f".{filename.split('.')[-1].lower()}" if "." in filename else ""
    return f"{prefix}/{uuid.uuid4()}{ext}"


def build_cloudfront_url(key: str) -> str:
    """
    Build CloudFront URL for S3 object to serve files through CDN.

    Args:
        key: S3 object key

    Returns:
        str: CloudFront URL for the object, falls back to S3 direct URL

    Note:
        CloudFront provides better performance and caching for file delivery.
        Fallback ensures files are still accessible even without CloudFront config.
    """
    domain = (
        (CLOUDFRONT_DOMAIN or "")
        .strip()
        .lstrip("https://")
        .lstrip("http://")
        .rstrip("/")
    )

    if not domain:
        logger.warning("CloudFront domain not configured, using S3 direct URL")
        return f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"

    return f"https://{domain}/{key}"


def generate_presigned_put_url(
    key: str, content_type: Optional[str] = None, expires_in: Optional[int] = None
) -> str:
    """
    Generate presigned URL for direct client-side file uploads to S3.

    Args:
        key: S3 object key where file will be stored
        content_type: MIME type of the file being uploaded
        expires_in: URL expiration time in seconds

    Returns:
        str: Presigned PUT URL for direct upload

    Raises:
        HTTPException: If S3 bucket not configured or presigned URL generation fails

    Note:
        Presigned URLs allow secure direct uploads without exposing AWS credentials
        to clients. The URL expires after the specified time for security.
    """
    if not AWS_S3_BUCKET:
        logger.error("S3 bucket not configured for presigned URL generation")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3 bucket not configured",
        )

    client = get_s3_client()
    params = {"Bucket": AWS_S3_BUCKET, "Key": key}

    if content_type:
        params["ContentType"] = content_type

    try:
        presigned_url = client.generate_presigned_url(
            "put_object",
            Params=params,
            ExpiresIn=expires_in or PRESIGNED_URL_EXPIRES_SECONDS,
        )
        logger.info(f"Generated presigned URL for key: {key}")
        return presigned_url
    except ClientError as e:
        logger.error(f"Failed to generate presigned URL for key {key}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate S3 URL: {str(e)}",
        )


def put_object(key: str, body: bytes, content_type: str):
    """
    Upload file data directly to S3.

    Args:
        key: S3 object key where file will be stored
        body: File content as bytes
        content_type: MIME type of the file

    Raises:
        HTTPException: If upload fails

    Note:
        Used for server-side uploads when presigned URLs are not suitable.
        For large files or client uploads, prefer presigned URLs.
    """
    try:
        get_s3_client().put_object(
            Bucket=AWS_S3_BUCKET, Key=key, Body=body, ContentType=content_type
        )
        logger.info(f"Successfully uploaded object to S3 key: {key}")
    except ClientError as e:
        logger.error(f"S3 upload failed for key {key}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"S3 upload failed: {str(e)}",
        )


def extract_key_from_url(url: str) -> Optional[str]:
    """
    Extract S3 object key from CloudFront or S3 URL.

    Args:
        url: Full URL to S3 object

    Returns:
        Optional[str]: S3 object key or None if extraction fails

    Example:
        extract_key_from_url('https://cdn.example.com/files/doc.pdf') -> 'files/doc.pdf'
    """
    return urlparse(url).path.lstrip("/")


def delete_object_by_url(url: str) -> bool:
    """
    Delete S3 object using its URL.

    Args:
        url: Full URL to the S3 object to delete

    Returns:
        bool: True if deletion successful, False otherwise

    Note:
        This is used for cleanup operations when removing policy documents
        or other uploaded files from the system.
    """
    try:
        key = extract_key_from_url(url)
        if not key:
            logger.warning(f"Could not extract S3 key from URL: {url}")
            return False

        get_s3_client().delete_object(Bucket=AWS_S3_BUCKET, Key=key)
        logger.info(f"Successfully deleted S3 object: {key}")
        return True
    except ClientError as e:
        logger.error(f"Failed to delete S3 object from URL {url}: {str(e)}")
        return False


def guess_content_type(filename: str, default: str) -> str:
    """
    Determine MIME type from filename extension.

    Args:
        filename: Name of the file
        default: Default MIME type if detection fails

    Returns:
        str: MIME type for the file

    Note:
        Proper content type ensures files are served correctly by browsers
        and handled appropriately by S3 and CloudFront.
    """
    ctype, _ = mimetypes.guess_type(filename)
    return ctype or default
