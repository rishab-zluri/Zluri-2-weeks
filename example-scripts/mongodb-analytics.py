#!/usr/bin/env python3
"""
MongoDB Analytics Script (Python)

This script demonstrates data analysis on a MongoDB database using Python.
Perfect for generating insights and statistics.

USAGE:
- Upload this as a script submission
- Select a MongoDB instance
- Select target database

WHAT IT DOES:
1. Connects to MongoDB
2. Analyzes collection data
3. Generates statistics
4. Exports insights

REQUIREMENTS:
- pymongo (automatically available in the portal)
"""

import os
import sys
from datetime import datetime, timedelta
from pymongo import MongoClient
from collections import Counter

def format_size(bytes_size):
    """Format bytes to human readable size"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if bytes_size < 1024.0:
            return f"{bytes_size:.2f} {unit}"
        bytes_size /= 1024.0
    return f"{bytes_size:.2f} TB"

def main():
    """Main execution function"""
    
    # Connection is automatically provided by the portal
    mongo_uri = os.environ.get('MONGODB_URI')
    
    if not mongo_uri:
        print("❌ Error: MONGODB_URI not found")
        sys.exit(1)
    
    client = None
    
    try:
        print("🔍 Starting MongoDB Analytics...\n")
        
        # Connect to MongoDB
        client = MongoClient(mongo_uri)
        db = client.get_database()
        
        # 1. Database Overview
        print("=" * 60)
        print("📊 DATABASE OVERVIEW")
        print("=" * 60)
        
        stats = db.command("dbStats")
        print(f"Database: {db.name}")
        print(f"Collections: {stats['collections']}")
        print(f"Total Documents: {stats['objects']:,}")
        print(f"Data Size: {format_size(stats['dataSize'])}")
        print(f"Storage Size: {format_size(stats['storageSize'])}")
        print(f"Indexes: {stats['indexes']}")
        print(f"Index Size: {format_size(stats['indexSize'])}")
        print()
        
        # 2. Collection Analysis
        print("=" * 60)
        print("📚 COLLECTION ANALYSIS")
        print("=" * 60)
        
        collections = db.list_collection_names()
        collection_stats = []
        
        for coll_name in collections:
            if coll_name.startswith('system.'):
                continue
                
            collection = db[coll_name]
            count = collection.count_documents({})
            
            # Get collection stats
            coll_stats = db.command("collStats", coll_name)
            
            collection_stats.append({
                'name': coll_name,
                'count': count,
                'size': coll_stats.get('size', 0),
                'avgObjSize': coll_stats.get('avgObjSize', 0)
            })
        
        # Sort by document count
        collection_stats.sort(key=lambda x: x['count'], reverse=True)
        
        print(f"{'Collection':<30} {'Documents':>12} {'Size':>12} {'Avg Doc':>12}")
        print("-" * 70)
        for stat in collection_stats:
            print(f"{stat['name']:<30} {stat['count']:>12,} "
                  f"{format_size(stat['size']):>12} "
                  f"{format_size(stat['avgObjSize']):>12}")
        print()
        
        # 3. Detailed Analysis of Main Collection
        if collection_stats:
            main_coll_name = collection_stats[0]['name']
            main_collection = db[main_coll_name]
            
            print("=" * 60)
            print(f"🔬 DETAILED ANALYSIS: {main_coll_name}")
            print("=" * 60)
            
            # Sample document structure
            sample = main_collection.find_one()
            if sample:
                print("Document Structure:")
                print(f"  Fields: {', '.join(sample.keys())}")
                print()
                
                # Field type analysis
                print("Field Types:")
                for key, value in sample.items():
                    print(f"  {key}: {type(value).__name__}")
                print()
            
            # Recent documents
            print("Recent Documents (Last 5):")
            recent = list(main_collection.find().sort('_id', -1).limit(5))
            for idx, doc in enumerate(recent, 1):
                # Remove _id for cleaner display
                doc_copy = {k: v for k, v in doc.items() if k != '_id'}
                print(f"  {idx}. {doc_copy}")
            print()
            
            # Field value distribution (for status-like fields)
            if sample and 'status' in sample:
                print("Status Distribution:")
                pipeline = [
                    {'$group': {'_id': '$status', 'count': {'$sum': 1}}},
                    {'$sort': {'count': -1}}
                ]
                status_dist = list(main_collection.aggregate(pipeline))
                
                total = sum(item['count'] for item in status_dist)
                for item in status_dist:
                    percentage = (item['count'] / total * 100) if total > 0 else 0
                    bar = "█" * int(percentage / 2)
                    print(f"  {str(item['_id']):15} {item['count']:6,} ({percentage:5.1f}%) {bar}")
                print()
        
        # 4. Index Analysis
        print("=" * 60)
        print("🔑 INDEX ANALYSIS")
        print("=" * 60)
        
        for coll_name in collections[:5]:  # Top 5 collections
            if coll_name.startswith('system.'):
                continue
                
            collection = db[coll_name]
            indexes = list(collection.list_indexes())
            
            if len(indexes) > 1:  # More than just _id index
                print(f"\n{coll_name}:")
                for idx in indexes:
                    keys = ', '.join([f"{k}: {v}" for k, v in idx['key'].items()])
                    print(f"  - {idx['name']}: {keys}")
        print()
        
        # 5. Data Quality Insights
        print("=" * 60)
        print("✨ DATA QUALITY INSIGHTS")
        print("=" * 60)
        
        if collection_stats:
            main_collection = db[collection_stats[0]['name']]
            total_docs = collection_stats[0]['count']
            
            # Check for common quality issues
            sample_docs = list(main_collection.find().limit(100))
            
            if sample_docs:
                # Field consistency
                all_fields = set()
                for doc in sample_docs:
                    all_fields.update(doc.keys())
                
                field_presence = {}
                for field in all_fields:
                    count = sum(1 for doc in sample_docs if field in doc)
                    field_presence[field] = (count / len(sample_docs)) * 100
                
                print("Field Presence (in sample of 100):")
                for field, percentage in sorted(field_presence.items(), key=lambda x: x[1], reverse=True):
                    if percentage < 100:
                        print(f"  {field}: {percentage:.1f}% (missing in {100-percentage:.1f}%)")
                print()
        
        # Summary
        print("=" * 60)
        print("✅ ANALYSIS COMPLETE")
        print("=" * 60)
        print(f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Collections analyzed: {len(collection_stats)}")
        print(f"Total documents: {sum(s['count'] for s in collection_stats):,}")
        print()
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        if client:
            client.close()

if __name__ == "__main__":
    main()
