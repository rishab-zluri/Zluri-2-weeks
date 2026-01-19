#!/usr/bin/env python3
"""
PostgreSQL Report Generator (Python)

This script demonstrates safe read operations on a PostgreSQL database using Python.
Perfect for generating detailed reports with data analysis.

USAGE:
- Upload this as a script submission
- Select a PostgreSQL instance
- Select target database

WHAT IT DOES:
1. Connects to PostgreSQL
2. Analyzes user data
3. Generates formatted report
4. Exports summary statistics

REQUIREMENTS:
- psycopg2 (automatically available in the portal)
"""

import os
import sys
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor

def main():
    """Main execution function"""
    
    # Connection is automatically provided by the portal
    conn_string = os.environ.get('DATABASE_URL')
    
    if not conn_string:
        print("❌ Error: DATABASE_URL not found")
        sys.exit(1)
    
    conn = None
    
    try:
        print("🔍 Starting PostgreSQL Report Generation...\n")
        
        # Connect to database
        conn = psycopg2.connect(conn_string)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1. Overall Statistics
        print("=" * 60)
        print("📊 OVERALL STATISTICS")
        print("=" * 60)
        
        cur.execute("SELECT COUNT(*) as total FROM users")
        total_users = cur.fetchone()['total']
        print(f"Total Users: {total_users:,}")
        
        cur.execute("""
            SELECT 
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as last_30_days,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days,
                COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 day' THEN 1 END) as last_24_hours
            FROM users
        """)
        growth = cur.fetchone()
        print(f"New Users (30 days): {growth['last_30_days']:,}")
        print(f"New Users (7 days): {growth['last_7_days']:,}")
        print(f"New Users (24 hours): {growth['last_24_hours']:,}")
        print()
        
        # 2. Status Distribution
        print("=" * 60)
        print("📈 STATUS DISTRIBUTION")
        print("=" * 60)
        
        cur.execute("""
            SELECT 
                COALESCE(status, 'unknown') as status,
                COUNT(*) as count,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
            FROM users
            GROUP BY status
            ORDER BY count DESC
        """)
        
        statuses = cur.fetchall()
        for row in statuses:
            bar = "█" * int(row['percentage'] / 2)
            print(f"{row['status']:15} {row['count']:6,} ({row['percentage']:5.1f}%) {bar}")
        print()
        
        # 3. Growth Trend (Last 7 Days)
        print("=" * 60)
        print("📅 GROWTH TREND (Last 7 Days)")
        print("=" * 60)
        
        cur.execute("""
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as new_users
            FROM users
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        """)
        
        trends = cur.fetchall()
        if trends:
            max_count = max(row['new_users'] for row in trends)
            for row in trends:
                bar_length = int((row['new_users'] / max_count) * 40) if max_count > 0 else 0
                bar = "▓" * bar_length
                print(f"{row['date']} │ {row['new_users']:4} {bar}")
        else:
            print("No data available")
        print()
        
        # 4. Top Active Users (if you have activity tracking)
        print("=" * 60)
        print("👥 RECENT USERS (Last 10)")
        print("=" * 60)
        
        cur.execute("""
            SELECT 
                id,
                email,
                status,
                created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT 10
        """)
        
        recent_users = cur.fetchall()
        for idx, user in enumerate(recent_users, 1):
            print(f"{idx:2}. {user['email']:30} | {user['status']:10} | {user['created_at']}")
        print()
        
        # 5. Data Quality Check
        print("=" * 60)
        print("🔍 DATA QUALITY CHECK")
        print("=" * 60)
        
        cur.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(email) as has_email,
                COUNT(CASE WHEN email IS NULL OR email = '' THEN 1 END) as missing_email,
                COUNT(CASE WHEN status IS NULL THEN 1 END) as missing_status
            FROM users
        """)
        
        quality = cur.fetchone()
        print(f"Total Records: {quality['total']:,}")
        print(f"Has Email: {quality['has_email']:,} ({quality['has_email']/quality['total']*100:.1f}%)")
        print(f"Missing Email: {quality['missing_email']:,}")
        print(f"Missing Status: {quality['missing_status']:,}")
        print()
        
        # Summary
        print("=" * 60)
        print("✅ REPORT COMPLETE")
        print("=" * 60)
        print(f"Generated at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Total records analyzed: {total_users:,}")
        print()
        
    except psycopg2.Error as e:
        print(f"❌ Database Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    main()
