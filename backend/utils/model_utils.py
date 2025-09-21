"""
Model utilities for Insurezeal Backend API.

This module provides utility functions for SQLAlchemy model serialization
and data conversion. It handles the transformation of ORM objects into
formats suitable for Pydantic models and API responses, with special
handling for UUID and datetime conversions.

Key Features:
- UUID to string conversion for JSON serialization
- DateTime to date conversion for specific fields
- SQLAlchemy ORM to dictionary conversion
- Pydantic model validation preparation
- Consistent data formatting across the API
"""

from typing import Dict, Any
import uuid
from datetime import datetime


def convert_uuids_to_strings(
    data: Dict[str, Any], uuid_fields: list = None
) -> Dict[str, Any]:
    """
    Convert UUID objects to strings in a dictionary for JSON serialization.

    This function ensures that UUID fields can be properly serialized to JSON
    and validated by Pydantic models. It's essential for API responses that
    include database records with UUID primary keys.

    Args:
        data: Dictionary containing model data with potential UUID fields
        uuid_fields: List of field names that should be converted from UUID to string.
                    Defaults to ['id', 'user_id'] if not provided.

    Returns:
        Dict[str, Any]: Dictionary with UUID fields converted to strings

    Example:
        data = {"id": UUID("123e4567-e89b-12d3-a456-426614174000"), "name": "John"}
        result = convert_uuids_to_strings(data)
        # result = {"id": "123e4567-e89b-12d3-a456-426614174000", "name": "John"}

    Note:
        This conversion is necessary because JSON doesn't natively support
        UUID objects, and Pydantic expects string representations of UUIDs.
    """
    if uuid_fields is None:
        uuid_fields = ["id", "user_id"]

    converted_data = {}
    for key, value in data.items():
        if key in uuid_fields and value is not None and isinstance(value, uuid.UUID):
            converted_data[key] = str(value)
        else:
            converted_data[key] = value

    return converted_data


def model_data_from_orm(
    orm_obj,
    additional_data: Dict[str, Any] = None,
    uuid_fields: list = None,
    date_fields: list = None,
) -> Dict[str, Any]:
    """
    Extract data from SQLAlchemy ORM objects and prepare it for Pydantic validation.

    This function converts SQLAlchemy ORM objects into dictionaries with proper
    type conversions for UUID and datetime fields. It's the primary bridge
    between database models and API response models.

    Args:
        orm_obj: SQLAlchemy ORM object to extract data from
        additional_data: Additional data to include in the result dictionary
        uuid_fields: List of field names to convert from UUID to string
        date_fields: List of field names to convert from datetime to date

    Returns:
        Dict[str, Any]: Dictionary ready for Pydantic model validation

    Example:
        user_data = model_data_from_orm(
            user_profile,
            additional_data={"email": user.email},
            uuid_fields=["id", "user_id"],
            date_fields=["date_of_birth"]
        )

    Note:
        This function handles the most common conversion patterns used
        throughout the application, ensuring consistent data formatting.
    """
    if uuid_fields is None:
        uuid_fields = ["id", "user_id"]

    if date_fields is None:
        date_fields = ["date_of_birth", "nominee_date_of_birth"]

    orm_data = {}
    for column in orm_obj.__table__.columns:
        value = getattr(orm_obj, column.name)

        if (
            column.name in uuid_fields
            and value is not None
            and isinstance(value, uuid.UUID)
        ):
            orm_data[column.name] = str(value)
        elif (
            column.name in date_fields
            and value is not None
            and isinstance(value, datetime)
        ):
            orm_data[column.name] = value.date()
        else:
            orm_data[column.name] = value

    if additional_data:
        orm_data.update(additional_data)

    return orm_data
