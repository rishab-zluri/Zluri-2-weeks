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

  // Error states for validation
  const [instanceError, setInstanceError] = useState(false);
  const [databaseError, setDatabaseError] = useState(false);
  const [podError, setPodError] = useState(false);
  const [commentsError, setCommentsError] = useState(false);
  const [queryError, setQueryError] = useState(false);
  const [fileError, setFileError] = useState(false);

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

  // Check for clone data from sessionStorage (from MyQueriesPage)
  useEffect(() => {
    const cloneDataString = sessionStorage.getItem('cloneRequestData');
    if (cloneDataString) {
      try {
        const cloneData = JSON.parse(cloneDataString);
        // Pre-fill form with clone data
        if (cloneData.instanceId) setInstanceId(cloneData.instanceId);
        if (cloneData.podId) setPodId(cloneData.podId);
        if (cloneData.comments) setComments(cloneData.comments);
        if (cloneData.queryContent) setQuery(cloneData.queryContent);
        if (cloneData.submissionType) setSubmissionType(cloneData.submissionType as 'query' | 'script');
        // Set database name after a short delay to allow databases to load
        if (cloneData.databaseName) {
          setTimeout(() => setDatabaseName(cloneData.databaseName), 500);
        }
        // Clear the sessionStorage after reading
        sessionStorage.removeItem('cloneRequestData');
        toast.success('Request cloned - review and submit');
      } catch (e) {
        console.error('Failed to parse clone data:', e);
        sessionStorage.removeItem('cloneRequestData');
      }
    }
  }, []); // Run once on mount

  const handleReset = () => {
    setInstanceId('');
    setDatabaseName('');
    setPodId('');
    setComments('');
    setQuery('');
    setSelectedFile(null);
    // Clear all errors
    setInstanceError(false);
    setDatabaseError(false);
    setPodError(false);
    setCommentsError(false);
    setQueryError(false);
    setFileError(false);
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
    setFileError(false);
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

    // Clear all previous errors
    setInstanceError(false);
    setDatabaseError(false);
    setPodError(false);
    setCommentsError(false);
    setQueryError(false);
    setFileError(false);

    // Validate all fields and collect errors
    let hasErrors = false;
    const errors: string[] = [];

    if (!instanceId) {
      setInstanceError(true);
      errors.push('Instance');
      hasErrors = true;
    }
    if (!databaseName) {
      setDatabaseError(true);
      errors.push('Database');
      hasErrors = true;
    }
    if (!podId) {
      setPodError(true);
      errors.push('POD');
      hasErrors = true;
    }
    if (!comments.trim()) {
      setCommentsError(true);
      errors.push('Comments');
      hasErrors = true;
    }

    // Type-specific validation
    if (submissionType === 'query' && !query.trim()) {
      setQueryError(true);
      errors.push('Query');
      hasErrors = true;
    }
    if (submissionType === 'script' && !selectedFile) {
      setFileError(true);
      errors.push('Script file');
      hasErrors = true;
    }

    // If there are errors, show toast and return
    if (hasErrors) {
      toast.error(`Please fill in all required fields: ${errors.join(', ')}`);
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
                onInstanceChange={(id) => {
                  setInstanceId(id);
                  setInstanceError(false);
                }}
                onDatabaseChange={(name) => {
                  setDatabaseName(name);
                  setDatabaseError(false);
                }}
                onPodChange={(id) => {
                  setPodId(id);
                  setPodError(false);
                }}
                instanceError={instanceError}
                databaseError={databaseError}
                podError={podError}
              />

              {/* Comments - Always visible */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => {
                    setComments(e.target.value);
                    setCommentsError(false);
                  }}
                  placeholder="Describe the purpose of this request..."
                  rows={3}
                  maxLength={1000}
                  className={`textarea-field ${commentsError ? 'border-red-500 border-2 focus:ring-red-500' : ''}`}
                />
                <div className="flex items-center justify-between mt-1">
                  {commentsError ? (
                    <p className="text-sm text-red-600">Please provide comments</p>
                  ) : (
                    <p className="text-sm text-gray-500">Explain why you need this query/script</p>
                  )}
                  <p className={`text-sm ${comments.length > 900 ? 'text-orange-600 font-medium' : comments.length > 950 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                    {comments.length} / 1,000
                  </p>
                </div>
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
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setQueryError(false);
                    }}
                    placeholder="Enter your SQL or MongoDB query here..."
                    rows={8}
                    maxLength={10000}
                    className={`textarea-field font-mono text-sm ${queryError ? 'border-red-500 border-2 focus:ring-red-500' : ''}`}
                  />
                  <div className="flex items-center justify-between mt-1">
                    {queryError ? (
                      <p className="text-sm text-red-600">Please enter a query</p>
                    ) : (
                      <p className="text-sm text-gray-500">Write your SQL or MongoDB query</p>
                    )}
                    <p className={`text-sm ${query.length > 9000 ? 'text-orange-600 font-medium' : query.length > 9500 ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
                      {query.length} / 10,000
                    </p>
                  </div>
                </div>
              )}

              {/* File Upload - Only for script type */}
              {submissionType === 'script' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Script File <span className="text-red-500">*</span>
                  </label>

                  {/* Timeout Warning */}
                  <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                    <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800">Script Execution Limits</p>
                      <p className="text-yellow-700 mt-1">
                        • Scripts will timeout after <strong>30 seconds</strong><br />
                        • Maximum file size: <strong>16MB</strong><br />
                        • Allowed formats: <strong>.js, .py</strong>
                      </p>
                    </div>
                  </div>

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
                      className={`upload-zone ${dragOver ? 'dragover' : ''} ${fileError ? 'border-red-500 border-2' : ''}`}
                    >
                      <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">Click to upload or drag and drop</p>
                      <p className="text-sm text-gray-500 mt-1">
                        JavaScript (.js) or Python (.py) files only (max 16MB)
                      </p>
                    </div>
                  )}

                  {fileError && (
                    <p className="mt-1 text-sm text-red-600">Please upload a script file</p>
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
