import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        umd: {
          red: "#CC0033",
          "red-dark": "#8a0020",
          "red-light": "#ff1a4a",
          gold: "#FFD200",
          "gold-dim": "#b39800",
        },
        surface: {
          DEFAULT: "#0a0a0a",
          "1": "#111111",
          "2": "#161616",
          "3": "#1e1e1e",
          "4": "#262626",
        },
        text: {
          primary: "#f0f0f0",
          secondary: "#a0a0a0",
          muted: "#555555",
        },
        macro: {
          cal: "#FFD200",
          protein: "#CC0033",
          carbs: "#10b981",
          fat: "#8b5cf6",
        },
      },
      fontFamily: {
        display: ["'Bebas Neue'", "cursive"],
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease forwards",
        "slide-up": "slideUp 0.4s ease forwards",
        spin: "spin 0.8s linear infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(16px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};

export default config;
