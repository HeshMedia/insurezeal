from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract, or_, desc
from sqlalchemy.orm import selectinload, joinedload
from models import CutPay, Insurer, Broker, ChildIdRequest, AdminChildID, UserProfile
from .cutpay_schemas import (
    CutPayCreate, CutPayUpdate, ExtractedPolicyData, InsurerDropdown, BrokerDropdown, ChildIdDropdown, CutPayStats
)

from fastapi import HTTPException, status
from typing import Optional, Dict, Any, List
from datetime import datetime, date
import logging
import csv
import io

logger = logging.getLogger(__name__)

# =============================================================================
# CODE LOOKUP HELPER FUNCTIONS
# =============================================================================

async def resolve_broker_code_to_id(db: AsyncSession, broker_code: str) -> Optional[int]:
    """Resolve broker code to broker ID"""
    if not broker_code:
        return None
    
    result = await db.execute(
        select(Broker.id).where(
            and_(
                Broker.broker_code == broker_code,
                Broker.is_active == True
            )
        )
    )
    broker = result.scalar_one_or_none()
    
    if not broker:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Broker with code '{broker_code}' not found or inactive"
        )
    
    return broker

async def resolve_insurer_code_to_id(db: AsyncSession, insurer_code: str) -> Optional[int]:
    """Resolve insurer code to insurer ID"""
    if not insurer_code:
        return None
    
    result = await db.execute(
        select(Insurer.id).where(
            and_(
                Insurer.insurer_code == insurer_code,
                Insurer.is_active == True
            )
        )
    )
    insurer = result.scalar_one_or_none()
    
    if not insurer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insurer with code '{insurer_code}' not found or inactive"
        )
    
    return insurer

