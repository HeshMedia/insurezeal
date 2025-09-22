import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from models import Base, UserProfile
from supabase import create_client, Client
import logging

# Setup detailed logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
AWS_S3_BUCKET = os.getenv("AWS_S3_BUCKET")
CLOUDFRONT_DOMAIN = os.getenv("CLOUDFRONT_DOMAIN")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
PRESIGNED_URL_EXPIRES_SECONDS = int(os.getenv("PRESIGNED_URL_EXPIRES_SECONDS", "900"))
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 30
JWT_REFRESH_TOKEN_EXPIRE_DAYS = 7

_supabase_client = None
_supabase_admin_client = None


def get_supabase_client() -> Client:
    global _supabase_client
    if _supabase_client is None:
        if not SUPABASE_URL or not SUPABASE_ANON_KEY:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_ANON_KEY must be set in environment variables"
            )

        _supabase_client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    return _supabase_client


def get_supabase_admin_client() -> Client:
    global _supabase_admin_client
    if _supabase_admin_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables"
            )

        _supabase_admin_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    return _supabase_admin_client


def get_supabase_storage():
    """Get Supabase storage client for file operations"""
    client = get_supabase_admin_client()
    return client.storage


if DATABASE_URL:
    logger.info("Loading configuration from environment variables...")
    logger.info("DATABASE_URL loaded successfully.")
    logger.info("Attempting to create SQLAlchemy async engine...")

    # Create sync URL for legacy routes and alembic
    if DATABASE_URL.startswith("postgresql+asyncpg://"):
        sync_url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    elif DATABASE_URL.startswith("postgres+asyncpg://"):
        sync_url = DATABASE_URL.replace("postgres+asyncpg://", "postgresql://")
    elif DATABASE_URL.startswith("postgresql://"):
        sync_url = DATABASE_URL
    elif DATABASE_URL.startswith("postgres://"):
        sync_url = DATABASE_URL.replace("postgres://", "postgresql://")
    else:
        sync_url = DATABASE_URL

    sync_engine = create_engine(sync_url)

    # Create async URL
    if DATABASE_URL.startswith("postgresql://"):
        asyncpg_url = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
    elif DATABASE_URL.startswith("postgres://"):
        asyncpg_url = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://")
    elif DATABASE_URL.startswith("postgres+asyncpg://"):
        asyncpg_url = DATABASE_URL.replace(
            "postgres+asyncpg://", "postgresql+asyncpg://"
        )
    else:
        asyncpg_url = DATABASE_URL

    if "?" in asyncpg_url:
        base_url = asyncpg_url.split("?")[0]
    else:
        base_url = asyncpg_url

    asyncpg_url = f"{base_url}?prepared_statement_cache_size=0"

    try:
        async_engine = create_async_engine(
            asyncpg_url,
            echo=False,
            pool_pre_ping=True,  # Enable health checks for Coolify
            pool_size=5,
            max_overflow=2,  # Allow some overflow
        )
        logger.info("SQLAlchemy async engine created successfully.")
    except Exception as e:
        logger.critical(
            f"FATAL: Failed to create SQLAlchemy engine: {e}", exc_info=True
        )
        raise

    AsyncSessionLocal = sessionmaker(
        bind=async_engine, class_=AsyncSession, expire_on_commit=False
    )

    # Sync session for legacy routes
    from sqlalchemy.orm import sessionmaker as sync_sessionmaker

    SyncSessionLocal = sync_sessionmaker(bind=sync_engine, expire_on_commit=False)
    logger.info("Attempting to create SQLAlchemy session factory...")
    try:
        AsyncSessionFactory = sessionmaker(
            bind=async_engine, class_=AsyncSession, expire_on_commit=False
        )
        logger.info("SQLAlchemy session factory created successfully.")
    except Exception as e:
        logger.critical(
            f"FATAL: Failed to create SQLAlchemy session factory: {e}", exc_info=True
        )
        raise
else:
    sync_engine = None
    async_engine = None
    AsyncSessionLocal = None
    SyncSessionLocal = None


def get_sync_db():
    """Synchronous database session for legacy routes"""
    if SyncSessionLocal is None:
        raise Exception("Sync database not configured")
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_db():
    if AsyncSessionLocal is None:
        raise Exception("Database not configured")
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    if async_engine is None:
        raise Exception("Database not configured")
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def get_sync_engine():
    if sync_engine is None:
        raise Exception("Database not configured")
    return sync_engine


ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")
DEBUG = ENVIRONMENT == "dev"


# Google Sheets Private Key handling function
def get_google_sheets_private_key():
    """Get Google Sheets private key, supporting both regular and Base64 formats"""
    import base64

    # Try Base64 encoded version first (better for deployment platforms)
    base64_key = os.getenv("GOOGLE_SHEETS_PRIVATE_KEY_BASE64")
    if base64_key:
        try:
            decoded_key = base64.b64decode(base64_key).decode("utf-8")
            logger.info("Using Base64 decoded Google Sheets private key")
            return decoded_key
        except Exception as e:
            logger.error(f"Failed to decode Base64 private key: {e}")

    # Fallback to regular version
    regular_key = os.getenv("GOOGLE_SHEETS_PRIVATE_KEY", "")
    if regular_key:
        # Handle newline escaping
        processed_key = regular_key.replace("\\n", "\n")
        logger.info("Using regular Google Sheets private key")
        return processed_key

    logger.error("No Google Sheets private key found")
    return ""


# Google Sheets Service Account Credentials
GOOGLE_SHEETS_CREDENTIALS = {
    "type": os.getenv("GOOGLE_SHEETS_TYPE"),
    "project_id": os.getenv("GOOGLE_SHEETS_PROJECT_ID"),
    "private_key_id": os.getenv("GOOGLE_SHEETS_PRIVATE_KEY_ID"),
    "private_key": get_google_sheets_private_key(),
    "client_email": os.getenv("GOOGLE_SHEETS_CLIENT_EMAIL"),
    "client_id": os.getenv("GOOGLE_SHEETS_CLIENT_ID"),
    "auth_uri": os.getenv("GOOGLE_SHEETS_AUTH_URI"),
    "token_uri": os.getenv("GOOGLE_SHEETS_TOKEN_URI"),
    "auth_provider_x509_cert_url": os.getenv(
        "GOOGLE_SHEETS_AUTH_PROVIDER_X509_CERT_URL"
    ),
    "client_x509_cert_url": os.getenv("GOOGLE_SHEETS_CLIENT_X509_CERT_URL"),
    "universe_domain": os.getenv("GOOGLE_SHEETS_UNIVERSE_DOMAIN"),
}
GOOGLE_SHEETS_DOCUMENT_ID = os.getenv("GOOGLE_SHEETS_DOCUMENT_ID")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
LLMWHISPERER_API_KEY = os.getenv("LLMWHISPERER_API_KEY")
