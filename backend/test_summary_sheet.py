#!/usr/bin/env python3
"""
Test script to verify Summary sheet data retrieval
"""

import asyncio
import sys
import os

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from routers.mis.helpers import MISHelpers

async def test_summary_sheet():
    """Test the new Summary sheet data retrieval"""
    
    print("Testing Summary sheet data retrieval...")
    print("=" * 50)
    
    try:
        helpers = MISHelpers()
        result = await helpers.get_master_sheet_stats()
        
        print("Summary sheet result:")
        print(f"Keys: {list(result.keys())}")
        
        if 'data' in result:
            print(f"Number of rows: {len(result['data'])}")
            print(f"Number of columns: {result.get('total_columns', 'N/A')}")
            print(f"Headers: {result.get('headers', [])[:5]}...")  # Show first 5 headers
            
            if result['data']:
                print(f"Sample row keys: {list(result['data'][0].keys())[:5]}...")  # Show first 5 keys
                print(f"Sample row: {result['data'][0]}")
        elif 'error' in result:
            print(f"Error: {result['error']}")
        else:
            print("Unexpected result format")
            
    except Exception as e:
        print(f"Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_summary_sheet())
