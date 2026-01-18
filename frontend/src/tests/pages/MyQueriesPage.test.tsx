/**
 * MyQueriesPage Unit Tests (TypeScript)
 * Production-Grade Test Suite
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import MyQueriesPage from '@/pages/MyQueriesPage';

// Mock hooks
const mockUseMyRequests = vi.fn();
const mockUseRequests = vi.fn();
const mockUseRequest = vi.fn();
const mockUsePods = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/hooks', () => ({
    useMyRequests: (filters: any) => mockUseMyRequests(filters),
    useRequests: (filters: any, options: any) => mockUseRequests(filters, options),
    useRequest: (id: string) => mockUseRequest(id),
    usePods: (options: any) => mockUsePods(options),
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock Auth Context - Mutable to test different roles
let mockUserRole = 'developer';
let mockIsManager = false;

vi.mock('@/context/AuthContext', () => ({
    useAuth: () => ({
        isManager: mockIsManager,
        user: { id: 'user-1', email: 'test@example.com', role: mockUserRole },
    }),
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock Clipboard
const mockClipboard = {
    writeText: vi.fn(),
};
Object.assign(navigator, { clipboard: mockClipboard });

const mockRequestsData = {
    data: [
        {
            uuid: 'uuid-1',
            status: 'pending',
            submissionType: 'query',
            instanceName: 'db-1',
            databaseName: 'test_db',
            queryContent: 'SELECT * FROM users',
            user: { email: 'test@example.com', id: 'user-1' },
            createdAt: '2024-01-01T00:00:00Z',
        },
        {
            uuid: 'uuid-2',
            status: 'approved',
            submissionType: 'script',
            instanceName: 'db-2',
            databaseName: 'test_db_2',
            queryContent: 'print("hello")',
            user: { email: 'other@example.com' },
            createdAt: '2024-01-02T00:00:00Z',
        }
    ],
    pagination: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
    },
};

const renderPage = () => {
    return render(
        <BrowserRouter>
            <MyQueriesPage />
        </BrowserRouter>
    );
};

describe('MyQueriesPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUserRole = 'developer';
        mockIsManager = false;

        // Default success response
        mockUseMyRequests.mockReturnValue({
            data: mockRequestsData,
            isLoading: false,
            refetch: vi.fn(),
        });
        mockUseRequests.mockReturnValue({ // Default empty for manager calls
            data: { data: [], pagination: {} },
            isLoading: false,
            refetch: vi.fn(),
        });
        mockUseRequest.mockReturnValue({ data: null });
        mockUsePods.mockReturnValue({ data: [] });
    });

    describe('Rendering & Basic Role Views', () => {
        it('should render "My Queries" for standard users', () => {
            renderPage();
            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('My Queries');
            expect(screen.queryByText('Requests')).not.toBeInTheDocument(); // Tab shouldn't exist
            expect(screen.queryByText('Processed Requests')).not.toBeInTheDocument();
        });

        it('should render detailed rows correctly', () => {
            renderPage();
            expect(screen.getByText('test_db')).toBeInTheDocument();
            expect(screen.getByText('db-1')).toBeInTheDocument();
            expect(screen.getByText('Pending')).toBeInTheDocument();
            expect(screen.getByText('Query')).toBeInTheDocument();
            // Second row
            expect(screen.getByText('test_db_2')).toBeInTheDocument();
            expect(screen.getByText('Script')).toBeInTheDocument();
        });

        it('should render "Requests" and view tabs for Managers', () => {
            mockIsManager = true;
            mockUserRole = 'manager';
            renderPage();
            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Requests');

            // Should see tabs
            expect(screen.getByRole('button', { name: 'Requests' })).toHaveClass('bg-white');
            expect(screen.getByRole('button', { name: 'Processed Requests' })).toHaveClass('text-gray-500');
        });
    });

    describe('Interactions - Search & Filter', () => {
        it('should handle search input debounce', async () => {
            renderPage();
            const searchInput = screen.getByPlaceholderText(/search/i);

            fireEvent.change(searchInput, { target: { value: 'search term' } });

            // Should update input immediately
            expect(searchInput).toHaveValue('search term');

            // Wait for debounce
            await waitFor(() => {
                expect(mockUseMyRequests).toHaveBeenCalledWith(expect.objectContaining({
                    search: 'search term',
                    page: 1
                }));
            }, { timeout: 500 });

            // Clear search
            const clearBtn = screen.getByRole('button', { name: '' }); // X icon usually has empty name if not aria-labeled
            // Use querySelector to find the X button explicitly if name is tricky
            const xButton = document.querySelector('.lucide-x')?.closest('button');
            fireEvent.click(xButton!);

            expect(searchInput).toHaveValue('');
        });

        it('should toggle filter dropdown and selecting options', async () => {
            renderPage();

            // Open filter
            const filterBtn = screen.getByRole('button', { name: /filters/i });
            fireEvent.click(filterBtn);

            expect(screen.getAllByText('Clear All')[0]).toBeVisible();

            // Select Status 'Approved' - find specific option in dropdown (inside label)
            const approvedOption = screen.getAllByText('Approved').find(el => el.closest('label'))!;
            fireEvent.click(approvedOption);

            // Check visual indicator (checkbox logic)
            expect(approvedOption.closest('label')?.querySelector('.bg-purple-600')).toBeInTheDocument();

            // Set Date
            const dateInputs = screen.getAllByRole('textbox'); // Date inputs are text in JSDOM sometimes if type=date not supported fully, checking generic 
            // Actually specifically target by container
            const dateFrom = document.querySelectorAll('input[type="date"]')[0];
            fireEvent.change(dateFrom, { target: { value: '2024-01-01' } });

            // Apply
            const applyBtn = screen.getByRole('button', { name: 'Apply' });
            fireEvent.click(applyBtn);

            // Dropdown closed
            expect(screen.queryByText('Clear All')).not.toBeInTheDocument();

            // Hook called with filters
            expect(mockUseMyRequests).toHaveBeenCalledWith(expect.objectContaining({
                status: 'approved',
                fromDate: '2024-01-01'
            }));
        });
    });

    describe('Manager View Modes', () => {
        beforeEach(() => {
            mockIsManager = true;
            mockUserRole = 'manager';
        });

        it('should switch to Processed Requests (History) mode', async () => {
            renderPage();

            const historyTab = screen.getByRole('button', { name: 'Processed Requests' });
            fireEvent.click(historyTab);

            // Header updates
            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Processed Requests');

            // Hook call
            // commonFilters logic: Pending is excluded in history mode default
            await waitFor(() => {
                expect(mockUseRequests).toHaveBeenCalledWith(
                    expect.objectContaining({
                        excludeOwnRequests: 'true',
                        status: 'approved,rejected,failed,executing,completed'
                    }),
                    expect.objectContaining({ enabled: true })
                );
            });
        });

        it('should filter by Pod in manager view', async () => {
            mockUsePods.mockReturnValue({ data: [{ id: 'pod-1', name: 'DevOps' }] });
            renderPage();

            // Switch to history to ensure hook is enabled
            fireEvent.click(screen.getByRole('button', { name: 'Processed Requests' }));

            // Open filters
            fireEvent.click(screen.getByRole('button', { name: /filters/i }));

            // Select Pod
            const select = screen.getByRole('combobox');
            fireEvent.change(select, { target: { value: 'pod-1' } });

            fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

            expect(mockUseRequests).toHaveBeenCalledWith(
                expect.objectContaining({ podId: 'pod-1' }),
                expect.objectContaining({ enabled: true })
            );
        });
    });

    describe('Actions & Modal', () => {
        it('should open detail modal on row click and fetch details', async () => {
            renderPage();

            const firstRow = screen.getByText('test_db').closest('tr');
            fireEvent.click(firstRow!);

            // Verify call
            expect(mockUseRequest).toHaveBeenCalledWith('uuid-1');

            // Wait for modal
            expect(await screen.findByRole('dialog')).toBeVisible();
        });

        it('should display details in modal correctly', async () => {
            // Mock details response
            mockUseRequest.mockReturnValue({
                data: {
                    uuid: 'uuid-1',
                    instanceName: 'db-1',
                    databaseName: 'test_db',
                    podName: 'Pod A',
                    createdAt: '2024-01-01',
                    status: 'completed',
                    queryContent: 'SELECT * FROM secrets',
                    executionResult: '{"rows": []}',
                    submissionType: 'query'
                }
            });

            // Pre-select via prop would be hard, simulating click
            renderPage();
            const viewBtn = screen.getAllByTitle('View Details')[0];
            fireEvent.click(viewBtn);

            expect(await screen.findByText('Query Details')).toBeInTheDocument();
            expect(await screen.findByText('SELECT * FROM secrets')).toBeInTheDocument();
            expect(await screen.findByText('Execution Result')).toBeInTheDocument();
        });

        it('should clone request on click', () => {
            // Test user owns uuid-1
            renderPage();

            const cloneBtn = screen.getByTitle('Clone Request'); // only appears for owned request
            fireEvent.click(cloneBtn);

            expect(sessionStorage.getItem('cloneRequestData')).toBeTruthy();
            expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
        });

        it('should handle clipboard copy', async () => {
            mockUseRequest.mockReturnValue({
                data: {
                    uuid: 'uuid-1',
                    queryContent: 'copy me',
                    createdAt: '2024-01-01T00:00:00Z',
                    // Add other required fields to avoid runtime errors if accessed
                    instanceName: 'db-1',
                    databaseName: 'db',
                    submissionType: 'query',
                    status: 'pending'
                }
            });
            renderPage();
            fireEvent.click(screen.getAllByTitle('View Details')[0]);

            const copyBtn = screen.getByTitle('Copy to clipboard');
            fireEvent.click(copyBtn);

            await waitFor(() => {
                expect(mockClipboard.writeText).toHaveBeenCalledWith('copy me');
            });
        });
    });

    describe('Pagination', () => {
        it('should handle page changes', async () => {
            // Mock total pages to 5
            mockUseMyRequests.mockReturnValue({
                data: { ...mockRequestsData, pagination: { ...mockRequestsData.pagination, totalPages: 5 } },
                isLoading: false, refetch: vi.fn()
            });

            renderPage();

            // Should start at Page 1
            expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();

            const nextBtn = document.querySelector('.lucide-chevron-right')?.closest('button');
            const prevBtn = document.querySelector('.lucide-chevron-left')?.closest('button');

            // Click Next -> Page 2
            fireEvent.click(nextBtn!);
            await waitFor(() => {
                expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
            });
            expect(mockUseMyRequests).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));

            // Click Prev -> Page 1
            fireEvent.click(prevBtn!);
            await waitFor(() => {
                expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
            });
            expect(mockUseMyRequests).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
        });
    });
});
