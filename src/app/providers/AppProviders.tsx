import { AppRouter } from "@/app/router/AppRouter";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

export function AppProviders() {
  return (
    <ThemeProvider>
      <AppRouter />
    </ThemeProvider>
  );
}
