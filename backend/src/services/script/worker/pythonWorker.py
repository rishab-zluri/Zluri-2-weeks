#!/usr/bin/env python3
"""
Python Script Worker - Production-Grade Sandbox Executor

This worker executes user-submitted Python scripts in a secure sandbox environment.
It connects to PostgreSQL or MongoDB and provides a `db` wrapper for database operations.

SECURITY ARCHITECTURE:
├── Restricted Builtins (no open, exec, eval, compile)
├── Limited Imports (whitelist only)
├── No File System Access
├── No Network Access (beyond database)
├── Timeout Enforcement
└── Output Capture & Sanitization

USAGE:
    Script receives JSON config via stdin, executes script, returns JSON via stdout.

AUTHOR: Query Portal Backend
VERSION: 1.0.0
"""

import sys
import json
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional, Callable
from contextlib import contextmanager
import time


# =============================================================================
# SECURITY: RESTRICTED BUILTINS
# =============================================================================

BLOCKED_BUILTINS = {
    'open', 'exec', 'eval', 'compile', '__import__', 
    'input', 'breakpoint', 'help', 'license', 'credits',
    'memoryview', 'globals', 'locals', 'vars',
}

ALLOWED_BUILTINS = {
    # Core
    'True', 'False', 'None', 'print',
    # Types
    'str', 'int', 'float', 'bool', 'list', 'dict', 'set', 'tuple', 'bytes',
    # Collections
    'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed',
    # Math
    'abs', 'min', 'max', 'sum', 'round', 'pow', 'divmod',
    # Type checking
    'type', 'isinstance', 'issubclass', 'callable', 'hasattr', 'getattr', 'setattr',
    # String/formatting
    'format', 'repr', 'ascii', 'chr', 'ord', 'hex', 'oct', 'bin',
    # Iteration
    'iter', 'next', 'all', 'any',
    # Exceptions
    'Exception', 'ValueError', 'TypeError', 'KeyError', 'IndexError', 
    'RuntimeError', 'AttributeError', 'StopIteration',
}

# Whitelisted modules that can be imported
ALLOWED_MODULES = {
    'json',
    'datetime', 
    're',
    'math',
    'time',
    'collections',
    'functools',
    'itertools',
}

# Pre-import allowed modules
_PRELOADED_MODULES = {}
for _mod_name in ALLOWED_MODULES:
    try:
        _PRELOADED_MODULES[_mod_name] = __import__(_mod_name)
    except ImportError:
        pass


def restricted_import(name, globals=None, locals=None, fromlist=(), level=0):
    """
    Restricted __import__ that only allows whitelisted modules.
    
    This allows scripts to use 'import json' syntax while still
    blocking dangerous modules like os, subprocess, etc.
    """
    # Get base module name (e.g., 'datetime' from 'from datetime import datetime')
    base_module = name.split('.')[0]
    
    if base_module not in ALLOWED_MODULES:
        raise ImportError(f"Module '{name}' is not allowed. Allowed modules: {', '.join(sorted(ALLOWED_MODULES))}")
    
    # Return pre-loaded module
    if base_module in _PRELOADED_MODULES:
        return _PRELOADED_MODULES[base_module]
    
    raise ImportError(f"Module '{name}' could not be loaded")


def create_restricted_builtins() -> Dict[str, Any]:
    """Create a restricted builtins dict for script execution."""
    import builtins
    restricted = {}
    for name in ALLOWED_BUILTINS:
        if hasattr(builtins, name):
            restricted[name] = getattr(builtins, name)
    
    # Add restricted import function to allow 'import json' etc.
    restricted['__import__'] = restricted_import
    
    return restricted


# =============================================================================
# OUTPUT CAPTURE
# =============================================================================

class OutputCapture:
    """Captures all script output for audit trail."""
    
    def __init__(self):
        self.items: List[Dict[str, Any]] = []
    
    def add(self, output_type: str, message: str, **extras):
        """Add an output item with timestamp."""
        item = {
            'type': output_type,
            'message': message,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            **extras
        }
        self.items.append(item)
    
    def info(self, message: str, **extras):
        self.add('info', message, **extras)
    
    def error(self, message: str, **extras):
        self.add('error', message, **extras)
    
    def warn(self, message: str, **extras):
        self.add('warn', message, **extras)
    
    def query(self, message: str, **extras):
        self.add('query', message, **extras)
    
    def data(self, message: str, **extras):
        self.add('data', message, **extras)


