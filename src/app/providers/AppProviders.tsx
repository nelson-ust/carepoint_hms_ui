import { AppRouter } from "@/app/router/AppRouter";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { persistThemePreference } from "@/lib/theme/theme.api";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UIProvider } from "./UIProvider";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ToastProvider } from "@/components/feedback/ToastProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      // Cut redundant background DB load: don't refetch every active query
      // just because the tab regained focus or the network reconnected.
      // Screens that need live data set an explicit refetchInterval; cached
      // data stays fresh for staleTime.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <UIProvider>
          <ThemeProvider onPersist={persistThemePreference}>
            <ToastProvider>
              <AppRouter />
            </ToastProvider>
          </ThemeProvider>
        </UIProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
