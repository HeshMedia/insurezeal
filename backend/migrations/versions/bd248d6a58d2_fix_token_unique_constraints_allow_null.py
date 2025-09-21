"""fix_token_unique_constraints_allow_null

Revision ID: bd248d6a58d2
Revises: eaf258724fc2
Create Date: 2025-09-05 22:33:25.112205

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "bd248d6a58d2"
down_revision: Union[str, None] = "fad68cc96e94"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop existing unique indexes that don't handle NULL properly
    op.drop_index("confirmation_token_idx", "users")
    op.drop_index("email_change_token_current_idx", "users")
    op.drop_index("email_change_token_new_idx", "users")
    op.drop_index("reauthentication_token_idx", "users")
    op.drop_index("recovery_token_idx", "users")

    # Create partial unique indexes that allow multiple NULL values but ensure uniqueness for non-NULL values
    op.execute(
        """
        CREATE UNIQUE INDEX confirmation_token_unique_non_null
        ON users (confirmation_token)
        WHERE confirmation_token IS NOT NULL AND confirmation_token != ''
    """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX email_change_token_current_unique_non_null
        ON users (email_change_token_current)
        WHERE email_change_token_current IS NOT NULL AND email_change_token_current != ''
    """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX email_change_token_new_unique_non_null
        ON users (email_change_token_new)
        WHERE email_change_token_new IS NOT NULL AND email_change_token_new != ''
    """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX reauthentication_token_unique_non_null
        ON users (reauthentication_token)
        WHERE reauthentication_token IS NOT NULL AND reauthentication_token != ''
    """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX recovery_token_unique_non_null
        ON users (recovery_token)
        WHERE recovery_token IS NOT NULL AND recovery_token != ''
    """
    )


def downgrade() -> None:
    # Drop the partial unique indexes
    op.drop_index("confirmation_token_unique_non_null", "users")
    op.drop_index("email_change_token_current_unique_non_null", "users")
    op.drop_index("email_change_token_new_unique_non_null", "users")
    op.drop_index("reauthentication_token_unique_non_null", "users")
    op.drop_index("recovery_token_unique_non_null", "users")

    # Recreate the original unique indexes
    op.create_index(
        "confirmation_token_idx", "users", ["confirmation_token"], unique=True
    )
    op.create_index(
        "email_change_token_current_idx",
        "users",
        ["email_change_token_current"],
        unique=True,
    )
    op.create_index(
        "email_change_token_new_idx", "users", ["email_change_token_new"], unique=True
    )
    op.create_index(
        "reauthentication_token_idx", "users", ["reauthentication_token"], unique=True
    )
    op.create_index("recovery_token_idx", "users", ["recovery_token"], unique=True)
