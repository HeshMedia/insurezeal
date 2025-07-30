from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from fastapi.responses import HTMLResponse
from fastapi import Request, HTTPException
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
from routers.universal_records.universal_records import router as universal_records_router

# Setup detailed logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")
IS_PRODUCTION = ENVIRONMENT == "prod"

app = FastAPI(
    title="Insurezeal Site API",
    description="A comprehensive API for a Insurezeal website",
    version="1.0.0",
    root_path="/Prod" if IS_PRODUCTION else "",
    docs_url="/apidocs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    servers=[
        {"url": "http://localhost:8000", "description": "Local Development Server"},
        {"url": "https://your-aws-api.execute-api.region.amazonaws.com/Prod", "description": "Production Server"},
        {"url": "https://your-ngrok-tunnel.ngrok-free.app/", "description": "Ngrok Tunnel"},
    ],
)

logger.info("--- FastAPI application starting up ---")

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

@app.get("/docs", include_in_schema=False)
async def api_documentation(request: Request):
    openapi_url = "/Prod/openapi.json" if IS_PRODUCTION else "/openapi.json"
    
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
          <li><a href="/Prod/docs">Spotlight API Documentation</a></li>
          <li><a href="/Prod/redoc">Redoc API Documentation</a></li>
          <li><a href="/Prod/apidocs">Swagger API Documentation</a></li>
          <li><a href="/Prod/openapi.json">OpenAPI Specification</a></li>
          <hr>
          <li><a href="http://localhost:3000">Frontend Website</a></li>
          <hr>
          <h2>Insurezeal Platform API</h2>
        </ul>
      </body>
    </html>
    """

handler = Mangum(app)

logger.info("--- FastAPI application startup complete ---")
