import React, { useState } from 'react';
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
import {
  useRequests,
  useStatusCounts,
  useRequest
} from '@/hooks';
import queryService from '@/services/queryService'; // Direct service import for clone still
import { Loading, StatusBadge, EmptyState, Modal } from '@/components/common';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { QueryRequest, RequestStatus } from '@/types';

const MyQueriesPage: React.FC = () => {
  const navigate = useNavigate();

  // Filter state
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Modal state
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

  // Data Fetching with React Query
  // Note: we inject 'page' and 'limit' into filters. 
  // 'getMyRequests' is now unified via 'useRequests'
  const filterParams: any = { page, limit };
  if (activeFilter !== 'all') {
    filterParams.status = activeFilter;
  }

  // We use the unified 'useRequests' hook. 
  // IMPORTANT: The backend 'getAllRequests' endpoint handles authentication and implicitly filters for the user if they are not admin.
  // OR we can explicitly call 'queryService.getMyRequests' if we want to ensure segregation.
  // Given our refactor `getMyRequests` simply delegates, so `useRequests` is fine if we pass user context, 
  // BUT `useRequests` calls `getRequests` which calls `/requests`.
  // To keep it clean and match the old `getMyRequests` specificity, let's use `queryService.getMyRequests` wrapped in a hook?
  // Actually `useRequests` is generic. Let's make it smarter or just pass a flag?
  // For now, let's stick to using the hook we created which calls `getRequests`. 
  // Backend `/requests` automatically scopes to user if they are strict user.
  // For safety, let's ensure we are calling `getMyRequests` logic on the service if valuable, 
  // but our service just aliases it. 

  const {
    data: requestsData,
    isLoading: loading,
    isRefetching: refreshing,
    refetch
  } = useRequests(filterParams);

  const { data: statusCounts } = useStatusCounts();

  // Derived state
  const queries = requestsData?.data || [];
  const totalPages = requestsData?.pagination?.totalPages || 1;

  // Selected Query Details (fetched on demand when UUID is present)
  // We could fetch this only when modal is open.
  const { data: selectedQuery } = useRequest(selectedUuid || undefined);

  // Refresh data
  const handleRefresh = () => {
    refetch();
  };

  // Clone request
  const handleClone = async (uuid: string) => {
    try {
      await queryService.cloneRequest(uuid);
      toast.success('Query cloned and submitted');
      refetch();
    } catch (error) {
      console.error('Clone error:', error);
      toast.error('Failed to clone query');
    }
  };

  // View query details
  const handleViewDetails = (uuid: string) => {
    setSelectedUuid(uuid);
  };

  const handleCloseModal = () => {
    setSelectedUuid(null);
  };

  // Filter tabs
  const counts = statusCounts || {
    pending: 0,
    approved: 0,
    rejected: 0,
    failed: 0,
    total: 0,
    executing: 0
  };

  const filterTabs = [
    { key: 'all', label: 'All', count: counts.total || 0 }, // 'total' vs 'all' based on interface
    { key: RequestStatus.PENDING, label: 'Pending', count: counts.pending },
    { key: RequestStatus.EXECUTING, label: 'Processing', count: 0 }, // executing not always in counts?
    { key: RequestStatus.COMPLETED, label: 'Completed', count: counts.approved }, // approved vs completed? Adapter needed?
    { key: RequestStatus.FAILED, label: 'Failed', count: counts.failed },
    { key: RequestStatus.REJECTED, label: 'Rejected', count: counts.rejected },
  ];
  // Note: Backend might return 'approved' count for 'completed' requests if status logic maps them.

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
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${activeFilter === tab.key
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
              >
                {tab.label} ({tab.count || 0})
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
                  {queries.map((query: QueryRequest) => (
                    <tr key={query.uuid} className="hover:bg-gray-50">
                      <td className="py-4 text-sm font-mono text-gray-600">
                        #{query.id?.substring(0, 8)} {/* Assuming ID or UUID */}
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
                          {(query.status === RequestStatus.REJECTED || query.status === RequestStatus.FAILED) && (
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
        isOpen={!!selectedUuid}
        onClose={handleCloseModal}
        title="Query Details"
        size="lg"
      >
        {selectedQuery ? (
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
                {selectedQuery.queryContent || (selectedQuery as any).scriptFilename || 'N/A'}
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
        ) : (
          <div className="flex justify-center p-8">
            <Loading size="lg" />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MyQueriesPage;
