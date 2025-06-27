from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract, or_, desc
from sqlalchemy.orm import selectinload, joinedload
from models import CutPay, Insurer, Broker, ChildIdRequest
from .cutpay_schemas import (
    CutPayCreate, CutPayUpdate, CutPayPDFExtraction, InsurerDropdown, BrokerDropdown, ChildIdDropdown, CutPayStats
)
from utils.ai_utils import extract_policy_data_from_pdf
from utils.google_sheets import sync_cutpay_to_sheets
from fastapi import HTTPException, status
from typing import Optional, Dict, Any, List
from datetime import datetime, date
import logging
import csv
import io

logger = logging.getLogger(__name__)

class CutPayHelpers:
    """Helper class for cut pay operations with new flow support"""
    
    async def create_cutpay_transaction(
        self, 
        db: AsyncSession, 
        cutpay_data: CutPayCreate, 
        created_by_user_id: str
    ) -> CutPay:
        """Create a new cut pay transaction with new flow support"""
        try:
            # Calculate cut_pay_amount if sufficient data is provided
            cut_pay_amount = None
            payout_amount = None
            
            if (cutpay_data.gross_amount and cutpay_data.net_premium and 
                cutpay_data.agent_commission_given_percent):
                calculation = await self.calculate_cutpay_amounts(
                    gross_amount=cutpay_data.gross_amount,
                    net_premium=cutpay_data.net_premium,
                    agent_commission_given_percent=cutpay_data.agent_commission_given_percent,
                    payment_mode=cutpay_data.payment_mode,
                    payout_percent=cutpay_data.payout_percent
                )
                cut_pay_amount = calculation["cut_pay_amount"]
                payout_amount = calculation["payout_amount"]
            
            cutpay = CutPay(
                **cutpay_data.model_dump(exclude_unset=True),
                cut_pay_amount=cut_pay_amount,
                payout_amount=payout_amount,
                created_by=created_by_user_id
            )
            
            db.add(cutpay)
            await db.commit()
            await db.refresh(cutpay, attribute_names=[
                'insurer', 'broker', 'child_id_request'
            ])
            
            logger.info(f"Cut pay transaction created with ID: {cutpay.id}")
            return cutpay
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error creating cut pay transaction: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create cut pay transaction"
            )
    
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
    
    async def process_pdf_extraction(
        self, 
        db: AsyncSession, 
        cutpay_id: int, 
        pdf_url: str
    ) -> CutPayPDFExtraction:
        """Process PDF extraction for CutPay transaction"""
        try:
            # Extract data using AI
            extracted_data = await extract_policy_data_from_pdf(pdf_url)
            
            # Update CutPay transaction with extracted data
            cutpay = await self.get_cutpay_by_id(db, cutpay_id)
            if not cutpay:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Cut pay transaction not found"
                )
            
            # Map extracted data to CutPay fields
            cutpay.policy_number = extracted_data.get('policy_number')
            cutpay.policy_holder_name = extracted_data.get('policy_holder_name')
            cutpay.policy_start_date = extracted_data.get('policy_start_date')
            cutpay.policy_end_date = extracted_data.get('policy_end_date')
            cutpay.premium_amount = extracted_data.get('premium_amount')
            cutpay.sum_insured = extracted_data.get('sum_insured')
            cutpay.insurance_type = extracted_data.get('insurance_type')
            cutpay.policy_pdf_url = pdf_url
            
            await db.commit()
            
            return CutPayPDFExtraction(
                **extracted_data,
                confidence_score=extracted_data.get('confidence_score', 0.0)
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error processing PDF extraction for cutpay {cutpay_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to process PDF extraction"
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
                InsurerDropdown(
                    id=insurer.id,
                    name=insurer.name,
                    insurer_code=insurer.insurer_code,
                    is_active=insurer.is_active
                )
                for insurer in insurer_result.scalars().all()
            ]
            
            # Get active brokers
            broker_result = await db.execute(
                select(Broker).where(Broker.is_active == True).order_by(Broker.name)
            )
            brokers = [
                BrokerDropdown(
                    id=broker.id,
                    name=broker.name,
                    broker_code=broker.broker_code,
                    is_active=broker.is_active
                )
                for broker in broker_result.scalars().all()
            ]
            
            # Get approved child IDs
            child_id_result = await db.execute(
                select(ChildIdRequest)
                .options(
                    joinedload(ChildIdRequest.insurer),
                    joinedload(ChildIdRequest.broker)
                )
                .where(ChildIdRequest.status == "approved")
                .order_by(ChildIdRequest.child_id)
            )
            child_ids = [
                ChildIdDropdown(
                    id=child_id.id,
                    child_id=child_id.child_id,
                    insurer_name=child_id.insurer.name,
                    broker_name=child_id.broker.name if child_id.broker else None,
                    code_type=child_id.code_type,
                    status=child_id.status
                )
                for child_id in child_id_result.scalars().all()
            ]
            
            return {
                "insurers": insurers,
                "brokers": brokers,
                "child_ids": child_ids
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

async def extract_pdf_data(cutpay_id: int, pdf_url: str, db: AsyncSession):
    """Extract data from policy PDF using AI/OCR (standalone function)"""
    helper = CutPayHelpers()
    return await helper.process_pdf_extraction(db, cutpay_id, pdf_url)

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
            {"id": insurer.id, "name": insurer.name, "insurer_code": insurer.insurer_code}
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
            {"id": broker.id, "name": broker.name, "broker_code": broker.broker_code}
            for broker in broker_result.scalars().all()
        ]
        
        # Get child IDs (filter by insurer/broker if provided)
        child_id_query = select(ChildIdRequest).options(
            joinedload(ChildIdRequest.insurer),
            joinedload(ChildIdRequest.broker)
        ).where(ChildIdRequest.status == "approved")
        
        conditions = []
        if insurer_id:
            conditions.append(ChildIdRequest.insurer_id == insurer_id)
        if broker_id:
            conditions.append(ChildIdRequest.broker_id == broker_id)
        
        if conditions:
            child_id_query = child_id_query.where(and_(*conditions))
        
        child_id_query = child_id_query.order_by(ChildIdRequest.child_id)
        child_id_result = await db.execute(child_id_query)
        
        result["child_ids"] = [
            {
                "id": child_id.id,
                "child_id": child_id.child_id,
                "insurer_name": child_id.insurer.name if child_id.insurer else None,
                "broker_name": child_id.broker.name if child_id.broker else None,
                "code_type": child_id.code_type
            }
            for child_id in child_id_result.scalars().all()
        ]
        
        logger.info(f"Retrieved filtered dropdowns: {len(result['insurers'])} insurers, {len(result['brokers'])} brokers, {len(result['child_ids'])} child IDs")
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

async def sync_cutpay_transaction(cutpay_id: int, db: AsyncSession) -> Dict[str, Any]:
    """Sync CutPay transaction to Google Sheets using real sync function"""
    try:
        # Get the CutPay transaction
        helper = CutPayHelpers()
        cutpay = await helper.get_cutpay_by_id(db, cutpay_id)
        
        if not cutpay:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="CutPay transaction not found"
            )
        
        # Use the real Google Sheets sync function
        result = await sync_cutpay_to_sheets(cutpay)
        
        logger.info(f"Successfully synced CutPay transaction {cutpay_id} to Google Sheets")
        return result
        
    except Exception as e:
        logger.error(f"Error syncing CutPay transaction {cutpay_id}: {str(e)}")
        return {"status": "error", "message": str(e)}

def validate_cutpay_data(cutpay_data: Dict[str, Any]) -> List[str]:
    """Validate CutPay data (standalone function)"""
    errors = []
    
    # Basic validation
    if not cutpay_data.get('policy_number') and not cutpay_data.get('agent_code'):
        errors.append("Either policy_number or agent_code is required")
    
    if cutpay_data.get('gross_amount') and cutpay_data.get('gross_amount') < 0:
        errors.append("Gross amount cannot be negative")
    
    if cutpay_data.get('agent_commission_given_percent'):
        commission = cutpay_data['agent_commission_given_percent']
        if commission < 0 or commission > 100:
            errors.append("Agent commission percent must be between 0 and 100")
    
    return errors
