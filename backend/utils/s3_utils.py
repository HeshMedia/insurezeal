import mimetypes
import uuid
from typing import Optional
from urllib.parse import urlparse

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException, status

from config import (
    AWS_ACCESS_KEY_ID,
    AWS_REGION,
    AWS_S3_BUCKET,
    AWS_SECRET_ACCESS_KEY,
    CLOUDFRONT_DOMAIN,
    PRESIGNED_URL_EXPIRES_SECONDS,
)


def get_s3_client():
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
    if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
        kwargs["aws_access_key_id"] = AWS_ACCESS_KEY_ID
        kwargs["aws_secret_access_key"] = AWS_SECRET_ACCESS_KEY
    return boto3.client("s3", **kwargs)


def build_key(prefix: str, filename: str) -> str:
    ext = f".{filename.split('.')[-1].lower()}" if "." in filename else ""
    return f"{prefix}/{uuid.uuid4()}{ext}"


def build_cloudfront_url(key: str) -> str:
    domain = (
        (CLOUDFRONT_DOMAIN or "")
        .strip()
        .lstrip("https://")
        .lstrip("http://")
        .rstrip("/")
    )
    if not domain:
        # Fallback to S3 website-style URL (not ideal, but prevents None)
        return f"https://{AWS_S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{key}"
    return f"https://{domain}/{key}"


def generate_presigned_put_url(
    key: str, content_type: Optional[str] = None, expires_in: Optional[int] = None
) -> str:
    if not AWS_S3_BUCKET:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="S3 bucket not configured",
        )
    client = get_s3_client()
    params = {"Bucket": AWS_S3_BUCKET, "Key": key}
    if content_type:
        params["ContentType"] = content_type
    try:
        return client.generate_presigned_url(
            "put_object",
            Params=params,
            ExpiresIn=expires_in or PRESIGNED_URL_EXPIRES_SECONDS,
        )
    except ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate S3 URL: {str(e)}",
        )


def put_object(key: str, body: bytes, content_type: str):
    try:
        get_s3_client().put_object(
            Bucket=AWS_S3_BUCKET, Key=key, Body=body, ContentType=content_type
        )
    except ClientError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"S3 upload failed: {str(e)}",
        )


def extract_key_from_url(url: str) -> Optional[str]:
    return urlparse(url).path.lstrip("/")


def delete_object_by_url(url: str) -> bool:
    try:
        key = extract_key_from_url(url)
        if not key:
            return False
        get_s3_client().delete_object(Bucket=AWS_S3_BUCKET, Key=key)
        return True
    except ClientError:
        return False


def guess_content_type(filename: str, default: str) -> str:
    ctype, _ = mimetypes.guess_type(filename)
    return ctype or default
