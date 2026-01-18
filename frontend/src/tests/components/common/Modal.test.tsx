/**
 * Modal Component Unit Tests (TypeScript)
 * Production-Grade Test Suite
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Modal from '@/components/common/Modal';

describe('Modal Component', () => {
    const mockOnClose = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        document.body.style.overflow = '';
    });

    describe('Rendering', () => {
        it('should not render when isOpen is false', () => {
            render(
                <Modal isOpen={false} onClose={mockOnClose}>
                    <div>Modal Content</div>
                </Modal>
            );

            expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
        });

        it('should render when isOpen is true', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose}>
                    <div>Modal Content</div>
                </Modal>
            );

            expect(screen.getByText('Modal Content')).toBeInTheDocument();
        });

        it('should render title when provided', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose} title="Test Title">
                    <div>Content</div>
                </Modal>
            );

            expect(screen.getByText('Test Title')).toBeInTheDocument();
        });

        it('should render close button by default', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose} title="Test">
                    <div>Content</div>
                </Modal>
            );

            const closeButton = document.querySelector('button');
            expect(closeButton).toBeInTheDocument();
        });

        it('should not render close button when showClose is false', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose} showClose={false}>
                    <div>Content</div>
                </Modal>
            );

            const closeButton = document.querySelector('button');
            expect(closeButton).not.toBeInTheDocument();
        });
    });

    describe('Size Variants', () => {
        it('should apply sm size class', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose} size="sm">
                    <div>Content</div>
                </Modal>
            );

            const modalContent = document.querySelector('.max-w-md');
            expect(modalContent).toBeInTheDocument();
        });

        it('should apply lg size class', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose} size="lg">
                    <div>Content</div>
                </Modal>
            );

            const modalContent = document.querySelector('.max-w-2xl');
            expect(modalContent).toBeInTheDocument();
        });

        it('should apply xl size class', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose} size="xl">
                    <div>Content</div>
                </Modal>
            );

            const modalContent = document.querySelector('.max-w-4xl');
            expect(modalContent).toBeInTheDocument();
        });

        it('should apply full size class', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose} size="full">
                    <div>Content</div>
                </Modal>
            );

            const modalContent = document.querySelector('.max-w-6xl');
            expect(modalContent).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        it('should call onClose when close button is clicked', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose} title="Test">
                    <div>Content</div>
                </Modal>
            );

            const closeButton = document.querySelector('button');
            fireEvent.click(closeButton!);

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when backdrop is clicked', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose}>
                    <div>Content</div>
                </Modal>
            );

            const backdrop = document.querySelector('.bg-black.bg-opacity-50');
            fireEvent.click(backdrop!);

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });

        it('should not close when modal content is clicked', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose}>
                    <div>Content</div>
                </Modal>
            );

            fireEvent.click(screen.getByText('Content'));

            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('should call onClose when Escape key is pressed', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose}>
                    <div>Content</div>
                </Modal>
            );

            fireEvent.keyDown(document, { key: 'Escape' });

            expect(mockOnClose).toHaveBeenCalledTimes(1);
        });
    });

    describe('Body Scroll Lock', () => {
        it('should lock body scroll when modal opens', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose}>
                    <div>Content</div>
                </Modal>
            );

            expect(document.body.style.overflow).toBe('hidden');
        });
    });

    describe('Accessibility', () => {
        it('should have proper z-index for overlay', () => {
            render(
                <Modal isOpen={true} onClose={mockOnClose}>
                    <div>Content</div>
                </Modal>
            );

            const overlay = document.querySelector('.z-50');
            expect(overlay).toBeInTheDocument();
        });
    });
});
