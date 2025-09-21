"""
FastAPI application entry point for Insurezeal Backend API.

This module initializes the FastAPI application with all necessary middleware,
routers, and lifecycle events for the Insurezeal insurance management system.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi import Request
import os
import logging

from routers.auth.auth import router as auth_router
from routers.users.users import router as users_router
from routers.admin.admin import router as admin_router
from routers.child.child import router as child_router
from routers.policies.policies import router as policies_router
from routers.superadmin.superadmin import router as superadmin_router
from routers.admin.cutpay import router as cutpay_router
from routers.admin.public import router as public_router
from routers.mis.mis import router as mis_router
from routers.universal_records.universal_records import (
    router as universal_records_router,
)
from utils.quarterly_scheduler import (
    startup_quarterly_system,
    shutdown_quarterly_system,
)

# Configure logging for production readiness
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")
IS_PRODUCTION = ENVIRONMENT == "prod"

app = FastAPI(
    title="Insurezeal Site API",
    description="A comprehensive API for a Insurezeal website",
    version="1.0.0",
    docs_url="/apidocs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

logger.info("FastAPI application initialized successfully")


# Application lifecycle events
@app.on_event("startup")
async def startup_event():
    """
    Application startup event handler.

    Initializes quarterly system for automatic report generation and
    other background services required for the application.
    """
    logger.info("Application startup initiated")
    try:
        await startup_quarterly_system()
        logger.info("Application startup completed successfully")
    except Exception as e:
        logger.error(f"Application startup failed: {str(e)}", exc_info=True)
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """
    Application shutdown event handler.

    Gracefully shuts down background services and cleans up resources
    to ensure data integrity and proper application termination.
    """
    logger.info("Application shutdown initiated")
    try:
        await shutdown_quarterly_system()
        logger.info("Application shutdown completed successfully")
    except Exception as e:
        logger.error(f"Application shutdown failed: {str(e)}", exc_info=True)


# Configure CORS middleware for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all API routers
try:
    app.include_router(auth_router)
    app.include_router(users_router)
    app.include_router(admin_router)
    app.include_router(superadmin_router)
    app.include_router(child_router)
    app.include_router(policies_router)
    app.include_router(cutpay_router)
    app.include_router(public_router)
    app.include_router(mis_router)
    app.include_router(universal_records_router)

    logger.info("All API routers registered successfully")
except Exception as e:
    logger.critical(f"Critical error registering routers: {e}", exc_info=True)
    raise


@app.get("/docs", include_in_schema=False)
async def api_documentation(request: Request):
    """
    Custom API documentation endpoint using Stoplight Elements.

    Provides a clean, dark-themed interface for API documentation
    instead of the default Swagger UI.
    """
    openapi_url = "/openapi.json"

    return HTMLResponse(
        f"""
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>Insurezeal SITE API DOCS</title>

    <script src="https://unpkg.com/@stoplight/elements/web-components.min.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/@stoplight/elements/styles.min.css">
  </head>
  <body>

    <elements-api
      apiDescriptionUrl="{openapi_url}"
      router="hash"
      theme="dark"
    />

  </body>
</html>"""
    )


@app.get("/", response_class=HTMLResponse)
def home():
    """
    Default homepage route for the Insurezeal API.

    Returns an HTML page with links to API documentation and related resources.
    This serves as a landing page for developers accessing the API.
    """
    return """
    <html>
      <head>
        <title>Insurezeal Site API</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background-color: #f8f9fa; }
          h1 { color: #333; }
          ul { list-style-type: none; padding: 0; }
          li { margin: 10px 0; }
          a { color: #0066cc; text-decoration: none; }
          a:hover { text-decoration: underline; }
          hr { margin: 20px 0; }
          h2 { color: #555; }
        </style>
      </head>
      <body>
        <h1>Welcome to Insurezeal Site API</h1>
        <hr>
        <ul>
          <li><a href="/docs">Spotlight API Documentation</a></li>
          <li><a href="/redoc">Redoc API Documentation</a></li>
          <li><a href="/openapi.json">OpenAPI Specification</a></li>
          <hr>
          <li><a href="http://localhost:3000">Frontend Website</a></li>
          <hr>
          <h2>Insurezeal Platform API</h2>
        </ul>
      </body>
    </html>
    """


@app.get("/health")
def health_check():
    """
    Health check endpoint for monitoring and load balancers.

    Returns the application status to verify the service is running
    and responsive. Used by monitoring tools and container orchestration.
    """
    return {"status": "healthy", "service": "insurezeal-api"}


if __name__ == "__main__":
    import uvicorn

    logger.info("Starting Uvicorn server...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000)
