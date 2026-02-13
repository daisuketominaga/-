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
          red: "#E63946",
          dark: "#1D1D1D",
          darker: "#121212",
          card: "#1E1E1E",
          cardHover: "#2A2A2A",
          accent: "#FF4655",
          muted: "#888888",
          border: "#333333",
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
