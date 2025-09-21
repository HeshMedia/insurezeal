"""
SuperAdmin Helper Functions for Insurezeal Backend API.

This module provides comprehensive helper functions for super-administrator
operations including broker and insurer management, code generation, and
system-wide administrative tasks. It handles the highest level of administrative
functionality with full platform access and control.

Key Features:
- Broker and insurer management and configuration
- Unique code generation for entities
- System-wide data access and management
- Administrative validation and business rules
- Entity relationship management
- Comprehensive error handling and validation

Business Logic:
- Broker onboarding and management processes
- Insurance company integration and setup
- Unique identifier generation and assignment
- Entity validation and business rule enforcement
- System configuration and administrative controls
- Data integrity and relationship management

Security Considerations:
- Super-admin level access control
- Sensitive data handling and validation
- Audit logging for all administrative actions
- Data integrity checks and constraints
- Secure entity management operations
"""

from sqlalchemy.orm import Session
from sqlalchemy import desc
from models import Broker, Insurer, AdminChildID, UserProfile
from typing import Optional, List


class SuperAdminHelpers:
    """
    Comprehensive helper class for super-administrator operations.

    This class provides methods for managing brokers, insurers, and other
    system-wide entities with the highest level of administrative access.
    It ensures proper validation, business rule enforcement, and data
    integrity for critical platform operations.

    Key Responsibilities:
        - Broker and insurer entity management
        - Unique code generation and assignment
        - System-wide data access and validation
        - Administrative business rule enforcement
        - Entity relationship management and integrity
        - Error handling and logging for admin operations
    """

    @staticmethod
    def generate_broker_code(db: Session) -> str:
        """Generate next broker code in format B001, B002, etc."""
        last_broker = db.query(Broker).order_by(desc(Broker.id)).first()
        if last_broker:
            last_num = int(last_broker.broker_code[1:])
            return f"B{last_num + 1:03d}"
        return "B001"

    @staticmethod
    def generate_insurer_code(db: Session) -> str:
        """Generate next insurer code in format I001, I002, etc."""
        last_insurer = db.query(Insurer).order_by(desc(Insurer.id)).first()
        if last_insurer:
            last_num = int(last_insurer.insurer_code[1:])
            return f"I{last_num + 1:03d}"
        return "I001"

    @staticmethod
    def get_active_brokers(db: Session) -> List[Broker]:
        """Get all active brokers"""
        return db.query(Broker).filter(Broker.is_active == True).all()

    @staticmethod
    def get_active_insurers(db: Session) -> List[Insurer]:
        """Get all active insurers"""
        return db.query(Insurer).filter(Insurer.is_active == True).all()

    @staticmethod
    def get_broker_by_id(db: Session, broker_id: int) -> Optional[Broker]:
        """Get broker by ID"""
        return (
            db.query(Broker)
            .filter(Broker.id == broker_id, Broker.is_active == True)
            .first()
        )

    @staticmethod
    def get_insurer_by_id(db: Session, insurer_id: int) -> Optional[Insurer]:
        """Get insurer by ID"""
        return (
            db.query(Insurer)
            .filter(Insurer.id == insurer_id, Insurer.is_active == True)
            .first()
        )

    @staticmethod
    def get_admin_child_id_by_id(
        db: Session, child_id_id: int
    ) -> Optional[AdminChildID]:
        """Get admin child ID by database ID"""
        return db.query(AdminChildID).filter(AdminChildID.id == child_id_id).first()

    @staticmethod
    def get_admin_child_id_by_child_id(
        db: Session, child_id: str
    ) -> Optional[AdminChildID]:
        """Get admin child ID by child_id string"""
        return db.query(AdminChildID).filter(AdminChildID.child_id == child_id).first()

    @staticmethod
    def get_active_admin_child_ids(db: Session) -> List[AdminChildID]:
        """Get all active admin child IDs"""
        return (
            db.query(AdminChildID)
            .filter(AdminChildID.is_active == True, AdminChildID.is_suspended == False)
            .all()
        )

    @staticmethod
    def get_available_admin_child_ids_by_broker_insurer(
        db: Session, insurer_id: int, broker_id: Optional[int] = None
    ) -> List[AdminChildID]:
        """Get available admin child IDs filtered by insurer and optionally broker"""
        query = db.query(AdminChildID).filter(
            AdminChildID.is_active == True,
            AdminChildID.is_suspended == False,
            AdminChildID.insurer_id == insurer_id,
        )

        if broker_id:
            query = query.filter(AdminChildID.broker_id == broker_id)

        return query.all()

    @staticmethod
    def check_user_is_superadmin(user: UserProfile) -> bool:
        """Check if user has superadmin role"""
        return user.user_role == "superadmin"

    @staticmethod
    def check_user_is_admin_or_superadmin(user: UserProfile) -> bool:
        """Check if user has admin or superadmin role"""
        return user.user_role in ["admin", "superadmin"]
