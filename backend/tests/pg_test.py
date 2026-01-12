import os
import json

def main():
    config_path = os.environ.get('DB_CONFIG_FILE')
    
    if not config_path:
        print('Running in test mode - no DB config')
        print('Script executed successfully!')
        print('Result: { "status": "ok", "message": "Test script ran" }')
        return
    
    import psycopg2
    
    with open(config_path, 'r') as f:
        config = json.load(f)
    
    conn = psycopg2.connect(
        host=config['host'],
        port=config['port'],
        database=config['database'],
        user=config['user'],
        password=config['password']
    )
    
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT NOW(), current_database()")
        result = cursor.fetchall()
        print(f"Result: {result}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()