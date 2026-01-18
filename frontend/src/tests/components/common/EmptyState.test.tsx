/**
 * EmptyState Component Unit Tests (TypeScript)
 * Production-Grade Test Suite
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Search } from 'lucide-react';
import EmptyState from '@/components/common/EmptyState';

describe('EmptyState Component', () => {
    describe('Default Rendering', () => {
        it('should render with default title', () => {
            render(<EmptyState />);

            expect(screen.getByText('No data found')).toBeInTheDocument();
        });

        it('should render default icon', () => {
            const { container } = render(<EmptyState />);

            const icon = container.querySelector('svg');
            expect(icon).toBeInTheDocument();
            expect(icon).toHaveClass('w-12', 'h-12', 'text-gray-400');
        });

        it('should not render description when not provided', () => {
            render(<EmptyState />);

            const description = document.querySelector('p.text-gray-500');
            expect(description).not.toBeInTheDocument();
        });

        it('should not render action when not provided', () => {
            render(<EmptyState />);

            expect(screen.queryByRole('button')).not.toBeInTheDocument();
        });
    });

    describe('Custom Props', () => {
        it('should render custom title', () => {
            render(<EmptyState title="No queries found" />);

            expect(screen.getByText('No queries found')).toBeInTheDocument();
        });

        it('should render custom description', () => {
            render(<EmptyState description="Try adjusting your filters" />);

            expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
        });

        it('should render custom icon', () => {
            const { container } = render(<EmptyState icon={Search} />);

            const icon = container.querySelector('svg');
            expect(icon).toBeInTheDocument();
        });

        it('should render action button', () => {
            render(
                <EmptyState
                    action={<button>Create New</button>}
                />
            );

            expect(screen.getByRole('button', { name: 'Create New' })).toBeInTheDocument();
        });
    });

    describe('Layout', () => {
        it('should have centered layout', () => {
            const { container } = render(<EmptyState />);

            const wrapper = container.firstChild;
            expect(wrapper).toHaveClass('flex', 'flex-col', 'items-center', 'justify-center');
        });

        it('should have proper spacing', () => {
            const { container } = render(<EmptyState />);

            const wrapper = container.firstChild;
            expect(wrapper).toHaveClass('py-12', 'px-4');
        });

        it('should have icon container with background', () => {
            const { container } = render(<EmptyState />);

            const iconContainer = container.querySelector('.bg-gray-100.rounded-full');
            expect(iconContainer).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have proper heading structure', () => {
            render(<EmptyState title="No results" />);

            const heading = screen.getByRole('heading', { level: 3 });
            expect(heading).toHaveTextContent('No results');
        });

        it('should have proper text styling', () => {
            render(<EmptyState title="Test" />);

            const heading = screen.getByRole('heading');
            expect(heading).toHaveClass('text-lg', 'font-medium', 'text-gray-900');
        });
    });
});
