import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "rgb(var(--bg) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        surface2: "rgb(var(--surface-2) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        inkDim: "rgb(var(--ink-dim) / <alpha-value>)",
        inkFaint: "rgb(var(--ink-faint) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        lineStrong: "rgb(var(--line-strong) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        accentInk: "rgb(var(--accent-ink) / <alpha-value>)",
        accentDim: "rgb(var(--accent-dim) / <alpha-value>)",
        good: "rgb(var(--good) / <alpha-value>)",
        goodBg: "rgb(var(--good-bg) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        warnBg: "rgb(var(--warn-bg) / <alpha-value>)",
        bad: "rgb(var(--bad) / <alpha-value>)",
        badBg: "rgb(var(--bad-bg) / <alpha-value>)",
        info: "rgb(var(--info) / <alpha-value>)",
        infoBg: "rgb(var(--info-bg) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-kanit)", "system-ui", "sans-serif"],
        body: ["var(--font-sarabun)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "14px",
      },
    },
  },
  plugins: [],
};
export default config;
