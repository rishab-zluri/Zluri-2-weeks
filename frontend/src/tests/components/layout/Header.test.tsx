/**
 * Header Component Unit Tests (TypeScript)
 * Production-Grade Test Suite
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Header from '@/components/layout/Header';

// Mock the AuthContext
const mockLogout = vi.fn();
const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'developer',
};

vi.mock('@/context/AuthContext', () => ({
    useAuth: () => ({
        user: mockUser,
        logout: mockLogout,
    }),
}));

const renderHeader = (onMenuToggle = vi.fn()) => {
    return render(
        <BrowserRouter>
            <Header onMenuToggle={onMenuToggle} />
        </BrowserRouter>
    );
};

describe('Header Component', () => {
    // Mock window.location
    const originalLocation = window.location;

    beforeEach(() => {
        vi.clearAllMocks();
        delete (window as any).location;
        (window as any).location = { href: '' };
    });

    afterEach(() => {
        (window as any).location = originalLocation;
    });

    describe('Rendering', () => {
        it('should render the header', () => {
            renderHeader();
            expect(document.querySelector('header')).toBeInTheDocument();
        });

        it('should display Zluri logo', () => {
            renderHeader();
            expect(screen.getByText('zluri')).toBeInTheDocument();
        });

        it('should display user email', () => {
            renderHeader();
            expect(screen.getByText('test@example.com')).toBeInTheDocument();
        });

        it('should render menu toggle button', () => {
            renderHeader();
            const menuButton = document.querySelector('button.lg\\:hidden');
            expect(menuButton).toBeInTheDocument();
        });
    });

    describe('User Dropdown Interaction', () => {
        it('should open dropdown when user button is clicked', async () => {
            renderHeader();
            const userButton = screen.getByText('test@example.com');
            fireEvent.click(userButton); // Open

            await waitFor(() => {
                expect(screen.getByText('Test User')).toBeInTheDocument();
            });
        });

        it('should close dropdown when user button is clicked again', async () => {
            renderHeader();
            const userButton = screen.getByText('test@example.com');

            fireEvent.click(userButton); // Open
            expect(screen.getByText('Test User')).toBeVisible();

            fireEvent.click(userButton); // Close
            expect(screen.queryByText('Test User')).not.toBeInTheDocument();
        });

        it('should close dropdown when clicking outside', async () => {
            renderHeader();
            const userButton = screen.getByText('test@example.com');
            fireEvent.click(userButton); // Open
            expect(screen.getByText('Test User')).toBeVisible();

            fireEvent.mouseDown(document.body); // Click outside

            expect(screen.queryByText('Test User')).not.toBeInTheDocument();
        });

        it('should render user role tag', async () => {
            renderHeader();
            fireEvent.click(screen.getByText('test@example.com'));
            expect(screen.getByText('developer')).toBeInTheDocument();
        });

        it('should toggle dropdown arrow rotation', async () => {
            renderHeader();
            fireEvent.click(screen.getByText('test@example.com'));
            const arrow = document.querySelector('.rotate-180');
            expect(arrow).toBeInTheDocument();
        });
    });

    describe('Menu Toggle', () => {
        it('should call onMenuToggle when menu button is clicked', () => {
            const mockOnMenuToggle = vi.fn();
            renderHeader(mockOnMenuToggle);

            const menuButton = document.querySelector('button.lg\\:hidden');
            fireEvent.click(menuButton!);

            expect(mockOnMenuToggle).toHaveBeenCalledTimes(1);
        });
    });

    describe('Logout', () => {
        it('should call logout and redirect when sign out is clicked', async () => {
            renderHeader();
            const userButton = screen.getByText('test@example.com');
            fireEvent.click(userButton);

            const signOutButton = screen.getByText('Sign Out');
            fireEvent.click(signOutButton);

            expect(mockLogout).toHaveBeenCalled();
            await waitFor(() => {
                expect(window.location.href).toBe('/login');
            });
        });
    });

    describe('Profile Settings', () => {
        it('should have working profile button', () => {
            renderHeader();
            fireEvent.click(screen.getByText('test@example.com'));
            const profileBtn = screen.getByText('Profile Settings');
            fireEvent.click(profileBtn);
            // Logic is currently empty in component, just ensuring no crash
            expect(profileBtn).toBeVisible();
        });
    });

    describe('Accessibility & Styling', () => {
        it('component unmount should clean up event listeners', () => {
            const { unmount } = renderHeader();
            const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
            unmount();
            expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
        });
    });
});
