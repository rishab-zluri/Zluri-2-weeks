import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Send, RotateCcw, Loader2 } from 'lucide-react';
import { queryService } from '../services';
import { Loading } from '../components/common';
import toast from 'react-hot-toast';

const QuerySubmissionPage = () => {
  const navigate = useNavigate();
  
  // Form state
  const [formData, setFormData] = useState({
    instanceId: '',
    databaseName: '',
    comments: '',
    query: '',
    podId: '',
  });
  
  // Data state
  const [instances, setInstances] = useState([]);
  const [databases, setDatabases] = useState([]);
  const [pods, setPods] = useState([]);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDatabases, setLoadingDatabases] = useState(false);

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
        // API returns { data: { databases: [...] } }
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
    // Reset database selection when instance changes
    setFormData((prev) => ({ ...prev, databaseName: '' }));
  }, [formData.instanceId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    setFormData({
      instanceId: '',
      databaseName: '',
      comments: '',
      query: '',
      podId: '',
    });
    setDatabases([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.instanceId || !formData.databaseName || !formData.query || !formData.podId || !formData.comments) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Get instance details
      const instance = instances.find((i) => i.id === formData.instanceId);
      const pod = pods.find((p) => p.id === formData.podId);

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
      handleReset();
      navigate('/queries');
    } catch (error) {
      console.error('Submit error:', error);
      const message = error.response?.data?.message || 'Failed to submit query';
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
    <div className="max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Query Submission Portal</h1>
        <p className="text-gray-500 mt-1">Submit database queries for approval and execution</p>
      </div>

      {/* Form Card */}
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Instance Selection */}
          <div>
            <label htmlFor="instanceId" className="block text-sm font-medium text-gray-700 mb-2">
              Instance Name <span className="text-red-500">*</span>
            </label>
            <select
              id="instanceId"
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
            <label htmlFor="databaseName" className="block text-sm font-medium text-gray-700 mb-2">
              Database Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="databaseName"
                name="databaseName"
                value={formData.databaseName}
                onChange={handleChange}
                className="select-field"
                required
                disabled={!formData.instanceId || loadingDatabases}
              >
                <option value="">Select Database Name</option>
                {databases.map((db) => (
                  <option key={db} value={db}>
                    {db}
                  </option>
                ))}
              </select>
              {loadingDatabases && (
                <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
              )}
            </div>
          </div>

          {/* Comments */}
          <div>
            <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-2">
              Comments <span className="text-red-500">*</span>
            </label>
            <textarea
              id="comments"
              name="comments"
              value={formData.comments}
              onChange={handleChange}
              placeholder="Describe the purpose of this query..."
              rows={3}
              className="textarea-field"
              required
            />
          </div>

          {/* Query Input */}
          <div>
            <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
              SQL/MongoDB Query <span className="text-red-500">*</span>
            </label>
            <textarea
              id="query"
              name="query"
              value={formData.query}
              onChange={handleChange}
              placeholder="SELECT * FROM table_name WHERE..."
              rows={8}
              className="textarea-field font-mono text-sm"
              required
            />
          </div>

          {/* POD Selection */}
          <div>
            <label htmlFor="podId" className="block text-sm font-medium text-gray-700 mb-2">
              POD Name <span className="text-red-500">*</span>
            </label>
            <select
              id="podId"
              name="podId"
              value={formData.podId}
              onChange={handleChange}
              className="select-field"
              required
            >
              <option value="">Select POD</option>
              {pods.map((pod) => (
                <option key={pod.id} value={pod.id}>
                  {pod.name}
                </option>
              ))}
            </select>
          </div>

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
                  Submit Query
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
  );
};

export default QuerySubmissionPage;
