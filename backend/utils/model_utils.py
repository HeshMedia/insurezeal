"""
Utility functions for model serialization and data conversion
"""
from typing import Dict, Any
import uuid
from datetime import datetime, date


def convert_uuids_to_strings(data: Dict[str, Any], uuid_fields: list = None) -> Dict[str, Any]:
    """
    Convert UUID objects to strings in a dictionary for Pydantic validation.
    
    Args:
        data: Dictionary containing model data
        uuid_fields: List of field names that should be converted from UUID to string.
                    Defaults to ['id', 'user_id'] if not provided.
    
    Returns:
        Dictionary with UUID fields converted to strings
    """
    if uuid_fields is None:
        uuid_fields = ['id', 'user_id']
    
    converted_data = {}
    for key, value in data.items():
        if key in uuid_fields and value is not None and isinstance(value, uuid.UUID):
            converted_data[key] = str(value)
        else:
            converted_data[key] = value
    
    return converted_data


def model_data_from_orm(orm_obj, additional_data: Dict[str, Any] = None, uuid_fields: list = None, date_fields: list = None) -> Dict[str, Any]:
    """
    Extract data from SQLAlchemy ORM object and convert UUIDs to strings and datetimes to dates where needed.
    
    Args:
        orm_obj: SQLAlchemy ORM object
        additional_data: Additional data to include in the result
        uuid_fields: List of field names that should be converted from UUID to string
        date_fields: List of field names that should be converted from datetime to date
    
    Returns:
        Dictionary ready for Pydantic model validation
    """
    if uuid_fields is None:
        uuid_fields = ['id', 'user_id']
    
    if date_fields is None:
        date_fields = ['date_of_birth', 'nominee_date_of_birth']
    
    orm_data = {}
    for column in orm_obj.__table__.columns:
        value = getattr(orm_obj, column.name)
        
        if column.name in uuid_fields and value is not None and isinstance(value, uuid.UUID):
            orm_data[column.name] = str(value)
        elif column.name in date_fields and value is not None and isinstance(value, datetime):
            orm_data[column.name] = value.date()
        else:
            orm_data[column.name] = value
    
    if additional_data:
        orm_data.update(additional_data)
    
    return orm_data
