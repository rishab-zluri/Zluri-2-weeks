import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  CheckCircle2, 
  XCircle, 
  Eye,
  Database,
  User,
  Clock,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Filter
} from 'lucide-react';
import { queryService } from '../services';
import { Loading, StatusBadge, EmptyState, Modal } from '../components/common';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const ApprovalDashboardPage = () => {
  const { user } = useAuth();
  
  // Data state
  const [requests, setRequests] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPod, setFilterPod] = useState('');
  const [pods, setPods] = useState([]);
  
  // Loading state
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const params = {
        page,
        limit: 10,
        status: 'pending',
      };
      
      if (filterPod) {
        params.podId = filterPod;
      }
      
      if (searchQuery) {
        params.search = searchQuery;
      }

      const response = await queryService.getPendingRequests(params);
      setRequests(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Failed to load pending requests');
    }
  }, [page, filterPod, searchQuery]);

  const fetchPods = async () => {
    try {
      // Pass forApproval=true to get only managed pods for managers
      const response = await queryService.getPods({ forApproval: true });
      setPods(response.data || []);
    } catch (error) {
      console.error('Error fetching pods:', error);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRequests(), fetchPods()]);
      setLoading(false);
    };
    loadData();
  }, [fetchRequests]);

  // View request details
  const handleViewDetails = async (uuid) => {
    try {
      const response = await queryService.getRequest(uuid);
      setSelectedRequest(response.data);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Error fetching details:', error);
      toast.error('Failed to load request details');
    }
  };

  // Approve request
  const handleApprove = async (uuid) => {
    setActionLoading(true);
    try {
      await queryService.approveRequest(uuid);
      toast.success('Request approved successfully');
      setShowDetailModal(false);
      fetchRequests();
    } catch (error) {
      console.error('Approve error:', error);
      toast.error('Failed to approve request');
    } finally {
      setActionLoading(false);
    }
  };

  // Open reject modal
  const openRejectModal = (request) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
    setRejectReason('');
  };

  // Reject request
  const handleReject = async () => {
    if (!selectedRequest) return;
    
    setActionLoading(true);
    try {
      await queryService.rejectRequest(selectedRequest.uuid, rejectReason || null);
      toast.success('Request rejected');
      setShowRejectModal(false);
      setShowDetailModal(false);
      fetchRequests();
    } catch (error) {
      console.error('Reject error:', error);
      toast.error('Failed to reject request');
    } finally {
      setActionLoading(false);
    }
  };

  // Search handler with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchRequests();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
              {pods.map((pod) => (
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
                  {requests.map((request) => (
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
                        #{request.id}
                      </td>
                      <td className="py-4">
                        <p className="text-sm text-gray-600 font-mono truncate max-w-xs">
                          {request.queryContent?.substring(0, 50) || request.scriptFilename || 'N/A'}...
                        </p>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">{request.userEmail}</span>
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
                            className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                            title="Approve"
                          >
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                          </button>
                          <button
                            onClick={() => openRejectModal(request)}
                            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
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
        title="Request Details"
        size="lg"
      >
        {selectedRequest && (
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
              <div>
                <label className="text-sm text-gray-500">Requester</label>
                <p className="font-medium">{selectedRequest.userName || selectedRequest.userEmail}</p>
                <p className="text-sm text-gray-500">{selectedRequest.userEmail}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">POD</label>
                <p className="font-medium">{selectedRequest.podName}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Database</label>
                <p className="font-medium">{selectedRequest.instanceName}</p>
                <p className="text-sm text-gray-500">{selectedRequest.databaseName}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Type</label>
                <p className="capitalize">{selectedRequest.submissionType} ({selectedRequest.databaseType})</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Submitted</label>
                <p className="text-sm">{format(new Date(selectedRequest.createdAt), 'PPpp')}</p>
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500">Comments</label>
              <p className="mt-1 p-3 bg-gray-50 rounded-lg text-gray-700">{selectedRequest.comments}</p>
            </div>

            <div>
              <label className="text-sm text-gray-500">Query/Script</label>
              <pre className="mt-1 p-3 bg-gray-900 text-green-400 rounded-lg text-sm overflow-x-auto max-h-64">
                {selectedRequest.queryContent || selectedRequest.scriptContent || 'N/A'}
              </pre>
            </div>

            {/* Action Buttons */}
            {selectedRequest.status === 'pending' && (
              <div className="flex items-center gap-4 pt-4 border-t">
                <button
                  onClick={() => handleApprove(selectedRequest.uuid)}
                  disabled={actionLoading}
                  className="btn-success flex items-center gap-2"
                >
                  {actionLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Approve
                </button>
                <button
                  onClick={() => openRejectModal(selectedRequest)}
                  disabled={actionLoading}
                  className="btn-danger flex items-center gap-2"
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
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
              className="textarea-field"
            />
          </div>

          <div className="flex items-center gap-4 pt-4">
            <button
              onClick={handleReject}
              disabled={actionLoading}
              className="btn-danger flex items-center gap-2"
            >
              {actionLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
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
