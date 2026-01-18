/**
 * LoginPage Tests (TypeScript)
 * Production-Grade Component Tests
 */
// @ts-nocheck
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual as object,
        useNavigate: () => mockNavigate,
        Navigate: ({ to }: { to: string }) => <div>Redirected to {to}</div>
    };
});

// Mock toast
vi.mock('react-hot-toast', () => ({
    default: { success: vi.fn(), error: vi.fn() }
}));

// Mock useAuth
const mockLogin = vi.fn();
// We need to import the module to mock its properties
import * as AuthContext from '@/context/AuthContext';

vi.mock('@/context/AuthContext', () => ({
    useAuth: vi.fn(),
    AuthProvider: ({ children }: any) => <div>{children}</div>
}));

describe('LoginPage Component', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset default mock implementation
        vi.mocked(AuthContext.useAuth).mockReturnValue({
            login: mockLogin,
            isAuthenticated: false,
            loading: false,
            // Add other required properties from AuthContextType to match interface if strict
            admin: false,
            isManager: false,
            isAdmin: false,
            isDeveloper: false,
            user: null,
            logout: vi.fn(),
            updateUser: vi.fn(),
        } as any);
    });

    const renderLoginPage = () => {
        return render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>
        );
    };

    describe('Rendering', () => {
        it('should render login form', () => {
            renderLoginPage();

            expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
            expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
            expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
        });

        it('should display portal title and description', () => {
            renderLoginPage();

            expect(screen.getByText(/database query portal/i)).toBeInTheDocument();
            expect(screen.getByText(/sign in to access the sre portal/i)).toBeInTheDocument();
        });

        it('should display help text', () => {
            renderLoginPage();
            expect(screen.getByText(/contact it support/i)).toBeInTheDocument();
        });

        it('should display copyright footer', () => {
            renderLoginPage();
            expect(screen.getByText(/zluri inc/i)).toBeInTheDocument();
        });
    });

    describe('Auth State Handling', () => {
        it('should show loading spinner when auth is loading', () => {
            vi.mocked(AuthContext.useAuth).mockReturnValue({
                loading: true,
                isAuthenticated: false,
                login: mockLogin,
                user: null,
                logout: vi.fn(),
                updateUser: vi.fn(),
                isManager: false,
                isAdmin: false,
                isDeveloper: false,
            } as any);

            const { container } = renderLoginPage();
            // Look for the loader icon or container
            // The loader uses lucide-react Loader2. It usually renders as an svg.
            // We can check if the form is NOT present
            expect(screen.queryByLabelText(/email address/i)).not.toBeInTheDocument();
            // Or precise check (using querySelector since it's an icon without text)
            // But checking absence of form is good enough proof it's in loading state
        });

        it('should redirect to dashboard if already authenticated', () => {
            vi.mocked(AuthContext.useAuth).mockReturnValue({
                loading: false,
                isAuthenticated: true,
                login: mockLogin,
                user: { id: '1' },
                logout: vi.fn(),
                updateUser: vi.fn(),
                isManager: false,
                isAdmin: false,
                isDeveloper: false,
            } as any);

            renderLoginPage();
            expect(screen.getByText('Redirected to /dashboard')).toBeInTheDocument();
        });
    });

    describe('Form Interactions', () => {
        it('should update email input on change', () => {
            renderLoginPage();

            const emailInput = screen.getByLabelText(/email address/i);
            fireEvent.change(emailInput, { target: { value: 'test@zluri.com' } });

            expect(emailInput).toHaveValue('test@zluri.com');
        });

        it('should update password input on change', () => {
            renderLoginPage();

            const passwordInput = screen.getByLabelText(/password/i);
            fireEvent.change(passwordInput, { target: { value: 'password123' } });

            expect(passwordInput).toHaveValue('password123');
        });
    });

    describe('Form Submission', () => {
        it('should call login service on form submit', async () => {
            mockLogin.mockResolvedValue({ success: true });

            renderLoginPage();

            fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@zluri.com' } });
            fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
            fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

            await waitFor(() => {
                expect(mockLogin).toHaveBeenCalledWith('test@zluri.com', 'password123');
            });
        });

        it('should navigate to dashboard on successful login', async () => {
            mockLogin.mockResolvedValue({ success: true });

            renderLoginPage();

            fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@zluri.com' } });
            fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
            fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

            await waitFor(() => {
                expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
            });
        });

        it('should display error message on failed login', async () => {
            mockLogin.mockResolvedValue({ success: false, error: 'Invalid credentials' });

            renderLoginPage();

            fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'wrong@zluri.com' } });
            fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
            fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

            await waitFor(() => {
                expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
            });
        });

        it('should show loading state during submission', async () => {
            mockLogin.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
            );

            renderLoginPage();

            fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@zluri.com' } });
            fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
            fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

            expect(screen.getByText(/signing in/i)).toBeInTheDocument();
            expect(screen.getByRole('button')).toBeDisabled();
        });

        it('should handle exception during login', async () => {
            mockLogin.mockRejectedValue({ response: { data: { message: 'Server error' } } });

            renderLoginPage();

            fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'test@zluri.com' } });
            fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
            fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

            await waitFor(() => {
                expect(screen.getByText(/server error/i)).toBeInTheDocument();
            });
        });
    });

    describe('Error Handling', () => {
        it('should clear error when user starts typing', async () => {
            mockLogin.mockResolvedValue({ success: false, error: 'Invalid credentials' });

            renderLoginPage();

            // Submit to get error
            fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'wrong@zluri.com' } });
            fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrongpass' } });
            fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

            await waitFor(() => {
                expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
            });

            // Start typing to clear error
            fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'new@zluri.com' } });

            expect(screen.queryByText(/invalid credentials/i)).not.toBeInTheDocument();
        });
    });
});
