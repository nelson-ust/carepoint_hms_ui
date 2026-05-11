import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <main className="min-h-screen bg-slate-50 relative overflow-hidden flex items-center justify-center px-4">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-[10%] -left-[10%] h-[40%] w-[40%] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute -bottom-[10%] -right-[10%] h-[40%] w-[40%] rounded-full bg-brand-navy/5 blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />
      </div>

      <div className="relative z-10 w-full flex items-center justify-center">
        <Outlet />
      </div>
    </main>
  );
}

