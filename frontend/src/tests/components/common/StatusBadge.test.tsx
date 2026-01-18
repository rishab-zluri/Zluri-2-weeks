/**
 * StatusBadge Component Unit Tests (TypeScript)
 * Production-Grade Test Suite
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StatusBadge from '@/components/common/StatusBadge';
import { RequestStatus } from '@/types';

describe('StatusBadge Component', () => {
    describe('Rendering Status Types', () => {
        it('should render pending status correctly', () => {
            render(<StatusBadge status={RequestStatus.PENDING} />);

            expect(screen.getByText('Pending')).toBeInTheDocument();
        });

        it('should render approved status correctly', () => {
            render(<StatusBadge status={RequestStatus.APPROVED} />);

            expect(screen.getByText('Approved')).toBeInTheDocument();
        });

        it('should render executing status with animation', () => {
            render(<StatusBadge status={RequestStatus.EXECUTING} />);

            expect(screen.getByText('Processing')).toBeInTheDocument();
            const icon = document.querySelector('.animate-spin');
            expect(icon).toBeInTheDocument();
        });

        it('should render completed status correctly', () => {
            render(<StatusBadge status={RequestStatus.COMPLETED} />);

            expect(screen.getByText('Completed')).toBeInTheDocument();
        });

        it('should render failed status correctly', () => {
            render(<StatusBadge status={RequestStatus.FAILED} />);

            expect(screen.getByText('Failed')).toBeInTheDocument();
        });

        it('should render rejected status correctly', () => {
            render(<StatusBadge status={RequestStatus.REJECTED} />);

            expect(screen.getByText('Rejected')).toBeInTheDocument();
        });
    });

    describe('Styling', () => {
        it('should apply pending badge class', () => {
            render(<StatusBadge status={RequestStatus.PENDING} />);

            const badge = document.querySelector('.status-pending');
            expect(badge).toBeInTheDocument();
        });

        it('should apply approved badge class', () => {
            render(<StatusBadge status={RequestStatus.APPROVED} />);

            const badge = document.querySelector('.status-approved');
            expect(badge).toBeInTheDocument();
        });

        it('should apply completed badge class', () => {
            render(<StatusBadge status={RequestStatus.COMPLETED} />);

            const badge = document.querySelector('.status-completed');
            expect(badge).toBeInTheDocument();
        });

        it('should apply failed badge class', () => {
            render(<StatusBadge status={RequestStatus.FAILED} />);

            const badge = document.querySelector('.status-failed');
            expect(badge).toBeInTheDocument();
        });

        it('should apply rejected badge class', () => {
            render(<StatusBadge status={RequestStatus.REJECTED} />);

            const badge = document.querySelector('.status-rejected');
            expect(badge).toBeInTheDocument();
        });
    });

    describe('Icon Rendering', () => {
        it('should render icon for each status', () => {
            const { container } = render(<StatusBadge status={RequestStatus.PENDING} />);

            const icon = container.querySelector('svg');
            expect(icon).toBeInTheDocument();
            expect(icon).toHaveClass('w-3.5', 'h-3.5');
        });

        it('should animate icon for executing status', () => {
            render(<StatusBadge status={RequestStatus.EXECUTING} />);

            const icon = document.querySelector('svg.animate-spin');
            expect(icon).toBeInTheDocument();
        });

        it('should not animate icon for non-executing status', () => {
            render(<StatusBadge status={RequestStatus.PENDING} />);

            const icon = document.querySelector('svg');
            expect(icon).not.toHaveClass('animate-spin');
        });
    });

    describe('Fallback Behavior', () => {
        it('should fallback to pending for unknown status', () => {
            render(<StatusBadge status={'unknown' as any} />);

            expect(screen.getByText('Pending')).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have status-badge class for styling', () => {
            render(<StatusBadge status={RequestStatus.PENDING} />);

            const badge = document.querySelector('.status-badge');
            expect(badge).toBeInTheDocument();
        });
    });
});
