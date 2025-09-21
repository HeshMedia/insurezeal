"""change registration_no to registration_number in cutpay

Revision ID: change_registration_no
Revises: ff8fe434d15c
Create Date: 2025-08-15 12:00:00.000000

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "change_registration_no"
down_revision = "ff8fe434d15c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Rename the column from registration_no to registration_number in cutpay table
    op.alter_column("cutpay", "registration_no", new_column_name="registration_number")


def downgrade() -> None:
    # Rename back from registration_number to registration_no
    op.alter_column("cutpay", "registration_number", new_column_name="registration_no")
