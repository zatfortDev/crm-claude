import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // No reintentar errores de cliente (4xx); sí errores de red/servidor hasta 2 veces.
        const status = error?.response?.status ?? 0;
        if (status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
