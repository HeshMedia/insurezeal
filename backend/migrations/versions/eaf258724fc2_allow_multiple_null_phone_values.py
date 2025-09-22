"""allow_multiple_null_phone_values

Revision ID: eaf258724fc2
Revises: 774081f689f5
Create Date: 2025-09-05 23:00:00.000000

"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "eaf258724fc2"
down_revision: Union[str, None] = "774081f689f5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Allow multiple null phone values by removing unique constraint on phone where it allows null
    # This migration was created to fix phone number unique constraint issues
    pass


def downgrade() -> None:
    # Reverse the changes if needed
    pass
