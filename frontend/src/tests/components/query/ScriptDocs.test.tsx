/**
 * ScriptDocs Unit Tests (TypeScript)
 * Production-Grade Test Suite
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScriptDocs } from '@/components/query/ScriptDocs';

describe('ScriptDocs Component', () => {
    it('renders documentation header', () => {
        render(<ScriptDocs />);
        expect(screen.getByText('Script Documentation')).toBeInTheDocument();
    });

    it('displays usage instructions', () => {
        render(<ScriptDocs />);
        expect(screen.getByText(/database connections are automatically provided/i)).toBeInTheDocument();
        expect(screen.getByText(/pre-injected/i)).toBeInTheDocument();
    });

    it('renders Javascript controls section', () => {
        render(<ScriptDocs />);
        expect(screen.getByText('JavaScript Scripts (.js)')).toBeInTheDocument();
    });

    it('displays variable information', () => {
        render(<ScriptDocs />);
        expect(screen.getByText(/db - Database wrapper/i)).toBeInTheDocument();
    });

    it('shows code examples', () => {
        render(<ScriptDocs />);
        expect(screen.getByText('PostgreSQL Example:')).toBeInTheDocument();
        expect(screen.getByText('MongoDB Example:')).toBeInTheDocument();

        // Check for code content snippets
        expect(screen.getByText(/SELECT \* FROM users/i)).toBeInTheDocument();
        expect(screen.getByText(/db.collection\('users'\)/i)).toBeInTheDocument();
    });

    it('displays important notes', () => {
        render(<ScriptDocs />);
        const note = screen.getByText(/all operations are logged/i);
        expect(note).toBeInTheDocument();
    });
});
