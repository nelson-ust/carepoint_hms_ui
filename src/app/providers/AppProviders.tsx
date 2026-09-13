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
