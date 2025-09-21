"""
Quarterly Transition Scheduler

This module provides automatic quarterly transition management.
It can be integrated with task schedulers like Celery, APScheduler, or cron jobs.
"""

import asyncio
import logging
from datetime import datetime, date, timedelta
from typing import Dict, Any
import schedule
import time
from threading import Thread

logger = logging.getLogger(__name__)


class QuarterlyTransitionScheduler:
    """Handles scheduled quarterly transitions and maintenance tasks"""
    
    def __init__(self):
        self.is_running = False
        self.scheduler_thread = None
    
    def check_and_create_quarterly_sheet(self) -> Dict[str, Any]:
        """Check if quarterly sheet needs to be created and create if necessary"""
        try:
            from utils.quarterly_sheets_manager import quarterly_manager
            
            logger.info("Running scheduled quarterly transition check...")
            
            # Check quarter transition
            transition_result = quarterly_manager.check_quarter_transition()
            
            # Log the result
            if transition_result.get("transition_needed"):
                if transition_result.get("new_sheet_created"):
                    logger.info(f"✅ Created new quarterly sheet: {transition_result.get('sheet_name')}")
                else:
                    logger.error(f"❌ Failed to create quarterly sheet: {transition_result.get('error')}")
            else:
                logger.info(f"ℹ️ No quarterly transition needed. Current sheet: {transition_result.get('current_sheet')}")
            
            return transition_result
            
        except Exception as e:
            logger.error(f"Error in scheduled quarterly transition check: {str(e)}")
            return {"error": str(e)}
    
    def quarterly_maintenance_check(self) -> Dict[str, Any]:
        """Perform quarterly maintenance tasks"""
        try:
            from utils.quarterly_sheets_manager import quarterly_manager
            
            logger.info("Running quarterly maintenance check...")
            
            results = {
                "timestamp": datetime.now().isoformat(),
                "checks": []
            }
            
            # 1. Check current quarter sheet exists
            quarter_name, quarter, year = quarterly_manager.get_current_quarter_info()
            current_sheet_exists = quarterly_manager.sheet_exists(quarter_name)
            
            results["checks"].append({
                "check": "current_quarter_sheet_exists",
                "status": "pass" if current_sheet_exists else "fail",
                "details": f"Current quarter sheet {quarter_name} exists: {current_sheet_exists}"
            })
            
            # 2. Check if we're approaching a new quarter (within 7 days)
            today = date.today()
            
            # Calculate next quarter start date
            if quarter == 4:
                next_quarter_start = date(year + 1, 1, 1)
            else:
                next_quarter_month = (quarter * 3) + 1
                next_quarter_start = date(year, next_quarter_month, 1)
            
            days_to_next_quarter = (next_quarter_start - today).days
            
            results["checks"].append({
                "check": "next_quarter_preparation", 
                "status": "warning" if days_to_next_quarter <= 7 else "pass",
                "details": f"Days until next quarter: {days_to_next_quarter}",
                "next_quarter_date": next_quarter_start.isoformat()
            })
            
            # 3. If approaching new quarter, prepare next quarter sheet
            if days_to_next_quarter <= 7:
                next_quarter = quarter + 1 if quarter < 4 else 1
                next_year = year if quarter < 4 else year + 1
                next_sheet_name = quarterly_manager.get_quarterly_sheet_name(next_quarter, next_year)
                
                if not quarterly_manager.sheet_exists(next_sheet_name):
                    logger.info(f"Preparing next quarter sheet: {next_sheet_name}")
                    next_worksheet = quarterly_manager.create_quarterly_sheet(next_quarter, next_year)
                    
                    results["checks"].append({
                        "check": "next_quarter_sheet_creation",
                        "status": "pass" if next_worksheet else "fail",
                        "details": f"Created next quarter sheet: {next_sheet_name}" if next_worksheet else f"Failed to create: {next_sheet_name}"
                    })
                else:
                    results["checks"].append({
                        "check": "next_quarter_sheet_exists",
                        "status": "pass",
                        "details": f"Next quarter sheet already exists: {next_sheet_name}"
                    })
            
            # 4. Check Master Template sheet in Google Sheets
            template_sheet = quarterly_manager.get_master_template_sheet()
            template_exists = template_sheet is not None
            results["checks"].append({
                "check": "master_template_sheet",
                "status": "pass" if template_exists else "fail",
                "details": f"Master Template sheet in Google Sheets: {template_exists}",
                "sheet_name": quarterly_manager.master_template_sheet_name if template_exists else None
            })
            
            # 5. Check Record Mapper sheet in Google Sheets
            mapper_data = quarterly_manager.get_record_mapper_data()
            mapper_exists = bool(mapper_data and mapper_data.get("data"))
            results["checks"].append({
                "check": "record_mapper_sheet",
                "status": "pass" if mapper_exists else "warning",
                "details": f"Record Mapper sheet in Google Sheets: {mapper_exists}",
                "sheet_name": mapper_data.get("sheet_name") if mapper_data else None
            })
            
            # 6. Check Google Sheets connection
            sheets_connected = quarterly_manager.client is not None
            results["checks"].append({
                "check": "google_sheets_connection",
                "status": "pass" if sheets_connected else "fail",
                "details": f"Google Sheets connected: {sheets_connected}"
            })
            
            logger.info(f"Quarterly maintenance check completed. Status: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Error in quarterly maintenance check: {str(e)}")
            return {"error": str(e), "timestamp": datetime.now().isoformat()}
    
    def start_scheduler(self):
        """Start the background scheduler"""
        if self.is_running:
            logger.warning("Scheduler is already running")
            return
        
        # Schedule quarterly transition checks
        # Check every day at 2 AM
        schedule.every().day.at("02:00").do(self.check_and_create_quarterly_sheet)
        
        # Schedule maintenance checks
        # Run maintenance every Monday at 3 AM
        schedule.every().monday.at("03:00").do(self.quarterly_maintenance_check)
        
        # Also check at startup
        schedule.every().minute.do(self._startup_check)
        
        self.is_running = True
        self.scheduler_thread = Thread(target=self._run_scheduler, daemon=True)
        self.scheduler_thread.start()
        
        logger.info("Quarterly transition scheduler started")
    
    def _startup_check(self):
        """Run startup check once then remove"""
        try:
            logger.info("Running startup quarterly check...")
            self.check_and_create_quarterly_sheet()
            
            # Remove this job after first run
            return schedule.CancelJob
            
        except Exception as e:
            logger.error(f"Error in startup check: {str(e)}")
            return schedule.CancelJob
    
    def _run_scheduler(self):
        """Run the scheduler in background thread"""
        while self.is_running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except Exception as e:
                logger.error(f"Error in scheduler thread: {str(e)}")
                time.sleep(60)
    
    def stop_scheduler(self):
        """Stop the background scheduler"""
        self.is_running = False
        schedule.clear()
        logger.info("Quarterly transition scheduler stopped")
    
    def run_immediate_check(self) -> Dict[str, Any]:
        """Run immediate quarterly transition check"""
        return self.check_and_create_quarterly_sheet()
    
    def run_immediate_maintenance(self) -> Dict[str, Any]:
        """Run immediate maintenance check"""
        return self.quarterly_maintenance_check()


