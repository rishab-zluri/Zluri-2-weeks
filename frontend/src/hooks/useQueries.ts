import { useQuery, keepPreviousData } from '@tanstack/react-query';
import queryService, { RequestFilters } from '@/services/queryService';
import { DatabaseType, RequestStatus } from '@/types';

// Keys for caching
export const QUERY_KEYS = {
    instances: (type?: string) => ['instances', type],
    databases: (instanceId: string) => ['databases', instanceId],
    pods: ['pods'],
    requests: (filters: RequestFilters) => ['requests', filters],
    request: (uuid: string) => ['request', uuid],
    statusCounts: ['statusCounts'],
};

export const useInstances = (type?: DatabaseType | null) => {
    return useQuery({
        queryKey: QUERY_KEYS.instances(type || 'all'),
        queryFn: () => queryService.getInstances(type),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export const useDatabases = (instanceId: string | null) => {
    return useQuery({
        queryKey: QUERY_KEYS.databases(instanceId || ''),
        queryFn: () => queryService.getDatabases(instanceId!),
        enabled: !!instanceId,
        staleTime: 5 * 60 * 1000,
    });
};

export const usePods = () => {
    return useQuery({
        queryKey: QUERY_KEYS.pods,
        queryFn: () => queryService.getPods(),
        staleTime: 60 * 60 * 1000, // 1 hour (rarely changes)
    });
};

export const useRequests = (filters: RequestFilters) => {
    return useQuery({
        queryKey: QUERY_KEYS.requests(filters),
        queryFn: () => queryService.getRequests(filters),
        placeholderData: keepPreviousData, // Keep old data while fetching new page
        staleTime: 30 * 1000, // 30 seconds
    });
};

export const useRequest = (uuid: string | undefined) => {
    return useQuery({
        queryKey: QUERY_KEYS.request(uuid || ''),
        queryFn: () => queryService.getRequest(uuid!),
        enabled: !!uuid,
        retry: 1,
    });
};

export const useStatusCounts = () => {
    return useQuery({
        queryKey: QUERY_KEYS.statusCounts,
        queryFn: () => queryService.getMyStatusCounts(),
        refetchInterval: 60 * 1000, // Poll every minute
    });
};
