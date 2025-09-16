"""
Quarterly Sheets Configuration Utility

This utility helps with initial setup and configuration of the quarterly sheets system.
"""

import os
import json
import csv
from typing import Dict, Any, List
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


class QuarterlySheetConfigUtil:
    """Utility for configuring quarterly sheets system"""
    
    def __init__(self):
        self.base_path = "c:\\Users\\Dell\\OneDrive\\Desktop\\inze"
        self.backend_path = os.path.join(self.base_path, "insurezeal", "backend")
    
    def validate_configuration(self) -> Dict[str, Any]:
        """Validate the configuration for quarterly sheets system"""
        results = {
            "valid": True,
            "checks": [],
            "errors": [],
            "warnings": []
        }
        
        # Check 1: Master Template Sheet in Google Sheets
        try:
            from utils.quarterly_sheets_manager import quarterly_manager
            
            template_sheet = quarterly_manager.get_master_template_sheet()
            if template_sheet:
                results["checks"].append(f"✅ Master Template sheet found: {quarterly_manager.master_template_sheet_name}")
                
                # Validate headers
                try:
                    headers = template_sheet.row_values(1)
                    header_count = len([h for h in headers if h.strip()])
                    results["checks"].append(f"✅ Master template has {header_count} headers")
                except Exception as e:
                    results["errors"].append(f"❌ Error reading master template headers: {str(e)}")
                    results["valid"] = False
            else:
                results["errors"].append("❌ Master Template sheet not found in Google Sheets")
                results["warnings"].append("⚠️ Create a 'Master Template' sheet in your Google Spreadsheet")
                results["valid"] = False
                
        except Exception as e:
            results["errors"].append(f"❌ Error accessing Google Sheets: {str(e)}")
            results["valid"] = False
        
        # Check 2: Record Mapper Sheet in Google Sheets
        try:
            from utils.quarterly_sheets_manager import quarterly_manager
            
            mapper_data = quarterly_manager.get_record_mapper_data()
            if mapper_data and mapper_data.get("data"):
                results["checks"].append(f"✅ Record Mapper sheet found: {mapper_data.get('sheet_name', 'Record Mapper')}")
                results["checks"].append(f"✅ Found {len(mapper_data['data'])} mapper records")
            else:
                results["warnings"].append("⚠️ Record Mapper sheet not found in Google Sheets")
                results["warnings"].append("⚠️ Create a 'Record Mapper' sheet if you need mapping functionality")
                
        except Exception as e:
            results["warnings"].append(f"⚠️ Could not access Record Mapper: {str(e)}")
        
        # Check 3: Google Sheets Credentials
        credentials_path = os.path.join(self.backend_path, "credentials", "google_sheets.json")
        if os.path.exists(credentials_path):
            results["checks"].append("✅ Google Sheets credentials file found")
            
            # Validate JSON structure
            try:
                with open(credentials_path, 'r') as file:
                    creds = json.load(file)
                    required_fields = ["type", "project_id", "private_key", "client_email"]
                    missing_fields = [field for field in required_fields if field not in creds]
                    if missing_fields:
                        results["warnings"].append(f"⚠️ Missing credential fields: {missing_fields}")
                    else:
                        results["checks"].append("✅ Google Sheets credentials structure valid")
            except Exception as e:
                results["errors"].append(f"❌ Error reading credentials: {str(e)}")
                results["valid"] = False
        else:
            results["errors"].append(f"❌ Google Sheets credentials not found at {credentials_path}")
            results["valid"] = False
        
        # Check 4: Environment Variables
        from config import GOOGLE_SHEETS_CREDENTIALS, GOOGLE_SHEETS_DOCUMENT_ID
        
        if GOOGLE_SHEETS_CREDENTIALS and all(GOOGLE_SHEETS_CREDENTIALS.values()):
            results["checks"].append("✅ GOOGLE_SHEETS_CREDENTIALS configured")
        else:
            results["errors"].append("❌ GOOGLE_SHEETS_CREDENTIALS not configured or missing values")
            results["valid"] = False
        
        if GOOGLE_SHEETS_DOCUMENT_ID:
            results["checks"].append("✅ GOOGLE_SHEETS_DOCUMENT_ID configured")
        else:
            results["errors"].append("❌ GOOGLE_SHEETS_DOCUMENT_ID not configured")
            results["valid"] = False
        
        # Check 5: Dependencies
        try:
            import gspread
            results["checks"].append("✅ gspread library available")
        except ImportError:
            results["errors"].append("❌ gspread library not installed")
            results["valid"] = False
        
        try:
            from google.oauth2.service_account import Credentials
            results["checks"].append("✅ google-auth library available")
        except ImportError:
            results["errors"].append("❌ google-auth library not installed")
            results["valid"] = False
        
        return results
    
    def create_sample_env_file(self) -> str:
        """Create a sample .env file with quarterly sheets configuration"""
        env_content = """
# Quarterly Sheets Configuration
# Google Sheets Service Account Credentials (individual environment variables)
GOOGLE_SHEETS_TYPE=service_account
GOOGLE_SHEETS_PROJECT_ID=your_project_id_here
GOOGLE_SHEETS_PRIVATE_KEY_ID=your_private_key_id_here
GOOGLE_SHEETS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nyour_private_key_here\\n-----END PRIVATE KEY-----\\n"
GOOGLE_SHEETS_CLIENT_EMAIL=your_service_account_email_here
GOOGLE_SHEETS_CLIENT_ID=your_client_id_here
GOOGLE_SHEETS_AUTH_URI=https://accounts.google.com/o/oauth2/auth
GOOGLE_SHEETS_TOKEN_URI=https://oauth2.googleapis.com/token
GOOGLE_SHEETS_AUTH_PROVIDER_X509_CERT_URL=https://www.googleapis.com/oauth2/v1/certs
GOOGLE_SHEETS_CLIENT_X509_CERT_URL=your_client_cert_url_here
GOOGLE_SHEETS_UNIVERSE_DOMAIN=googleapis.com
GOOGLE_SHEETS_DOCUMENT_ID=your_google_sheets_document_id_here

# Database Configuration
DATABASE_URL=your_database_url_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
SUPABASE_STORAGE_BUCKET=your_bucket_name_here

# JWT Configuration
JWT_SECRET_KEY=your_jwt_secret_key_here

# AWS Configuration (if needed)
AWS_REGION=ap-south-1
"""
        
        env_file_path = os.path.join(self.backend_path, ".env.sample")
        with open(env_file_path, 'w') as file:
            file.write(env_content.strip())
        
        return env_file_path
    
    def create_requirements_addition(self) -> str:
        """Create additional requirements for quarterly sheets"""
        additional_requirements = """
# Additional requirements for Quarterly Sheets System
schedule>=1.2.0
gspread>=5.7.0
google-auth>=2.16.0
google-auth-oauthlib>=0.8.0
google-auth-httplib2>=0.1.0
"""
        
        req_file_path = os.path.join(self.backend_path, "requirements_quarterly.txt")
        with open(req_file_path, 'w') as file:
            file.write(additional_requirements.strip())
        
        return req_file_path
    
    def test_google_sheets_connection(self) -> Dict[str, Any]:
        """Test Google Sheets connection"""
        try:
            from utils.quarterly_sheets_manager import quarterly_manager
            
            if not quarterly_manager.client:
                return {
                    "success": False,
                    "error": "Google Sheets client not initialized"
                }
            
            if not quarterly_manager.spreadsheet:
                return {
                    "success": False,
                    "error": "Google Sheets spreadsheet not accessible"
                }
            
            # Test reading spreadsheet info
            title = quarterly_manager.spreadsheet.title
            worksheets = quarterly_manager.spreadsheet.worksheets()
            
            return {
                "success": True,
                "spreadsheet_title": title,
                "worksheet_count": len(worksheets),
                "worksheets": [ws.title for ws in worksheets]
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def setup_initial_quarterly_sheet(self) -> Dict[str, Any]:
        """Set up the initial quarterly sheet for current quarter"""
        try:
            from utils.quarterly_sheets_manager import quarterly_manager
            
            # Get current quarter info
            quarter_name, quarter, year = quarterly_manager.get_current_quarter_info()
            
            # Check if sheet already exists
            if quarterly_manager.sheet_exists(quarter_name):
                return {
                    "success": True,
                    "message": f"Sheet {quarter_name} already exists",
                    "sheet_name": quarter_name,
                    "created": False
                }
            
            # Create the sheet
            worksheet = quarterly_manager.create_quarterly_sheet(quarter, year)
            
            if worksheet:
                return {
                    "success": True,
                    "message": f"Successfully created initial quarterly sheet: {quarter_name}",
                    "sheet_name": quarter_name,
                    "created": True
                }
            else:
                return {
                    "success": False,
                    "error": f"Failed to create quarterly sheet for {quarter_name}"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status"""
        status = {
            "timestamp": str(datetime.now()),
            "configuration": self.validate_configuration(),
            "google_sheets": self.test_google_sheets_connection()
        }
        
        # Add quarterly info if Google Sheets is working
        if status["google_sheets"].get("success"):
            try:
                from utils.quarterly_sheets_manager import quarterly_manager
                quarter_name, quarter, year = quarterly_manager.get_current_quarter_info()
                status["current_quarter"] = {
                    "name": quarter_name,
                    "quarter": quarter,
                    "year": year,
                    "sheet_exists": quarterly_manager.sheet_exists(quarter_name)
                }
            except Exception as e:
                status["current_quarter"] = {"error": str(e)}
        
        return status


# Utility functions for easy access
def validate_quarterly_config():
    """Validate quarterly sheets configuration"""
    util = QuarterlySheetConfigUtil()
    return util.validate_configuration()


def test_sheets_connection():
    """Test Google Sheets connection"""
    util = QuarterlySheetConfigUtil()
    return util.test_google_sheets_connection()


def setup_initial_sheet():
    """Set up initial quarterly sheet"""
    util = QuarterlySheetConfigUtil()
    return util.setup_initial_quarterly_sheet()


def get_system_status():
    """Get comprehensive system status"""
    util = QuarterlySheetConfigUtil()
    return util.get_system_status()


if __name__ == "__main__":
    # Run configuration validation when script is executed directly
    from datetime import datetime
    
    print("🔧 Quarterly Sheets Configuration Utility")
    print("=" * 50)
    
    util = QuarterlySheetConfigUtil()
    
    print("\n📋 Configuration Validation:")
    config_result = util.validate_configuration()
    
    for check in config_result["checks"]:
        print(f"  {check}")
    
    for warning in config_result["warnings"]:
        print(f"  {warning}")
    
    for error in config_result["errors"]:
        print(f"  {error}")
    
    print(f"\n🔧 Overall Configuration: {'✅ VALID' if config_result['valid'] else '❌ INVALID'}")
    
    if config_result["valid"]:
        print("\n🌐 Testing Google Sheets Connection:")
        connection_result = util.test_google_sheets_connection()
        
        if connection_result["success"]:
            print(f"  ✅ Connected to: {connection_result['spreadsheet_title']}")
            print(f"  ✅ Found {connection_result['worksheet_count']} worksheets")
        else:
            print(f"  ❌ Connection failed: {connection_result['error']}")
    
    print("\n" + "=" * 50)
