import React from 'react';
import { BookOpen } from 'lucide-react';

export const ScriptDocs: React.FC = () => {
    return (
        <div className="card bg-blue-50 border-blue-200 sticky top-20">
            <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h2 className="font-semibold text-gray-900">Script Documentation</h2>
            </div>

            <p className="text-sm text-gray-600 mb-4">
                Database connections are automatically provided to your scripts. Use the pre-injected <code className="bg-gray-200 px-1 rounded">db</code> variable.
            </p>

            {/* Node.js Section */}
            <div>
                <div className="flex items-center gap-2 mb-2">
                    <span className="text-green-500 font-bold">&lt;/&gt;</span>
                    <h3 className="font-semibold text-gray-900">JavaScript Scripts (.js)</h3>
                </div>
                <p className="text-sm text-gray-600 mb-2">Available variable:</p>
                <div className="bg-gray-800 text-green-400 p-3 rounded-lg text-xs font-mono">
                    <div>db - Database wrapper with query methods</div>
                </div>

                <p className="text-sm font-medium text-gray-700 mt-3 mb-2">PostgreSQL Example:</p>
                <div className="bg-gray-800 text-green-400 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                    {`// SELECT query
const result = await db.query(
  'SELECT * FROM users LIMIT 10'
);
console.log(result.rows);

// INSERT/UPDATE/DELETE
const update = await db.query(
  'UPDATE users SET active = $1 WHERE id = $2',
  [true, 123]
);
console.log(update.rowCount + ' rows affected');`}
                </div>

                <p className="text-sm font-medium text-gray-700 mt-3 mb-2">MongoDB Example:</p>
                <div className="bg-gray-800 text-green-400 p-3 rounded-lg text-xs font-mono overflow-x-auto">
                    {`// Find documents
const users = await db.collection('users')
  .find({ active: true });
console.log(users);

// Insert document
await db.collection('users')
  .insertOne({ name: 'John', email: 'john@example.com' });

// Update documents
await db.collection('users')
  .updateMany({ active: false }, { $set: { archived: true } });`}
                </div>

                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800">
                        <strong>Note:</strong> All operations are logged and results are captured automatically. Use <code className="bg-yellow-100 px-1 rounded">console.log()</code> to output data.
                    </p>
                </div>
            </div>
        </div>
    );
};
