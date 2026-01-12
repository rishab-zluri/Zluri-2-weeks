import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, 
  Send, 
  RotateCcw, 
  Loader2, 
  Upload, 
  FileCode, 
  BookOpen,
  X,
  FileText,
  Code,
  FileUp
} from 'lucide-react';
import { queryService } from '../services';
import { Loading } from '../components/common';
import toast from 'react-hot-toast';

const QuerySubmissionPage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  // Submission type toggle: 'query' or 'script'
  const [submissionType, setSubmissionType] = useState('query');
  
  // Form state
  const [formData, setFormData] = useState({
    instanceId: '',
    databaseName: '',
    comments: '',
    query: '',
    podId: '',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  
  // Data state
  const [instances, setInstances] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [pods, setPods] = useState([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [instancesRes, podsRes] = await Promise.all([
          queryService.getInstances(),
          queryService.getPods(),
        ]);
        
        setInstances(instancesRes.data || []);
        setPods(podsRes.data || []);
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load form data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Load databases when instance changes
  useEffect(() => {
    const loadDatabases = async () => {
      if (!formData.instanceId) {
        setDatabases([]);
        return;
      }

      setLoadingDatabases(true);
      try {
        const response = await queryService.getDatabases(formData.instanceId);
        setDatabases(response.data?.databases || []);
      } catch (error) {
        console.error('Error loading databases:', error);
        toast.error('Failed to load databases');
        setDatabases([]);
      } finally {
        setLoadingDatabases(false);
      }
    };

    loadDatabases();
    setFormData((prev) => ({ ...prev, databaseName: '' }));
  }, [formData.instanceId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileSelect = (file) => {
    if (!file) return;
    
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

  const handleFileInput = (e) => {
    handleFileSelect(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e) => {
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

  const handleReset = () => {
    setFormData({
      instanceId: '',
      databaseName: '',
      comments: '',
      query: '',
      podId: '',
    });
    setSelectedFile(null);
    setDatabases([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Common validation
    if (!formData.instanceId || !formData.databaseName || !formData.podId || !formData.comments) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Type-specific validation
    if (submissionType === 'query' && !formData.query) {
      toast.error('Please enter a query');
      return;
    }
    if (submissionType === 'script' && !selectedFile) {
      toast.error('Please upload a script file');
      return;
    }

    setSubmitting(true);
    try {
      const instance = instances.find((i) => i.id === formData.instanceId);
      const pod = pods.find((p) => p.id === formData.podId);

      if (submissionType === 'query') {
        const submitData = {
          instanceId: formData.instanceId,
          instanceName: instance?.name || formData.instanceId,
          databaseType: instance?.type || 'postgresql',
          databaseName: formData.databaseName,
          submissionType: 'query',
          queryContent: formData.query,
          comments: formData.comments,
          podId: formData.podId,
          podName: pod?.name || formData.podId,
        };

        await queryService.submitQuery(submitData);
        toast.success('Query submitted successfully!');
      } else {
        const submitFormData = new FormData();
        submitFormData.append('instanceId', formData.instanceId);
        submitFormData.append('instanceName', instance?.name || formData.instanceId);
        submitFormData.append('databaseType', instance?.type || 'postgresql');
        submitFormData.append('databaseName', formData.databaseName);
        submitFormData.append('submissionType', 'script');
        submitFormData.append('comments', formData.comments);
        submitFormData.append('podId', formData.podId);
        submitFormData.append('podName', pod?.name || formData.podId);
        submitFormData.append('script', selectedFile);

        await queryService.submitScript(submitFormData);
        toast.success('Script submitted successfully!');
      }
      
      handleReset();
      navigate('/queries');
    } catch (error) {
      console.error('Submit error:', error);
      const message = error.response?.data?.message || `Failed to submit ${submissionType}`;
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
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
            onClick={() => setShowDocs(!showDocs)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              showDocs 
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
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              submissionType === 'query'
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
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              submissionType === 'script'
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
              {/* Instance Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instance Name <span className="text-red-500">*</span>
                </label>
                <select
                  name="instanceId"
                  value={formData.instanceId}
                  onChange={handleChange}
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
                    name="databaseName"
                    value={formData.databaseName}
                    onChange={handleChange}
                    className="select-field"
                    required
                    disabled={!formData.instanceId || loadingDatabases}
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
                  name="podId"
                  value={formData.podId}
                  onChange={handleChange}
                  className="select-field"
                  required
                >
                  <option value="">Select POD</option>
                  {pods.map((pod) => (
                    <option key={pod.id} value={pod.id}>{pod.name}</option>
                  ))}
                </select>
              </div>

              {/* Comments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Comments <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="comments"
                  value={formData.comments}
                  onChange={handleChange}
                  placeholder={submissionType === 'query' 
                    ? "Describe the purpose of this query..." 
                    : "Describe what this script does..."}
                  rows={3}
                  className="textarea-field"
                  required
                />
              </div>

              {/* Query Input - Only for query type */}
              {submissionType === 'query' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Database Query <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="query"
                    value={formData.query}
                    onChange={handleChange}
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
                        JavaScript (.js) files only (max 16MB)
                      </p>
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".js"
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
          </div>
        )}
      </div>
    </div>
  );
};

export default QuerySubmissionPage;
