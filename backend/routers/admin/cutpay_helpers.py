from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract
from sqlalchemy.orm import selectinload
from models import CutPay
from .cutpay_schemas import CutPayCreate, CutPayUpdate, CutPayStats
from fastapi import HTTPException, status
from typing import Optional, Dict, Any, List
from datetime import datetime, date
import logging
import csv
import io

logger = logging.getLogger(__name__)

class CutPayHelpers:
    """Helper class for cut pay operations"""
    
    async def create_cutpay_transaction(
        self, 
        db: AsyncSession, 
        cutpay_data: CutPayCreate, 
        created_by_user_id: str
    ) -> CutPay:
        """Create a new cut pay transaction"""
        try:
            cutpay = CutPay(
                **cutpay_data.model_dump(),
                created_by=created_by_user_id
            )
            
            db.add(cutpay)
            await db.commit()
            await db.refresh(cutpay)
            
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
        """Get a cut pay transaction by ID"""
        try:
            result = await db.execute(
                select(CutPay).where(CutPay.id == cutpay_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching cut pay transaction {cutpay_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch cut pay transaction"
            )
    async def get_all_cutpay_transactions(
        self, 
        db: AsyncSession, 
        page: int = 1, 
        page_size: int = 20,
        search: Optional[str] = None,
        agent_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get all cut pay transactions with pagination and filters"""
        try:
            query = select(CutPay)
            count_query = select(func.count(CutPay.id))
            
            if search:
                search_filter = CutPay.policy_number.ilike(f"%{search}%")
                query = query.where(search_filter)
                count_query = count_query.where(search_filter)
            
            if agent_code:
                agent_filter = CutPay.agent_code == agent_code
                query = query.where(agent_filter)
                count_query = count_query.where(agent_filter)
            
            total_result = await db.execute(count_query)
            total_count = total_result.scalar()
            
            offset = (page - 1) * page_size
            query = query.order_by(CutPay.created_at.desc()).offset(offset).limit(page_size)
            
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
    
    async def update_cutpay_transaction(
        self, 
        db: AsyncSession, 
        cutpay_id: int, 
        update_data: CutPayUpdate
    ) -> Optional[CutPay]:
        """Update a cut pay transaction"""
        try:
            cutpay = await self.get_cutpay_by_id(db, cutpay_id)
            if not cutpay:
                return None
            
            update_dict = update_data.model_dump(exclude_unset=True)
            for field, value in update_dict.items():
                setattr(cutpay, field, value)
            
            await db.commit()
            await db.refresh(cutpay)
            
            logger.info(f"Cut pay transaction {cutpay_id} updated successfully")
            return cutpay
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error updating cut pay transaction {cutpay_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update cut pay transaction"
            )
    
    async def delete_cutpay_transaction(self, db: AsyncSession, cutpay_id: int) -> bool:
        """Delete a cut pay transaction"""
        try:
            cutpay = await self.get_cutpay_by_id(db, cutpay_id)
            if not cutpay:
                return False
            
            await db.delete(cutpay)
            await db.commit()
            
            logger.info(f"Cut pay transaction {cutpay_id} deleted successfully")
            return True
            
        except Exception as e:
            await db.rollback()
            logger.error(f"Error deleting cut pay transaction {cutpay_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete cut pay transaction"
            )
    
    async def get_cutpay_statistics(self, db: AsyncSession) -> Dict[str, Any]:
        """Get comprehensive cut pay statistics"""
        try:
            basic_stats_query = select(
                func.count(CutPay.id).label('total_transactions'),
                func.sum(CutPay.cut_pay_amount).label('total_cut_pay_amount'),
                func.sum(CutPay.amount_received).label('total_amount_received'),
                func.avg(CutPay.cut_pay_amount).label('average_cut_pay_amount')            )
            
            basic_result = await db.execute(basic_stats_query)
            basic_stats = basic_result.first()
            
            current_year = datetime.now().year
            monthly_query = select(
                extract('month', CutPay.transaction_date).label('month'),
                func.count(CutPay.id).label('count'),
                func.sum(CutPay.cut_pay_amount).label('total_amount')
            ).where(
                extract('year', CutPay.transaction_date) == current_year
            ).group_by(extract('month', CutPay.transaction_date))
            
            monthly_result = await db.execute(monthly_query)
            monthly_breakdown = [
                {
                    "month": int(row.month),
                    "count": row.count,
                    "total_amount": float(row.total_amount or 0)
                }
                for row in monthly_result
            ]
            
            agents_query = select(
                CutPay.agent_code,
                func.count(CutPay.id).label('transaction_count'),
                func.sum(CutPay.cut_pay_amount).label('total_cut_pay')
            ).group_by(CutPay.agent_code).order_by(
                func.sum(CutPay.cut_pay_amount).desc()
            ).limit(10)
            
            agents_result = await db.execute(agents_query)
            top_agents = [
                {
                    "agent_code": row.agent_code,
                    "transaction_count": row.transaction_count,
                    "total_cut_pay": float(row.total_cut_pay or 0)                }
                for row in agents_result
            ]
            
            stats = CutPayStats(                total_transactions=basic_stats.total_transactions or 0,
                total_cut_pay_amount=float(basic_stats.total_cut_pay_amount or 0),
                total_amount_received=float(basic_stats.total_amount_received or 0),
                average_cut_pay_amount=float(basic_stats.average_cut_pay_amount or 0)
            )
            
            return {
                "stats": stats,
                "monthly_breakdown": monthly_breakdown,
                "top_agents": top_agents
            }
            
        except Exception as e:
            logger.error(f"Error getting cut pay statistics: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch cut pay statistics"
            )
    
    async def export_cutpay_to_csv(
        self, 
        db: AsyncSession, 
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> str:
        """Export cut pay transactions to CSV format"""
        try:
            query = select(CutPay)
            
            if start_date and end_date:
                query = query.where(
                    and_(
                        CutPay.transaction_date >= start_date,
                        CutPay.transaction_date <= end_date
                    )
                )
            elif start_date:
                query = query.where(CutPay.transaction_date >= start_date)
            elif end_date:
                query = query.where(CutPay.transaction_date <= end_date)
            
            query = query.order_by(CutPay.transaction_date.desc())
            
            result = await db.execute(query)
            transactions = result.scalars().all()
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            headers = [
                'ID', 'Policy Number', 'Agent Code', 'Insurance Company', 'Broker',
                'Gross Amount', 'Net Premium', 'Commission Grid',                'Agent Commission Given %', 'Cut Pay Amount', 'Payment By',
                'Amount Received', 'Payment Method',
                'Payment Source', 'Transaction Date', 'Payment Date', 
                'Notes', 'Created At', 'Updated At'
            ]
            writer.writerow(headers)
            
            for transaction in transactions:
                row = [
                    transaction.id,
                    transaction.policy_number,
                    transaction.agent_code,
                    transaction.insurance_company,
                    transaction.broker,
                    transaction.gross_amount,
                    transaction.net_premium,
                    transaction.commission_grid,
                    transaction.agent_commission_given_percent, 
                    transaction.cut_pay_amount,
                    transaction.payment_by,
                    transaction.amount_received,
                    transaction.payment_method,
                    transaction.payment_source,
                    transaction.transaction_date.strftime('%Y-%m-%d') if transaction.transaction_date else '',
                    transaction.payment_date.strftime('%Y-%m-%d') if transaction.payment_date else '',
                    transaction.notes or '',
                    transaction.created_at.strftime('%Y-%m-%d %H:%M:%S') if transaction.created_at else '',
                    transaction.updated_at.strftime('%Y-%m-%d %H:%M:%S') if transaction.updated_at else ''
                ]
                writer.writerow(row)
            
            csv_content = output.getvalue()
            output.close()
            
            logger.info(f"CSV export generated with {len(transactions)} transactions")
            return csv_content
            
        except Exception as e:
            logger.error(f"Error exporting cut pay to CSV: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to export cut pay transactions to CSV"
            )
