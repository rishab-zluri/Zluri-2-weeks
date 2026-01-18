/**
 * SecretsManagerPage Unit Tests (TypeScript)
 * Production-Grade Test Suite
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SecretsManagerPage from '@/pages/SecretsManagerPage';
import secretsService from '@/services/secretsService';

// Mock secretsService
vi.mock('@/services/secretsService', () => ({
    default: {
        getSecrets: vi.fn(),
        downloadSecret: vi.fn(),
    }
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn(),
    }
}));

vi.mock('@/components/common', () => ({
    Loading: () => <div data-testid="loading">Loading...</div>,
    EmptyState: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));

describe('SecretsManagerPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders loading state initially', async () => {
        // Return promise that doesn't resolve immediately
        vi.mocked(secretsService.getSecrets).mockImplementation(() => new Promise(() => { }));

        render(<SecretsManagerPage />);
        expect(screen.getByTestId('loading')).toBeInTheDocument();
    });

    it('renders empty state when no secrets found', async () => {
        vi.mocked(secretsService.getSecrets).mockResolvedValue({ data: { secrets: [] } });

        render(<SecretsManagerPage />);

        await waitFor(() => {
            expect(screen.getByTestId('empty-state')).toHaveTextContent('No secrets found');
        });
    });

    it('renders list of secrets', async () => {
        const mockSecrets = ['prod/db/users', 'prod/db/orders', 'dev/api/key'];
        vi.mocked(secretsService.getSecrets).mockResolvedValue({ data: { secrets: mockSecrets } });

        render(<SecretsManagerPage />);

        await waitFor(() => {
            expect(screen.getByText('prod/db/users')).toBeInTheDocument();
            expect(screen.getByText('prod/db/orders')).toBeInTheDocument();
            expect(screen.getByText('dev/api/key')).toBeInTheDocument();
        });
    });

    it('filters secrets based on search input', async () => {
        const mockSecrets = ['prod/db/users', 'prod/db/orders', 'dev/api/key'];
        vi.mocked(secretsService.getSecrets).mockResolvedValue({ data: { secrets: mockSecrets } });

        render(<SecretsManagerPage />);

        await waitFor(() => {
            expect(screen.getByText('prod/db/users')).toBeInTheDocument();
        });

        const searchInput = screen.getByPlaceholderText(/type to search/i);
        fireEvent.change(searchInput, { target: { value: 'orders' } });

        // Wait for debounce usually, but in test we can wait for effect
        await waitFor(() => {
            expect(screen.getByText('prod/db/orders')).toBeInTheDocument();
            expect(screen.queryByText('prod/db/users')).not.toBeInTheDocument();
        }, { timeout: 1000 });
    });

    it('selects a secret when clicked', async () => {
        const mockSecrets = ['prod/db/users'];
        vi.mocked(secretsService.getSecrets).mockResolvedValue({ data: { secrets: mockSecrets } });

        render(<SecretsManagerPage />);

        await waitFor(() => {
            expect(screen.getByText('prod/db/users')).toBeInTheDocument();
        });

        const secretRow = screen.getByText('prod/db/users').parentElement;
        fireEvent.click(secretRow!);

        // Check visual indication (CheckCircle2 icon or class)
        // Since we are not using real icons in JSDOM usually, we check if it is selected by logic or visual cue
        // But here we can check if download button becomes enabled
        const downloadBtn = screen.getByText('Download Secret').closest('button');
        expect(downloadBtn).not.toBeDisabled();
    });

    it('calls download service when download button clicked', async () => {
        const mockSecrets = ['prod/db/users'];
        vi.mocked(secretsService.getSecrets).mockResolvedValue({ data: { secrets: mockSecrets } });
        vi.mocked(secretsService.downloadSecret).mockResolvedValue({});

        render(<SecretsManagerPage />);

        await waitFor(() => {
            expect(screen.getByText('prod/db/users')).toBeInTheDocument();
        });

        // Select secret
        fireEvent.click(screen.getByText('prod/db/users'));

        // Click download
        const downloadBtn = screen.getByText('Download Secret');
        fireEvent.click(downloadBtn);

        await waitFor(() => {
            expect(secretsService.downloadSecret).toHaveBeenCalledWith('prod/db/users');
        });
    });
});
