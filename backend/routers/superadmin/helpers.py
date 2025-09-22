"""
Helper functions for SuperAdmin routes
"""

from typing import List, Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from models import AdminChildID, Broker, Insurer, UserProfile


class SuperAdminHelpers:
    """
    Helper functions for SuperAdmin operations

    FUNCTIONS:
    - generate_broker_code() - Generate next broker code
    - generate_insurer_code() - Generate next insurer code
    - get_active_brokers() - Get all active brokers
    - get_active_insurers() - Get all active insurers
    - get_broker_by_id() - Get broker by ID
    - get_insurer_by_id() - Get insurer by ID
    - get_admin_child_id_by_id() - Get admin child ID by database ID
    - get_admin_child_id_by_child_id() - Get admin child ID by child_id string
    - get_active_admin_child_ids() - Get all active admin child IDs
    - get_available_admin_child_ids_by_broker_insurer() - Get filtered admin child IDs
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
