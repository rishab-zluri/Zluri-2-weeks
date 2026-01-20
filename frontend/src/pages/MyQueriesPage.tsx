import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Eye,
  FileText,
  Database,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  X,
  Check,
  CheckCircle2,
  XCircle,
  User,
  Copy
} from 'lucide-react';
import {
  useMyRequests,
  useRequests, // For Approvals
  useRequest,
  usePods,
} from '@/hooks';
import { Loading, StatusBadge, EmptyState, Modal } from '@/components/common';
import { format } from 'date-fns';
import { QueryRequest } from '@/types';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

// Status options for filter
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'approved', label: 'Approved', color: 'blue' },
  { value: 'executing', label: 'Executing', color: 'purple' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'failed', label: 'Failed', color: 'red' },
  { value: 'rejected', label: 'Rejected', color: 'gray' },
];

type ViewMode = 'my-requests' | 'approvals' | 'history';

const MyQueriesPage: React.FC = () => {
  const navigate = useNavigate();
  const { isManager, user } = useAuth(); // Check role and get current user
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // View Mode - Default to 'my-requests'
  const [viewMode, setViewMode] = useState<ViewMode>('my-requests');

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 10;

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filter dropdown state - Temporary states (not applied until "Apply" clicked)
  const [showFilters, setShowFilters] = useState(false);
  const [tempSelectedStatuses, setTempSelectedStatuses] = useState<string[]>([]);
  const [tempDateFrom, setTempDateFrom] = useState('');
  const [tempDateTo, setTempDateTo] = useState('');
  const [tempFilterType, setTempFilterType] = useState('');
  
  // Applied filter states (actually used in API calls)
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterType, setFilterType] = useState('');
  
  // Date validation error
  const [dateError, setDateError] = useState('');

  // Modal state
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

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

  // Reset page and filters when switching modes
  useEffect(() => {
    setPage(1);
    setSelectedStatuses([]); // Reset status filter on mode change
  }, [viewMode]);

  // Build filter params
  const commonFilters: any = { page: page, limit: limit };
  if (debouncedSearch) commonFilters.search = debouncedSearch;
  if (dateFrom) commonFilters.fromDate = dateFrom;
  if (dateTo) commonFilters.toDate = dateTo;
  if (filterType) commonFilters.submissionType = filterType;

  // Status Filter Logic based on Mode
  if (viewMode === 'my-requests') {
    if (selectedStatuses.length > 0) commonFilters.status = selectedStatuses.join(',');
  } else if (viewMode === 'approvals') {
    // Force Pending for Approvals tab
    commonFilters.status = 'pending';
  } else if (viewMode === 'history') {
    // Default to all non-pending if no generic status selected
    // If user selected generic statuses, use those but exclude pending (or just trust user? lets exclude pending to be safe)
    if (selectedStatuses.length > 0) {
      commonFilters.status = selectedStatuses.filter(s => s !== 'pending').join(',');
    } else {
      commonFilters.status = 'approved,rejected,failed,executing,completed';
    }
  }

  // 1. My Requests Data
  const {
    data: myRequestsData,
    isLoading: loadingMyRequests,
    isRefetching: refreshingMyRequests,
    refetch: refetchMyRequests
  } = useMyRequests(commonFilters);

  // 2. Approvals/History Data (Only computed if Manager)
  const managerFilters: Record<string, any> = { ...commonFilters };
  // Note: We DON'T exclude manager's own requests in history
  // Managers should see ALL requests they've processed, including their own

  const {
    data: managerData,
    isLoading: loadingManager,
    isRefetching: refreshingManager,
    refetch: refetchManager
  } = useRequests(managerFilters, {
    enabled: isManager && (viewMode === 'approvals' || viewMode === 'history')
  });

  // Pods for filter (Only if Manager)
  const { data: pods = [] } = usePods({ enabled: isManager });

  // Select Data based on Mode
  const effectiveViewMode = isManager ? viewMode : 'my-requests';
  const currentData = effectiveViewMode === 'my-requests' ? myRequestsData : managerData;
  const loading = effectiveViewMode === 'my-requests' ? loadingMyRequests : loadingManager;
  const refreshing = effectiveViewMode === 'my-requests' ? refreshingMyRequests : refreshingManager;
  const refetch = effectiveViewMode === 'my-requests' ? refetchMyRequests : refetchManager;

  const queries = currentData?.data || [];
  const totalPages = currentData?.pagination?.totalPages || 1;

  // Handle Detail Fetch
  const { data: selectedQuery } = useRequest(selectedUuid || undefined);

  // Derived Heading
  const getFilterHeading = () => {
    if (selectedStatuses.length === 0) return 'All Requests';
    const labels = selectedStatuses.map(s => STATUS_OPTIONS.find(opt => opt.value === s)?.label || s);
    if (labels.length === 1) return `${labels[0]} Requests`;
    return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]} Requests`;
  };

  // Handlers
  const handleRefresh = () => refetch();

  const handleViewDetails = (uuid: string) => setSelectedUuid(uuid);
  const handleCloseModal = () => setSelectedUuid(null);

  // Clone request - navigate to submit page with pre-filled data
  const handleClone = async (query: QueryRequest) => {
    // Validate that the instance still exists before cloning
    try {
      // Check if instance exists by trying to fetch its databases
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/v1/databases/instances/${query.instanceId}/databases`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        toast.error(`Cannot clone: Instance "${query.instanceId}" no longer exists. Please create a new request.`);
        return;
      }
      
      // Store clone data in sessionStorage for the submit page to read
      const cloneData = {
        instanceId: query.instanceId,
        databaseName: query.databaseName,
        podId: query.podId,
        comments: query.comments,
        queryContent: query.queryContent || '',
        submissionType: query.submissionType,
      };
      sessionStorage.setItem('cloneRequestData', JSON.stringify(cloneData));
      navigate('/dashboard');
    } catch (error) {
      console.error('Clone validation error:', error);
      toast.error('Cannot clone this request. The instance may no longer exist.');
    }
  };

  // Check if a request belongs to the current user
  const isOwnRequest = (query: QueryRequest): boolean => {
    return query.user?.id === user?.id || query.userEmail === user?.email;
  };

  const handleStatusToggle = (status: string) => {
    setTempSelectedStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };

  const handleClearFilters = () => {
    setTempSelectedStatuses([]);
    setTempDateFrom('');
    setTempDateTo('');
    setTempFilterType('');
    setDateError('');
    // Also clear applied filters
    setSelectedStatuses([]);
    setDateFrom('');
    setDateTo('');
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
    setSelectedStatuses(tempSelectedStatuses);
    setDateFrom(tempDateFrom);
    setDateTo(tempDateTo);
    setFilterType(tempFilterType);
    
    // Close the dropdown
    setShowFilters(false);
    setPage(1);
  };
  
  // Sync temp filters when opening dropdown
  useEffect(() => {
    if (showFilters) {
      setTempSelectedStatuses(selectedStatuses);
      setTempDateFrom(dateFrom);
      setTempDateTo(dateTo);
      setTempFilterType(filterType);
      setDateError('');
    }
  }, [showFilters]);

  const activeFilterCount = selectedStatuses.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (filterType ? 1 : 0);

  if (loading && !queries.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading text="Loading..." />
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {effectiveViewMode === 'history'
              ? 'Processed Requests'
              : isManager
                ? 'Requests'
                : 'My Queries'}
          </h1>
          <p className="text-gray-500 mt-1">
            {effectiveViewMode === 'history'
              ? 'View history of requests you have approved or rejected'
              : isManager
                ? 'View and manage submitted requests'
                : 'Track the status of your submitted queries'}
          </p>
        </div>

        {/* View Mode Toggle (Manager Only) */}
        {isManager && (
          <div className="flex bg-gray-100 p-1 rounded-lg self-start">
            <button
              onClick={() => setViewMode('my-requests')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'my-requests'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              My Requests
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === 'history'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Processed Requests
            </button>
          </div>
        )}
      </div>

      {/* Search & Filters Bar */}
      <div className="card mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by ID, database, instance, or comments..."
              className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm 
                       focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            {searchInput && (
              <button
                onClick={() => setSearchInput('')}
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

                  {/* Status Filters (Hidden for "Approvals" which forces Pending) */}
                  {effectiveViewMode !== 'approvals' && (
                    <div className="p-4 border-b">
                      <label className="text-sm font-medium text-gray-700 mb-3 block">Status</label>
                      <div className="grid grid-cols-2 gap-2">
                        {STATUS_OPTIONS
                          .filter(status => effectiveViewMode === 'history' ? status.value !== 'pending' : true)
                          .map((status) => (
                            <label
                              key={status.value}
                              onClick={() => handleStatusToggle(status.value)}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${tempSelectedStatuses.includes(status.value)
                                ? 'bg-purple-50 border border-purple-300'
                                : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                                }`}
                            >
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${tempSelectedStatuses.includes(status.value)
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-gray-300'
                                }`}>
                                {tempSelectedStatuses.includes(status.value) && (
                                  <Check className="w-3 h-3 text-white" />
                                )}
                              </div>
                              <span className="text-sm text-gray-700">{status.label}</span>
                            </label>
                          ))}
                      </div>
                    </div>
                  )}

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

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 
                       text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all text-sm font-medium"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

      </div>

      {/* Dynamic Heading based on filters */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          {getFilterHeading()}
          {debouncedSearch && (
            <span className="text-sm font-normal text-gray-500 ml-2">
              matching "{debouncedSearch}"
            </span>
          )}
        </h2>
      </div>

      {/* Queries List */}
      <div className="card">
        {loading || refreshing ? (
          <div className="flex items-center justify-center h-64">
            <Loading text={refreshing ? "Refreshing..." : "Loading queries..."} />
          </div>
        ) : queries.length === 0 ? (
          <EmptyState
            icon={effectiveViewMode === 'approvals' ? CheckCircle2 : FileText}
            title={
              debouncedSearch || activeFilterCount > 0
                ? "No matching requests"
                : effectiveViewMode === 'approvals'
                  ? "No pending approvals"
                  : effectiveViewMode === 'history'
                    ? "No history found"
                    : "No queries found"
            }
            description={
              debouncedSearch || activeFilterCount > 0
                ? "Try adjusting your search or filters"
                : effectiveViewMode === 'approvals'
                  ? "You're all caught up on approvals!"
                  : effectiveViewMode === 'history'
                    ? "You haven't approved or rejected any requests yet."
                    : "Submit a query from the Query Requests page"
            }
            action={
              debouncedSearch || activeFilterCount > 0 ? (
                <button onClick={handleClearFilters} className="btn-secondary">
                  Clear Filters
                </button>
              ) : effectiveViewMode === 'my-requests' ? (
                <button onClick={() => navigate('/dashboard')} className="btn-primary">
                  Submit a Query
                </button>
              ) : undefined
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
                    <th className="pb-3 font-medium">Type</th>
                    <th className="pb-3 font-medium">User</th>
                    <th className="pb-3 font-medium">Status</th>
                    {effectiveViewMode === 'history' && <th className="pb-3 font-medium">Processed By</th>}
                    <th className="pb-3 font-medium">Date</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {queries.map((query: QueryRequest) => (
                    <tr
                      key={query.uuid}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleViewDetails(query.uuid)}
                    >
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
                        <span className={`px-2 py-1 rounded text-xs font-medium ${query.submissionType === 'script' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                          {query.submissionType === 'script' ? 'Script' : 'Query'}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {isOwnRequest(query)
                              ? 'Me'
                              : query.userEmail || query.user?.email || 'Unknown'}
                          </span>
                        </div>
                      </td>

                      <td className="py-4">
                        <StatusBadge status={query.status} />
                      </td>
                      
                      {/* Processed By column (only in history tab) */}
                      {effectiveViewMode === 'history' && (
                        <td className="py-4">
                          {query.approver ? (
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {query.approver.email || query.approver.name || 'Unknown'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">N/A</span>
                          )}
                        </td>
                      )}
                      
                      <td className="py-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(query.createdAt), 'MMM d')}
                        </div>
                      </td>
                      <td className="py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewDetails(query.uuid)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4 text-gray-500" />
                          </button>
                          {/* Clone button - only for user's own requests */}
                          {isOwnRequest(query) && (
                            <button
                              onClick={() => handleClone(query)}
                              className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                              title="Clone Request"
                            >
                              <Copy className="w-4 h-4 text-purple-500" />
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
                <p className="font-mono text-sm">#{selectedQuery.uuid?.substring(0, 8)}</p>
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-500">
                  {selectedQuery.submissionType === 'script' ? 'Script Content' : 'Query Content'}
                  {(selectedQuery.queryContent || selectedQuery.scriptContent) && (
                    <span className="ml-2 text-xs text-gray-400">
                      ({(selectedQuery.queryContent?.length || selectedQuery.scriptContent?.length || 0).toLocaleString()} chars)
                    </span>
                  )}
                </label>
                <button
                  onClick={async () => {
                    const content = selectedQuery.queryContent || selectedQuery.scriptContent || '';
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
                {selectedQuery.queryContent || selectedQuery.scriptContent || 'N/A'}
              </pre>
              {((selectedQuery.queryContent?.length || 0) > 2000 || (selectedQuery.scriptContent?.length || 0) > 2000) && (
                <p className="mt-1 text-xs text-gray-400 italic">
                  Scroll to see full content • Use "Copy" to get complete text
                </p>
              )}
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
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <label className="text-sm font-medium text-red-800 flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Rejection Reason
                </label>
                <p className="text-red-700 mt-2">{selectedQuery.rejectionReason}</p>
              </div>
            )}

            {/* Approver Info (if processed) */}
            {selectedQuery.approver && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <label className="text-sm font-medium text-gray-700">Processed By</label>
                <div className="flex items-center gap-2 mt-2">
                  <User className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-900">
                    {selectedQuery.approver.name || selectedQuery.approver.email}
                  </span>
                  <span className="text-gray-500 text-sm">
                    ({selectedQuery.approver.role})
                  </span>
                </div>
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
