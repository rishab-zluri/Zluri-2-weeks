"""
MongoDB Test Script (Python)

Demonstrates how to execute MongoDB operations using the sandbox `db` object.
The sandbox provides a pre-connected database wrapper.

Available globals:
    - db.collection(name) - Get a collection wrapper
    - Collection methods: find, findOne, insertOne, insertMany, updateOne, updateMany,
                         deleteOne, deleteMany, countDocuments, aggregate
    - print() - Output capture
    - json, datetime, re, math - Allowed modules

USAGE:
    Submit via API with .py extension or scriptLanguage: 'python'
"""

import json
from datetime import datetime

print("=== MongoDB Python Test ===")
print("Starting test operations...")

# Get collection reference
users = db.collection('users')

# 1. Count documents
total = users.countDocuments({})
print(f"Total documents in users: {total}")

# 2. Find all documents (limit to 5)
cursor = users.find({}).limit(5)
docs = cursor.toArray()
print(f"Found {len(docs)} documents")

if docs:
    print(f"First user: {json.dumps(docs[0], default=str, indent=2)}")

# 3. Find with filter
active_cursor = users.find({'isActive': True})
active_docs = active_cursor.toArray()
print(f"Active users: {len(active_docs)}")

# 4. Find one document
first = users.findOne({})
if first:
    print(f"First user email: {first.get('email', 'N/A')}")

# 5. Aggregation example
agg_result = users.aggregate([
    {'$group': {'_id': '$role', 'count': {'$sum': 1}}},
    {'$sort': {'count': -1}}
]).toArray()
print(f"Users by role: {json.dumps(agg_result, default=str)}")

print("=== Test Complete ===")
