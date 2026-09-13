import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center bg-slate-50 dark:bg-secondary-950 transition-colors duration-500">
      {/* Ambient aurora + grid backdrop */}
      <div className="absolute inset-0 z-0 ambient-bg">
        <div className="absolute -top-[10%] -left-[10%] h-[45%] w-[45%] rounded-full bg-emerald-500/10 blur-[130px] animate-float" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[45%] w-[45%] rounded-full bg-cyan-500/10 blur-[130px] animate-float [animation-delay:2s]" />
        <div className="absolute top-1/3 right-1/4 h-[25%] w-[25%] rounded-full bg-violet-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full flex items-center justify-center">
        <Outlet />
      </div>
    </main>
  );
}
