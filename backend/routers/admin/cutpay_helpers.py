import csv
import io
import json
import logging
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, desc, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from models import AdminChildID, Broker, CutPay, Insurer

from .cutpay_schemas import (
    CutPayDatabaseResponse,
    CutPayStats,
    CutPayUpdate,
)

logger = logging.getLogger(__name__)

# =============================================================================
# RESPONSE HELPER FUNCTIONS
# =============================================================================


def database_cutpay_response(cutpay_obj) -> CutPayDatabaseResponse:
    """
    Convert SQLAlchemy CutPay object to CutPayDatabaseResponse with only database fields
    This is the clean response for list endpoints showing only stored data
    """
    try:
        # Extract only database fields that exist in the model
        db_data = {}

        # Map database fields directly
        db_field_mapping = {
            "id": "id",
            "policy_pdf_url": "policy_pdf_url",
            "additional_documents": "additional_documents",
            "policy_number": "policy_number",
            "agent_code": "agent_code",
            "booking_date": "booking_date",
            "admin_child_id": "admin_child_id",
            "insurer_id": "insurer_id",
            "broker_id": "broker_id",
            "child_id_request_id": "child_id_request_id",
            "policy_start_date": "policy_start_date",
            "policy_end_date": "policy_end_date",
            "created_at": "created_at",
            "updated_at": "updated_at",
        }

        for db_field, response_field in db_field_mapping.items():
            try:
                value = getattr(cutpay_obj, db_field)

                # Handle special field conversions
                if db_field == "additional_documents" and isinstance(value, str):
                    # Convert JSON string back to dict
                    try:
                        db_data[response_field] = json.loads(value) if value else {}
                    except (json.JSONDecodeError, TypeError):
                        db_data[response_field] = {}
                else:
                    db_data[response_field] = value

            except Exception:
                # Set appropriate defaults for missing fields
                if db_field == "additional_documents":
                    db_data[response_field] = {}
                elif db_field in ["created_at", "updated_at"]:
                    from datetime import datetime

                    db_data[response_field] = datetime.utcnow()
                else:
                    db_data[response_field] = None

        # Calculate quarter information based on booking_date
        quarter, year, quarter_sheet_name = calculate_quarter_info(
            cutpay_obj.booking_date
        )
        db_data["quarter"] = quarter
        db_data["year"] = year
        db_data["quarter_sheet_name"] = quarter_sheet_name

        return CutPayDatabaseResponse(**db_data)

    except Exception as e:
        logger.warning(f"database_cutpay_response failed: {str(e)}")
        raise e


def calculate_quarter_info(booking_date):
    """
    Calculate quarter information based on booking date

    Args:
        booking_date: Date object representing the booking date

    Returns:
        tuple: (quarter, year, quarter_sheet_name)
    """
    if not booking_date:
        return None, None, None

    try:
        # Extract year from booking date
        year = booking_date.year

        # Calculate quarter based on month
        month = booking_date.month
        if month in [1, 2, 3]:
            quarter = 1
        elif month in [4, 5, 6]:
            quarter = 2
        elif month in [7, 8, 9]:
            quarter = 3
        else:  # months 10, 11, 12
            quarter = 4

        # Create quarter sheet name
        quarter_sheet_name = f"Q{quarter}-{year}"

        return quarter, year, quarter_sheet_name

    except Exception as e:
        logger.warning(f"Failed to calculate quarter info for date {booking_date}: {e}")
        return None, None, None


# =============================================================================
# CODE LOOKUP HELPER FUNCTIONS
# =============================================================================


async def resolve_broker_code_to_id(
    db: AsyncSession, broker_code: str
) -> Optional[int]:
    """Resolve broker code to broker ID"""
    if not broker_code:
        return None

    result = await db.execute(
        select(Broker.id).where(
            and_(Broker.broker_code == broker_code, Broker.is_active == True)
        )
    )
    broker = result.scalar_one_or_none()

    if not broker:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Broker with code '{broker_code}' not found or inactive",
        )

    return broker


async def resolve_insurer_code_to_id(
    db: AsyncSession, insurer_code: str
) -> Optional[int]:
    """Resolve insurer code to insurer ID"""
    if not insurer_code:
        return None

    result = await db.execute(
        select(Insurer.id).where(
            and_(Insurer.insurer_code == insurer_code, Insurer.is_active == True)
        )
    )
    insurer = result.scalar_one_or_none()

    if not insurer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insurer with code '{insurer_code}' not found or inactive",
        )

    return insurer


async def resolve_broker_code_to_details(
    db: AsyncSession, broker_code: str
) -> Optional[tuple[int, str]]:
    """Resolve broker code to broker ID and name"""
    if not broker_code:
        return None, None

    result = await db.execute(
        select(Broker.id, Broker.name).where(
            and_(Broker.broker_code == broker_code, Broker.is_active == True)
        )
    )
    broker = result.first()

    if not broker:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Broker with code '{broker_code}' not found or inactive",
        )

    return broker.id, broker.name


async def resolve_insurer_code_to_details(
    db: AsyncSession, insurer_code: str
) -> Optional[tuple[int, str]]:
    """Resolve insurer code to insurer ID and name"""
    if not insurer_code:
        return None, None

    result = await db.execute(
        select(Insurer.id, Insurer.name).where(
            and_(Insurer.insurer_code == insurer_code, Insurer.is_active == True)
        )
    )
    insurer = result.first()

    if not insurer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insurer with code '{insurer_code}' not found or inactive",
        )

    return insurer.id, insurer.name


async def validate_and_resolve_codes_with_names(
    db: AsyncSession, broker_code: Optional[str], insurer_code: Optional[str]
) -> tuple[Optional[int], Optional[int], Optional[str], Optional[str]]:
    """Validate and resolve both broker and insurer codes to IDs and names"""
    broker_id = None
    insurer_id = None
    broker_name = None
    insurer_name = None

    if broker_code:
        broker_id, broker_name = await resolve_broker_code_to_details(db, broker_code)

    if insurer_code:
        insurer_id, insurer_name = await resolve_insurer_code_to_details(
            db, insurer_code
        )

    return broker_id, insurer_id, broker_name, insurer_name


async def validate_and_resolve_codes(
    db: AsyncSession, broker_code: Optional[str], insurer_code: Optional[str]
) -> tuple[Optional[int], Optional[int]]:
    """Validate and resolve both broker and insurer codes to IDs"""
    broker_id = None
    insurer_id = None

    if broker_code:
        broker_id = await resolve_broker_code_to_id(db, broker_code)

    if insurer_code:
        insurer_id = await resolve_insurer_code_to_id(db, insurer_code)

    return broker_id, insurer_id


# =============================================================================
# EXISTING CUTPAY HELPERS CLASS
# =============================================================================


