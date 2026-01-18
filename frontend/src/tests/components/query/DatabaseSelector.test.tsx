/**
 * DatabaseSelector Unit Tests (TypeScript)
 * Production-Grade Test Suite
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DatabaseSelector } from '@/components/query/DatabaseSelector';
import { DatabaseType } from '@/types';

describe('DatabaseSelector Component', () => {
    const mockOnInstanceChange = vi.fn();
    const mockOnDatabaseChange = vi.fn();
    const mockOnPodChange = vi.fn();

    const defaultProps = {
        instances: [
            { id: 'inst-1', instanceId: 'db-1', name: 'Primary DB', type: 'postgresql' as DatabaseType, host: 'localhost', port: 5432 },
            { id: 'inst-2', instanceId: 'db-2', name: 'Analytics DB', type: 'mysql' as DatabaseType, host: 'localhost', port: 3306 },
        ],
        pods: [
            { id: 'pod-1', name: 'Core Pod', code: 'core' },
        ],
        databases: [],
        loadingDatabases: false,
        selectedInstanceId: '',
        selectedDatabaseName: '',
        selectedPodId: '',
        onInstanceChange: mockOnInstanceChange,
        onDatabaseChange: mockOnDatabaseChange,
        onPodChange: mockOnPodChange,
    };

    it('renders all select fields', () => {
        render(<DatabaseSelector {...defaultProps} />);

        expect(screen.getByText(/instance name/i)).toBeInTheDocument();
        expect(screen.getByText(/database name/i)).toBeInTheDocument();
        expect(screen.getByText(/pod name/i)).toBeInTheDocument();
    });

    it('displays instances in dropdown', () => {
        render(<DatabaseSelector {...defaultProps} />);

        const instanceSelect = screen.getByDisplayValue('Select Instance');
        expect(instanceSelect).toBeInTheDocument();
        expect(screen.getByText('Primary DB (postgresql)')).toBeInTheDocument();
    });

    it('calls onInstanceChange when instance selected', () => {
        render(<DatabaseSelector {...defaultProps} />);

        const instanceSelect = screen.getAllByRole('combobox')[0]; // First select is Instance
        fireEvent.change(instanceSelect, { target: { value: 'inst-1' } });

        expect(mockOnInstanceChange).toHaveBeenCalledWith('inst-1');
    });

    it('disables database select when no instance selected', () => {
        render(<DatabaseSelector {...defaultProps} selectedInstanceId="" />);

        const databaseSelect = screen.getAllByRole('combobox')[1];
        expect(databaseSelect).toBeDisabled();
        // Option text
        expect(screen.getByText('← Select an instance first')).toBeInTheDocument();
        // Tooltip text
        expect(screen.getByText('Please select an instance first')).toBeInTheDocument();
    });

    it('enables database select when instance selected', () => {
        render(<DatabaseSelector {...defaultProps} selectedInstanceId="inst-1" />);

        const databaseSelect = screen.getAllByRole('combobox')[1];
        expect(databaseSelect).not.toBeDisabled();
        expect(screen.queryByText(/select an instance first/i)).not.toBeInTheDocument();
    });

    it('displays loading spinner for databases', () => {
        render(<DatabaseSelector {...defaultProps} selectedInstanceId="inst-1" loadingDatabases={true} />);

        const databaseSelect = screen.getAllByRole('combobox')[1];
        expect(databaseSelect).toBeDisabled();
        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
    });

    it('displays databases when loaded', () => {
        const props = {
            ...defaultProps,
            selectedInstanceId: 'inst-1',
            databases: ['users_db', 'orders_db'],
        };
        render(<DatabaseSelector {...props} />);

        expect(screen.getByText('users_db')).toBeInTheDocument();
        expect(screen.getByText('orders_db')).toBeInTheDocument();
    });

    it('calls onDatabaseChange when database selected', () => {
        const props = {
            ...defaultProps,
            selectedInstanceId: 'inst-1',
            databases: ['users_db'],
        };
        render(<DatabaseSelector {...props} />);

        const databaseSelect = screen.getAllByRole('combobox')[1];
        fireEvent.change(databaseSelect, { target: { value: 'users_db' } });

        expect(mockOnDatabaseChange).toHaveBeenCalledWith('users_db');
    });

    it('calls onPodChange when pod selected', () => {
        render(<DatabaseSelector {...defaultProps} />);

        const podSelect = screen.getAllByRole('combobox')[2];
        fireEvent.change(podSelect, { target: { value: 'pod-1' } });

        expect(mockOnPodChange).toHaveBeenCalledWith('pod-1');
    });
});
