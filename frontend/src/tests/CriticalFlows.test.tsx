import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '../pages/LoginPage';
import { AuthProvider } from '../context/AuthContext';
import { MemoryRouter } from 'react-router-dom';
import authService from '../services/authService';

// Mock authService
vi.mock('../services/authService', () => ({
    default: {
        login: vi.fn(),
        storeAuth: vi.fn(),
        getStoredUser: vi.fn().mockReturnValue(null), // Start unauthenticated
    }
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

// Mock toast
vi.mock('react-hot-toast', () => ({
    default: { success: vi.fn(), error: vi.fn() }
}));

describe('Critical User Flows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Login Flow: User can login and navigate to dashboard', async () => {
        // Setup mock response
        const mockUser = { id: '1', email: 'test@zluri.com', role: 'developer', name: 'Test User' };
        vi.mocked(authService.login).mockResolvedValue({
            success: true,
            status: 'success',
            data: {
                user: mockUser,
                accessToken: 'fake-token'
            }
        });

        render(
            <MemoryRouter>
                <AuthProvider>
                    <LoginPage />
                </AuthProvider>
            </MemoryRouter>
        );

        // Fill credentials
        fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@zluri.com' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });

        // Submit
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        // Verify service call
        await waitFor(() => {
            expect(authService.login).toHaveBeenCalledWith('test@zluri.com', 'password123');
        });

        // Verify successful login actions
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
        });
    });

    it('Login Flow: Handles invalid credentials', async () => {
        // Setup mock failure
        vi.mocked(authService.login).mockResolvedValue({
            success: false,
            status: 'fail',
            data: null as any,
            message: 'Invalid email or password'
        });

        render(
            <MemoryRouter>
                <AuthProvider>
                    <LoginPage />
                </AuthProvider>
            </MemoryRouter>
        );

        fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'wrong@zluri.com' } });
        fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
        fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

        await waitFor(() => {
            expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
            expect(mockNavigate).not.toHaveBeenCalled();
        });
    });
});
