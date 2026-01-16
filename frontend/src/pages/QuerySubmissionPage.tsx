import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Code,
  FileUp,
  RotateCcw,
  Send,
  Loader2,
  BookOpen,
  Upload,
  X,
  FileText
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
import { ScriptDocs } from '@/components/query/ScriptDocs';
import toast from 'react-hot-toast';
import { DatabaseInstance, Pod, SubmitQueryInput, SubmitScriptInput } from '@/services/queryService';
import type { DatabaseType } from '@/types';

const QuerySubmissionPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Submission type toggle: 'query' or 'script'
  const [submissionType, setSubmissionType] = useState<'query' | 'script'>('query');
  const [showDocs, setShowDocs] = useState(false);

  // Form state
  const [instanceId, setInstanceId] = useState('');
  const [databaseName, setDatabaseName] = useState('');
  const [podId, setPodId] = useState('');
  const [comments, setComments] = useState('');
  const [query, setQuery] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

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

  // File handling
  const validateAndSelectFile = (file: File) => {
    const validExtensions = ['.js', '.py'];
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validExtensions.includes(extension)) {
      toast.error('Please upload a .js or .py file');
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      toast.error('File size must be less than 16MB');
      return;
    }

    setSelectedFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
      const instance = instances.find(i => i.id === instanceId);
      const databaseType = (instance?.type || 'postgresql') as DatabaseType;

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

      handleReset();
      navigate('/queries');

    } catch (error) {
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

      <div className={`grid grid-cols-1 ${submissionType === 'script' && showDocs ? 'lg:grid-cols-3' : ''} gap-6`}>
        {/* Form Section */}
        <div className={submissionType === 'script' && showDocs ? 'lg:col-span-2' : ''}>
          <div className="card">
            <form onSubmit={handleSubmit} className="space-y-6">

              <DatabaseSelector
                instances={instances as DatabaseInstance[]}
                pods={pods as Pod[]}
                databases={databases || []}
                loadingDatabases={loadingDatabases}
                selectedInstanceId={instanceId}
                selectedDatabaseName={databaseName}
                selectedPodId={podId}
                onInstanceChange={setInstanceId}
                onDatabaseChange={setDatabaseName}
                onPodChange={setPodId}
              />

              {/* Comments - Always visible */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Describe the purpose of this request..."
                  rows={3}
                  className="textarea-field"
                  required
                />
              </div>

              {/* Submission Type Toggle - Now BELOW comments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Request Type <span className="text-red-500">*</span>
                </label>
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

              {/* Query Input - Only for query type */}
              {submissionType === 'query' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Database Query <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter your SQL or MongoDB query here..."
                    rows={8}
                    className="textarea-field font-mono text-sm"
                    required
                  />
                </div>
              )}

              {/* File Upload - Only for script type */}
              {submissionType === 'script' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Script File <span className="text-red-500">*</span>
                  </label>

                  {selectedFile ? (
                    <div className="flex items-center justify-between p-4 bg-purple-50 border border-purple-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-8 h-8 text-purple-600" />
                        <div>
                          <p className="font-medium text-gray-900">{selectedFile.name}</p>
                          <p className="text-sm text-gray-500">
                            {(selectedFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-1 hover:bg-purple-100 rounded-full transition-colors"
                      >
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      className={`upload-zone ${dragOver ? 'dragover' : ''}`}
                    >
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">Click to upload or drag and drop</p>
                      <p className="text-sm text-gray-500 mt-1">
                        JavaScript (.js) or Python (.py) files only (max 16MB)
                      </p>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".js,.py"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </div>
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