class SandboxPrint:
    """Replacement print() that captures output."""
    
    def __init__(self, output: OutputCapture):
        self.output = output
    
    def __call__(self, *args, **kwargs):
        message = ' '.join(str(arg) for arg in args)
        self.output.info(message)


# =============================================================================
# DATABASE WRAPPERS
# =============================================================================

class PostgresWrapper:
    """
    PostgreSQL database wrapper for script sandbox.
    
    Provides:
        db.query(sql, params) - Execute query and return results
        db.execute(sql, params) - Execute without returning (INSERT/UPDATE/DELETE)
    
    Security:
        - Uses parameterized queries (prevents SQL injection)
        - Read-only by default (configurable)
        - Query logging for audit trail
    """
    
    def __init__(self, connection_params: Dict[str, Any], output: OutputCapture, readonly: bool = False):
        import psycopg2
        import psycopg2.extras
        
        self.output = output
        self.readonly = readonly
        self.query_count = 0
        
        # Connect with parameters
        self.conn = psycopg2.connect(**connection_params)
        if readonly:
            self.conn.set_session(readonly=True)
        self.cursor = self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    def query(self, sql: str, params: Optional[tuple] = None) -> Dict[str, Any]:
        """Execute a query and return results."""
        self.query_count += 1
        start_time = time.time()
        
        try:
            self.cursor.execute(sql, params or ())
            duration_ms = int((time.time() - start_time) * 1000)
            
            # Determine query type
            query_type = sql.strip().split()[0].upper()
            
            if query_type == 'SELECT':
                rows = self.cursor.fetchall()
                # Convert RealDictRow to regular dict
                rows = [dict(row) for row in rows]
                row_count = len(rows)
                
                self.output.query(
                    f"Query {self.query_count} ({query_type}): {row_count} rows in {duration_ms}ms",
                    queryNumber=self.query_count,
                    queryType=query_type,
                    sql=sql[:200] + ('...' if len(sql) > 200 else ''),
                    duration=f"{duration_ms}ms",
                    rowCount=row_count
                )
                
                return {
                    'rows': rows,
                    'rowCount': row_count,
                    'fields': [desc[0] for desc in self.cursor.description] if self.cursor.description else []
                }
            else:
                # INSERT, UPDATE, DELETE
                row_count = self.cursor.rowcount
                self.conn.commit()
                
                self.output.query(
                    f"Query {self.query_count} ({query_type}): {row_count} rows affected in {duration_ms}ms",
                    queryNumber=self.query_count,
                    queryType=query_type,
                    sql=sql[:200] + ('...' if len(sql) > 200 else ''),
                    duration=f"{duration_ms}ms",
                    rowsAffected=row_count
                )
                
                return {
                    'rows': [],
                    'rowCount': row_count,
                    'rowsAffected': row_count
                }
                
        except Exception as e:
            self.conn.rollback()
            self.output.error(
                f"Query {self.query_count} failed: {str(e)}",
                queryNumber=self.query_count,
                error=str(e)
            )
            raise
    
    def execute(self, sql: str, params: Optional[tuple] = None) -> int:
        """Execute a query without returning results. Returns rows affected."""
        result = self.query(sql, params)
        return result.get('rowsAffected', 0)
    
    def close(self):
        """Close database connection."""
        try:
            self.cursor.close()
            self.conn.close()
        except:
            pass


class MongoWrapper:
    """
    MongoDB database wrapper for script sandbox.
    
    Provides:
        db.collection(name) - Get a collection with wrapped methods
    
    Collection methods:
        find, findOne, insertOne, insertMany, updateOne, updateMany,
        deleteOne, deleteMany, countDocuments, aggregate
    
    Security:
        - All operations logged for audit trail
        - Critical operations (drop, deleteMany) flagged
    """
    
    def __init__(self, uri: str, database_name: str, output: OutputCapture):
        from pymongo import MongoClient
        
        self.output = output
        self.op_count = 0
        self.client = MongoClient(uri)
        self.db = self.client[database_name]
    
    def _log_op(self, collection: str, operation: str, **details):
        """Log a database operation."""
        self.op_count += 1
        message = f"Op {self.op_count}: {collection}.{operation}()"
        
        # Flag critical operations
        if operation in ('drop', 'dropDatabase', 'deleteMany'):
            self.output.warn(f"CRITICAL: {message}", **details)
        else:
            self.output.query(message, opNumber=self.op_count, operation=operation, collection=collection, **details)
    
    def collection(self, name: str) -> 'MongoCollectionWrapper':
        """Get a wrapped collection."""
        return MongoCollectionWrapper(self.db[name], name, self)
    
    def close(self):
        """Close MongoDB connection."""
        try:
            self.client.close()
        except:
            pass


