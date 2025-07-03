from supabase import Client
from fastapi import HTTPException, status
from config import get_supabase_client, get_supabase_admin_client, JWT_SECRET_KEY, JWT_ALGORITHM
import logging
import jwt

logger = logging.getLogger(__name__)

class AuthHelpers:
    """Helper functions for authentication operations"""
    
    def __init__(self):
        self._supabase = None
        self._admin_client = None
    
    @property
    def supabase(self) -> Client:
        if self._supabase is None:
            self._supabase = get_supabase_client()
        return self._supabase
    
    @property
    def admin_client(self) -> Client:
        if self._admin_client is None:
            self._admin_client = get_supabase_admin_client()
        return self._admin_client
    
    def verify_token(self, token: str):
        """
        Verify JWT token locally without calling Supabase API
        Returns user object with role from JWT
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
                    "verify_aud": False  
                }
            )

            user_id = payload.get("sub") 
            email = payload.get("email")
            user_metadata = payload.get("user_metadata", {})
            role = user_metadata.get("role")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, 
                    detail="Invalid token: missing user ID"
                )
            
            return type('User', (), {
                'id': user_id,
                'email': email,
                'role': role,
                'payload': payload
            })()
                
        except jwt.ExpiredSignatureError:
            logger.warning("JWT token expired")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Token expired"
            )
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Invalid token"
            )
        except Exception as e:
            logger.error(f"JWT verification failed: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Token verification failed"
            )
    
    async def refresh_token(self, refresh_token: str):
        """Refresh access token using refresh token"""
        try:
            auth_response = self.supabase.auth.refresh_session(refresh_token)
            
            if auth_response.session is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid refresh token"
                )
            
            return auth_response.session
            
        except Exception as e:
            logger.error(f"Token refresh error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

auth_helpers = AuthHelpers()