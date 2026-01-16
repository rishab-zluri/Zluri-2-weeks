import React from 'react';
import { Loader2 } from 'lucide-react';
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
                    {instances.map((instance) => (
                        <option key={instance.id} value={instance.id}>
                            {instance.name} ({instance.type})
                        </option>
                    ))}
                </select>
            </div>

            {/* Database Selection */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Database Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                    <select
                        value={selectedDatabaseName}
                        onChange={(e) => onDatabaseChange(e.target.value)}
                        className="select-field"
                        required
                        disabled={!selectedInstanceId || loadingDatabases}
                    >
                        <option value="">Select Database Name</option>
                        {databases.map((db) => (
                            <option key={db} value={db}>{db}</option>
                        ))}
                    </select>
                    {loadingDatabases && (
                        <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                    )}
                </div>
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
                    {pods.map((pod) => (
                        <option key={pod.id} value={pod.id}>{pod.name}</option>
                    ))}
                </select>
            </div>
        </div>
    );
};
