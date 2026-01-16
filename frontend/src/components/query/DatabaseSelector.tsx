import React from 'react';
import { Loader2, XCircle } from 'lucide-react';
import { DatabaseInstance, Pod } from '@/services/queryService';

export interface DatabaseSelectorProps {
    instances: DatabaseInstance[];
    pods: Pod[];
    databases: string[];
    loadingDatabases: boolean;
    selectedInstanceId: string;
    selectedDatabaseName: string;
    selectedPodId: string;
    onInstanceChange: (instanceId: string) => void;
    onDatabaseChange: (databaseName: string) => void;
    onPodChange: (podId: string) => void;
}

export const DatabaseSelector: React.FC<DatabaseSelectorProps> = ({
    instances,
    pods,
    databases,
    loadingDatabases,
    selectedInstanceId,
    selectedDatabaseName,
    selectedPodId,
    onInstanceChange,
    onDatabaseChange,
    onPodChange,
}) => {
    const isDatabaseDisabled = !selectedInstanceId;

    return (
        <div className="space-y-6">
            {/* Instance Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Instance Name <span className="text-red-500">*</span>
                </label>
                <select
                    value={selectedInstanceId}
                    onChange={(e) => onInstanceChange(e.target.value)}
                    className="select-field"
                    required
                >
                    <option value="">Select Instance</option>
                    {Array.isArray(instances) && instances.map((instance) => (
                        <option key={instance.id} value={instance.id}>
                            {instance.name} ({instance.type})
                        </option>
                    ))}
                </select>
            </div>

            {/* Database Selection */}
            <div className="relative group">
                <label className={`block text-sm font-medium mb-2 transition-colors ${isDatabaseDisabled ? 'text-gray-400' : 'text-gray-700'
                    }`}>
                    Database Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <select
                        value={selectedDatabaseName}
                        onChange={(e) => onDatabaseChange(e.target.value)}
                        className={`select-field transition-all ${isDatabaseDisabled
                                ? 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400'
                                : ''
                            }`}
                        required
                        disabled={isDatabaseDisabled || loadingDatabases}
                    >
                        <option value="">
                            {isDatabaseDisabled
                                ? '← Select an instance first'
                                : 'Select Database Name'
                            }
                        </option>
                        {Array.isArray(databases) && databases.map((db) => (
                            <option key={db} value={db}>{db}</option>
                        ))}
                    </select>

                    {/* Loading spinner */}
                    {loadingDatabases && (
                        <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-purple-500" />
                    )}

                    {/* Red X indicator when disabled - shows on hover */}
                    {isDatabaseDisabled && (
                        <div className="absolute right-10 top-1/2 -translate-y-1/2 
                                        opacity-0 group-hover:opacity-100 transition-opacity">
                            <XCircle className="w-5 h-5 text-red-400" />
                        </div>
                    )}
                </div>

                {/* Tooltip on hover when disabled */}
                {isDatabaseDisabled && (
                    <div className="absolute z-10 left-0 -bottom-8 
                                    opacity-0 group-hover:opacity-100 transition-opacity
                                    text-xs text-red-500 bg-red-50 px-2 py-1 rounded border border-red-200">
                        Please select an instance first
                    </div>
                )}
            </div>

            {/* POD Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    POD Name <span className="text-red-500">*</span>
                </label>
                <select
                    value={selectedPodId}
                    onChange={(e) => onPodChange(e.target.value)}
                    className="select-field"
                    required
                >
                    <option value="">Select POD</option>
                    {Array.isArray(pods) && pods.map((pod) => (
                        <option key={pod.id} value={pod.id}>{pod.name}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};
