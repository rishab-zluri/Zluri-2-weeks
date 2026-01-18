/**
 * ErrorBoundary Component Unit Tests (TypeScript)
 * Production-Grade Test Suite
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ErrorBoundary from '@/components/common/ErrorBoundary';

// Component that throws an error
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
    if (shouldThrow) {
        throw new Error('Test error message');
    }
    return <div>Child component rendered</div>;
};

describe('ErrorBoundary Component', () => {
    // Suppress console.error for expected errors
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Normal Rendering', () => {
        it('should render children when no error occurs', () => {
            render(
                <ErrorBoundary>
                    <div>Normal content</div>
                </ErrorBoundary>
            );

            expect(screen.getByText('Normal content')).toBeInTheDocument();
        });

        it('should render multiple children', () => {
            render(
                <ErrorBoundary>
                    <div>First child</div>
                    <div>Second child</div>
                </ErrorBoundary>
            );

            expect(screen.getByText('First child')).toBeInTheDocument();
            expect(screen.getByText('Second child')).toBeInTheDocument();
        });
    });

    describe('Error Handling', () => {
        it('should display error UI when child throws', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );

            expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        });

        it('should display error message', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );

            expect(screen.getByText(/Test error message/)).toBeInTheDocument();
        });

        it('should display reload button', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );

            expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
        });

        it('should display help text', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );

            expect(screen.getByText(/try reloading the page/i)).toBeInTheDocument();
        });
    });

    describe('Reload Functionality', () => {
        it('should call window.location.reload when button is clicked', () => {
            const originalLocation = window.location;
            const mockReload = vi.fn();

            // Mock window.location.reload
            Object.defineProperty(window, 'location', {
                value: { reload: mockReload },
                writable: true,
            });

            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );

            const reloadButton = screen.getByRole('button', { name: /reload page/i });
            fireEvent.click(reloadButton);

            expect(mockReload).toHaveBeenCalled();

            // Restore original location
            Object.defineProperty(window, 'location', {
                value: originalLocation,
                writable: true,
            });
        });
    });

    describe('Error UI Styling', () => {
        it('should have full screen centered layout', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );

            const container = document.querySelector('.min-h-screen');
            expect(container).toBeInTheDocument();
            expect(container).toHaveClass('flex', 'items-center', 'justify-center');
        });

        it('should have error icon', () => {
            const { container } = render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );

            const icon = container.querySelector('svg');
            expect(icon).toBeInTheDocument();
        });

        it('should have error message container', () => {
            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );

            const errorContainer = document.querySelector('.bg-gray-100.rounded-lg');
            expect(errorContainer).toBeInTheDocument();
        });
    });

    describe('Console Logging', () => {
        it('should log error to console', () => {
            const consoleSpy = vi.spyOn(console, 'error');

            render(
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={true} />
                </ErrorBoundary>
            );

            expect(consoleSpy).toHaveBeenCalled();
        });
    });
});
