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
  X,
  AlertTriangle,
  Shield,
  AlertCircle,
  Copy
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
import toast from 'react-hot-toast';
import queryService, { QueryAnalysis } from '@/services/queryService';



type TabType = 'pending' | 'processed';

const ApprovalDashboardPage: React.FC = () => {
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('pending');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  // Temporary filter states (not applied until "Apply" clicked)
  const [showFilters, setShowFilters] = useState(false);
  const [tempDateFrom, setTempDateFrom] = useState('');
  const [tempDateTo, setTempDateTo] = useState('');
  const [tempFilterPod, setTempFilterPod] = useState('');
  const [tempFilterType, setTempFilterType] = useState('');
  
  // Applied filter states (actually used in API calls)
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterPod, setFilterPod] = useState('');
  const [filterType, setFilterType] = useState('');
  
  // Date validation error
  const [dateError, setDateError] = useState('');

  // Mutations
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const actionLoading = approveMutation.isPending || rejectMutation.isPending;

  // Modal state
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const { data: selectedRequest } = useRequest(selectedUuid || undefined);

  // Risk analysis state
  const [queryAnalysis, setQueryAnalysis] = useState<QueryAnalysis | null>(null);
  const [analyzingQuery, setAnalyzingQuery] = useState(false);

  // Analyze query/script when viewing a request
  useEffect(() => {
    const analyzeRequest = async () => {
      // Analyze both queries and scripts - both contain SQL/MongoDB commands
      const contentToAnalyze = selectedRequest?.queryContent || selectedRequest?.scriptContent;

      if (contentToAnalyze) {
        setAnalyzingQuery(true);
        try {
          // Default to postgresql if databaseType is missing (for old requests)
          const dbType = selectedRequest.databaseType || 'postgresql';
          const analysis = await queryService.analyzeQuery(
            contentToAnalyze,
            dbType
          );
          setQueryAnalysis(analysis);
        } catch (error) {
          console.error('Query/script analysis failed:', error);
          setQueryAnalysis(null);
        } finally {
          setAnalyzingQuery(false);
        }
      } else {
        setQueryAnalysis(null);
      }
    };

    if (selectedRequest) {
      analyzeRequest();
    }
  }, [selectedRequest]);

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

  // Reset page on filter change or tab change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterPod, dateFrom, dateTo, filterType, activeTab]);

  // Build filter params based on active tab
  const commonFilters: any = { page, limit };
  
  // Set status based on active tab
  if (activeTab === 'pending') {
    commonFilters.status = 'pending';
  } else {
    // Processed tab shows approved, rejected, completed, failed, executing
    commonFilters.status = 'approved,rejected,completed,failed,executing';
  }
  
  if (debouncedSearch) commonFilters.search = debouncedSearch;
  if (dateFrom) commonFilters.fromDate = dateFrom;
  if (dateTo) commonFilters.toDate = dateTo;
  if (filterType) commonFilters.submissionType = filterType;

  // Data Fetching: Approvals (Incoming)
  const approvalsFilters = { ...commonFilters };
  if (filterPod) approvalsFilters.podId = filterPod;

  const {
    data: approvalsData,
    isLoading: loadingApprovals,
    isRefetching: refreshingApprovals
  } = useRequests(approvalsFilters);

  const { data: pods = [] } = usePods();

  // Data Assignment
  const currentData = approvalsData;
  const loading = loadingApprovals || refreshingApprovals;
  const requests = currentData?.data || [];
  const totalPages = currentData?.pagination?.totalPages || 1;

  // Handlers
  const handleViewDetails = (uuid: string) => setSelectedUuid(uuid);

  const openApproveModal = (uuid: string) => {
    setSelectedUuid(uuid);
    setShowApproveModal(true);
  };

  const handleApprove = async () => {
    if (!selectedUuid) return;
    await approveMutation.mutateAsync({ uuid: selectedUuid });
    setShowApproveModal(false);
    setSelectedUuid(null);
  };

  const openRejectModal = (uuid: string) => {
    setSelectedUuid(uuid);
    setShowRejectModal(true);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!selectedUuid) return;
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    await rejectMutation.mutateAsync({ uuid: selectedUuid, reason: rejectReason.trim() });
    setShowRejectModal(false);
    setSelectedUuid(null);
  };

  const handleClearFilters = () => {
    setTempDateFrom('');
    setTempDateTo('');
    setTempFilterPod('');
    setTempFilterType('');
    setDateError('');
    // Also clear applied filters
    setDateFrom('');
    setDateTo('');
    setSearchInput('');
    setFilterPod('');
    setFilterType('');
  };

  const handleApplyFilters = () => {
    // Validate dates
    if (tempDateFrom && tempDateTo) {
      const fromDate = new Date(tempDateFrom);
      const toDate = new Date(tempDateTo);
      
      if (fromDate > toDate) {
        setDateError('Start date cannot be after end date');
        toast.error('Start date cannot be after end date');
        return;
      }
    }
    
    // Clear any previous error
    setDateError('');
    
    // Apply the temporary filters to actual filter states
    setDateFrom(tempDateFrom);
    setDateTo(tempDateTo);
    setFilterPod(tempFilterPod);
    setFilterType(tempFilterType);
    
    // Close the dropdown
    setShowFilters(false);
    setPage(1);
  };
  
  // Sync temp filters when opening dropdown
  useEffect(() => {
    if (showFilters) {
      setTempDateFrom(dateFrom);
      setTempDateTo(dateTo);
      setTempFilterPod(filterPod);
      setTempFilterType(filterType);
      setDateError('');
    }
  }, [showFilters]);

  // Helper to update search input directly
  const setSearchInput = (val: string) => setSearchQuery(val);

  // Count active filters
  const activeFilterCount = (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (filterPod ? 1 : 0) + (filterType ? 1 : 0);

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Requests</h1>
          <p className="text-gray-500 mt-1">Manage approvals and view processed requests</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'pending'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Pending Approvals
            {activeTab === 'pending' && requests.length > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-600 rounded-full text-xs font-semibold">
                {requests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('processed')}
            className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'processed'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Processed Requests
          </button>
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
              placeholder={activeTab === 'pending' ? 'Search pending requests...' : 'Search processed requests...'}
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
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Requests for My Pods</label>
                    <p className="text-xs text-gray-500 mb-2">Filter requests submitted to your managed pods</p>
                    <select
                      value={tempFilterPod}
                      onChange={(e) => setTempFilterPod(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">All Managed Pods</option>
                      {pods.map((pod: any) => (
                        <option key={pod.id} value={pod.id}>{pod.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Type Filter */}
                  <div className="p-4 border-b">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Filter by Type</label>
                    <select
                      value={tempFilterType}
                      onChange={(e) => setTempFilterType(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">All Types</option>
                      <option value="query">Query</option>
                      <option value="script">Script</option>
                    </select>
                  </div>

                  {/* Date Range Filters */}
                  <div className="p-4 border-b">
                    <label className="text-sm font-medium text-gray-700 mb-3 block">Date Range</label>
                    {dateError && (
                      <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                        {dateError}
                      </div>
                    )}
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">From</label>
                        <input
                          type="date"
                          value={tempDateFrom}
                          onChange={(e) => {
                            setTempDateFrom(e.target.value);
                            setDateError('');
                          }}
                          className={`w-full px-3 py-2 border rounded-lg text-sm ${dateError ? 'border-red-300' : 'border-gray-200'}`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">To</label>
                        <input
                          type="date"
                          value={tempDateTo}
                          onChange={(e) => {
                            setTempDateTo(e.target.value);
                            setDateError('');
                          }}
                          className={`w-full px-3 py-2 border rounded-lg text-sm ${dateError ? 'border-red-300' : 'border-gray-200'}`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Apply Button */}
                  <div className="p-4">
                    <button
                      onClick={handleApplyFilters}
                      className="w-full btn-primary py-2.5 text-sm font-medium"
                    >
                      Apply Filters
                    </button>
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
            title={activeTab === 'pending' ? 'No pending approvals' : 'No processed requests'}
            description={activeTab === 'pending' ? "You're all caught up!" : "No requests have been processed yet"}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-3 font-medium">ID</th>
                    <th className="pb-3 font-medium">Database</th>
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">POD</th>
                    {activeTab === 'processed' && <th className="pb-3 font-medium">Processed By</th>}
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((request: QueryRequest) => (
                    <tr
                      key={request.uuid}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleViewDetails(request.uuid)}
                    >
                      {/* ID */}
                      <td className="py-4 text-sm font-mono text-gray-600">
                        #{request.id}
                      </td>

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
                          <span className="text-sm text-gray-600">
                            {request.userEmail || request.user?.email || 'Unknown'}
                          </span>
                        </div>
                      </td>

                      {/* Pod */}
                      <td className="py-4">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          {request.podName}
                        </span>
                      </td>

                      {/* Processed By (only in processed tab) */}
                      {activeTab === 'processed' && (
                        <td className="py-4">
                          {request.approver ? (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {request.approver.email || request.approver.name || 'Unknown'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">N/A</span>
                          )}
                        </td>
                      )}

                      {/* Date */}
                      <td className="py-4 text-sm text-gray-600">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </td>

                      {/* Actions - Only View button */}
                      <td className="py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewDetails(request.uuid)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
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
        isOpen={!!selectedUuid && !showRejectModal && !showApproveModal}
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

            {/* Rejection Reason (if rejected) */}
            {selectedRequest.status === RequestStatus.REJECTED && selectedRequest.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <label className="text-sm font-medium text-red-800 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Rejection Reason
                </label>
                <p className="text-red-700 mt-2">{selectedRequest.rejectionReason}</p>
              </div>
            )}

            {/* Approver Info (if approved/rejected) */}
            {(selectedRequest.status === RequestStatus.APPROVED || 
              selectedRequest.status === RequestStatus.REJECTED ||
              selectedRequest.status === RequestStatus.COMPLETED ||
              selectedRequest.status === RequestStatus.FAILED ||
              selectedRequest.status === RequestStatus.EXECUTING) && 
              selectedRequest.approver && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <label className="text-sm font-medium text-gray-700">Processed By</label>
                <div className="flex items-center gap-2 mt-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-900">
                    {selectedRequest.approver.name || selectedRequest.approver.email}
                  </span>
                  <span className="text-gray-500 text-sm">
                    ({selectedRequest.approver.role})
                  </span>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-500">
                  {selectedRequest.submissionType === 'script' ? 'Script Content' : 'Query Content'}
                  {(selectedRequest.queryContent || selectedRequest.scriptContent) && (
                    <span className="ml-2 text-xs text-gray-400">
                      ({(selectedRequest.queryContent?.length || selectedRequest.scriptContent?.length || 0).toLocaleString()} chars)
                    </span>
                  )}
                </label>
                <button
                  onClick={async () => {
                    const content = selectedRequest.queryContent || selectedRequest.scriptContent || '';
                    try {
                      if (!navigator.clipboard) {
                        toast.error('Clipboard not available in this browser');
                        return;
                      }
                      await navigator.clipboard.writeText(content);
                      toast.success('Copied to clipboard!');
                    } catch (err) {
                      console.error('Clipboard error:', err);
                      toast.error('Failed to copy to clipboard');
                    }
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy
                </button>
              </div>
              <pre className="p-3 bg-gray-900 text-green-400 rounded-lg text-sm overflow-auto max-h-80 whitespace-pre-wrap break-words font-mono leading-relaxed">
                {selectedRequest.queryContent || selectedRequest.scriptContent || 'N/A'}
              </pre>
              {((selectedRequest.queryContent?.length || 0) > 2000 || (selectedRequest.scriptContent?.length || 0) > 2000) && (
                <p className="mt-1 text-xs text-gray-400 italic">
                  Scroll to see full content • Use "Copy" to get complete text
                </p>
              )}
            </div>

            {/* Risk Analysis Section */}
            {(selectedRequest.queryContent || selectedRequest.scriptContent) && (
              <div className="border-t pt-4">
                <label className="text-sm text-gray-500 mb-3 block">Risk Analysis</label>

                {analyzingQuery && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Analyzing query...</span>
                  </div>
                )}

                {queryAnalysis && !analyzingQuery && (
                  <div className="space-y-4">
                    {/* Header with Risk Badge and Statement Count */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-600">Overall Risk:</span>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold inline-flex items-center gap-1.5 ${queryAnalysis.overallRisk === 'critical'
                            ? 'bg-red-100 text-red-700 border border-red-200'
                            : queryAnalysis.overallRisk === 'high'
                              ? 'bg-orange-100 text-orange-700 border border-orange-200'
                              : queryAnalysis.overallRisk === 'medium'
                                ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                                : queryAnalysis.overallRisk === 'low'
                                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                  : 'bg-green-100 text-green-700 border border-green-200'
                            }`}
                        >
                          {queryAnalysis.overallRisk === 'critical' && <AlertTriangle className="w-4 h-4" />}
                          {queryAnalysis.overallRisk === 'high' && <AlertCircle className="w-4 h-4" />}
                          {queryAnalysis.overallRisk === 'safe' && <Shield className="w-4 h-4" />}
                          {queryAnalysis.overallRisk.toUpperCase()}
                        </span>
                      </div>
                      {queryAnalysis.isMultiStatement && (
                        <span className="text-sm text-gray-500">
                          {queryAnalysis.statementCount} statements
                        </span>
                      )}
                    </div>

                    {/* Risk Breakdown (for multi-statement) */}
                    {queryAnalysis.isMultiStatement && queryAnalysis.riskBreakdown && (
                      <div className="bg-gray-50 rounded-lg p-3 border">
                        <p className="text-sm font-medium text-gray-700 mb-2">Risk Breakdown:</p>
                        <div className="flex flex-wrap gap-3 text-sm">
                          {queryAnalysis.riskBreakdown.critical > 0 && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md font-medium">
                              {queryAnalysis.riskBreakdown.critical} Critical
                            </span>
                          )}
                          {queryAnalysis.riskBreakdown.high > 0 && (
                            <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md font-medium">
                              {queryAnalysis.riskBreakdown.high} High
                            </span>
                          )}
                          {queryAnalysis.riskBreakdown.medium > 0 && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md font-medium">
                              {queryAnalysis.riskBreakdown.medium} Medium
                            </span>
                          )}
                          {queryAnalysis.riskBreakdown.low > 0 && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-medium">
                              {queryAnalysis.riskBreakdown.low} Low
                            </span>
                          )}
                          {queryAnalysis.riskBreakdown.safe > 0 && (
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md font-medium">
                              {queryAnalysis.riskBreakdown.safe} Safe
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Operations with Counts */}
                    {queryAnalysis.operationCounts && queryAnalysis.operationCounts.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 border">
                        <p className="text-sm font-medium text-gray-700 mb-2">Operations Breakdown:</p>
                        <div className="space-y-1">
                          {queryAnalysis.operationCounts.map((op, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0"
                            >
                              <span className="font-mono text-gray-700">{op.operation}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-gray-500">{op.count}x</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${op.risk === 'critical'
                                    ? 'bg-red-100 text-red-700'
                                    : op.risk === 'high'
                                      ? 'bg-orange-100 text-orange-700'
                                      : op.risk === 'medium'
                                        ? 'bg-yellow-100 text-yellow-700'
                                        : op.risk === 'low'
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-green-100 text-green-700'
                                    }`}
                                >
                                  {op.risk}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fallback: Show operations without counts for backward compatibility */}
                    {!queryAnalysis.operationCounts && queryAnalysis.operations.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3 border">
                        <p className="text-sm font-medium text-gray-700 mb-2">Detected Operations:</p>
                        <div className="flex flex-wrap gap-2">
                          {queryAnalysis.operations.map((op, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 rounded text-xs font-medium ${op.risk === 'critical'
                                ? 'bg-red-100 text-red-700'
                                : op.risk === 'high'
                                  ? 'bg-orange-100 text-orange-700'
                                  : op.risk === 'medium'
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : op.risk === 'low'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-green-100 text-green-700'
                                }`}
                              title={op.description}
                            >
                              {op.operation} ({op.risk})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings with Line Numbers */}
                    {queryAnalysis.warnings.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-amber-800 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" />
                          Warnings ({queryAnalysis.warnings.length}):
                        </p>
                        <ul className="space-y-2 max-h-48 overflow-y-auto">
                          {queryAnalysis.warnings.map((warning, idx) => (
                            <li key={idx} className="text-sm">
                              <div className="flex items-start gap-2">
                                <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${warning.level === 'critical' ? 'bg-red-500' :
                                  warning.level === 'high' ? 'bg-orange-500' :
                                    warning.level === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
                                  }`} />
                                <div>
                                  <span className="text-amber-700">{warning.message}</span>
                                  {warning.suggestion && (
                                    <p className="text-amber-600 text-xs mt-0.5">
                                      💡 {warning.suggestion}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {queryAnalysis.recommendations && queryAnalysis.recommendations.length > 0 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm font-medium text-blue-800 mb-2">
                          📋 Recommendations:
                        </p>
                        <ul className="space-y-1">
                          {queryAnalysis.recommendations.slice(0, 4).map((rec, idx) => (
                            <li key={idx} className="text-sm text-blue-700 flex items-start gap-2">
                              <span className={`mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${rec.priority === 'high' ? 'bg-red-100 text-red-600' :
                                rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600'
                                }`}>
                                {rec.priority.toUpperCase()}
                              </span>
                              <span>{rec.action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Summary */}
                    <div className="bg-gray-100 rounded-lg p-3">
                      <p className="text-sm font-mono text-gray-700">{queryAnalysis.summary}</p>
                    </div>
                  </div>
                )}

                {!queryAnalysis && !analyzingQuery && (
                  <p className="text-sm text-gray-500 italic">Unable to analyze content.</p>
                )}
              </div>
            )}

            {/* Action Buttons in Modal (Only if Pending) */}
            {selectedRequest.status === RequestStatus.PENDING && (
              <div className="flex items-center gap-4 pt-4 border-t">
                <button
                  onClick={() => openApproveModal(selectedRequest.uuid)}
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

      {/* Approve Confirmation Modal */}
      <Modal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Confirm Approval"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Are you sure you want to approve this request? This action cannot be undone.
          </p>
          <div className="flex items-center gap-4 pt-4">
            <button
              onClick={handleApprove}
              disabled={actionLoading}
              className="btn-success flex items-center gap-2"
            >
              {actionLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirm Approval
            </button>
            <button
              onClick={() => setShowApproveModal(false)}
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
