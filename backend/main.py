import logging
import os
import sentry_sdk

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from routers.admin.admin import router as admin_router
from routers.admin.cutpay import router as cutpay_router
from routers.admin.public import router as public_router
from routers.auth.auth import router as auth_router
from routers.child.child import router as child_router
from routers.mis.mis import router as mis_router
from routers.policies.policies import router as policies_router
from routers.superadmin.superadmin import router as superadmin_router
from routers.universal_records.universal_records import (
    router as universal_records_router,
)
from routers.users.users import router as users_router

sentry_sdk.init(
    dsn="https://9b2f10070541c7e5fd5f968f9062e470@o4510076195504128.ingest.us.sentry.io/4510076196880384",
    # Add data like request headers and IP for users,
    # see https://docs.sentry.io/platforms/python/data-management/data-collected/ for more info
    send_default_pii=True,
    # Enable sending logs to Sentry
    enable_logs=True,
    # Set traces_sample_rate to 1.0 to capture 100%
    # of transactions for tracing.
    traces_sample_rate=1.0,
    # Set profile_session_sample_rate to 1.0 to profile 100%
    # of profile sessions.
    profile_session_sample_rate=1.0,
    # Set profile_lifecycle to "trace" to automatically
    # run the profiler on when there is an active transaction
    profile_lifecycle="trace",
)

# Setup detailed logging
logging.basicConfig(level=logging.INFO)
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

logger.info("--- FastAPI application starting up ---")


# Add startup and shutdown events
@app.on_event("startup")
async def startup_event():
    """Application startup event"""
    logger.info("Application startup completed successfully")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event"""
    logger.info("Application shutdown completed successfully")


logger.info("Configuring CORS middleware...")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("CORS middleware configured.")

logger.info("Importing and including routers...")
try:
    app.include_router(auth_router)
    logger.info("Included auth_router.")

    app.include_router(users_router)
    logger.info("Included users_router.")

    app.include_router(admin_router)
    logger.info("Included admin_router.")

    app.include_router(superadmin_router)
    logger.info("Included superadmin_router.")

    app.include_router(child_router)
    logger.info("Included child_router.")

    app.include_router(policies_router)
    logger.info("Included policies_router.")

    app.include_router(cutpay_router)
    logger.info("Included cutpay_router.")

    app.include_router(public_router)
    logger.info("Included public_router.")

    app.include_router(mis_router)
    logger.info("Included mis_router.")

    app.include_router(universal_records_router)
    logger.info("Included universal_records_router.")

    logger.info("All routers included successfully.")

except Exception as e:
    logger.critical(f"FATAL: Failed to import or include routers: {e}", exc_info=True)
    raise

@app.get("/sentry-debug")
async def trigger_error():
    division_by_zero = 1 / 0

@app.get("/docs", include_in_schema=False)
async def api_documentation(request: Request):
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
    """This is the first and default route for the Insurezeal Site Backend"""
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
    """Health check endpoint for monitoring"""
    return {"status": "healthy", "service": "insurezeal-api"}


logger.info("--- FastAPI application startup complete ---")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000)
