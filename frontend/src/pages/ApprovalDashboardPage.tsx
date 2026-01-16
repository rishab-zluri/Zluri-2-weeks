import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Database,
  User,
  Loader2,
  Filter
} from 'lucide-react';
import {
  useRequests,
  usePods,
  useRequest,
  useApproveRequest,
  useRejectRequest
} from '@/hooks';
import { Loading, StatusBadge, EmptyState, Modal } from '@/components/common';
import { QueryRequest, RequestStatus } from '@/types';

const ApprovalDashboardPage: React.FC = () => {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPod, setFilterPod] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Debounced search could be implemented, for now direct passing

  // Data Fetching
  const filterParams: any = {
    page,
    limit,
    status: RequestStatus.PENDING
  };
  if (filterPod) filterParams.podId = filterPod;
  // Backend unified endpoint supports generic search (userId, comments, etc) check if `search` param is supported.
  // Yes, generic `search` param was added to `getAllRequests` (which is what `useRequests` calls).
  if (searchQuery) filterParams.search = searchQuery;

  const {
    data: requestsData,
    isLoading: loading
  } = useRequests(filterParams);

  // Fetch only managed pods? The service call `getPods({ forApproval: true })` was used.
  // We can create a specialized hook or just assume `usePods` fetches all and we filter if needed, 
  // or pass params to `usePods`.
  // Let's assume standard `usePods` is fine for filtering dropdown for now.
  const { data: pods = [] } = usePods();

  // Mutations
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const actionLoading = approveMutation.isPending || rejectMutation.isPending;

  // Modal state
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  // We need to keep track of which request is being rejected if modal is separate from details
  // But usually we reject from details or list.
  // Let's just use `selectedUuid` for both details and reject actions context.

  // Fetch details on demand
  const { data: selectedRequest } = useRequest(selectedUuid || undefined);

  const requests = requestsData?.data || [];
  const totalPages = requestsData?.pagination?.totalPages || 1;

  // Handlers
  const handleViewDetails = (uuid: string) => {
    setSelectedUuid(uuid);
  };

  const handleApprove = async (uuid: string) => {
    if (confirm('Are you sure you want to approve this request?')) {
      await approveMutation.mutateAsync({ uuid });
      setSelectedUuid(null); // Close modal if open
    }
  };

  const openRejectModal = (uuid: string) => {
    setSelectedUuid(uuid);
    setShowRejectModal(true);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!selectedUuid) return;
    await rejectMutation.mutateAsync({ uuid: selectedUuid, reason: rejectReason });
    setShowRejectModal(false);
    setSelectedUuid(null); // Close details modal too if open
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading text="Loading pending requests..." />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Approval Dashboard</h1>
        <p className="text-gray-500 mt-1">Review and approve pending query requests</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by user, query, or comments..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 
                         focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* POD Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterPod}
              onChange={(e) => {
                setFilterPod(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 
                       focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">All PODs</option>
              {pods.map((pod: any) => (
                <option key={pod.id} value={pod.id}>{pod.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="card">
        {requests.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No pending requests"
            description="All requests have been reviewed"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">Database</th>
                    <th className="pb-3 font-medium">ID</th>
                    <th className="pb-3 font-medium">Queries</th>
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">POD</th>
                    <th className="pb-3 font-medium">Comments</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((request: QueryRequest) => (
                    <tr key={request.uuid} className="hover:bg-gray-50">
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{request.instanceName}</p>
                            <p className="text-xs text-gray-500">{request.databaseType}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 text-sm font-mono text-gray-600">
                        #{request.uuid?.substring(0, 8)}
                      </td>
                      <td className="py-4">
                        <p className="text-sm text-gray-600 font-mono truncate max-w-xs">
                          {request.queryContent?.substring(0, 50) || (request as any).scriptFilename || 'N/A'}...
                        </p>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{(request as any).userEmail || 'User'}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          {request.podName}
                        </span>
                      </td>
                      <td className="py-4">
                        <p className="text-sm text-gray-600 truncate max-w-xs">
                          {request.comments}
                        </p>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewDetails(request.uuid)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={() => handleApprove(request.uuid)}
                            disabled={actionLoading}
                            className="p-2 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Approve"
                          >
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={() => openRejectModal(request.uuid)}
                            disabled={actionLoading}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination (Simple Implementation) */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-4 gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm">Prev</button>
                <span className="self-center text-sm">Page {page} of {totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm">Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedUuid && !showRejectModal} // Hide if reject modal is taking over, or handle layers
        onClose={() => setSelectedUuid(null)}
        title="Request Details"
        size="lg"
      >
        {selectedRequest ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Request ID</label>
                <p className="font-mono text-sm">#{selectedRequest.id}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Status</label>
                <div className="mt-1">
                  <StatusBadge status={selectedRequest.status} />
                </div>
              </div>
              {/* Add more fields as needed */}
            </div>

            <div>
              <label className="text-sm text-gray-500">Query/Script</label>
              <pre className="mt-1 p-3 bg-gray-900 text-green-400 rounded-lg text-sm overflow-x-auto max-h-64">
                {selectedRequest.queryContent || (selectedRequest as any).scriptContent || 'N/A'}
              </pre>
            </div>

            {/* Action Buttons in Modal */}
            {selectedRequest.status === RequestStatus.PENDING && (
              <div className="flex items-center gap-4 pt-4 border-t">
                <button
                  onClick={() => handleApprove(selectedRequest.uuid)}
                  disabled={actionLoading}
                  className="btn-success flex items-center gap-2"
                >
                  {actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  Approve
                </button>
                <button
                  onClick={() => openRejectModal(selectedRequest.uuid)}
                  disabled={actionLoading}
                  className="btn-danger flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </div>
            )}
          </div>
        ) : <Loading />}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Request"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to reject this request? Please provide a reason (optional).
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Please add WHERE clause to prevent full table scan..."
              rows={3}
              className="textarea-field w-full rounded border p-2"
            />
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="btn-danger flex items-center gap-2"
            >
              {actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              Reject Request
            </button>
            <button
              onClick={() => setShowRejectModal(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ApprovalDashboardPage;
