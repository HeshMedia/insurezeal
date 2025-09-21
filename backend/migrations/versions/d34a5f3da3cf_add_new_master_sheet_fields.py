"""add_new_master_sheet_fields

Revision ID: d34a5f3da3cf
Revises: cef323998a42
Create Date: 2025-08-19 20:29:06.309660

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd34a5f3da3cf'
down_revision: Union[str, None] = 'cef323998a42'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new fields to cut_pay table
    op.add_column('cut_pay', sa.Column('policy_start_date', sa.Date(), nullable=True))
    op.add_column('cut_pay', sa.Column('policy_end_date', sa.Date(), nullable=True))
    op.add_column('cut_pay', sa.Column('invoice_number', sa.String(length=100), nullable=True))
    op.add_column('cut_pay', sa.Column('po_diff_broker_percent', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('cut_pay', sa.Column('po_diff_broker_amt', sa.Numeric(precision=15, scale=2), nullable=True))
    op.add_column('cut_pay', sa.Column('agent_payout_percent', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('cut_pay', sa.Column('agent_payout_amount', sa.Numeric(precision=15, scale=2), nullable=True))
    op.add_column('cut_pay', sa.Column('po_diff_agent_percent', sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column('cut_pay', sa.Column('po_diff_agent_amt', sa.Numeric(precision=15, scale=2), nullable=True))
    op.add_column('cut_pay', sa.Column('veh_wheels', sa.Integer(), nullable=True))
    
    # Add new field to policies table
    op.add_column('policies', sa.Column('invoice_number', sa.String(length=100), nullable=True))


def downgrade() -> None:
    # Remove fields from policies table
    op.drop_column('policies', 'invoice_number')
    
    # Remove fields from cut_pay table
    op.drop_column('cut_pay', 'veh_wheels')
    op.drop_column('cut_pay', 'po_diff_agent_amt')
    op.drop_column('cut_pay', 'po_diff_agent_percent')
    op.drop_column('cut_pay', 'agent_payout_amount')
    op.drop_column('cut_pay', 'agent_payout_percent')
    op.drop_column('cut_pay', 'po_diff_broker_amt')
    op.drop_column('cut_pay', 'po_diff_broker_percent')
    op.drop_column('cut_pay', 'invoice_number')
    op.drop_column('cut_pay', 'policy_end_date')
    op.drop_column('cut_pay', 'policy_start_date')