# Global scheduler instance
quarterly_scheduler = QuarterlyTransitionScheduler()


# Convenience functions
def start_quarterly_scheduler():
    """Start the quarterly scheduler"""
    quarterly_scheduler.start_scheduler()


def stop_quarterly_scheduler():
    """Stop the quarterly scheduler"""
    quarterly_scheduler.stop_scheduler()


def check_quarterly_transition():
    """Run immediate quarterly transition check"""
    return quarterly_scheduler.run_immediate_check()


def run_quarterly_maintenance():
    """Run immediate quarterly maintenance"""
    return quarterly_scheduler.run_immediate_maintenance()


# Integration with FastAPI startup/shutdown events
async def startup_quarterly_system():
    """Startup event for quarterly system"""
    try:
        logger.info("Starting quarterly transition system...")
        
        # Start the scheduler
        start_quarterly_scheduler()
        
        # Run immediate check
        result = check_quarterly_transition()
        logger.info(f"Startup quarterly check result: {result}")
        
        logger.info("Quarterly transition system started successfully")
        
    except Exception as e:
        logger.error(f"Error starting quarterly system: {str(e)}")


async def shutdown_quarterly_system():
    """Shutdown event for quarterly system"""
    try:
        logger.info("Shutting down quarterly transition system...")
        stop_quarterly_scheduler()
        logger.info("Quarterly transition system shut down successfully")
        
    except Exception as e:
        logger.error(f"Error shutting down quarterly system: {str(e)}")
