from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract, or_, desc
from sqlalchemy.orm import selectinload, joinedload
from models import CutPay, Insurer, Broker, ChildIdRequest
from .cutpay_schemas import (
    CutPayCreate, CutPayUpdate, CutPayStats, CutPayPDFExtraction,
    CutPayCalculationRequest, InsurerDropdown, BrokerDropdown, ChildIdDropdown
)
from fastapi import HTTPException, status
from typing import Optional, Dict, Any, List
from datetime import datetime, date
import logging
import csv
import io
from utils.ai_utils import extract_policy_data_from_pdf
from utils.pdf_utils import validate_pdf_file

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
            
            update_data = cutpay_data.model_dump(exclude_unset=True)
            for field, value in update_data.items():
                setattr(cutpay, field, value)

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
            if not validate_pdf_file(pdf_url):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid PDF file"
                )

            extracted_data = await extract_policy_data_from_pdf(pdf_url)
            
            cutpay = await self.get_cutpay_by_id(db, cutpay_id)
            if not cutpay:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Cut pay transaction not found"
                )
            
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
                commission_amount = (gross_amount * agent_commission_given_percent) / 100
                cut_pay_amount = commission_amount - (net_premium * 0.1) 
                calculation_details["commission_amount"] = commission_amount
                calculation_details["cutpay_calculation"] = f"Commission({commission_amount}) - Net Premium Adjustment"
                
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
            
            query = select(CutPay).options(
                joinedload(CutPay.insurer),
                joinedload(CutPay.broker),
                joinedload(CutPay.child_id_request)
            )
            
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

            count_query = select(func.count(CutPay.id))
            if conditions:
                count_query = count_query.where(and_(*conditions))
            
            total_count_result = await db.execute(count_query)
            total_count = total_count_result.scalar()

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
            stats_result = await db.execute(
                select(
                    func.count(CutPay.id).label("total_transactions"),
                    func.coalesce(func.sum(CutPay.cut_pay_amount), 0).label("total_cut_pay_amount"),
                    func.coalesce(func.sum(CutPay.amount_received), 0).label("total_amount_received"),
                    func.coalesce(func.avg(CutPay.cut_pay_amount), 0).label("average_cut_pay_amount")
                )
            )
            stats = stats_result.first()
            
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

            output = io.StringIO()
            writer = csv.writer(output)

            headers = [
                'ID', 'Policy Number', 'Agent Code', 'Code Type', 'Insurer', 'Broker',
                'Gross Amount', 'Net Premium', 'Commission %', 'Cut Pay Amount',
                'Payment Mode', 'Payout Amount', 'Amount Received', 'Status',
                'Transaction Date', 'Created At'
            ]
            writer.writerow(headers)

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
