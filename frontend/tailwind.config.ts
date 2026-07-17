import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        popover: "hsl(var(--popover))",
        "popover-foreground": "hsl(var(--popover-foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        "border-hover": "hsl(var(--border-hover))",
        "border-dim": "hsl(var(--border-dim))",
        "border-subtle": "hsl(var(--border-subtle))",
        "border-accent": "hsl(var(--border-accent))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        elevated: "hsl(var(--elevated))",
        surface: {
          1: "hsl(var(--surface-1))",
          2: "hsl(var(--surface-2))",
          3: "hsl(var(--surface-3))",
        },
        cy: {
          DEFAULT: "var(--cyan)",
          dark: "var(--cyan)",
          glow: "var(--cyan-glow)",
        },
        purple: {
          DEFAULT: "var(--purple)",
          dark: "var(--purple)",
          glow: "var(--purple-glow)",
        },
        success: {
          DEFAULT: "var(--success)",
          dark: "var(--success)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          dark: "var(--warning)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          dark: "var(--danger)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "soft-card": "0 18px 48px rgba(19, 24, 32, 0.4)",
        glow: "0 0 24px rgba(0, 212, 255, 0.25)",
        "glow-sm": "0 0 12px rgba(0, 212, 255, 0.18)",
        "glow-cyan": "0 0 28px var(--cyan-glow)",
        "glow-purple": "0 0 28px var(--purple-glow)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-primary": "var(--gradient-primary)",
        "gradient-radial-glow":
          "radial-gradient(circle at 50% 0%, var(--cyan-glow), transparent 55%)",
        "login-grid":
          "linear-gradient(to right, rgba(0, 212, 255, 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 212, 255, 0.06) 1px, transparent 1px)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        shimmer: "shimmer 2s infinite linear",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.35s ease-out forwards",
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        spin: "spin 1s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
