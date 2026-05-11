import { useState, useRef, useEffect } from "react";
import { ShieldCheck, ChevronRight, AlertCircle, RefreshCw } from "lucide-react";

export function TwoFactorForm() {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(60);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(timer - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    
    const newCode = [...code];
    newCode[index] = value.substring(value.length - 1);
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const data = e.clipboardData.getData("text").substring(0, 6).split("");
    const newCode = [...code];
    data.forEach((char, i) => {
      if (!isNaN(Number(char))) newCode[i] = char;
    });
    setCode(newCode);
    inputs.current[Math.min(data.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    const fullCode = code.join("");
    if (fullCode.length < 6) {
      setError("Please enter the complete 6-digit code.");
      setIsSubmitting(false);
      return;
    }

    // Mock API call
    setTimeout(() => {
      setIsSubmitting(false);
      // Logic for verification would go here
    }, 1500);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-500 shadow-xl shadow-primary-500/20">
            <ShieldCheck className="h-10 w-10 text-white" />
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-secondary-900 font-display">Two-Factor Auth</h1>
          <p className="mt-2 text-secondary-500 text-sm">
            We've sent a 6-digit verification code to your registered email address.
          </p>
        </div>

        <div className="glass-card rounded-3xl p-8 md:p-10">
          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="flex items-center gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-600 border border-rose-100 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <div className="flex justify-between gap-2 md:gap-3">
              {code.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  className="w-full h-14 md:h-16 text-center text-2xl font-bold rounded-2xl border border-secondary-200 bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 focus:outline-none transition-all"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full group py-4"
            >
              {isSubmitting ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <span>Verify Identity</span>
                  <ChevronRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center space-y-4">
            <p className="text-sm text-secondary-500">
              {timer > 0 ? (
                `Resend code in ${timer}s`
              ) : (
                <button 
                  onClick={() => setTimer(60)}
                  className="text-primary-600 font-bold hover:underline"
                >
                  Resend Code
                </button>
              )}
            </p>
            <button className="text-xs font-bold text-secondary-400 hover:text-secondary-600 uppercase tracking-widest transition-colors">
              Try another way
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
