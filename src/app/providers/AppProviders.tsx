import { AppRouter } from "@/app/router/AppRouter";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UIProvider } from "./UIProvider";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <UIProvider>
          <ThemeProvider>
            <AppRouter />
          </ThemeProvider>
        </UIProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
