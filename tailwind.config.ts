import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#1B3A5C",
          "navy-light": "#2A5580",
          gold: "#D4A853",
          "gold-light": "#E8C97A",
          green: "#5B9A8B",
          "green-light": "#7BB5A7",
        },
        background: {
          warm: "#FAFAF7",
          cream: "#F5F0E8",
          card: "#FFFFFF",
        },
        text: {
          primary: "#2D2D2D",
          secondary: "#6B7280",
          muted: "#9CA3AF",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Hiragino Sans",
          "Hiragino Kaku Gothic ProN",
          "Meiryo",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
