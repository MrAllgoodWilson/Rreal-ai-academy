import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        raised: "rgb(var(--raised) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        neon: "rgb(var(--neon) / <alpha-value>)",
        violet: "rgb(var(--violet) / <alpha-value>)",
        lime: "rgb(var(--lime) / <alpha-value>)",
        flame: "rgb(var(--flame) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--neon) / 0.35), 0 0 32px -4px rgb(var(--neon) / 0.45)",
        "glow-violet": "0 0 0 1px rgb(var(--violet) / 0.35), 0 0 32px -4px rgb(var(--violet) / 0.45)",
      },
      keyframes: {
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        flicker: { "0%,100%": { transform: "scale(1) rotate(-2deg)" }, "50%": { transform: "scale(1.08) rotate(2deg)" } },
      },
      animation: {
        shimmer: "shimmer 3s linear infinite",
        float: "float 6s ease-in-out infinite",
        flicker: "flicker 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
