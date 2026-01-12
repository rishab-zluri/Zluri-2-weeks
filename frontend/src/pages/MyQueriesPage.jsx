import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  RefreshCw, 
  Eye, 
  Copy, 
  FileText,
  Database,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { queryService } from '../services';
import { Loading, StatusBadge, EmptyState, Modal } from '../components/common';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const MyQueriesPage = () => {
  const navigate = useNavigate();
  
  // Data state
  const [queries, setQueries] = useState([]);
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    pending: 0,
    executing: 0,
    completed: 0,
    failed: 0,
    rejected: 0,
  });
  
  // Filter state
  const [activeFilter, setActiveFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Loading state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal state
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchQueries = useCallback(async () => {
    try {
      const params = {
        page,
        limit: 10,
      };
      
      if (activeFilter !== 'all') {
        params.status = activeFilter;
      }

      const response = await queryService.getMyRequests(params);
      setQueries(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching queries:', error);
      toast.error('Failed to load queries');
    }
  }, [page, activeFilter]);

  const fetchStatusCounts = useCallback(async () => {
    try {
      const response = await queryService.getMyStatusCounts();
      const counts = response.data || {};
      setStatusCounts({
        all: counts.total || 0,
        pending: counts.pending || 0,
        executing: counts.executing || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        rejected: counts.rejected || 0,
      });
    } catch (error) {
      console.error('Error fetching status counts:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchQueries(), fetchStatusCounts()]);
      setLoading(false);
    };
    loadData();
  }, [fetchQueries, fetchStatusCounts]);

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchQueries(), fetchStatusCounts()]);
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  // Clone request
  const handleClone = async (uuid) => {
    try {
      await queryService.cloneRequest(uuid);
      toast.success('Query cloned and submitted');
      handleRefresh();
    } catch (error) {
      console.error('Clone error:', error);
      toast.error('Failed to clone query');
    }
  };

  // View query details
  const handleViewDetails = async (uuid) => {
    try {
      const response = await queryService.getRequest(uuid);
      setSelectedQuery(response.data);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Failed to load query details');
    }
  };

  // Filter tabs
  const filterTabs = [
    { key: 'all', label: 'All', count: statusCounts.all },
    { key: 'pending', label: 'Pending', count: statusCounts.pending },
    { key: 'executing', label: 'Processing', count: statusCounts.executing },
    { key: 'completed', label: 'Completed', count: statusCounts.completed },
    { key: 'failed', label: 'Failed', count: statusCounts.failed },
    { key: 'rejected', label: 'Rejected', count: statusCounts.rejected },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading text="Loading your queries..." />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Queries</h1>
        <p className="text-gray-500 mt-1">Track the status of your submitted queries and file executions</p>
      </div>

      {/* Filter Tabs and Refresh */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveFilter(tab.key);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  activeFilter === tab.key
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 
                     text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Queries List */}
      <div className="card">
        {queries.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No queries found"
            description="Submit a query from the Query Requests page"
            action={
              <button
                onClick={() => navigate('/dashboard')}
                className="btn-primary"
              >
                Submit a Query
              </button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">ID</th>
                    <th className="pb-3 font-medium">Database</th>
                    <th className="pb-3 font-medium">Query Preview</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {queries.map((query) => (
                    <tr key={query.uuid} className="hover:bg-gray-50">
                      <td className="py-4 text-sm font-mono text-gray-600">
                        #{query.id}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{query.instanceName}</p>
                            <p className="text-xs text-gray-500">{query.databaseName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <p className="text-sm text-gray-600 font-mono truncate max-w-xs">
                          {query.queryContent || query.scriptFilename || 'N/A'}
                        </p>
                      </td>
                      <td className="py-4">
                        <StatusBadge status={query.status} />
                      </td>
                      <td className="py-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(query.createdAt), 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewDetails(query.uuid)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          {(query.status === 'rejected' || query.status === 'failed') && (
                            <button
                              onClick={() => handleClone(query.uuid)}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Clone & Resubmit"
                            >
                              <Copy className="w-4 h-4 text-gray-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6 pt-4 border-t">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Query Details"
        size="lg"
      >
        {selectedQuery && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedQuery.status} />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500">Request ID</label>
                <p className="font-mono text-sm">#{selectedQuery.id}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Database</label>
                <p className="font-medium">{selectedQuery.instanceName}</p>
                <p className="text-sm text-gray-500">{selectedQuery.databaseName}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">POD</label>
                <p className="font-medium">{selectedQuery.podName}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Submitted</label>
                <p className="text-sm">{format(new Date(selectedQuery.createdAt), 'PPpp')}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Type</label>
                <p className="capitalize">{selectedQuery.submissionType}</p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500">Comments</label>
              <p className="mt-1 text-gray-700">{selectedQuery.comments}</p>
            </div>

            <div>
              <label className="text-sm text-gray-500">Query/Script</label>
              <pre className="mt-1 p-3 bg-gray-900 text-green-400 rounded-lg text-sm overflow-x-auto">
                {selectedQuery.queryContent || selectedQuery.scriptContent || 'N/A'}
              </pre>
            </div>

            {selectedQuery.executionResult && (
              <div>
                <label className="text-sm text-gray-500">Execution Result</label>
                <pre className="mt-1 p-3 bg-gray-100 rounded-lg text-sm overflow-x-auto">
                  {selectedQuery.executionResult}
                </pre>
              </div>
            )}

            {selectedQuery.executionError && (
              <div>
                <label className="text-sm text-red-500">Execution Error</label>
                <pre className="mt-1 p-3 bg-red-50 text-red-700 rounded-lg text-sm overflow-x-auto">
                  {selectedQuery.executionError}
                </pre>
              </div>
            )}

            {selectedQuery.rejectionReason && (
              <div>
                <label className="text-sm text-gray-500">Rejection Reason</label>
                <p className="mt-1 p-3 bg-yellow-50 text-yellow-800 rounded-lg">
                  {selectedQuery.rejectionReason}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MyQueriesPage;