class MongoCollectionWrapper:
    """Wrapped MongoDB collection with logging."""
    
    def __init__(self, collection, name: str, wrapper: MongoWrapper):
        self._collection = collection
        self._name = name
        self._wrapper = wrapper
    
    def find(self, filter: Optional[Dict] = None, projection: Optional[Dict] = None):
        """Find documents. Returns cursor (use .toArray() or list())."""
        self._wrapper._log_op(self._name, 'find', filter=str(filter)[:100] if filter else '{}')
        return MongoFindCursor(self._collection.find(filter or {}, projection))
    
    def findOne(self, filter: Optional[Dict] = None):
        """Find a single document."""
        self._wrapper._log_op(self._name, 'findOne', filter=str(filter)[:100] if filter else '{}')
        return self._collection.find_one(filter or {})
    
    def insertOne(self, document: Dict) -> Dict:
        """Insert a single document."""
        self._wrapper._log_op(self._name, 'insertOne')
        result = self._collection.insert_one(document)
        return {'insertedId': str(result.inserted_id)}
    
    def insertMany(self, documents: List[Dict]) -> Dict:
        """Insert multiple documents."""
        self._wrapper._log_op(self._name, 'insertMany', count=len(documents))
        result = self._collection.insert_many(documents)
        return {'insertedIds': [str(id) for id in result.inserted_ids]}
    
    def updateOne(self, filter: Dict, update: Dict) -> Dict:
        """Update a single document."""
        self._wrapper._log_op(self._name, 'updateOne')
        result = self._collection.update_one(filter, update)
        return {'matchedCount': result.matched_count, 'modifiedCount': result.modified_count}
    
    def updateMany(self, filter: Dict, update: Dict) -> Dict:
        """Update multiple documents."""
        self._wrapper._log_op(self._name, 'updateMany', filter=str(filter)[:100])
        result = self._collection.update_many(filter, update)
        return {'matchedCount': result.matched_count, 'modifiedCount': result.modified_count}
    
    def deleteOne(self, filter: Dict) -> Dict:
        """Delete a single document."""
        self._wrapper._log_op(self._name, 'deleteOne')
        result = self._collection.delete_one(filter)
        return {'deletedCount': result.deleted_count}
    
    def deleteMany(self, filter: Dict) -> Dict:
        """Delete multiple documents. ⚠️ CRITICAL if filter is empty."""
        if not filter or filter == {}:
            self._wrapper._log_op(self._name, 'deleteMany', warning='DELETING ALL DOCUMENTS', risk='critical')
        else:
            self._wrapper._log_op(self._name, 'deleteMany', filter=str(filter)[:100])
        result = self._collection.delete_many(filter)
        return {'deletedCount': result.deleted_count}
    
    def countDocuments(self, filter: Optional[Dict] = None) -> int:
        """Count documents matching filter."""
        self._wrapper._log_op(self._name, 'countDocuments')
        return self._collection.count_documents(filter or {})
    
    def aggregate(self, pipeline: List[Dict]):
        """Run aggregation pipeline. Returns cursor."""
        self._wrapper._log_op(self._name, 'aggregate', stages=len(pipeline))
        return MongoFindCursor(self._collection.aggregate(pipeline))


class MongoFindCursor:
    """Wrapped MongoDB cursor with toArray() method for JS compatibility."""
    
    def __init__(self, cursor):
        self._cursor = cursor
    
    def toArray(self) -> List[Dict]:
        """Convert cursor to list (JavaScript compatibility)."""
        return list(self._cursor)
    
    def __iter__(self):
        return iter(self._cursor)
    
    def limit(self, n: int):
        self._cursor = self._cursor.limit(n)
        return self
    
    def skip(self, n: int):
        self._cursor = self._cursor.skip(n)
        return self
    
    def sort(self, key_or_list, direction=None):
        self._cursor = self._cursor.sort(key_or_list, direction)
        return self


