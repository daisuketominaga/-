import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1E3A5F",
          light: "#2A4F7F",
          dark: "#15294A",
        },
        status: {
          s: "#E74C3C",
          a: "#E67E22",
          b: "#F1C40F",
          c: "#2ECC71",
          d: "#3498DB",
          e: "#95A5A6",
        },
        reaction: {
          liked: "#2ECC71",
          considering: "#F1C40F",
          rejected: "#E74C3C",
          unchecked: "#95A5A6",
        },
        journal: {
          property: "#F39C12",
          value: "#9B59B6",
          normal: "#3498DB",
        },
      },
      fontFamily: {
        sans: [
          "Noto Sans JP",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Hiragino Sans",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
