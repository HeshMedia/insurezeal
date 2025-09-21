"""fix_phone_unique_constraint_allow_null

Revision ID: 774081f689f5
Revises: bd248d6a58d2
Create Date: 2025-09-05 22:41:27.959138

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "774081f689f5"
down_revision: Union[str, None] = "bd248d6a58d2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the existing unique constraint on phone
    op.drop_constraint("users_phone_key", "users", type_="unique")

    # Create a partial unique constraint that allows multiple NULL/empty values
    # This ensures uniqueness for non-NULL, non-empty phone values while allowing multiple NULL/empty values
    op.execute(
        """
        CREATE UNIQUE INDEX users_phone_unique_non_null
        ON users (phone)
        WHERE phone IS NOT NULL AND phone != ''
    """
    )


def downgrade() -> None:
    # Drop the partial unique index
    op.drop_index("users_phone_unique_non_null", "users")

    # Recreate the original unique constraint
    op.create_unique_constraint("users_phone_key", "users", ["phone"])
