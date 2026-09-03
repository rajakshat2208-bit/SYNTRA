/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "#0e1419",
        surface: "#0e1621",
        "surface-container-lowest": "#090f14",
        "surface-container-low": "#161c22",
        "surface-container": "#1a2026",
        "surface-container-high": "#252b30",
        "surface-container-highest": "#2f353b",
        "surface-border": "#1c2633",
        "on-surface": "#dee3ea",
        "on-surface-variant": "#bac9cc",
        "primary-fixed-dim": "#00daf3",
        "primary-container": "#00e5ff",
        secondary: "#cdbdff",
        "secondary-container": "#5203d5",
        "operational-green": "#00c853",
        "warning-yellow": "#ffd600",
        "tertiary-fixed-dim": "#f3bf26",
        "critical-red": "#ff1744",
        error: "#ffb4ab",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
