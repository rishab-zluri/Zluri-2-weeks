import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw,
  Eye,
  Copy,
  FileText,
  Database,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  X,
  Calendar,
  Check
} from 'lucide-react';
import {
  useMyRequests,
  useRequest
} from '@/hooks';
import queryService from '@/services/queryService';
import { Loading, StatusBadge, EmptyState, Modal } from '@/components/common';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { QueryRequest, RequestStatus } from '@/types';

// Status options for filter
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'approved', label: 'Approved', color: 'blue' },
  { value: 'executing', label: 'Executing', color: 'purple' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'failed', label: 'Failed', color: 'red' },
  { value: 'rejected', label: 'Rejected', color: 'gray' },
];

const MyQueriesPage: React.FC = () => {
  const navigate = useNavigate();
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 10;

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Filter dropdown state
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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

  // Build filter params for API
  const filterParams: Record<string, unknown> = { page, limit };

  // Apply search
  if (debouncedSearch) {
    filterParams.search = debouncedSearch;
  }

  // Apply status filter
  if (selectedStatuses.length > 0) {
    filterParams.status = selectedStatuses.join(',');
  }

  // Apply date range
  if (dateFrom) {
    filterParams.fromDate = dateFrom;
  }
  if (dateTo) {
    filterParams.toDate = dateTo;
  }

  // Data fetching
  const {
    data: requestsData,
    isLoading: loading,
    isRefetching: refreshing,
    refetch
  } = useMyRequests(filterParams);

  const { data: selectedQuery } = useRequest(selectedUuid || undefined);

  // Derived state
  const queries = requestsData?.data || [];
  const totalPages = requestsData?.pagination?.totalPages || 1;

  // Status counts from backend (for potential future use)

  // Generate dynamic heading based on selected filters
  const getFilterHeading = () => {
    if (selectedStatuses.length === 0) {
      return 'All Requests';
    }
    const labels = selectedStatuses.map(s =>
      STATUS_OPTIONS.find(opt => opt.value === s)?.label || s
    );
    if (labels.length === 1) {
      return `${labels[0]} Requests`;
    }
    return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]} Requests`;
  };

  // Handlers
  const handleRefresh = () => refetch();

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

  const handleViewDetails = (uuid: string) => setSelectedUuid(uuid);
  const handleCloseModal = () => setSelectedUuid(null);


  const handleStatusToggle = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const handleClearFilters = () => {
    setSelectedStatuses([]);
    setDateFrom('');
    setDateTo('');
    setSearchInput('');
  };

  const handleApplyFilters = () => {
    setShowFilters(false);
    setPage(1);
  };

  // Count active filters
  const activeFilterCount = selectedStatuses.length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

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
        <p className="text-gray-500 mt-1">Track the status of your submitted queries and scripts</p>
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

          {/* Filter Button & Dropdown */}
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

            {/* Filter Dropdown Panel */}
            {showFilters && (
              <div className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-gray-900">Filters</h3>
                </div>

                {/* Status Filters */}
                <div className="p-4 border-b">
                  <label className="text-sm font-medium text-gray-700 mb-3 block">Status</label>
                  <div className="grid grid-cols-2 gap-2">
                    {STATUS_OPTIONS.map((status) => (
                      <label
                        key={status.value}
                        onClick={() => handleStatusToggle(status.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${selectedStatuses.includes(status.value)
                          ? 'bg-purple-50 border border-purple-300'
                          : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                          }`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${selectedStatuses.includes(status.value)
                          ? 'bg-purple-600 border-purple-600'
                          : 'border-gray-300'
                          }`}>
                          {selectedStatuses.includes(status.value) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                        <span className="text-sm text-gray-700">{status.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Date Range Filters */}
                <div className="p-4 border-b">
                  <label className="text-sm font-medium text-gray-700 mb-3 block">Date Range</label>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">From</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">To</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="p-4 flex gap-3">
                  <button
                    onClick={handleClearFilters}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={handleApplyFilters}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 
                     text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
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
        {(selectedStatuses.length > 0 || dateFrom || dateTo || debouncedSearch) && (
          <button
            onClick={handleClearFilters}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Queries List */}
      <div className="card">
        {queries.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={debouncedSearch || activeFilterCount > 0 ? "No matching queries" : "No queries found"}
            description={
              debouncedSearch || activeFilterCount > 0
                ? "Try adjusting your search or filters"
                : "Submit a query from the Query Requests page"
            }
            action={
              debouncedSearch || activeFilterCount > 0 ? (
                <button onClick={handleClearFilters} className="btn-secondary">
                  Clear Filters
                </button>
              ) : (
                <button onClick={() => navigate('/dashboard')} className="btn-primary">
                  Submit a Query
                </button>
              )
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
                        #{query.uuid?.substring(0, 8)}
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
