"""
Asynchronous utilities for Insurezeal Backend API.

This module provides utility functions for handling synchronous operations
within asynchronous FastAPI contexts. It's particularly useful for integrating
third-party libraries that don't support async/await patterns.

Key Features:
- Thread pool execution for synchronous functions
- Non-blocking integration with sync libraries (like gspread)
- Proper asyncio event loop integration
- Performance optimization for I/O bound operations
"""

import asyncio
from typing import Callable, Any


async def run_sync_in_threadpool(
    func: Callable[..., Any], *args: Any, **kwargs: Any
) -> Any:
    """
    Execute a synchronous function in a separate thread to avoid blocking the event loop.

    This function is essential for running synchronous libraries like gspread
    within an async FastAPI application without blocking the main event loop.
    It ensures that I/O-bound operations don't prevent other requests from
    being processed concurrently.

    Args:
        func: The synchronous function to execute
        *args: Positional arguments to pass to the function
        **kwargs: Keyword arguments to pass to the function

    Returns:
        Any: The result of the function execution

    Example:
        result = await run_sync_in_threadpool(
            spreadsheet.worksheet, "Sheet1"
        )

    Note:
        Uses the asyncio event loop's thread pool executor which manages
        a pool of worker threads for optimal performance and resource usage.
    """
    loop = asyncio.get_running_loop()
    # Execute the function in a ThreadPoolExecutor and await the result
    return await loop.run_in_threadpool(lambda: func(*args, **kwargs))