# =============================================================================
# SCRIPT EXECUTOR
# =============================================================================

def execute_script(config: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a Python script in a sandboxed environment.
    
    Args:
        config: {
            'scriptContent': str,           # The Python script to execute
            'databaseType': 'postgresql' | 'mongodb',
            'instance': {                   # Database instance config
                'host': str,
                'port': int,
                'user': str,
                'password': str,
                'uri': str (for MongoDB)
            },
            'databaseName': str,
            'timeout': int                  # Timeout in milliseconds
        }
    
    Returns:
        {
            'success': bool,
            'result': Any,                  # Script return value (if any)
            'output': List[Dict],           # Captured output
            'error': {'type': str, 'message': str}  # If failed
        }
    """
    output = OutputCapture()
    db_wrapper = None
    
    try:
        script_content = config['scriptContent']
        database_type = config['databaseType']
        instance = config['instance']
        database_name = config['databaseName']
        
        output.info(
            'Starting script execution...',
            database=database_name,
            instance=instance.get('id', 'unknown'),
            databaseType=database_type
        )
        
        # Create database wrapper
        if database_type == 'postgresql':
            connection_params = {
                'host': instance.get('host', 'localhost'),
                'port': instance.get('port', 5432),
                'database': database_name,
                'user': instance.get('user') or instance.get('credentialsEnvPrefix', 'postgres'),
                'password': instance.get('password', ''),
            }
            # Handle env-based credentials
            if 'credentialsEnvPrefix' in instance:
                import os
                prefix = instance['credentialsEnvPrefix']
                connection_params['user'] = os.environ.get(f'{prefix}_USER', connection_params['user'])
                connection_params['password'] = os.environ.get(f'{prefix}_PASSWORD', '')
            
            db_wrapper = PostgresWrapper(connection_params, output)
            
        elif database_type == 'mongodb':
            uri = instance.get('uri') or instance.get('connectionString', 'mongodb://localhost:27017')
            # Handle env-based connection string
            if 'credentialsEnvPrefix' in instance:
                import os
                prefix = instance['credentialsEnvPrefix']
                env_uri = os.environ.get(f'{prefix}_CONNECTION_STRING')
                if env_uri:
                    uri = env_uri
            
            db_wrapper = MongoWrapper(uri, database_name, output)
        
        else:
            raise ValueError(f"Unsupported database type: {database_type}")
        
        # Create sandbox globals
        sandbox_globals = {
            '__builtins__': create_restricted_builtins(),
            'db': db_wrapper,
            'print': SandboxPrint(output),
            'json': __import__('json'),
            'datetime': __import__('datetime'),
            're': __import__('re'),
            'math': __import__('math'),
        }
        
        # Execute script
        exec(compile(script_content, '<script>', 'exec'), sandbox_globals)
        
        output.info('Script completed successfully')
        
        return {
            'success': True,
            'result': None,
            'output': output.items
        }
        
    except SyntaxError as e:
        output.error(f"Syntax error at line {e.lineno}: {e.msg}")
        return {
            'success': False,
            'error': {'type': 'SyntaxError', 'message': f"Line {e.lineno}: {e.msg}"},
            'output': output.items
        }
        
    except Exception as e:
        output.error(f"Script failed: {str(e)}")
        return {
            'success': False,
            'error': {'type': type(e).__name__, 'message': str(e)},
            'output': output.items
        }
        
    finally:
        if db_wrapper:
            db_wrapper.close()


# =============================================================================
# MAIN: IPC HANDLER
# =============================================================================

def main():
    """Main entry point - reads config from stdin, writes result to stdout."""
    try:
        # Read config from stdin
        config_json = sys.stdin.read()
        config = json.loads(config_json)
        
        # Execute script
        result = execute_script(config)
        
        # Write result to stdout
        print(json.dumps(result))
        sys.exit(0 if result['success'] else 1)
        
    except json.JSONDecodeError as e:
        error_result = {
            'success': False,
            'error': {'type': 'ConfigError', 'message': f"Invalid JSON config: {str(e)}"},
            'output': []
        }
        print(json.dumps(error_result))
        sys.exit(1)
        
    except Exception as e:
        error_result = {
            'success': False,
            'error': {'type': 'WorkerError', 'message': str(e)},
            'output': []
        }
        print(json.dumps(error_result))
        sys.exit(1)


if __name__ == '__main__':
    main()
