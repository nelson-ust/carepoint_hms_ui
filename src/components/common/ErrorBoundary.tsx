import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-secondary-50/30 p-6">
          <div className="glass-card rounded-[3rem] p-12 max-w-lg w-full border border-rose-100 bg-white/60 shadow-2xl text-center animate-fade-in">
            <div className="h-20 w-20 rounded-3xl bg-rose-500 text-white flex items-center justify-center mx-auto mb-8 shadow-xl shadow-rose-500/20">
               <AlertTriangle className="h-10 w-10" />
            </div>
            <h1 className="text-2xl font-black text-secondary-900 mb-4">Something went wrong</h1>
            <p className="text-sm text-secondary-500 font-medium leading-relaxed mb-10">
               We've encountered an unexpected interface error. Don't worry, your data is safe.
               <span className="block mt-4 p-4 rounded-2xl bg-rose-50 text-rose-600 font-mono text-[10px] break-all">
                  {this.state.error?.message}
               </span>
            </p>
            <div className="flex gap-4">
               <button 
                  onClick={() => window.location.reload()}
                  className="flex-1 btn-primary gap-3 py-4 rounded-2xl"
               >
                  <RefreshCw className="h-4 w-4" />
                  <span className="font-bold">Reload App</span>
               </button>
               <button 
                  onClick={() => window.location.href = '/'}
                  className="flex-1 btn-secondary gap-3 py-4 rounded-2xl"
               >
                  <Home className="h-4 w-4" />
                  <span className="font-bold">Go Home</span>
               </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
