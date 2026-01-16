import { useMutation, useQueryClient } from '@tanstack/react-query';
import queryService, { SubmitQueryInput, SubmitScriptInput } from '@/services/queryService';
import { toast } from 'react-hot-toast';
import { QUERY_KEYS } from './useQueries';

export const useSubmitQuery = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: SubmitQueryInput) => queryService.submitQuery(data),
        onSuccess: () => {
            toast.success('Query submitted successfully');
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.statusCounts });
            queryClient.invalidateQueries({ queryKey: ['requests'] }); // Invalidate all request lists
        },

    });
};

export const useSubmitScript = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: SubmitScriptInput) => queryService.submitScript(data),
        onSuccess: () => {
            toast.success('Script submitted successfully');
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.statusCounts });
            queryClient.invalidateQueries({ queryKey: ['requests'] });
        },
    });
};

export const useApproveRequest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ uuid, data }: { uuid: string; data?: object }) =>
            queryService.approveRequest(uuid, data),
        onSuccess: (_, { uuid }) => {
            toast.success('Request approved');
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.request(uuid) });
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.statusCounts });
        },
    });
};

export const useRejectRequest = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ uuid, reason }: { uuid: string; reason?: string }) =>
            queryService.rejectRequest(uuid, reason || null),
        onSuccess: (_, { uuid }) => {
            toast.success('Request rejected');
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.request(uuid) });
            queryClient.invalidateQueries({ queryKey: ['requests'] });
            queryClient.invalidateQueries({ queryKey: QUERY_KEYS.statusCounts });
        },
    });
};
