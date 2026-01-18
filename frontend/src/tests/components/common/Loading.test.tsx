/**
 * Common Components Unit Tests (TypeScript)
 * Production-Grade Test Suite
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

// ================================
// Loading Component Tests
// ================================
import Loading from '@/components/common/Loading';

describe('Loading Component', () => {
    describe('Rendering', () => {
        it('should render spinner with default size', () => {
            render(<Loading />);

            const spinner = document.querySelector('.animate-spin');
            expect(spinner).toBeInTheDocument();
            expect(spinner).toHaveClass('w-8', 'h-8'); // md size default
        });

        it('should render small spinner', () => {
            render(<Loading size="sm" />);

            const spinner = document.querySelector('.animate-spin');
            expect(spinner).toHaveClass('w-4', 'h-4');
        });

        it('should render large spinner', () => {
            render(<Loading size="lg" />);

            const spinner = document.querySelector('.animate-spin');
            expect(spinner).toHaveClass('w-12', 'h-12');
        });

        it('should render extra large spinner', () => {
            render(<Loading size="xl" />);

            const spinner = document.querySelector('.animate-spin');
            expect(spinner).toHaveClass('w-16', 'h-16');
        });

        it('should display loading text when provided', () => {
            render(<Loading text="Loading data..." />);

            expect(screen.getByText('Loading data...')).toBeInTheDocument();
        });

        it('should not display text when not provided', () => {
            render(<Loading />);

            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        });

        it('should render full screen overlay when fullScreen is true', () => {
            render(<Loading fullScreen />);

            const overlay = document.querySelector('.fixed.inset-0');
            expect(overlay).toBeInTheDocument();
            expect(overlay).toHaveClass('z-50');
        });

        it('should not render overlay when fullScreen is false', () => {
            render(<Loading fullScreen={false} />);

            const overlay = document.querySelector('.fixed.inset-0');
            expect(overlay).not.toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper spinner styling', () => {
            render(<Loading />);

            const spinner = document.querySelector('.animate-spin');
            expect(spinner).toHaveClass('text-purple-600');
        });
    });
});
