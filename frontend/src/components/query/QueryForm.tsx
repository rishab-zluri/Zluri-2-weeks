import React from 'react';

interface QueryFormProps {
    query: string;
    comments: string;
    onQueryChange: (value: string) => void;
    onCommentsChange: (value: string) => void;
}

export const QueryForm: React.FC<QueryFormProps> = ({
    query,
    comments,
    onQueryChange,
    onCommentsChange,
}) => {
    return (
        <div className="space-y-6">
            {/* Comments */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comments <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={comments}
                    onChange={(e) => onCommentsChange(e.target.value)}
                    placeholder="Describe the purpose of this query..."
                    rows={3}
                    className="textarea-field"
                    required
                />
            </div>

            {/* Query Input */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Database Query <span className="text-red-500">*</span>
                </label>
                <textarea
                    value={query}
                    onChange={(e) => onQueryChange(e.target.value)}
                    placeholder="Enter your SQL or MongoDB query here..."
                    rows={8}
                    className="textarea-field font-mono text-sm"
                    required
                />
            </div>
        </div>
    );
};
