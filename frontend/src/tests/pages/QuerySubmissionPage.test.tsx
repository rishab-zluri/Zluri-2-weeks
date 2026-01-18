/**
 * QuerySubmissionPage Unit Tests (TypeScript)
 * Production-Grade Test Suite
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import QuerySubmissionPage from '@/pages/QuerySubmissionPage';
import toast from 'react-hot-toast';

// 1. Hoist the mock object so it can be referenced in the factory
const { mockToast } = vi.hoisted(() => ({
    mockToast: {
        success: vi.fn(),
        error: vi.fn(),
    }
}));

// Mock mocks
const mockNavigate = vi.fn();
const mockMutateAsync = vi.fn();

// Mock hooks
vi.mock('../../hooks', () => ({
    useInstances: () => ({
        data: [
            { id: 'inst-1', name: 'Primary DB', type: 'postgresql' },
            { id: 'inst-2', name: 'Analytics DB', type: 'mysql' }
        ],
        isLoading: false
    }),
    usePods: () => ({
        data: [
            { id: 'pod-1', name: 'Core Pod' },
            { id: 'pod-2', name: 'Analytics Pod' }
        ],
        isLoading: false
    }),
    useDatabases: () => ({
        data: ['users_db', 'orders_db'],
        isLoading: false
    }),
    useSubmitQuery: () => ({
        mutateAsync: mockMutateAsync,
        isPending: false
    }),
    useSubmitScript: () => ({
        mutateAsync: mockMutateAsync,
        isPending: false
    })
}));

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

vi.mock('react-hot-toast', () => ({
    default: mockToast,
    __esModule: true,
}));

// Mock child components
vi.mock('@/components/common', () => ({
    Loading: () => <div data-testid="loading">Loading...</div>,
}));

vi.mock('@/components/query/DatabaseSelector', () => ({
    DatabaseSelector: ({ onInstanceChange, onDatabaseChange, onPodChange }: any) => (
        <div data-testid="database-selector">
            <button onClick={() => onInstanceChange('inst-1')}>Select Instance</button>
            <button onClick={() => onDatabaseChange('users_db')}>Select Database</button>
            <button onClick={() => onPodChange('pod-1')}>Select Pod</button>
        </div>
    )
}));

vi.mock('@/components/query/ScriptDocs', () => ({
    ScriptDocs: () => <div data-testid="script-docs">Script Docs</div>
}));

describe('QuerySubmissionPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
        // Reset toast mocks specifically if needed, but clearAllMocks does it
    });

    const renderPage = () => {
        return render(
            <BrowserRouter>
                <QuerySubmissionPage />
            </BrowserRouter>
        );
    };

    it('renders the page title', () => {
        renderPage();
        expect(screen.getByText('Database Request Portal')).toBeInTheDocument();
        expect(screen.getByText(/submit queries or scripts for approval/i)).toBeInTheDocument();
    });

    it('renders submission type toggles', () => {
        renderPage();
        expect(screen.getByText('Query')).toBeInTheDocument();
        expect(screen.getAllByText('Script File')[0]).toBeInTheDocument();
    });

    it('switches between query and script modes', () => {
        renderPage();

        // Default is query mode
        expect(screen.getByPlaceholderText(/enter your sql or mongodb query here/i)).toBeInTheDocument();

        // Switch to script mode
        const scriptTab = screen.getAllByRole('button').find(b => b.textContent?.includes('Script File'));
        fireEvent.click(scriptTab!);

        expect(screen.getByText(/upload script file/i)).toBeInTheDocument();
        expect(screen.queryByPlaceholderText(/enter your sql or mongodb query here/i)).not.toBeInTheDocument();
    });

    it('validates form before submission (Query Mode)', async () => {
        renderPage();

        const submitBtn = screen.getByText('Submit Query');
        fireEvent.submit(submitBtn.closest('form')!);

        // Toast error should be called
        expect(toast.error).toHaveBeenCalledWith('Please fill in all required fields');
        expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    it('submits query successfully', async () => {
        renderPage();

        // Fill form via mocked DatabaseSelector interactions
        fireEvent.click(screen.getByText('Select Instance'));
        fireEvent.click(screen.getByText('Select Database'));
        fireEvent.click(screen.getByText('Select Pod'));

        // Fill comments
        const commentsInput = screen.getByPlaceholderText(/describe the purpose/i);
        fireEvent.change(commentsInput, { target: { value: 'Test query' } });

        // Fill query
        const queryInput = screen.getByPlaceholderText(/enter your sql or mongodb query here/i);
        fireEvent.change(queryInput, { target: { value: 'SELECT * FROM users' } });

        // Submit
        const submitBtn = screen.getByText('Submit Query');
        fireEvent.submit(submitBtn.closest('form')!);

        await waitFor(() => {
            expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
                instanceId: 'inst-1',
                databaseName: 'users_db',
                podId: 'pod-1',
                comments: 'Test query',
                queryContent: 'SELECT * FROM users'
            }));
        });
    });

    it('shows loading state when data is fetching', async () => {
        // Override mock for this test
        vi.doMock('../../hooks', async () => {
            return {
                useInstances: () => ({ data: [], isLoading: true }),
                usePods: () => ({ data: [], isLoading: true }),
                useDatabases: () => ({ data: [], isLoading: false }),
                useSubmitQuery: () => ({ mutateAsync: vi.fn(), isPending: false }),
                useSubmitScript: () => ({ mutateAsync: vi.fn(), isPending: false }),
            };
        });

        // Re-render with new mock
        vi.resetModules();

        // Dynamic imports always async
        const { render, screen } = await import('@testing-library/react');
        const { BrowserRouter } = await import('react-router-dom');
        const { default: QuerySubmissionPage } = await import('@/pages/QuerySubmissionPage');

        render(
            <BrowserRouter>
                <QuerySubmissionPage />
            </BrowserRouter>
        );
        expect(screen.getByTestId('loading')).toBeInTheDocument();

        vi.doUnmock('../../hooks');
    });

    describe('Script Mode & File Upload', () => {
        beforeEach(() => {
            renderPage();
            // Switch to script mode
            const scriptTab = screen.getAllByRole('button').find(b => b.textContent?.includes('Script File'));
            fireEvent.click(scriptTab!);
        });

        const uploadFile = async (file: File) => {
            const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
            fireEvent.change(hiddenInput, { target: { files: [file] } });
        };

        it('validates file extension', async () => {
            const file = new File(['points'], 'data.txt', { type: 'text/plain' });
            await uploadFile(file);

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith('Please upload a .js or .py file');
            });
        });

        it('validates file size', async () => {
            const largeFile = new File(['x'.repeat(17 * 1024 * 1024)], 'bloat.js', { type: 'text/javascript' });
            await uploadFile(largeFile);

            await waitFor(() => {
                expect(toast.error).toHaveBeenCalledWith('File size must be less than 16MB');
            });
        });

        it('handles strict submission validation', () => {
            // Fill common fields first to bypass common validation
            fireEvent.click(screen.getByText('Select Instance'));
            fireEvent.click(screen.getByText('Select Database'));
            fireEvent.click(screen.getByText('Select Pod'));
            const commentsInput = screen.getByPlaceholderText(/describe the purpose/i);
            fireEvent.change(commentsInput, { target: { value: 'Run script' } });

            const submitBtn = screen.getByText('Submit Script');
            fireEvent.submit(submitBtn.closest('form')!);

            // Should fail because no file
            expect(toast.error).toHaveBeenCalledWith('Please upload a script file');
        });

        it('submits valid script file', async () => {
            // 1. Upload File
            const file = new File(['print("hi")'], 'test.py', { type: 'text/x-python' });
            await uploadFile(file);

            expect(screen.getByText('test.py')).toBeInTheDocument();

            // 2. Fill Data
            fireEvent.click(screen.getByText('Select Instance'));
            fireEvent.click(screen.getByText('Select Database'));
            fireEvent.click(screen.getByText('Select Pod'));

            const commentsInput = screen.getByPlaceholderText(/describe the purpose/i);
            fireEvent.change(commentsInput, { target: { value: 'Run script' } });

            // 3. Submit
            const submitBtn = screen.getByText('Submit Script');
            fireEvent.submit(submitBtn.closest('form')!);

            await waitFor(() => {
                expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({
                    scriptFile: file,
                    comments: 'Run script'
                }));
            });
        });

        it('removes selected file', async () => {
            const file = new File([''], 'test.py');
            await uploadFile(file);

            const removeButton = screen.getAllByRole('button').find(btn => btn.querySelector('svg.text-gray-500'));
            fireEvent.click(removeButton!);

            expect(screen.queryByText('test.py')).not.toBeInTheDocument();
            expect(screen.getByText(/click to upload/i)).toBeInTheDocument();
        });
    });

    describe('Features', () => {
        it('pre-fills form from cloned session data', async () => {
            const cloneData = {
                instanceId: 'inst-1',
                podId: 'pod-1',
                databaseName: 'users_db',
                submissionType: 'query',
                queryContent: 'SELECT 1',
                comments: 'Cloned request'
            };
            sessionStorage.setItem('cloneRequestData', JSON.stringify(cloneData));

            renderPage();

            // Check if values are set
            expect(screen.getByDisplayValue('SELECT 1')).toBeInTheDocument();
            expect(screen.getByDisplayValue('Cloned request')).toBeInTheDocument();

            // Should show toast
            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith('Request cloned - review and submit');
            });

            // Should clear session
            expect(sessionStorage.getItem('cloneRequestData')).toBeNull();
        });

        it('resets form state', () => {
            renderPage();
            const commentsInput = screen.getByPlaceholderText(/describe the purpose/i);
            fireEvent.change(commentsInput, { target: { value: 'To delete' } });

            fireEvent.click(screen.getByText('Reset'));

            expect(commentsInput).toHaveValue('');
        });
    });
});
