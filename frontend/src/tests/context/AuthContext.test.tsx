/**
 * AuthContext Unit Tests
 */
import { render, screen, waitFor, act, renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import authService from '@/services/authService';
import { UserRole } from '@/types';

// Mock authService
vi.mock('@/services/authService', () => ({
    default: {
        getStoredUser: vi.fn(),
        getProfile: vi.fn(),
        login: vi.fn(),
        logout: vi.fn(),
        storeAuth: vi.fn(),
        clearAuth: vi.fn(),
    }
}));

// Test component to consume context
const TestComponent = () => {
    const { user, isAuthenticated, isManager, login, logout } = useAuth();
    return (
        <div>
            <div data-testid="user-email">{user?.email}</div>
            <div data-testid="is-auth">{String(isAuthenticated)}</div>
            <div data-testid="is-manager">{String(isManager)}</div>
            <button onClick={() => login('test@example.com', 'password')}>Login</button>
            <button onClick={() => logout()}>Logout</button>
        </div>
    );
};

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with no user if storage is empty', async () => {
            (authService.getStoredUser as any).mockReturnValue(null);

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('is-auth')).toHaveTextContent('false');
            });
            expect(authService.getProfile).not.toHaveBeenCalled();
        });

        it('should fetch profile if user is in storage', async () => {
            (authService.getStoredUser as any).mockReturnValue({ id: '1', email: 'stored@test.com' });
            (authService.getProfile as any).mockResolvedValue({
                success: true,
                data: { id: '1', email: 'fetched@test.com', role: UserRole.USER }
            });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(screen.getByTestId('user-email')).toHaveTextContent('fetched@test.com');
            });
            expect(screen.getByTestId('is-auth')).toHaveTextContent('true');
        });

        it('should clear auth if profile fetch fails', async () => {
            (authService.getStoredUser as any).mockReturnValue({ id: '1' });
            (authService.getProfile as any).mockRejectedValue(new Error('Network error')); // or make it return success: false

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(authService.clearAuth).toHaveBeenCalled();
            });
            expect(screen.getByTestId('is-auth')).toHaveTextContent('false');
        });

        it('should handle failed profile response (success: false)', async () => {
            (authService.getStoredUser as any).mockReturnValue({ id: '1' });
            (authService.getProfile as any).mockResolvedValue({ success: false });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => {
                expect(authService.clearAuth).toHaveBeenCalled();
            });
        });

        it('should handle initialization exception (console.error)', async () => {
            const spy = vi.spyOn(console, 'error').mockImplementation(() => { });
            (authService.getStoredUser as any).mockImplementation(() => { throw new Error('Storage Error'); });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await waitFor(() => expect(screen.getByTestId('is-auth')).toBeInTheDocument());
            expect(spy).toHaveBeenCalledWith('Auth initialization error:', expect.any(Error));
            spy.mockRestore();
        });
    });

    describe('Login', () => {
        it('should handle successful login', async () => {
            (authService.login as any).mockResolvedValue({
                success: true,
                data: { user: { id: '1', email: 'login@test.com', role: UserRole.USER } }
            });

            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Login').click();
            });

            expect(screen.getByTestId('user-email')).toHaveTextContent('login@test.com');
            expect(authService.storeAuth).toHaveBeenCalled();
        });

        it('should handle failed login', async () => {
            (authService.login as any).mockResolvedValue({
                success: false,
                message: 'Invalid credentials'
            });

            // We need to test the return value of login(), so we might use renderHook or modify TestComponent
            // Modifying logic slightly to test result via hook directly
            const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

            let loginResult;
            await act(async () => {
                loginResult = await result.current.login('test', 'pass');
            });

            expect(loginResult).toEqual({ success: false, error: 'Invalid credentials' });
            expect(result.current.isAuthenticated).toBe(false);
        });

        it('should handle login exception', async () => {
            (authService.login as any).mockRejectedValue(new Error('Network Error'));

            const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

            let loginResult;
            await act(async () => {
                loginResult = await result.current.login('test', 'pass');
            });

            expect(loginResult).toEqual({ success: false, error: 'Network Error' });
        });
    });

    describe('Logout', () => {
        it('should handle logout', async () => {
            render(
                <AuthProvider>
                    <TestComponent />
                </AuthProvider>
            );

            await act(async () => {
                screen.getByText('Logout').click();
            });

            expect(authService.logout).toHaveBeenCalled();
            expect(screen.getByTestId('is-auth')).toHaveTextContent('false');
        });
    });

    describe('Role Helpers', () => {
        it('should correctly identify roles', () => {
            const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

            // Initial state null
            expect(result.current.isManager).toBe(false);
            expect(result.current.isAdmin).toBe(false);
            expect(result.current.isDeveloper).toBe(false);

            // Update to Admin
            act(() => {
                result.current.updateUser({ id: '1', email: 'a', role: UserRole.ADMIN } as any);
            });
            expect(result.current.isAdmin).toBe(true);
            expect(result.current.isManager).toBe(true); // Admin is also manager usually? Check context logic: user?.role === UserRole.MANAGER || user?.role === UserRole.ADMIN

            // Update to Manager
            act(() => {
                result.current.updateUser({ id: '1', email: 'a', role: UserRole.MANAGER } as any);
            });
            expect(result.current.isAdmin).toBe(false);
            expect(result.current.isManager).toBe(true);

            // Update to User
            act(() => {
                result.current.updateUser({ id: '1', email: 'a', role: UserRole.USER } as any);
            });
            expect(result.current.isDeveloper).toBe(true);
            expect(result.current.isManager).toBe(false);
        });
    });
});
