/**
 * Sidebar Unit Tests (TypeScript)
 * Production-Grade Test Suite
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';

// Mock AuthContext
const mockUseAuth = vi.fn();
vi.mock('@/context/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

const { mockUseLocation } = vi.hoisted(() => {
    return { mockUseLocation: vi.fn() };
});

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom') as any;
    return {
        ...actual,
        useLocation: () => mockUseLocation(),
    };
});

describe('Sidebar Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const renderSidebar = () => {
        return render(
            <MemoryRouter>
                <Sidebar />
            </MemoryRouter>
        );
    };

    describe('Rendering - Standard User', () => {
        beforeEach(() => {
            mockUseAuth.mockReturnValue({ isManager: false, isAdmin: false });
            mockUseLocation.mockReturnValue({ pathname: '/dashboard' });
        });

        it('renders logo and branding', () => {
            renderSidebar();
            expect(screen.getByText('Zluri SRE')).toBeInTheDocument();
        });

        it('highlights dashboard link when on root path', () => {
            mockUseLocation.mockReturnValue({ pathname: '/' });
            renderSidebar();
            const dashboardLink = screen.getByText('Submit Request').closest('a');
            expect(dashboardLink).toHaveClass('active');
        });

        it('renders submit request link', () => {
            renderSidebar();
            expect(screen.getByText('Submit Request')).toBeInTheDocument();
        });

        it('renders my requests link', () => {
            renderSidebar();
            expect(screen.getByText('My Requests')).toBeInTheDocument();
        });

        it('should NOT render approval dashboard link', () => {
            renderSidebar();
            expect(screen.queryByText('Approval Dashboard')).not.toBeInTheDocument();
        });
    });

    describe('Rendering - Manager', () => {
        beforeEach(() => {
            mockUseAuth.mockReturnValue({ isManager: true, isAdmin: false });
        });

        it('renders approval dashboard link', () => {
            renderSidebar();
            expect(screen.getByText('Approval Dashboard')).toBeInTheDocument();
        });

        it('renders requests link (instead of My Requests)', () => {
            renderSidebar();
            expect(screen.getByText('Requests')).toBeInTheDocument();
            expect(screen.queryByText('My Requests')).not.toBeInTheDocument();
        });
    });

    describe('Rendering - Admin', () => {
        beforeEach(() => {
            mockUseAuth.mockReturnValue({ isManager: false, isAdmin: true });
        });

        it('renders approval dashboard link', () => {
            renderSidebar();
            expect(screen.getByText('Approval Dashboard')).toBeInTheDocument();
        });

        it('renders requests link', () => {
            renderSidebar();
            expect(screen.getByText('Requests')).toBeInTheDocument();
        });
    });
});
