import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Database,
  User,
  Loader2,
  Filter,
  X
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
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterPod, setFilterPod] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Mutations
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const actionLoading = approveMutation.isPending || rejectMutation.isPending;

  // Modal state
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const { data: selectedRequest } = useRequest(selectedUuid || undefined);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setShowFilters(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterPod, dateFrom, dateTo]);

  // Build filter params
  const commonFilters: any = { page, limit, status: 'pending' };
  if (debouncedSearch) commonFilters.search = debouncedSearch;
  if (dateFrom) commonFilters.fromDate = dateFrom;
  if (dateTo) commonFilters.toDate = dateTo;

  // Data Fetching: Approvals (Incoming)
  const approvalsFilters = { ...commonFilters };
  if (filterPod) approvalsFilters.podId = filterPod;

  const {
    data: approvalsData,
    isLoading: loadingApprovals
  } = useRequests(approvalsFilters);

  const { data: pods = [] } = usePods();

  // Data Assignment
  const currentData = approvalsData;
  const loading = loadingApprovals;
  const requests = currentData?.data || [];
  const totalPages = currentData?.pagination?.totalPages || 1;

  // Handlers
  const handleViewDetails = (uuid: string) => setSelectedUuid(uuid);

  const handleApprove = async (uuid: string) => {
    if (confirm('Are you sure you want to approve this request?')) {
      await approveMutation.mutateAsync({ uuid });
      setSelectedUuid(null);
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
    setSelectedUuid(null);
  };

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSearchInput('');
    setFilterPod('');
  };

  // Helper to update search input directly
  const setSearchInput = (val: string) => setSearchQuery(val);

  // Count active filters
  const activeFilterCount = (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (filterPod ? 1 : 0);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage approvals</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search requests to approve..."
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm 
                         focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Filter Button */}
            <div className="relative" ref={filterDropdownRef}>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-all ${activeFilterCount > 0
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-purple-600 text-white rounded-full">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Dropdown Panel */}
              {showFilters && (
                <div className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900">Filters</h3>
                    <button onClick={handleClearFilters} className="text-xs text-purple-600 font-medium hover:text-purple-700">
                      Clear All
                    </button>
                  </div>

                  {/* POD Filter */}
                  <div className="p-4 border-b">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Filter by Pod</label>
                    <select
                      value={filterPod}
                      onChange={(e) => setFilterPod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">All Managed Pods</option>
                      {pods.map((pod: any) => (
                        <option key={pod.id} value={pod.id}>{pod.name}</option>
                      ))}
                    </select>
                  </div>



                  {/* Date Range Filters */}
                  <div className="p-4">
                    <label className="text-sm font-medium text-gray-700 mb-3 block">Date Range</label>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">From</label>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">To</label>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loading text="Loading approvals..." />
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No pending approvals"
            description="You're all caught up!"
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">Database</th>
                    <th className="pb-3 font-medium">ID</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">POD</th>
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((request: QueryRequest) => (
                    <tr key={request.uuid} className="hover:bg-gray-50">
                      {/* Database Info */}
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{request.instanceName}</p>
                            <p className="text-xs text-gray-500">{request.databaseName}</p>
                          </div>
                        </div>
                      </td>

                      {/* ID */}
                      <td className="py-4 text-sm font-mono text-gray-600">
                        #{request.uuid?.substring(0, 8)}
                      </td>

                      {/* Type (Query/Script) */}
                      <td className="py-4">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${request.submissionType === 'script' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                          {request.submissionType === 'script' ? 'Script' : 'Query'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4">
                        <StatusBadge status={request.status} />
                      </td>

                      {/* User */}
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{(request as any).userEmail || 'User'}</span>
                        </div>
                      </td>

                      {/* Pod */}
                      <td className="py-4">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          {request.podName}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-4 text-sm text-gray-600">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewDetails(request.uuid)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>

                          {/* Only show Approve/Reject actions if Pending */}
                          {request.status === RequestStatus.PENDING && (
                            <>
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
                            </>
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
        isOpen={!!selectedUuid && !showRejectModal}
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
            </div>

            <div>
              <label className="text-sm text-gray-500">Comments</label>
              <p className="text-gray-900">{selectedRequest.comments}</p>
            </div>

            <div>
              <label className="text-sm text-gray-500">Query/Script Limit 500 chars</label>
              <pre className="mt-1 p-3 bg-gray-900 text-green-400 rounded-lg text-sm overflow-x-auto max-h-64 whitespace-pre-wrap break-all">
                {(selectedRequest.queryContent || (selectedRequest as any).scriptContent || 'N/A').substring(0, 500)}
                {((selectedRequest.queryContent?.length || 0) > 500 || ((selectedRequest as any).scriptContent?.length || 0) > 500) && '...'}
              </pre>
            </div>

            {/* Action Buttons in Modal (Only if Pending) */}
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
            Are you sure you want to reject this request? Please provide a reason.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Unsafe query structure..."
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
