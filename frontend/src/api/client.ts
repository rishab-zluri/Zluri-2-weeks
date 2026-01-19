import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'react-hot-toast';

// Define standard API response wrapper
export interface ApiResponse<T = any> {
    success: boolean;
    data: T;
    message?: string;
}

// Create Axios Instance
const client: AxiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // IMPORTANT: Send cookies with every request
});

// Request Interceptor
client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // No need to manually attach tokens - Cookies handle it!
        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

// Response Interceptor
client.interceptors.response.use(
    (response) => {
        // Unwrap standard response format if present
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Loop Prevention: If we are already failing on the refresh endpoint itself, do NOT retry
        // AND ensure we redirect to login to stop the madness
        if (error.config?.url?.includes('/refresh') || error.config?.url?.includes('/login')) {
            return Promise.reject(error);
        }

        // Handle 401 Unauthorized - Token Refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
                // Call refresh endpoint - Cookies should be sent automatically
                await client.post('/api/auth/refresh');

                // Retry original request
                return client(originalRequest);
            } catch (refreshError) {
                // Refresh failed - User must log in again
                // Prevent infinite loops by checking the URL and avoiding recursive calls
                if (!window.location.pathname.includes('/login')) {
                    // dispatched event to clear context if needed, but hard redirect is safest
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            }
        }

        // Handle 403 Forbidden - Access Denied
        if (error.response?.status === 403) {
            toast.error('Access denied. You do not have permission to perform this action.');
            return Promise.reject(error);
        }

        // Global Error Toasts (skip 401 and Canceled requests)
        if (error.response?.status !== 401 && !axios.isCancel(error)) {
            const message = (error.response?.data as any)?.message || 'Something went wrong';
            toast.error(message);
        }

        return Promise.reject(error);
    }
);

export default client;