async def validate_and_resolve_codes(
    db: AsyncSession,
    broker_code: Optional[str],
    insurer_code: Optional[str]
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
    """Helper class for cut pay operations with new flow support"""
    
    
    async def get_cutpay_by_id(self, db: AsyncSession, cutpay_id: int) -> Optional[CutPay]:
        """Get a cut pay transaction by ID with relationships"""
        try:
            result = await db.execute(
                select(CutPay)
                .options(
                    joinedload(CutPay.insurer),
                    joinedload(CutPay.broker),
                    joinedload(CutPay.child_id_request)
                )
                .where(CutPay.id == cutpay_id)
            )
            return result.scalar_one_or_none()
            
        except Exception as e:
            logger.error(f"Error fetching cut pay transaction {cutpay_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch cut pay transaction"
            )
    
    async def update_cutpay_transaction(
        self, 
        db: AsyncSession, 
        cutpay_id: int, 
        cutpay_data: CutPayUpdate
    ) -> Optional[CutPay]:
        """Update a cut pay transaction with recalculation"""
        try:
            cutpay = await self.get_cutpay_by_id(db, cutpay_id)
            if not cutpay:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Cut pay transaction not found"
                )
            
            # Update fields
            update_data = cutpay_data.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(cutpay, field, value)
            
            # Recalculate amounts if financial data changed
            if any(field in update_data for field in [
                'gross_amount', 'net_premium', 'agent_commission_given_percent', 
                'payment_mode', 'payout_percent'
            ]):
                calculation = await self.calculate_cutpay_amounts(
                    gross_amount=cutpay.gross_amount,
                    net_premium=cutpay.net_premium,
                    agent_commission_given_percent=cutpay.agent_commission_given_percent,
                    payment_mode=cutpay.payment_mode,
                    payout_percent=cutpay.payout_percent
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
                detail="Failed to update cut pay transaction"
            )
    
    async def calculate_cutpay_amounts(
        self,
        gross_amount: Optional[float] = None,
        net_premium: Optional[float] = None,
        agent_commission_given_percent: Optional[float] = None,
        payment_mode: Optional[str] = None,
        payout_percent: Optional[float] = None
    ) -> Dict[str, Any]:
        """Calculate CutPay amount and payout based on business logic"""
        try:
            cut_pay_amount = None
            payout_amount = None
            calculation_details = {}
            
            if gross_amount and net_premium and agent_commission_given_percent:
                # Basic CutPay calculation logic
                commission_amount = (gross_amount * agent_commission_given_percent) / 100
                cut_pay_amount = commission_amount - (net_premium * 0.1)  # Example calculation
                
                calculation_details["commission_amount"] = commission_amount
                calculation_details["cutpay_calculation"] = f"Commission({commission_amount}) - Net Premium Adjustment"
                
                # Payout calculation (when payment_mode is "agent")
                if payment_mode == "agent" and payout_percent and cut_pay_amount:
                    payout_amount = (cut_pay_amount * payout_percent) / 100
                    calculation_details["payout_calculation"] = f"CutPay({cut_pay_amount}) × Payout%({payout_percent})"
            
            return {
                "cut_pay_amount": cut_pay_amount,
                "payout_amount": payout_amount,
                "calculation_details": calculation_details
            }
            
        except Exception as e:
            logger.error(f"Error calculating cutpay amounts: {str(e)}")
            return {
                "cut_pay_amount": None,
                "payout_amount": None,
                "calculation_details": {"error": str(e)}
            }
    
    async def get_all_cutpay_transactions(
        self,
        db: AsyncSession,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        agent_code: Optional[str] = None,
        status_filter: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get paginated cut pay transactions with filters"""
        try:
            offset = (page - 1) * page_size
            
            # Build query with filters
            query = select(CutPay).options(
                joinedload(CutPay.insurer),
                joinedload(CutPay.broker),
                joinedload(CutPay.child_id_request)
            )
            
            # Apply filters
            conditions = []
            if search:
                conditions.append(
                    or_(
                        CutPay.policy_number.ilike(f"%{search}%"),
                        CutPay.agent_code.ilike(f"%{search}%")
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
            query = query.order_by(desc(CutPay.created_at)).offset(offset).limit(page_size)
            result = await db.execute(query)
            transactions = result.scalars().all()
            
            return {
                "transactions": transactions,
                "total_count": total_count,
                "page": page,
                "page_size": page_size
            }
            
        except Exception as e:
            logger.error(f"Error fetching cut pay transactions: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch cut pay transactions"
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
                    "is_active": insurer.is_active
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
                    "is_active": broker.is_active
                }
                for broker in broker_result.scalars().all()
            ]
            
            # Get active admin child IDs
            admin_child_result = await db.execute(
                select(AdminChildID)
                .options(
                    joinedload(AdminChildID.insurer),
                    joinedload(AdminChildID.broker)
                )
                .where(AdminChildID.is_active == True)
                .order_by(AdminChildID.child_id)
            )
            admin_child_ids = [
                {
                    "id": admin_child.id,
                    "child_id": admin_child.child_id,
                    "insurer_name": admin_child.insurer.name,
                    "broker_name": admin_child.broker.name if admin_child.broker else None,
                    "code_type": admin_child.code_type,
                    "is_active": admin_child.is_active
                }
                for admin_child in admin_child_result.scalars().all()
            ]
            
            return {
                "insurers": insurers,
                "brokers": brokers,
                "admin_child_ids": admin_child_ids
            }
            
        except Exception as e:
            logger.error(f"Error fetching cutpay dropdowns: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch dropdown options"
            )
    
    async def get_cutpay_statistics(self, db: AsyncSession) -> Dict[str, Any]:
        """Get comprehensive cut pay statistics"""
        try:
            # Basic stats
            stats_result = await db.execute(
                select(
                    func.count(CutPay.id).label("total_transactions"),
                    func.coalesce(func.sum(CutPay.cut_pay_amount), 0).label("total_cut_pay_amount"),
                    func.coalesce(func.sum(CutPay.amount_received), 0).label("total_amount_received"),
                    func.coalesce(func.avg(CutPay.cut_pay_amount), 0).label("average_cut_pay_amount")
                )
            )
            stats = stats_result.first()
            
            # Monthly breakdown
            monthly_result = await db.execute(
                select(
                    extract('year', CutPay.created_at).label('year'),
                    extract('month', CutPay.created_at).label('month'),
                    func.count(CutPay.id).label('count'),
                    func.coalesce(func.sum(CutPay.cut_pay_amount), 0).label('total_amount')
                )
                .group_by(
                    extract('year', CutPay.created_at),
                    extract('month', CutPay.created_at)
                )
                .order_by(
                    extract('year', CutPay.created_at).desc(),
                    extract('month', CutPay.created_at).desc()
                )
                .limit(12)
            )
            monthly_breakdown = [
                {
                    "year": int(row.year),
                    "month": int(row.month),
                    "count": row.count,
                    "total_amount": float(row.total_amount)
                }
                for row in monthly_result.fetchall()
            ]
            
            # Top agents
            top_agents_result = await db.execute(
                select(
                    CutPay.agent_code,
                    func.count(CutPay.id).label('transaction_count'),
                    func.coalesce(func.sum(CutPay.cut_pay_amount), 0).label('total_amount')
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
                    "total_amount": float(row.total_amount)
                }
                for row in top_agents_result.fetchall()
            ]
            
            return {
                "stats": CutPayStats(
                    total_transactions=stats.total_transactions,
                    total_cut_pay_amount=float(stats.total_cut_pay_amount),
                    total_amount_received=float(stats.total_amount_received),
                    average_cut_pay_amount=float(stats.average_cut_pay_amount)
                ),
                "monthly_breakdown": monthly_breakdown,
                "top_agents": top_agents
            }
            
        except Exception as e:
            logger.error(f"Error fetching cut pay statistics: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch cut pay statistics"
            )
    
    async def delete_cutpay_transaction(self, db: AsyncSession, cutpay_id: int) -> bool:
        """Delete a cut pay transaction"""
        try:
            cutpay = await self.get_cutpay_by_id(db, cutpay_id)
            if not cutpay:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Cut pay transaction not found"
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
                detail="Failed to delete cut pay transaction"
            )
    
    async def export_cutpay_transactions(
        self,
        db: AsyncSession,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> io.StringIO:
        """Export cut pay transactions to CSV"""
        try:
            query = select(CutPay).options(
                joinedload(CutPay.insurer),
                joinedload(CutPay.broker),
                joinedload(CutPay.child_id_request)
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
                'ID', 'Policy Number', 'Agent Code', 'Code Type', 'Insurer', 'Broker',
                'Gross Amount', 'Net Premium', 'Commission %', 'Cut Pay Amount',
                'Payment Mode', 'Payout Amount', 'Amount Received', 'Status',
                'Transaction Date', 'Created At'
            ]
            writer.writerow(headers)
            
            # Write data
            for transaction in transactions:
                writer.writerow([
                    transaction.id,
                    transaction.policy_number or '',
                    transaction.agent_code or '',
                    transaction.code_type or '',
                    transaction.insurer.name if transaction.insurer else '',
                    transaction.broker.name if transaction.broker else '',
                    transaction.gross_amount or 0,
                    transaction.net_premium or 0,
                    transaction.agent_commission_given_percent or 0,
                    transaction.cut_pay_amount or 0,
                    transaction.payment_mode or '',
                    transaction.payout_amount or 0,
                    transaction.amount_received or 0,
                    transaction.status,
                    transaction.transaction_date or '',
                    transaction.created_at
                ])
            
            output.seek(0)
            return output
            
        except Exception as e:
            logger.error(f"Error exporting cut pay transactions: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to export cut pay transactions"
            )

# =============================================================================
# STANDALONE HELPER FUNCTIONS (for cutpay.py router)  
# =============================================================================

async def calculate_commission_amounts(calculation_data: Dict[str, Any]) -> Dict[str, Any]:
    """Calculate commission amounts using real business logic from README"""
    try:
        # Extract input values
        gross_premium = calculation_data.get('gross_premium', 0) or 0
        net_premium = calculation_data.get('net_premium', 0) or 0
        od_premium = calculation_data.get('od_premium', 0) or 0
        tp_premium = calculation_data.get('tp_premium', 0) or 0
        incoming_grid_percent = calculation_data.get('incoming_grid_percent', 0) or 0
        extra_grid = calculation_data.get('extra_grid', 0) or 0
        commissionable_premium = calculation_data.get('commissionable_premium') or gross_premium
        agent_commission_percent = calculation_data.get('agent_commission_given_percent', 0) or 0
        payment_by = calculation_data.get('payment_by', 'Agent')
        payout_on = calculation_data.get('payout_on', 'NP')
        
        # Initialize results
        result = {
            'receivable_from_broker': 0,
            'extra_amount_receivable_from_broker': 0,
            'total_receivable_from_broker': 0,
            'total_receivable_from_broker_with_gst': 0,
            'cut_pay_amount': 0,
            'agent_po_amt': 0,
            'total_agent_po_amt': 0,
            'calculation_details': {}
        }
        
        # 1. Commission Calculations
        if gross_premium and incoming_grid_percent:
            # Receivable from Broker = Gross Premium × Incoming Grid %
            result['receivable_from_broker'] = gross_premium * (incoming_grid_percent / 100)
            
            # Extra Receivable = Commissionable Premium × Extra Grid %
            if extra_grid and commissionable_premium:
                result['extra_amount_receivable_from_broker'] = commissionable_premium * (extra_grid / 100)
            
            # Total Receivable = Receivable + Extra
            result['total_receivable_from_broker'] = (
                result['receivable_from_broker'] + result['extra_amount_receivable_from_broker']
            )
            
            # With GST = Total × 1.18
            result['total_receivable_from_broker_with_gst'] = result['total_receivable_from_broker'] * 1.18
        
        # 2. CutPay Amount Logic
        if payment_by == "Agent":
            result['cut_pay_amount'] = 0  # Agent handles customer payment
        elif payment_by == "InsureZeal" and gross_premium and net_premium and agent_commission_percent:
            agent_commission = net_premium * (agent_commission_percent / 100)
            result['cut_pay_amount'] = gross_premium - agent_commission
        
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
                result['agent_po_amt'] = base_premium * (agent_commission_percent / 100)
                result['total_agent_po_amt'] = result['agent_po_amt']  # Can add extra amounts later
        
        # 4. Calculation Details for transparency
        result['calculation_details'] = {
            'commission_formula': f"{gross_premium} × {incoming_grid_percent}% = {result['receivable_from_broker']}",
            'extra_formula': f"{commissionable_premium} × {extra_grid}% = {result['extra_amount_receivable_from_broker']}",
            'gst_formula': f"{result['total_receivable_from_broker']} × 1.18 = {result['total_receivable_from_broker_with_gst']}",
            'cutpay_logic': f"Payment by {payment_by}: {result['cut_pay_amount']}",
            'payout_logic': f"Payout on {payout_on}: {result['agent_po_amt']}"
        }
        
        logger.info(f"Calculated commission amounts: CutPay={result['cut_pay_amount']}, Agent Payout={result['agent_po_amt']}")
        return result
        
    except Exception as e:
        logger.error(f"Error calculating commission amounts: {str(e)}")
        return {
            'receivable_from_broker': 0,
            'total_receivable_from_broker_with_gst': 0,
            'cut_pay_amount': 0,
            'agent_po_amt': 0,
            'calculation_details': {'error': str(e)}
        }

async def get_dropdown_options(db: AsyncSession) -> Dict[str, List]:
    """Get dropdown options for CutPay form (standalone function)"""
    helper = CutPayHelpers()
    return await helper.get_cutpay_dropdowns(db)

async def get_filtered_dropdowns(db: AsyncSession, insurer_id: Optional[int] = None, broker_id: Optional[int] = None) -> Dict[str, List]:
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
        
        # Get admin child IDs (filter by insurer/broker if provided)
        admin_child_query = select(AdminChildID).options(
            joinedload(AdminChildID.insurer),
            joinedload(AdminChildID.broker)
        ).where(AdminChildID.is_active == True)
        
        conditions = []
        if insurer_id:
            conditions.append(AdminChildID.insurer_id == insurer_id)
        if broker_id:
            conditions.append(AdminChildID.broker_id == broker_id)
        
        if conditions:
            admin_child_query = admin_child_query.where(and_(*conditions))
        
        admin_child_query = admin_child_query.order_by(AdminChildID.child_id)
        admin_child_result = await db.execute(admin_child_query)
        
        result["admin_child_ids"] = [
            {
                "id": admin_child.id,
                "child_id": admin_child.child_id,
                "insurer_name": admin_child.insurer.name if admin_child.insurer else None,
                "broker_name": admin_child.broker.name if admin_child.broker else None,
                "code_type": admin_child.code_type,
                "is_active": admin_child.is_active
            }
            for admin_child in admin_child_result.scalars().all()
        ]
        
        logger.info(f"Retrieved filtered dropdowns: {len(result['insurers'])} insurers, {len(result['brokers'])} brokers, {len(result['admin_child_ids'])} admin child IDs")
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
            if hasattr(cutpay, 'insurer') and cutpay.insurer:
                cutpay.insurer_name = cutpay.insurer.name
        
        # Auto-populate broker name from broker_id  
        if cutpay.broker_id and not cutpay.broker_name:
            if hasattr(cutpay, 'broker') and cutpay.broker:
                cutpay.broker_name = cutpay.broker.name
        
        # Auto-populate cluster from state (basic mapping)
        if cutpay.state and not cutpay.cluster:
            state_cluster_map = {
                'MH': 'West', 'GJ': 'West', 'RJ': 'West',
                'DL': 'North', 'PB': 'North', 'HR': 'North',
                'KA': 'South', 'TN': 'South', 'AP': 'South', 'TS': 'South',
                'WB': 'East', 'OR': 'East', 'JH': 'East'
            }
            cutpay.cluster = state_cluster_map.get(cutpay.state, 'Other')
            
        logger.info(f"Auto-populated relationship data for CutPay {cutpay.id}")
        
    except Exception as e:
        logger.error(f"Error auto-populating relationship data: {str(e)}")



def validate_cutpay_data(cutpay_data: Dict[str, Any]) -> List[str]:
    """Validate CutPay data (standalone function)"""
    errors = []

    # Check for policy_number and agent_code at all possible locations
    policy_number = (
        cutpay_data.get('policy_number')
        or (cutpay_data.get('extracted_data') or {}).get('policy_number')
    )
    agent_code = (
        cutpay_data.get('agent_code')
        or (cutpay_data.get('admin_input') or {}).get('agent_code')
    )

    if not policy_number and not agent_code:
        errors.append("Either policy_number or agent_code is required")

    # Gross amount validation (top-level or in admin_input)
    gross_amount = cutpay_data.get('gross_amount') or (cutpay_data.get('admin_input') or {}).get('gross_amount')
    if gross_amount and gross_amount < 0:
        errors.append("Gross amount cannot be negative")
    
    # Agent commission percent validation (top-level or in admin_input)
    agent_commission = cutpay_data.get('agent_commission_given_percent') or (cutpay_data.get('admin_input') or {}).get('agent_commission_given_percent')
    if agent_commission is not None:
        if agent_commission < 0 or agent_commission > 100:
            errors.append("Agent commission percent must be between 0 and 100")
    
    return errors


async def update_agent_financials(db: AsyncSession, agent_code: str, net_premium: float, running_balance: float):
    """Update agent financial totals in UserProfile"""
    try:
        if not agent_code:
            return
        
        # Find the user profile by agent_code
        result = await db.execute(
            select(UserProfile).where(UserProfile.agent_code == agent_code)
        )
        user_profile = result.scalar_one_or_none()
        
        if not user_profile:
            logger.warning(f"No user profile found for agent_code: {agent_code}")
            return
        
        # Update running totals
        current_running_balance = user_profile.running_balance or 0.0
        current_total_net_premium = user_profile.total_net_premium or 0.0
        
        user_profile.running_balance = current_running_balance + (running_balance or 0.0)
        user_profile.total_net_premium = current_total_net_premium + (net_premium or 0.0)
        
        logger.info(f"Updated agent {agent_code} financials - Running Balance: {user_profile.running_balance}, Total Net Premium: {user_profile.total_net_premium}")
        
    except Exception as e:
        logger.error(f"Error updating agent financials for {agent_code}: {str(e)}")


async def get_agent_financial_summary(db: AsyncSession, agent_code: str) -> Dict[str, Any]:
    """Get agent financial summary from UserProfile"""
    try:
        result = await db.execute(
            select(UserProfile).where(UserProfile.agent_code == agent_code)
        )
        user_profile = result.scalar_one_or_none()
        
        if not user_profile:
            return {
                "agent_code": agent_code,
                "running_balance": 0.0,
                "total_net_premium": 0.0,
                "last_updated": None
            }
        
        return {
            "agent_code": agent_code,
            "running_balance": float(user_profile.running_balance or 0.0),
            "total_net_premium": float(user_profile.total_net_premium or 0.0),
            "last_updated": user_profile.updated_at
        }
        
    except Exception as e:
        logger.error(f"Error getting agent financial summary for {agent_code}: {str(e)}")
        return {
            "agent_code": agent_code,
            "running_balance": 0.0,
            "total_net_premium": 0.0,
            "last_updated": None
        }
