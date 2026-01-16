import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Code,
  FileUp,
  RotateCcw,
  Send,
  Loader2,
  BookOpen
} from 'lucide-react';
import {
  useInstances,
  usePods,
  useDatabases,
  useSubmitQuery,
  useSubmitScript
} from '@/hooks';
import { Loading } from '@/components/common';
import { DatabaseSelector } from '@/components/query/DatabaseSelector';
import { QueryForm } from '@/components/query/QueryForm';
import { ScriptForm } from '@/components/query/ScriptForm';
import { ScriptDocs } from '@/components/query/ScriptDocs'; // Correct import path
import toast from 'react-hot-toast';
import { DatabaseInstance, Pod, SubmitQueryInput, SubmitScriptInput } from '@/services/queryService';
import { DatabaseType } from '@/types';

const QuerySubmissionPage: React.FC = () => {
  const navigate = useNavigate();

  // Submission type toggle: 'query' or 'script'
  const [submissionType, setSubmissionType] = useState<'query' | 'script'>('query');
  const [showDocs, setShowDocs] = useState(false);

  // Form state
  // We keep form state lifted here to coordinate between selector and forms
  const [instanceId, setInstanceId] = useState('');
  const [databaseName, setDatabaseName] = useState('');
  const [podId, setPodId] = useState('');
  const [comments, setComments] = useState('');
  const [query, setQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Data Fetching Hooks
  const { data: instances = [], isLoading: loadingInstances } = useInstances();
  const { data: pods = [], isLoading: loadingPods } = usePods();
  const { data: databases = [], isLoading: loadingDatabases } = useDatabases(instanceId || null);

  // Mutation Hooks
  const submitQueryMutation = useSubmitQuery();
  const submitScriptMutation = useSubmitScript();
  const submitting = submitQueryMutation.isPending || submitScriptMutation.isPending;

  // Reset databases when instance changes
  useEffect(() => {
    setDatabaseName('');
  }, [instanceId]);

  const handleReset = () => {
    setInstanceId('');
    setDatabaseName('');
    setPodId('');
    setComments('');
    setQuery('');
    setSelectedFile(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Common validation
    if (!instanceId || !databaseName || !podId || !comments) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Type-specific validation
    if (submissionType === 'query' && !query) {
      toast.error('Please enter a query');
      return;
    }
    if (submissionType === 'script' && !selectedFile) {
      toast.error('Please upload a script file');
      return;
    }

    try {
      // Find selected objects for names (not strictly needed by backend mostly ids, but good for optimistic UI or logs if needed)
      // The backend expects IDs mostly, names are optional or redundant but we send what service interface says.

      const instance = instances.find(i => i.id === instanceId);
      const databaseType = instance?.type || 'postgresql'; // Default

      if (submissionType === 'query') {
        const payload: SubmitQueryInput = {
          instanceId,
          databaseName,
          podId,
          databaseType,
          queryContent: query,
          comments,
        };
        await submitQueryMutation.mutateAsync(payload);

      } else {
        if (!selectedFile) return;
        const payload: SubmitScriptInput = {
          instanceId,
          databaseName,
          podId,
          databaseType,
          comments,
          scriptFile: selectedFile,
        };
        await submitScriptMutation.mutateAsync(payload);
      }

      // Success is handled by mutation hook (toast + invalidate)
      // But we should navigate or reset here.
      // Navigation is good user experience.
      handleReset();
      navigate('/queries');

    } catch (error) {
      // Error handled by mutation hook or global handler mostly
      console.error(error);
    }
  };

  if (loadingInstances || loadingPods) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading text="Loading form data..." />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Database Request Portal</h1>
          <p className="text-gray-500 mt-1">Submit queries or scripts for approval and execution</p>
        </div>
        {submissionType === 'script' && (
          <button
            type="button"
            onClick={() => setShowDocs(!showDocs)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showDocs
              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
          >
            <BookOpen className="w-4 h-4" />
            {showDocs ? 'Hide Docs' : 'Show Docs'}
          </button>
        )}
      </div>

      {/* Submission Type Toggle */}
      <div className="mb-6">
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-1">
          <button
            type="button"
            onClick={() => setSubmissionType('query')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${submissionType === 'query'
              ? 'bg-white text-purple-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Code className="w-4 h-4" />
            Query
          </button>
          <button
            type="button"
            onClick={() => setSubmissionType('script')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${submissionType === 'script'
              ? 'bg-white text-purple-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <FileUp className="w-4 h-4" />
            Script File
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${submissionType === 'script' && showDocs ? 'lg:grid-cols-3' : ''} gap-6`}>
        {/* Form Section */}
        <div className={submissionType === 'script' && showDocs ? 'lg:col-span-2' : ''}>
          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-6">

              <DatabaseSelector
                instances={instances as DatabaseInstance[]}
                pods={pods as Pod[]}
                databases={databases || []} // useDatabases hook returns array in data.data? Checked hook.
                // Wait, hook returns what `queryService.getDatabases` returns. 
                // `queryService` returns `response.data.data` which is `string[]`. Correct.
                loadingDatabases={loadingDatabases}
                selectedInstanceId={instanceId}
                selectedDatabaseName={databaseName}
                selectedPodId={podId}
                onInstanceChange={setInstanceId}
                onDatabaseChange={setDatabaseName}
                onPodChange={setPodId}
              />

              {submissionType === 'query' ? (
                <QueryForm
                  query={query}
                  comments={comments}
                  onQueryChange={setQuery}
                  onCommentsChange={setComments}
                />
              ) : (
                <ScriptForm
                  selectedFile={selectedFile}
                  comments={comments}
                  onFileSelect={setSelectedFile}
                  onCommentsChange={setComments}
                />
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-4 pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Submit {submissionType === 'query' ? 'Query' : 'Script'}
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn-secondary flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Documentation Panel - Only for script type */}
        {submissionType === 'script' && showDocs && (
          <div className="lg:col-span-1">
            <ScriptDocs />
          </div>
        )}
      </div>
    </div>
  );
};

export default QuerySubmissionPage;
