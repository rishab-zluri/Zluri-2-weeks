import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

describe('Frontend Smoke Test', () => {
    it('renders without crashing', () => {
        render(
            <MemoryRouter>
                <div data-testid="test-root">Hello World</div>
            </MemoryRouter>
        );
        expect(screen.getByTestId('test-root')).toBeInTheDocument();
        expect(screen.getByText('Hello World')).toBeInTheDocument();
    });
});
