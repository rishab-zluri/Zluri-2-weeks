import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryForm } from '@/components/query/QueryForm';

describe('QueryForm Component', () => {
    it('renders form fields with correct values', () => {
        const query = 'SELECT * FROM users';
        const comments = 'Test query';
        render(
            <QueryForm
                query={query}
                comments={comments}
                onQueryChange={vi.fn()}
                onCommentsChange={vi.fn()}
            />
        );

        expect(screen.getByPlaceholderText(/describe the purpose/i)).toHaveValue(comments);
        expect(screen.getByPlaceholderText(/enter your sql/i)).toHaveValue(query);
    });

    it('calls onCommentsChange when comments input changes', () => {
        const handleCommentsChange = vi.fn();
        render(
            <QueryForm
                query=""
                comments=""
                onQueryChange={vi.fn()}
                onCommentsChange={handleCommentsChange}
            />
        );

        const commentsInput = screen.getByPlaceholderText(/describe the purpose/i);
        fireEvent.change(commentsInput, { target: { value: 'New comment' } });

        expect(handleCommentsChange).toHaveBeenCalledWith('New comment');
    });

    it('calls onQueryChange when query input changes', () => {
        const handleQueryChange = vi.fn();
        render(
            <QueryForm
                query=""
                comments=""
                onQueryChange={handleQueryChange}
                onCommentsChange={vi.fn()}
            />
        );

        const queryInput = screen.getByPlaceholderText(/enter your sql/i);
        fireEvent.change(queryInput, { target: { value: 'SELECT * FROM pods' } });

        expect(handleQueryChange).toHaveBeenCalledWith('SELECT * FROM pods');
    });

    it('displays required indicators', () => {
        render(
            <QueryForm
                query=""
                comments=""
                onQueryChange={vi.fn()}
                onCommentsChange={vi.fn()}
            />
        );

        const labels = screen.getAllByText('*');
        expect(labels).toHaveLength(2); // One for each field
        labels.forEach(label => expect(label).toHaveClass('text-red-500'));
    });
});
