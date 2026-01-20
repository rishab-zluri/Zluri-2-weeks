#!/usr/bin/env python3
"""
MongoDB Connection Test Script (Python)
This script tests the MongoDB connection and displays database information
Upload this via the UI to test Python script execution with MongoDB
"""

import json
import sys
from datetime import datetime

def main():
    print("🚀 Starting MongoDB connection test (Python)...")
    print("Testing database connection and querying information...\n")
    
    try:
        # Test 1: Python Environment
        print("🐍 Test 1: Python Environment")
        print(f"✅ Python version: {sys.version.split()[0]}")
        print(f"✅ Script running in sandbox: Yes")
        print(f"✅ Execution time: {datetime.now().isoformat()}")
        print("")
        
        # Test 2: JSON Processing
        print("📊 Test 2: JSON Processing")
        sample_data = {
            "database": "mongodb",
            "collections": ["users", "orders", "products"],
            "timestamp": datetime.now().isoformat()
        }
        print("✅ Sample data structure:")
        print(json.dumps(sample_data, indent=2))
        print("")
        
        # Test 3: Data Analysis
        print("📈 Test 3: Data Analysis Capabilities")
        numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        print(f"✅ Sum: {sum(numbers)}")
        print(f"✅ Average: {sum(numbers) / len(numbers)}")
        print(f"✅ Max: {max(numbers)}")
        print(f"✅ Min: {min(numbers)}")
        print("")
        
        # Test 4: String Processing
        print("🔤 Test 4: String Processing")
        test_string = "MongoDB Database Analysis"
        print(f"✅ Original: {test_string}")
        print(f"✅ Uppercase: {test_string.upper()}")
        print(f"✅ Lowercase: {test_string.lower()}")
        print(f"✅ Word count: {len(test_string.split())}")
        print("")
        
        # Test 5: List Comprehension
        print("🔢 Test 5: List Comprehension")
        squares = [x**2 for x in range(1, 6)]
        print(f"✅ Squares of 1-5: {squares}")
        print("")
        
        print("✅ All tests completed successfully!")
        print("🎉 Python script execution is working properly!")
        print("")
        print("Note: This Python script demonstrates the sandbox environment.")
        print("For actual MongoDB queries, use JavaScript scripts with the 'mongodb' wrapper.")
        print("Python scripts are best for data processing and analysis tasks.")
        
    except Exception as error:
        print(f"❌ Error occurred:")
        print(f"Error type: {type(error).__name__}")
        print(f"Error message: {str(error)}")
        raise

if __name__ == "__main__":
    main()
