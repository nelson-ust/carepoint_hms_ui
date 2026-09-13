/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#0F172A",
          emerald: "#10B981",
          rose: "#E11D48",
          gray: "#F8FAFC",
        },
        // Semantic overrides for Tailwind colors
        primary: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10B981", // Brand Emerald
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
        secondary: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a", // Brand Navy
          950: "#020617",
        },
        accent: {
          cyan: "#22d3ee",
          violet: "#a78bfa",
          amber: "#fbbf24",
          rose: "#fb7185",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(15, 23, 42, 0.05)",
        premium:
          "0 20px 25px -5px rgb(0 0 0 / 0.05), 0 8px 10px -6px rgb(0 0 0 / 0.05)",
        "premium-lg":
          "0 32px 64px -12px rgb(2 6 23 / 0.18), 0 12px 24px -8px rgb(2 6 23 / 0.10)",
        glow: "0 0 24px 0 rgba(16, 185, 129, 0.35)",
        "glow-sm": "0 0 12px 0 rgba(16, 185, 129, 0.25)",
        "glow-rose": "0 0 20px 0 rgba(244, 63, 94, 0.30)",
        "glow-amber": "0 0 20px 0 rgba(245, 158, 11, 0.30)",
        "glow-cyan": "0 0 20px 0 rgba(34, 211, 238, 0.30)",
        "inner-highlight": "inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
      },
      backgroundImage: {
        "aurora-dark":
          "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(16,185,129,0.13), transparent), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(34,211,238,0.08), transparent), radial-gradient(ellipse 70% 50% at 50% 110%, rgba(167,139,250,0.07), transparent)",
        "aurora-light":
          "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(16,185,129,0.07), transparent), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(34,211,238,0.05), transparent)",
        "grid-slate":
          "linear-gradient(to right, rgba(100,116,139,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(100,116,139,0.06) 1px, transparent 1px)",
        "gradient-primary": "linear-gradient(135deg, #10B981 0%, #059669 60%, #047857 100%)",
        "gradient-sheen":
          "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.06) 45%, transparent 60%)",
      },
      backgroundSize: {
        grid: "32px 32px",
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        shimmer: "shimmer 2.4s linear infinite",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        float: "float 7s ease-in-out infinite",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "slide-up": {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 16px 0 rgba(16,185,129,0.18)" },
          "50%": { boxShadow: "0 0 28px 4px rgba(16,185,129,0.32)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
    },
  },
  safelist: [
    // Tint utilities composed dynamically in stat tiles / metric cards
    { pattern: /bg-(emerald|rose|amber|cyan|violet|sky|indigo|primary|secondary)-500\/10/ },
    { pattern: /text-(emerald|rose|amber|cyan|violet|sky|indigo|primary|secondary)-(400|500|600)/ },
  ],
  plugins: [],
};