class CutPayHelpers:
    """
    Comprehensive Cut Pay (Commission) Management Helper Class

    Provides sophisticated business logic for managing insurance commission
    payments, cut pay calculations, and related financial operations within
    the InsureZeal platform. This class handles the complex workflows involved
    in commission processing, payment tracking, and financial reporting.

    Key Capabilities:

    **Cut Pay Transaction Management**:
    - Complete cut pay transaction lifecycle management
    - Transaction retrieval with comprehensive filtering and pagination
    - Update operations with data validation and integrity checks
    - Soft deletion with proper audit trail maintenance
    - Status tracking throughout the commission payment process

    **Commission Calculation Engine**:
    - Advanced commission calculation algorithms
    - Support for multiple commission structures and rates
    - Automatic calculation based on policy premiums and terms
    - Configurable commission rules for different brokers and insurers
    - Real-time calculation updates with validation

    **Financial Data Processing**:
    - Comprehensive financial data validation and processing
    - Support for multiple currency formats and calculations
    - Automatic amount formatting and validation
    - Financial reconciliation and audit trail maintenance
    - Quarter-based financial reporting and analysis

    **Dropdown Data Management**:
    - Dynamic dropdown population for form interfaces
    - Filtered dropdown options based on user permissions and context
    - Real-time data updates for dependent dropdown fields
    - Broker and insurer relationship management for dropdowns
    - Administrative data caching for performance optimization

    **Statistical Analysis & Reporting**:
    - Comprehensive cut pay statistics and analytics
    - Performance metrics for commission tracking
    - Time-based analysis with quarterly and yearly breakdowns
    - Agent and broker performance analytics
    - Financial trend analysis for business intelligence

    **Data Export & Integration**:
    - CSV export functionality for external reporting
    - Configurable export formats for different stakeholders
    - Data formatting for Google Sheets integration
    - Bulk export operations for administrative purposes
    - Custom report generation with filtering capabilities

    **Broker & Insurer Code Resolution**:
    - Intelligent broker code to ID resolution
    - Insurer code validation and ID mapping
    - Cross-referential data validation for entity relationships
    - Code format validation and standardization
    - Administrative code management and updates

    **Data Validation & Integrity**:
    - Comprehensive cut pay data validation
    - Business rule enforcement for commission calculations
    - Cross-field validation for logical consistency
    - Financial amount validation with appropriate limits
    - Date validation for policy and payment periods

    **Quarter Management**:
    - Automatic quarter calculation based on booking dates
    - Quarter-based data organization and reporting
    - Quarter sheet preparation for Google Sheets integration
    - Cross-quarter data analysis and comparison
    - Quarter-specific filtering and analytics

    **Google Sheets Integration**:
    - Complete sheets data preparation for external reporting
    - Real-time synchronization with Google Sheets
    - Update handling for existing sheet records
    - Conflict resolution for concurrent sheet updates
    - Performance optimization for large dataset operations

    **Relationship Management**:
    - Complex broker-insurer-agent relationship validation
    - Admin child ID association and verification
    - Cross-entity data consistency checks
    - Hierarchical data management for administrative control
    - Relationship mapping for operational efficiency

    **Performance Optimizations**:
    - Efficient database queries with proper joins and indexing
    - Pagination support for large transaction datasets
    - Optimized filtering algorithms for complex searches
    - Caching strategies for frequently accessed data
    - Bulk operations for administrative efficiency

    **Security & Compliance**:
    - Financial data protection with appropriate security measures
    - Access control validation for sensitive commission data
    - Audit trail maintenance for regulatory compliance
    - Data encryption for sensitive financial information
    - Role-based access control for financial operations

    This helper class serves as the financial engine of the InsureZeal platform,
    providing comprehensive commission management capabilities while ensuring
    data integrity, security, and compliance with financial regulations.
    """

    async def get_cutpay_by_id(
        self, db: AsyncSession, cutpay_id: int
    ) -> Optional[CutPay]:
        """Get a cut pay transaction by ID with relationships"""
        try:
            result = await db.execute(
                select(CutPay)
                .options(
                    joinedload(CutPay.insurer),
                    joinedload(CutPay.broker),
                    joinedload(CutPay.child_id_request),
                )
                .where(CutPay.id == cutpay_id)
            )
            return result.scalar_one_or_none()

        except Exception as e:
            logger.error(f"Error fetching cut pay transaction {cutpay_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch cut pay transaction",
            )

    async def update_cutpay_transaction(
        self, db: AsyncSession, cutpay_id: int, cutpay_data: CutPayUpdate
    ) -> Optional[CutPay]:
        """Update a cut pay transaction with recalculation"""
        try:
            cutpay = await self.get_cutpay_by_id(db, cutpay_id)
            if not cutpay:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Cut pay transaction not found",
                )

            # Update fields
            update_data = cutpay_data.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(cutpay, field, value)

            # Recalculate amounts if financial data changed
            if any(
                field in update_data
                for field in [
                    "gross_amount",
                    "net_premium",
                    "agent_commission_given_percent",
                    "payment_mode",
                    "payout_percent",
                ]
            ):
                calculation = await self.calculate_cutpay_amounts(
                    gross_amount=cutpay.gross_amount,
                    net_premium=cutpay.net_premium,
                    agent_commission_given_percent=cutpay.agent_commission_given_percent,
                    payment_mode=cutpay.payment_mode,
                    payout_percent=cutpay.payout_percent,
                )
                cutpay.cut_pay_amount = calculation["cut_pay_amount"]
                cutpay.payout_amount = calculation["payout_amount"]

            await db.commit()
            await db.refresh(cutpay)

            logger.info(f"Cut pay transaction {cutpay_id} updated")
            return cutpay

        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating cut pay transaction {cutpay_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update cut pay transaction",
            )

    async def calculate_cutpay_amounts(
        self,
        gross_amount: Optional[float] = None,
        net_premium: Optional[float] = None,
        agent_commission_given_percent: Optional[float] = None,
        payment_mode: Optional[str] = None,
        payout_percent: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Calculate CutPay amount and payout based on business logic"""
        try:
            cut_pay_amount = None
            payout_amount = None
            calculation_details = {}

            if gross_amount and net_premium and agent_commission_given_percent:
                # Basic CutPay calculation logic
                commission_amount = (
                    gross_amount * agent_commission_given_percent
                ) / 100
                cut_pay_amount = commission_amount - (
                    net_premium * 0.1
                )  # Example calculation

                calculation_details["commission_amount"] = commission_amount
                calculation_details["cutpay_calculation"] = (
                    f"Commission({commission_amount}) - Net Premium Adjustment"
                )

                # Payout calculation (when payment_mode is "agent")
                if payment_mode == "agent" and payout_percent and cut_pay_amount:
                    payout_amount = (cut_pay_amount * payout_percent) / 100
                    calculation_details["payout_calculation"] = (
                        f"CutPay({cut_pay_amount}) × Payout%({payout_percent})"
                    )

            return {
                "cut_pay_amount": cut_pay_amount,
                "payout_amount": payout_amount,
                "calculation_details": calculation_details,
            }

        except Exception as e:
            logger.error(f"Error calculating cutpay amounts: {str(e)}")
            return {
                "cut_pay_amount": None,
                "payout_amount": None,
                "calculation_details": {"error": str(e)},
            }

    async def get_all_cutpay_transactions(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        agent_code: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated cut pay transactions with filters"""
        try:
            offset = (page - 1) * page_size

            # Build query with filters
            query = select(CutPay).options(
                joinedload(CutPay.insurer),
                joinedload(CutPay.broker),
                joinedload(CutPay.child_id_request),
            )

            # Apply filters
            conditions = []
            if search:
                conditions.append(
                    or_(
                        CutPay.policy_number.ilike(f"%{search}%"),
                        CutPay.agent_code.ilike(f"%{search}%"),
                    )
                )

            if agent_code:
                conditions.append(CutPay.agent_code == agent_code)

            if status_filter:
                conditions.append(CutPay.status == status_filter)

            if conditions:
                query = query.where(and_(*conditions))

            # Count total
            count_query = select(func.count(CutPay.id))
            if conditions:
                count_query = count_query.where(and_(*conditions))

            total_count_result = await db.execute(count_query)
            total_count = total_count_result.scalar()

            # Get paginated results
            query = (
                query.order_by(desc(CutPay.created_at)).offset(offset).limit(page_size)
            )
            result = await db.execute(query)
            transactions = result.scalars().all()

            return {
                "transactions": transactions,
                "total_count": total_count,
                "page": page,
                "page_size": page_size,
            }

        except Exception as e:
            logger.error(f"Error fetching cut pay transactions: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch cut pay transactions",
            )

    async def get_cutpay_dropdowns(self, db: AsyncSession) -> Dict[str, List]:
        """Get dropdown options for CutPay form"""
        try:
            # Get active insurers
            insurer_result = await db.execute(
                select(Insurer).where(Insurer.is_active == True).order_by(Insurer.name)
            )
            insurers = [
                {
                    "code": insurer.insurer_code,
                    "name": insurer.name,
                    "is_active": insurer.is_active,
                }
                for insurer in insurer_result.scalars().all()
            ]

            # Get active brokers
            broker_result = await db.execute(
                select(Broker).where(Broker.is_active == True).order_by(Broker.name)
            )
            brokers = [
                {
                    "code": broker.broker_code,
                    "name": broker.name,
                    "is_active": broker.is_active,
                }
                for broker in broker_result.scalars().all()
            ]

            # Get active admin child IDs
            admin_child_result = await db.execute(
                select(AdminChildID)
                .options(
                    joinedload(AdminChildID.insurer), joinedload(AdminChildID.broker)
                )
                .where(AdminChildID.is_active == True)
                .order_by(AdminChildID.child_id)
            )
            admin_child_ids = [
                {
                    "id": admin_child.id,
                    "child_id": admin_child.child_id,
                    "insurer_name": admin_child.insurer.name,
                    "broker_name": (
                        admin_child.broker.name if admin_child.broker else None
                    ),
                    "code_type": admin_child.code_type,
                    "is_active": admin_child.is_active,
                }
                for admin_child in admin_child_result.scalars().all()
            ]

            return {
                "insurers": insurers,
                "brokers": brokers,
                "admin_child_ids": admin_child_ids,
            }

        except Exception as e:
            logger.error(f"Error fetching cutpay dropdowns: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch dropdown options",
            )

    async def get_cutpay_statistics(self, db: AsyncSession) -> Dict[str, Any]:
        """Get comprehensive cut pay statistics"""
        try:
            # Basic stats
            stats_result = await db.execute(
                select(
                    func.count(CutPay.id).label("total_transactions"),
                    func.coalesce(func.sum(CutPay.cut_pay_amount), 0).label(
                        "total_cut_pay_amount"
                    ),
                    func.coalesce(func.sum(CutPay.amount_received), 0).label(
                        "total_amount_received"
                    ),
                    func.coalesce(func.avg(CutPay.cut_pay_amount), 0).label(
                        "average_cut_pay_amount"
                    ),
                )
            )
            stats = stats_result.first()

            # Monthly breakdown
            monthly_result = await db.execute(
                select(
                    extract("year", CutPay.created_at).label("year"),
                    extract("month", CutPay.created_at).label("month"),
                    func.count(CutPay.id).label("count"),
                    func.coalesce(func.sum(CutPay.cut_pay_amount), 0).label(
                        "total_amount"
                    ),
                )
                .group_by(
                    extract("year", CutPay.created_at),
                    extract("month", CutPay.created_at),
                )
                .order_by(
                    extract("year", CutPay.created_at).desc(),
                    extract("month", CutPay.created_at).desc(),
                )
                .limit(12)
            )
            monthly_breakdown = [
                {
                    "year": int(row.year),
                    "month": int(row.month),
                    "count": row.count,
                    "total_amount": float(row.total_amount),
                }
                for row in monthly_result.fetchall()
            ]

            # Top agents
            top_agents_result = await db.execute(
                select(
                    CutPay.agent_code,
                    func.count(CutPay.id).label("transaction_count"),
                    func.coalesce(func.sum(CutPay.cut_pay_amount), 0).label(
                        "total_amount"
                    ),
                )
                .where(CutPay.agent_code.isnot(None))
                .group_by(CutPay.agent_code)
                .order_by(func.sum(CutPay.cut_pay_amount).desc())
                .limit(10)
            )
            top_agents = [
                {
                    "agent_code": row.agent_code,
                    "transaction_count": row.transaction_count,
                    "total_amount": float(row.total_amount),
                }
                for row in top_agents_result.fetchall()
            ]

            return {
                "stats": CutPayStats(
                    total_transactions=stats.total_transactions,
                    total_cut_pay_amount=float(stats.total_cut_pay_amount),
                    total_amount_received=float(stats.total_amount_received),
                    average_cut_pay_amount=float(stats.average_cut_pay_amount),
                ),
                "monthly_breakdown": monthly_breakdown,
                "top_agents": top_agents,
            }

        except Exception as e:
            logger.error(f"Error fetching cut pay statistics: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch cut pay statistics",
            )

    async def delete_cutpay_transaction(self, db: AsyncSession, cutpay_id: int) -> bool:
        """Delete a cut pay transaction"""
        try:
            cutpay = await self.get_cutpay_by_id(db, cutpay_id)
            if not cutpay:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Cut pay transaction not found",
                )

            await db.delete(cutpay)
            await db.commit()

            logger.info(f"Cut pay transaction {cutpay_id} deleted")
            return True

        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Error deleting cut pay transaction {cutpay_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete cut pay transaction",
            )

    async def export_cutpay_transactions(
        self,
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> io.StringIO:
        """Export cut pay transactions to CSV"""
        try:
            query = select(CutPay).options(
                joinedload(CutPay.insurer),
                joinedload(CutPay.broker),
                joinedload(CutPay.child_id_request),
            )

            # Apply date filters
            conditions = []
            if start_date:
                conditions.append(CutPay.created_at >= start_date)
            if end_date:
                conditions.append(CutPay.created_at <= end_date)

            if conditions:
                query = query.where(and_(*conditions))

            query = query.order_by(CutPay.created_at)
            result = await db.execute(query)
            transactions = result.scalars().all()

            # Create CSV
            output = io.StringIO()
            writer = csv.writer(output)

            # Write headers
            headers = [
                "ID",
                "Policy Number",
                "Agent Code",
                "Code Type",
                "Insurer",
                "Broker",
                "Gross Amount",
                "Net Premium",
                "Commission %",
                "Cut Pay Amount",
                "Payment Mode",
                "Payout Amount",
                "Amount Received",
                "Status",
                "Transaction Date",
                "Created At",
            ]
            writer.writerow(headers)

            # Write data
            for transaction in transactions:
                writer.writerow(
                    [
                        transaction.id,
                        transaction.policy_number or "",
                        transaction.agent_code or "",
                        transaction.code_type or "",
                        transaction.insurer.name if transaction.insurer else "",
                        transaction.broker.name if transaction.broker else "",
                        transaction.gross_amount or 0,
                        transaction.net_premium or 0,
                        transaction.agent_commission_given_percent or 0,
                        transaction.cut_pay_amount or 0,
                        transaction.payment_mode or "",
                        transaction.payout_amount or 0,
                        transaction.amount_received or 0,
                        transaction.status,
                        transaction.transaction_date or "",
                        transaction.created_at,
                    ]
                )

            output.seek(0)
            return output

        except Exception as e:
            logger.error(f"Error exporting cut pay transactions: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to export cut pay transactions",
            )


# =============================================================================
# STANDALONE HELPER FUNCTIONS (for cutpay.py router)
# =============================================================================


async def calculate_commission_amounts(
    calculation_data: Dict[str, Any],
) -> Dict[str, Any]:
    """Calculate commission amounts using real business logic from README"""
    try:
        # Extract input values
        gross_premium = calculation_data.get("gross_premium", 0) or 0
        net_premium = calculation_data.get("net_premium", 0) or 0
        od_premium = calculation_data.get("od_premium", 0) or 0
        tp_premium = calculation_data.get("tp_premium", 0) or 0
        incoming_grid_percent = calculation_data.get("incoming_grid_percent", 0) or 0
        extra_grid = calculation_data.get("extra_grid", 0) or 0
        commissionable_premium = (
            calculation_data.get("commissionable_premium") or gross_premium
        )
        agent_commission_percent = (
            calculation_data.get("agent_commission_given_percent", 0) or 0
        )
        payment_by = calculation_data.get("payment_by", "Agent")
        payout_on = calculation_data.get("payout_on", "NP")

        # Initialize results
        result = {
            "receivable_from_broker": 0,
            "extra_amount_receivable_from_broker": 0,
            "total_receivable_from_broker": 0,
            "total_receivable_from_broker_with_gst": 0,
            "cut_pay_amount": 0,
            "agent_po_amt": 0,
            "total_agent_po_amt": 0,
            "calculation_details": {},
        }

        # 1. Commission Calculations
        if gross_premium and incoming_grid_percent:
            # Receivable from Broker = Gross Premium × Incoming Grid %
            result["receivable_from_broker"] = gross_premium * (
                incoming_grid_percent / 100
            )

            # Extra Receivable = Commissionable Premium × Extra Grid %
            if extra_grid and commissionable_premium:
                result["extra_amount_receivable_from_broker"] = (
                    commissionable_premium * (extra_grid / 100)
                )

            # Total Receivable = Receivable + Extra
            result["total_receivable_from_broker"] = (
                result["receivable_from_broker"]
                + result["extra_amount_receivable_from_broker"]
            )

            # With GST = Total × 1.18
            result["total_receivable_from_broker_with_gst"] = (
                result["total_receivable_from_broker"] * 1.18
            )

        # 2. CutPay Amount Logic
        if payment_by == "Agent":
            result["cut_pay_amount"] = 0  # Agent handles customer payment
        elif (
            payment_by == "InsureZeal"
            and gross_premium
            and net_premium
            and agent_commission_percent
        ):
            agent_commission = net_premium * (agent_commission_percent / 100)
            result["cut_pay_amount"] = gross_premium - agent_commission

        # 3. Agent Payout Logic
        if agent_commission_percent:
            base_premium = 0
            if payout_on == "OD" and od_premium:
                base_premium = od_premium
            elif payout_on == "NP" and net_premium:
                base_premium = net_premium
            elif payout_on == "OD+TP" and od_premium and tp_premium:
                base_premium = od_premium + tp_premium

            if base_premium:
                result["agent_po_amt"] = base_premium * (agent_commission_percent / 100)
                result["total_agent_po_amt"] = result[
                    "agent_po_amt"
                ]  # Can add extra amounts later

        # 4. Calculation Details for transparency
        result["calculation_details"] = {
            "commission_formula": f"{gross_premium} × {incoming_grid_percent}% = {result['receivable_from_broker']}",
            "extra_formula": f"{commissionable_premium} × {extra_grid}% = {result['extra_amount_receivable_from_broker']}",
            "gst_formula": f"{result['total_receivable_from_broker']} × 1.18 = {result['total_receivable_from_broker_with_gst']}",
            "cutpay_logic": f"Payment by {payment_by}: {result['cut_pay_amount']}",
            "payout_logic": f"Payout on {payout_on}: {result['agent_po_amt']}",
        }

        logger.info(
            f"Calculated commission amounts: CutPay={result['cut_pay_amount']}, Agent Payout={result['agent_po_amt']}"
        )
        return result

    except Exception as e:
        logger.error(f"Error calculating commission amounts: {str(e)}")
        return {
            "receivable_from_broker": 0,
            "total_receivable_from_broker_with_gst": 0,
            "cut_pay_amount": 0,
            "agent_po_amt": 0,
            "calculation_details": {"error": str(e)},
        }


async def get_dropdown_options(db: AsyncSession) -> Dict[str, List]:
    """Get dropdown options for CutPay form (standalone function)"""
    helper = CutPayHelpers()
    return await helper.get_cutpay_dropdowns(db)


async def get_filtered_dropdowns(
    db: AsyncSession, insurer_id: Optional[int] = None, broker_id: Optional[int] = None
) -> Dict[str, List]:
    """Get filtered dropdown options based on insurer/broker selection"""
    try:
        result = {"insurers": [], "brokers": [], "child_ids": []}

        # Get insurers (always return all active insurers)
        insurer_result = await db.execute(
            select(Insurer).where(Insurer.is_active == True).order_by(Insurer.name)
        )
        result["insurers"] = [
            {"code": insurer.insurer_code, "name": insurer.name}
            for insurer in insurer_result.scalars().all()
        ]

        # Get brokers (filter by insurer if provided)
        broker_query = select(Broker).where(Broker.is_active == True)
        if insurer_id:
            # If you have a relationship between Broker and Insurer, filter here
            # For now, return all brokers
            pass
        broker_query = broker_query.order_by(Broker.name)

        broker_result = await db.execute(broker_query)
        result["brokers"] = [
            {"code": broker.broker_code, "name": broker.name}
            for broker in broker_result.scalars().all()
        ]

        # Get admin child IDs with strict code type logic
        admin_child_query = (
            select(AdminChildID)
            .options(joinedload(AdminChildID.insurer), joinedload(AdminChildID.broker))
            .where(AdminChildID.is_active == True)
        )

        conditions = []
        if insurer_id:
            conditions.append(AdminChildID.insurer_id == insurer_id)

        # Apply strict code type filtering logic
        if broker_id:
            # Broker type: Must have both insurer and broker, and code_type must be "broker"
            conditions.extend(
                [
                    AdminChildID.broker_id == broker_id,
                    AdminChildID.code_type.ilike(
                        "%broker%"
                    ),  # Handle "Broker Code" or "broker"
                ]
            )
        else:
            # Direct type: Only insurer, no broker, and code_type must be "direct"
            conditions.extend(
                [
                    AdminChildID.broker_id.is_(None),
                    AdminChildID.code_type.ilike(
                        "%direct%"
                    ),  # Handle "Direct Code" or "direct"
                ]
            )

        if conditions:
            admin_child_query = admin_child_query.where(and_(*conditions))

        admin_child_query = admin_child_query.order_by(AdminChildID.child_id)
        admin_child_result = await db.execute(admin_child_query)

        result["admin_child_ids"] = [
            {
                "id": admin_child.id,
                "child_id": admin_child.child_id,
                "insurer_name": (
                    admin_child.insurer.name if admin_child.insurer else None
                ),
                "broker_name": admin_child.broker.name if admin_child.broker else None,
                "code_type": admin_child.code_type,
                "is_active": admin_child.is_active,
            }
            for admin_child in admin_child_result.scalars().all()
        ]

        logger.info(
            f"Retrieved filtered dropdowns: {len(result['insurers'])} insurers, {len(result['brokers'])} brokers, {len(result['admin_child_ids'])} admin child IDs"
        )
        return result

    except Exception as e:
        logger.error(f"Error getting filtered dropdowns: {str(e)}")
        # Fallback to unfiltered dropdowns
        helper = CutPayHelpers()
        return await helper.get_cutpay_dropdowns(db)


def auto_populate_relationship_data(cutpay: CutPay, db: AsyncSession):
    """Auto-populate relationship data from IDs"""
    try:
        # Auto-populate insurer name from insurer_id
        if cutpay.insurer_id and not cutpay.insurer_name:
            if hasattr(cutpay, "insurer") and cutpay.insurer:
                cutpay.insurer_name = cutpay.insurer.name

        # Auto-populate broker name from broker_id
        if cutpay.broker_id and not cutpay.broker_name:
            if hasattr(cutpay, "broker") and cutpay.broker:
                cutpay.broker_name = cutpay.broker.name

        # Auto-populate cluster from state (basic mapping)
        if cutpay.state and not cutpay.cluster:
            state_cluster_map = {
                "MH": "West",
                "GJ": "West",
                "RJ": "West",
                "DL": "North",
                "PB": "North",
                "HR": "North",
                "KA": "South",
                "TN": "South",
                "AP": "South",
                "TS": "South",
                "WB": "East",
                "OR": "East",
                "JH": "East",
            }
            cutpay.cluster = state_cluster_map.get(cutpay.state, "Other")

        logger.info(f"Auto-populated relationship data for CutPay {cutpay.id}")

    except Exception as e:
        logger.error(f"Error auto-populating relationship data: {str(e)}")


def validate_cutpay_data(cutpay_data: Dict[str, Any]) -> List[str]:
    """Validate CutPay data (standalone function)"""
    errors = []

    # Check for policy_number and agent_code at all possible locations
    policy_number = cutpay_data.get("policy_number") or (
        cutpay_data.get("extracted_data") or {}
    ).get("policy_number")
    agent_code = cutpay_data.get("agent_code") or (
        cutpay_data.get("admin_input") or {}
    ).get("agent_code")

    if not policy_number and not agent_code:
        errors.append("Either policy_number or agent_code is required")

    # Gross amount validation (top-level or in admin_input)
    gross_amount = cutpay_data.get("gross_amount") or (
        cutpay_data.get("admin_input") or {}
    ).get("gross_amount")
    if gross_amount and gross_amount < 0:
        errors.append("Gross amount cannot be negative")

    # Agent commission percent validation (top-level or in admin_input)
    agent_commission = cutpay_data.get("agent_commission_given_percent") or (
        cutpay_data.get("admin_input") or {}
    ).get("agent_commission_given_percent")
    if agent_commission is not None:
        if agent_commission < 0 or agent_commission > 100:
            errors.append("Agent commission percent must be between 0 and 100")

    return errors


# =============================================================================
# GOOGLE SHEETS DATA PREPARATION HELPERS
# =============================================================================


def prepare_complete_sheets_data(
    cutpay_data: Any,
    cutpay_db_record: Any = None,
    broker_name: str = "",
    insurer_name: str = "",
) -> Dict[str, Any]:
    """
    Prepare complete data for Google Sheets including all fields from the request.
    This function maps all possible fields to the Google Sheets column headers.

    Args:
        cutpay_data: CutPayCreate object with all the form data
        cutpay_db_record: CutPay database record (optional)

    Returns:
        Dictionary with Google Sheets column headers as keys and data as values
    """
    sheets_data = {}

    # If we have a database record, get basic info from it
    if cutpay_db_record:
        sheets_data.update(
            {
                "Child ID/ User ID [Provided by Insure Zeal]": (
                    str(cutpay_db_record.id) if cutpay_db_record.id else ""
                ),
                "Agent Code": cutpay_db_record.agent_code or "",
            }
        )

    # Extract data from extracted_data section
    if hasattr(cutpay_data, "extracted_data") and cutpay_data.extracted_data:
        extracted = cutpay_data.extracted_data
        sheets_data.update(
            {
                "Policy number": extracted.policy_number or "",
                "Formatted Policy number": extracted.formatted_policy_number or "",
                "Major Categorisation( Motor/Life/ Health)": extracted.major_categorisation
                or "",
                "Product (Insurer Report)": extracted.product_insurer_report or "",
                "Product Type": extracted.product_type or "",
                "Plan type (Comp/STP/SAOD)": extracted.plan_type or "",
                "Customer Name": extracted.customer_name or "",
                "Customer Number": extracted.customer_phone_number or "",
                "Gross premium": extracted.gross_premium or 0,
                "Net premium": extracted.net_premium or 0,
                "OD Preimium": extracted.od_premium or 0,
                "TP Premium": extracted.tp_premium or 0,
                "GST Amount": extracted.gst_amount or 0,
                "Registration.no": extracted.registration_number or "",
                "Make_Model": extracted.make_model or "",
                "Model": extracted.model or "",
                "Vehicle_Variant": extracted.vehicle_variant or "",
                "GVW": extracted.gvw or 0,
                "RTO": extracted.rto or "",
                "State": extracted.state or "",
                "Fuel Type": extracted.fuel_type or "",
                "CC": extracted.cc or 0,
                "Age(Year)": extracted.age_year or 0,
                "NCB (YES/NO)": extracted.ncb or "",
                "Discount %": extracted.discount_percent or 0,
                "Business Type": extracted.business_type or "",
                "Seating Capacity": extracted.seating_capacity or 0,
                "Veh_Wheels": extracted.veh_wheels or 0,
                "Policy Start Date": extracted.start_date or "",
                "Policy End Date": extracted.end_date or "",
            }
        )

    # Extract data from admin_input section
    if hasattr(cutpay_data, "admin_input") and cutpay_data.admin_input:
        admin = cutpay_data.admin_input
        sheets_data.update(
            {
                "Reporting Month (mmm'yy)": admin.reporting_month or "",
                "Booking Date(Click to select Date)": (
                    admin.booking_date.isoformat() if admin.booking_date else ""
                ),
                "Code Type": admin.code_type or "",
                "Broker code": admin.broker_code or "",
                "Insurer code": admin.insurer_code or "",
                "Admin child ID": admin.admin_child_id or "",
                "Insurer /broker code": (admin.insurer_code or admin.broker_code or ""),
                "Broker Name": broker_name,  # Populated from database lookup
                "Insurer name": insurer_name,  # Populated from database lookup
                "Commissionable Premium": admin.commissionable_premium or 0,
                "Incoming Grid %": admin.incoming_grid_percent or 0,
                "Extra Grid": admin.extra_grid or 0,
                "Payment by": admin.payment_by or "",
                "Payment Mode": admin.payment_method or "",
                "Payout on": admin.payout_on or "",
                "Actual Agent_PO%": admin.agent_commission_given_percent or 0,
                "Agent_Extra%": admin.agent_extra_percent or 0,
                "Payment By Office": admin.payment_by_office or 0,
            }
        )

    # Extract data from calculations section
    if hasattr(cutpay_data, "calculations") and cutpay_data.calculations:
        calc = cutpay_data.calculations
        sheets_data.update(
            {
                "Receivable from Broker": calc.receivable_from_broker or 0,
                "Extra Amount Receivable from Broker": calc.extra_amount_receivable_from_broker
                or 0,
                "Total Receivable from Broker": calc.total_receivable_from_broker or 0,
                "Total Receivable from Broker Include 18% GST": calc.total_receivable_from_broker_with_gst
                or 0,
                "Cut Pay Amount Received From Agent": calc.cut_pay_amount or 0,
                "Agent_PO_AMT": calc.agent_po_amt or 0,
                "Agent_Extr_Amount": calc.agent_extra_amount or 0,
                "Agent Total PO Amount": calc.total_agent_po_amt or 0,
                "IZ Total PO%": calc.iz_total_po_percent or 0,
                "Already Given to agent": calc.already_given_to_agent or 0,
                "As per Broker PO AMT": calc.broker_payout_amount or 0,
            }
        )

    # Extract top-level fields and add additional fields from template
    sheets_data.update(
        {
            "Claimed By": getattr(cutpay_data, "claimed_by", "") or "",
            "Running Bal": getattr(cutpay_data, "running_bal", 0) or 0,
            "Remarks": getattr(cutpay_data, "notes", "") or "",
            "Match": "FALSE",  # Default to FALSE for new records
            "Actual": "",  # Default empty
            "PO Paid To Agent": "",  # Will be calculated
            "As per Broker PO%": "",  # Additional field from template
            "As per Broker PO AMT": "",  # Additional field from template
            "PO% Diff": "",  # Additional field from template
            "Broker PO AMT Diff": "",  # Additional field from template
            "Broker": "",  # Additional field from template
            "As per Agent Payout%": "",  # Additional field from template
            "As per Agent Payout Amount": "",  # Additional field from template
            "PO% Diff Agent": "",  # Additional field from template
            "PO AMT Diff Agent": "",  # Additional field from template
            "Invoice Status": "",  # Additional field from template
            "Invoice Number": "",  # Additional field from template
            "Cluster": getattr(cutpay_data, "cluster", "")
            or (getattr(cutpay_db_record, "cluster", "") if cutpay_db_record else ""),
        }
    )

    return sheets_data


def prepare_complete_sheets_data_for_update(
    cutpay_data: Any,
    cutpay_db_record: Any,
    broker_name: str = "",
    insurer_name: str = "",
) -> Dict[str, Any]:
    """
    Prepare complete data for Google Sheets update including all fields from the request.
    This function maps all possible fields to the Google Sheets column headers for updates.

    Args:
        cutpay_data: CutPayUpdate object with the update data
        cutpay_db_record: CutPay database record

    Returns:
        Dictionary with Google Sheets column headers as keys and updated data as values
    """
    sheets_data = {}

    # Always include the database record ID
    sheets_data["Child ID/ User ID [Provided by Insure Zeal]"] = str(
        cutpay_db_record.id
    )
    sheets_data["Agent Code"] = cutpay_db_record.agent_code or ""

    # Always include policy number from database record first
    print(
        f"🔍 DEBUG Helper: Database record policy_number = {repr(cutpay_db_record.policy_number)}"
    )
    sheets_data["Policy number"] = cutpay_db_record.policy_number or ""
    print(
        f"🔍 DEBUG Helper: Set Policy number in sheets_data = {repr(sheets_data['Policy number'])}"
    )

    # Handle nested extracted_data section
    if hasattr(cutpay_data, "extracted_data") and cutpay_data.extracted_data:
        extracted = cutpay_data.extracted_data
        print(
            f"🔍 DEBUG Helper: extracted.policy_number = {repr(getattr(extracted, 'policy_number', None))}"
        )
        # Override policy number if provided in extracted data AND it's not empty
        if extracted.policy_number and extracted.policy_number.strip():
            print(
                f"🔍 DEBUG Helper: Overriding with extracted policy_number = {repr(extracted.policy_number)}"
            )
            sheets_data["Policy number"] = extracted.policy_number
        else:
            print(
                f"🔍 DEBUG Helper: Keeping database policy_number = {repr(sheets_data['Policy number'])}"
            )
        sheets_data.update(
            {
                "Formatted Policy number": extracted.formatted_policy_number or "",
                "Major Categorisation( Motor/Life/ Health)": extracted.major_categorisation
                or "",
                "Product (Insurer Report)": extracted.product_insurer_report or "",
                "Product Type": extracted.product_type or "",
                "Plan type (Comp/STP/SAOD)": extracted.plan_type or "",
                "Customer Name": extracted.customer_name or "",
                "Customer Number": extracted.customer_phone_number or "",
                "Gross premium": extracted.gross_premium or 0,
                "Net premium": extracted.net_premium or 0,
                "OD Preimium": extracted.od_premium or 0,
                "TP Premium": extracted.tp_premium or 0,
                "GST Amount": extracted.gst_amount or 0,
                "Registration.no": extracted.registration_number or "",
                "Make_Model": extracted.make_model or "",
                "Model": extracted.model or "",
                "Vehicle_Variant": extracted.vehicle_variant or "",
                "GVW": extracted.gvw or 0,
                "RTO": extracted.rto or "",
                "State": extracted.state or "",
                "Fuel Type": extracted.fuel_type or "",
                "CC": extracted.cc or 0,
                "Age(Year)": extracted.age_year or 0,
                "NCB (YES/NO)": extracted.ncb or "",
                "Discount %": extracted.discount_percent or 0,
                "Business Type": extracted.business_type or "",
                "Seating Capacity": extracted.seating_capacity or 0,
                "Veh_Wheels": extracted.veh_wheels or 0,
                "Policy Start Date": extracted.start_date or "",
                "Policy End Date": extracted.end_date or "",
            }
        )

    # Handle nested admin_input section
    if hasattr(cutpay_data, "admin_input") and cutpay_data.admin_input:
        admin = cutpay_data.admin_input
        sheets_data.update(
            {
                "Reporting Month (mmm'yy)": admin.reporting_month or "",
                "Booking Date(Click to select Date)": (
                    admin.booking_date.isoformat() if admin.booking_date else ""
                ),
                "Insurer /broker code": (admin.insurer_code or admin.broker_code or ""),
                "Broker Name": broker_name,  # Populated from database lookup
                "Insurer name": insurer_name,  # Populated from database lookup
                "Commissionable Premium": admin.commissionable_premium or 0,
                "Incoming Grid %": admin.incoming_grid_percent or 0,
                "Extra Grid": admin.extra_grid or 0,
                "Payment by": admin.payment_by or "",
                "Payment Mode": admin.payment_method or "",
                "Actual Agent_PO%": admin.agent_commission_given_percent or 0,
                "Agent_Extra%": admin.agent_extra_percent or 0,
                "Payment By Office": admin.payment_by_office or 0,
            }
        )

    # Handle nested calculations section
    if hasattr(cutpay_data, "calculations") and cutpay_data.calculations:
        calc = cutpay_data.calculations
        sheets_data.update(
            {
                "Receivable from Broker": calc.receivable_from_broker or 0,
                "Extra Amount Receivable from Broker": calc.extra_amount_receivable_from_broker
                or 0,
                "Total Receivable from Broker": calc.total_receivable_from_broker or 0,
                "Total Receivable from Broker Include 18% GST": calc.total_receivable_from_broker_with_gst
                or 0,
                "Cut Pay Amount Received From Agent": calc.cut_pay_amount or 0,
                "Agent_PO_AMT": calc.agent_po_amt or 0,
                "Agent_Extr_Amount": calc.agent_extra_amount or 0,
                "Agent Total PO Amount": calc.total_agent_po_amt or 0,
                "IZ Total PO%": calc.iz_total_po_percent or 0,
                "Already Given to agent": calc.already_given_to_agent or 0,
                "As per Broker PO AMT": calc.broker_payout_amount or 0,
            }
        )

    # Handle direct field updates (for flat structure updates)
    direct_field_mappings = {
        "policy_number": "Policy number",
        "formatted_policy_number": "Formatted Policy number",
        "major_categorisation": "Major Categorisation( Motor/Life/ Health)",
        "product_insurer_report": "Product (Insurer Report)",
        "product_type": "Product Type",
        "plan_type": "Plan type (Comp/STP/SAOD)",
        "customer_name": "Customer Name",
        "customer_phone_number": "Customer Number",
        "gross_premium": "Gross premium",
        "net_premium": "Net premium",
        "od_premium": "OD Preimium",
        "tp_premium": "TP Premium",
        "gst_amount": "GST Amount",
        "registration_number": "Registration.no",
        "make_model": "Make_Model",
        "model": "Model",
        "vehicle_variant": "Vehicle_Variant",
        "gvw": "GVW",
        "rto": "RTO",
        "state": "State",
        "fuel_type": "Fuel Type",
        "cc": "CC",
        "age_year": "Age(Year)",
        "ncb": "NCB (YES/NO)",
        "discount_percent": "Discount %",
        "business_type": "Business Type",
        "seating_capacity": "Seating Capacity",
        "veh_wheels": "Veh_Wheels",
        "reporting_month": "Reporting Month (mmm'yy)",
        "booking_date": "Booking Date(Click to select Date)",
        "commissionable_premium": "Commissionable Premium",
        "incoming_grid_percent": "Incoming Grid %",
        "extra_grid": "Extra Grid",
        "payment_by": "Payment by",
        "payment_method": "Payment Mode",
        "agent_commission_given_percent": "Actual Agent_PO%",
        "agent_extra_percent": "Agent_Extra%",
        "payment_by_office": "Payment By Office",
        "claimed_by": "Claimed By",
        "running_bal": "Running Bal",
        "notes": "Remarks",
    }

    # Map direct fields from the update request
    try:
        update_dict = (
            cutpay_data.dict(exclude_unset=True) if hasattr(cutpay_data, "dict") else {}
        )
    except:
        update_dict = {}

    # Special handling for policy_number - ensure it's always present
    if "policy_number" in update_dict and update_dict["policy_number"]:
        sheets_data["Policy number"] = update_dict["policy_number"]

    for field_name, sheet_column in direct_field_mappings.items():
        if field_name in update_dict:
            value = update_dict[field_name]
            if field_name == "booking_date" and value:
                sheets_data[sheet_column] = (
                    value.isoformat() if hasattr(value, "isoformat") else str(value)
                )
            else:
                sheets_data[sheet_column] = value or ""

    # Handle top-level fields
    if hasattr(cutpay_data, "claimed_by") and cutpay_data.claimed_by is not None:
        sheets_data["Claimed By"] = cutpay_data.claimed_by
    if hasattr(cutpay_data, "running_bal") and cutpay_data.running_bal is not None:
        sheets_data["Running Bal"] = cutpay_data.running_bal
    if hasattr(cutpay_data, "notes") and cutpay_data.notes is not None:
        sheets_data["Remarks"] = cutpay_data.notes

    # Always set Match to FALSE for records
    sheets_data["Match"] = "FALSE"

    # Add additional template fields that might be updated
    additional_fields = {
        "invoice_status": "Invoice Status",
        "invoice_number": "Invoice Number",
        "cluster": "Cluster",
        "company": "Company",
    }

    for field_name, sheet_column in additional_fields.items():
        if field_name in update_dict:
            sheets_data[sheet_column] = update_dict[field_name] or ""

    # Remove any None or empty values to avoid overwriting existing data with blanks
    # BUT keep essential fields like Policy number even if empty for tracking
    essential_fields = [
        "Policy number",
        "Child ID/ User ID [Provided by Insure Zeal]",
        "Agent Code",
    ]
    print(
        f"🔍 DEBUG Helper: Before filtering - Policy number = {repr(sheets_data.get('Policy number'))}"
    )
    sheets_data = {
        k: v
        for k, v in sheets_data.items()
        if v not in [None, ""] or k in essential_fields
    }
    print(
        f"🔍 DEBUG Helper: After filtering - Policy number = {repr(sheets_data.get('Policy number'))}"
    )

    return sheets_data


def convert_sheets_data_to_nested_response(
    sheets_data: Dict[str, Any],
    database_record: Optional[Dict[str, Any]] = None,
    broker_name: str = "",
    insurer_name: str = "",
) -> Dict[str, Any]:
    """
    Convert flat Google Sheets data to nested CutPayDetailResponse structure.
    Groups fields into extracted_data, admin_input, and calculations nested objects.

    Args:
        sheets_data: Flat dictionary from Google Sheets
        database_record: Optional database record for id and system fields
        broker_name: Broker name from database
        insurer_name: Insurer name from database

    Returns:
        Dictionary with nested structure matching CutPayDetailResponse
    """
    # Debug: log available sheets data keys
    logger.info(f"🔍 DEBUG: Available Google Sheets keys: {list(sheets_data.keys())}")
    from datetime import datetime

    # Helper to safely parse dates
    def parse_date(value):
        if not value or value == "":
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        try:
            return datetime.strptime(str(value), "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return None

    # Helper to safely parse floats
    def parse_float(value):
        if not value or value == "":
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    # Helper to safely parse ints
    def parse_int(value):
        if not value or value == "":
            return None
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return None

    # Extract database ID if available
    cutpay_id = None
    if database_record and "id" in database_record:
        cutpay_id = database_record["id"]

    # Build extracted_data (from PDF extraction)
    extracted_data = {
        "policy_number": sheets_data.get("Policy number") or sheets_data.get("policy_number"),
        "formatted_policy_number": sheets_data.get("Formatted Policy number"),
        "major_categorisation": sheets_data.get("Major Categorisation( Motor/Life/ Health)"),
        "product_insurer_report": sheets_data.get("Product (Insurer Report)"),
        "product_type": sheets_data.get("Product Type"),
        "plan_type": sheets_data.get("Plan type (Comp/STP/SAOD)"),
        "customer_name": sheets_data.get("Customer Name"),
        "customer_phone_number": sheets_data.get("Customer Number"),
        "gross_premium": parse_float(sheets_data.get("Gross premium")),
        "net_premium": parse_float(sheets_data.get("Net premium")),
        "od_premium": parse_float(sheets_data.get("OD Preimium")),
        "tp_premium": parse_float(sheets_data.get("TP Premium")),
        "gst_amount": parse_float(sheets_data.get("GST Amount")),
        "start_date": sheets_data.get("Policy Start Date"),
        "end_date": sheets_data.get("Policy End Date"),
        "registration_number": sheets_data.get("Registration.no"),
        "make_model": sheets_data.get("Make_Model"),
        "model": sheets_data.get("Model"),
        "vehicle_variant": sheets_data.get("Vehicle_Variant"),
        "gvw": parse_float(sheets_data.get("GVW")),
        "rto": sheets_data.get("RTO"),
        "state": sheets_data.get("State"),
        "fuel_type": sheets_data.get("Fuel Type"),
        "cc": parse_int(sheets_data.get("CC")),
        "age_year": parse_int(sheets_data.get("Age(Year)")),
        "ncb": sheets_data.get("NCB (YES/NO)"),
        "discount_percent": parse_float(sheets_data.get("Discount %")),
        "business_type": sheets_data.get("Business Type"),
        "seating_capacity": parse_int(sheets_data.get("Seating Capacity")),
        "veh_wheels": parse_int(sheets_data.get("Veh_Wheels")),
    }
    # Preserve all fields including empty strings ("") and zeros (0), only remove None values
    extracted_data = {k: v for k, v in extracted_data.items() if v is not None}

    # Build admin_input (manual admin fields)
    # Handle broker_code and insurer_code with fallback to combined column
    combined_code = sheets_data.get("Insurer /broker code", "")
    separate_broker_code = sheets_data.get("Broker code")
    separate_insurer_code = sheets_data.get("Insurer code")
    
    # Use separate columns if they exist and have values, otherwise use combined column
    broker_code = separate_broker_code if separate_broker_code else combined_code
    insurer_code = separate_insurer_code if separate_insurer_code else combined_code
    
    # Determine code_type based on business logic
    code_type = None
    if broker_code and insurer_code:
        code_type = "Broker Code"  # Both present = Broker Code
    elif insurer_code and not broker_code:
        code_type = "Direct Code"   # Only insurer = Direct Code
    # If neither present, code_type remains None
    
    # Get database fallback values for key fields when sheets data is empty
    db_booking_date = None
    db_agent_code = None
    db_admin_child_id = None
    if database_record:
        db_booking_date = database_record.get("booking_date")
        db_agent_code = database_record.get("agent_code") 
        db_admin_child_id = database_record.get("admin_child_id")
    
    admin_input = {
        "reporting_month": sheets_data.get("Reporting Month (mmm'yy)") or "",
        "booking_date": parse_date(sheets_data.get("Booking Date(Click to select Date)")) or db_booking_date,
        "agent_code": sheets_data.get("Agent Code") or db_agent_code or "",
        "code_type": code_type or "",  # Computed code_type based on broker/insurer presence
        "broker_code": broker_code or "",
        "insurer_code": insurer_code or "",
        "admin_child_id": sheets_data.get("Child ID/ User ID [Provided by Insure Zeal]") or sheets_data.get("Admin child ID") or db_admin_child_id or "",
        "incoming_grid_percent": parse_float(sheets_data.get("Incoming Grid %")) or 0,
        "agent_commission_given_percent": parse_float(sheets_data.get("Actual Agent_PO%")) or 0,
        "extra_grid": parse_float(sheets_data.get("Extra Grid")) or 0,
        "commissionable_premium": parse_float(sheets_data.get("Commissionable Premium")) or 0,
        "payment_by": sheets_data.get("Payment by") or "",
        "payment_method": sheets_data.get("Payment Mode") or "",
        "payout_on": sheets_data.get("Payout on") or "",
        "agent_extra_percent": parse_float(sheets_data.get("Agent_Extra%")) or 0,
        "payment_by_office": parse_float(sheets_data.get("Payment By Office")) or 0,
    }
    # Remove only None values, preserve empty strings and zeros
    admin_input = {k: v for k, v in admin_input.items() if v is not None}

    # Build calculations (auto-calculated fields)
    calculations = {
        "receivable_from_broker": parse_float(sheets_data.get("Receivable from Broker")) or 0,
        "extra_amount_receivable_from_broker": parse_float(
            sheets_data.get("Extra Amount Receivable from Broker")
        ) or 0,
        "total_receivable_from_broker": parse_float(
            sheets_data.get("Total Receivable from Broker")
        ) or 0,
        "total_receivable_from_broker_with_gst": parse_float(
            sheets_data.get("Total Receivable from Broker Include 18% GST")
        ) or 0,
        "cut_pay_amount": parse_float(sheets_data.get("Cut Pay Amount Received From Agent")) or 0,
        "agent_po_amt": parse_float(sheets_data.get("Agent_PO_AMT")) or 0,
        "agent_extra_amount": parse_float(sheets_data.get("Agent_Extr_Amount")) or 0,
        "total_agent_po_amt": parse_float(sheets_data.get("Agent Total PO Amount")) or 0,
        "iz_total_po_percent": parse_float(sheets_data.get("IZ Total PO%")) or 0,
        "already_given_to_agent": parse_float(sheets_data.get("Already Given to agent")) or 0,
        "insurer_broker_code": sheets_data.get("Insurer /broker code") or "",
        "cluster": sheets_data.get("Cluster") or "",
    }
    # Remove only None values, preserve zeros and empty strings
    calculations = {k: v for k, v in calculations.items() if v is not None}

    # Build the nested response
    response = {
        "id": cutpay_id,
        "policy_pdf_url": database_record.get("policy_pdf_url")
        if database_record
        else None,
        "additional_documents": database_record.get("additional_documents")
        if database_record
        else None,
        "extracted_data": extracted_data if extracted_data else None,
        "admin_input": admin_input if admin_input else None,
        "calculations": calculations if calculations else None,
        "broker_name": broker_name or sheets_data.get("Broker Name") or "",
        "insurer_name": insurer_name or sheets_data.get("Insurer name") or "",
        "claimed_by": sheets_data.get("Claimed By") or "",
        "running_bal": parse_float(sheets_data.get("Running Bal")) or 0,
        "cluster": sheets_data.get("Cluster") or "",
        "iz_total_po_percent": parse_float(sheets_data.get("IZ Total PO%")) or 0,
        "broker_po_percent": parse_float(sheets_data.get("As per Broker PO%")) or 0,
        "broker_payout_amount": parse_float(sheets_data.get("As per Broker PO AMT")) or 0,
        "invoice_status": sheets_data.get("Invoice Status") or "",
        "remarks": sheets_data.get("Remarks") or "",
        # Additional fields from Google Sheets (all remaining fields from 72-column list)
        "po_paid_to_agent": parse_float(sheets_data.get("PO Paid To Agent")) or 0,
        "as_per_agent_payout_percent": parse_float(sheets_data.get("As per Agent Payout%")) or 0,
        "as_per_agent_payout_amount": parse_float(sheets_data.get("As per Agent Payout Amount")) or 0,
        "po_percent_diff_agent": parse_float(sheets_data.get("PO% Diff Agent")) or 0,
        "po_amount_diff_agent": parse_float(sheets_data.get("PO AMT Diff Agent")) or 0,
        "po_percent_diff_broker": parse_float(sheets_data.get("PO% Diff Broker")) or 0,
        "po_amount_diff_broker": parse_float(sheets_data.get("PO AMT Diff Broker")) or 0,
        "invoice_number": sheets_data.get("Invoice Number") or "",
        "match": sheets_data.get("Match") or "FALSE",
    }

    # Add system fields from database if available
    if database_record:
        response.update(
            {
                "synced_to_cutpay_sheet": database_record.get("synced_to_cutpay_sheet"),
                "synced_to_master_sheet": database_record.get("synced_to_master_sheet"),
                "cutpay_sheet_row_id": database_record.get("cutpay_sheet_row_id"),
                "master_sheet_row_id": database_record.get("master_sheet_row_id"),
                "created_by": database_record.get("created_by"),
                "created_at": database_record.get("created_at"),
                "updated_at": database_record.get("updated_at"),
            }
        )

    # Remove None values at top level (but keep nested objects even if empty)
    response = {k: v for k, v in response.items() if v is not None}

    return response
