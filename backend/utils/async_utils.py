import asyncio
from typing import Any, Callable


async def run_sync_in_threadpool(
    func: Callable[..., Any], *args: Any, **kwargs: Any
) -> Any:
    """
    Runs a synchronous function in a separate thread to avoid blocking the asyncio event loop.
    This is crucial for running libraries like gspread in an async FastAPI application.
    """
    loop = asyncio.get_running_loop()
    # `loop.run_in_threadpool` executes the function in a concurrent.futures.ThreadPoolExecutor
    # and returns a future, which we await.
    return await loop.run_in_threadpool(lambda: func(*args, **kwargs))
