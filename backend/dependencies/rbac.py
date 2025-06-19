"""
RBAC dependencies for FastAPI routes
Role-based access control implemented as dependencies that run after authentication
"""
from fastapi import Depends, HTTPException, status, Request
from typing import Dict, Any
import logging

from routers.auth.auth import get_current_user

logger = logging.getLogger(__name__)

RESOURCES_FOR_ROLES = {
    'admin': {        'admin/agents': ['read', 'write', 'delete'],
        'admin/stats': ['read'],
        'admin/child-requests': ['read', 'write', 'update'],
        'admin/cutpay': ['read', 'write', 'update', 'delete'],
        
        'users/me': ['read', 'write'],
        'users/documents': ['read', 'write', 'delete'],
        
        'child/requests': ['read', 'write', 'update'],
        'policies': ['read', 'write', 'manage']
    },
    'agent': {
        'users/me': ['read', 'write'],
        'users/documents': ['read', 'write', 'delete'],
        
        'child/requests': ['read', 'write'],
        'policies': ['read', 'write']
    }
}

def normalize_path(path: str) -> str:
    """Normalize request path for RBAC checking"""
    if path.startswith('/'):
        path = path[1:]

    segments = path.split('/')
    
    if len(segments) == 0:
        return path
    
    if segments[0] == 'admin':
        if len(segments) >= 2:
            if segments[1] == 'cutpay':
                return 'admin/cutpay'
            elif segments[1] == 'agents':
                return 'admin/agents'
            elif segments[1] == 'stats':
                return 'admin/stats'
            elif segments[1] == 'child-requests':
                return 'admin/child-requests'
        return 'admin'
    
    elif segments[0] == 'users':
        if len(segments) >= 2:
            if segments[1] == 'me':
                return 'users/me'
            elif segments[1] == 'documents':
                return 'users/documents'
        return 'users'
    
    elif segments[0] == 'child':
        if len(segments) >= 2:
            if segments[1] == 'requests':
                return 'child/requests'
        return 'child'
    
    return segments[0]

def translate_method_to_action(method: str) -> str:
    """Map HTTP methods to RBAC actions"""
    method_permission_mapping = {
        'GET': 'read',
        'POST': 'write',
        'PUT': 'update',
        'PATCH': 'update',
        'DELETE': 'delete',
    }
    return method_permission_mapping.get(method.upper(), 'read')

def has_permission(user_role: str, resource_name: str, required_permission: str) -> bool:
    """Check if user role has permission for the resource and action"""
    if user_role not in RESOURCES_FOR_ROLES:
        return False
    
    user_permissions = RESOURCES_FOR_ROLES[user_role]
    
    if resource_name in user_permissions:
        return required_permission in user_permissions[resource_name]
    
    parent_resource = resource_name.split('/')[0] if '/' in resource_name else resource_name
    if parent_resource in user_permissions:
        return required_permission in user_permissions[parent_resource]
    
    return False

def require_permission(resource: str = None, permission: str = None):
    """
    Create an RBAC dependency that checks permissions
      Args:
        resource: Specific resource name (auto-detected if not provided)
        permission: Specific permission (auto-detected if not provided)
    """
    def check_rbac(request: Request):
        """RBAC dependency function"""
        try:
            current_user = getattr(request.state, 'current_user', None)
            if not current_user:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
            
            user_role = 'agent' 
            if isinstance(current_user, dict):
                profile = current_user.get('profile')
                if profile:
                    user_role = getattr(profile, 'user_role', 'agent')
            else:
                user_role = getattr(current_user, 'user_role', 'agent')
            
            resource_name = resource or normalize_path(str(request.url.path))
            required_permission = permission or translate_method_to_action(request.method)
            
            logger.info(f"RBAC Check - User: {user_role}, Resource: {resource_name}, Permission: {required_permission}")
            
            if not has_permission(user_role, resource_name, required_permission):
                logger.warning(f"Access denied - User: {user_role}, Resource: {resource_name}, Permission: {required_permission}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied. {user_role.title()} role does not have {required_permission} permission for {resource_name}"
                )
            
            logger.info(f"Access granted - User: {user_role}, Resource: {resource_name}, Permission: {required_permission}")
            return True
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"RBAC dependency error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authorization check failed"
            )
    
    return check_rbac

require_admin_read = require_permission("admin", "read")
require_admin_write = require_permission("admin", "write") 
require_admin_agents = require_permission("admin/agents", "read")
require_admin_agents_write = require_permission("admin/agents", "write")
require_admin_agents_delete = require_permission("admin/agents", "delete")
require_admin_cutpay = require_permission("admin/cutpay", "read")
require_admin_cutpay_write = require_permission("admin/cutpay", "write")
require_admin_cutpay_update = require_permission("admin/cutpay", "update")
require_admin_cutpay_delete = require_permission("admin/cutpay", "delete")
require_admin_stats = require_permission("admin/stats", "read")
require_admin_child_requests = require_permission("admin/child-requests", "read")
require_admin_child_requests_write = require_permission("admin/child-requests", "write")
require_admin_child_requests_update = require_permission("admin/child-requests", "update")
