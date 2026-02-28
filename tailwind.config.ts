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
        primary: {
          orange: "#FF7A45",
          coral: "#FF6B6B",
        },
        secondary: {
          cream: "#FFF5EB",
          beige: "#FFF0E0",
        },
        accent: {
          teal: "#2EC4B6",
          green: "#38D9A9",
        },
        text: {
          dark: "#3D3D3D",
          medium: "#6B6B6B",
          light: "#9B9B9B",
        },
        background: {
          light: "#FFFAF5",
          white: "#FFFFFF",
          gray: "#F8F8F8",
        },
      },
      fontFamily: {
        sans: [
          '"Noto Sans JP"',
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Hiragino Sans",
          "Hiragino Kaku Gothic ProN",
          "Meiryo",
          "sans-serif",
        ],
        display: [
          "Poppins",
          '"Noto Sans JP"',
          "sans-serif",
        ],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 2px 15px rgba(0, 0, 0, 0.05)",
        card: "0 4px 20px rgba(0, 0, 0, 0.08)",
        button: "0 4px 14px rgba(255, 122, 69, 0.3)",
      },
    },
  },
  plugins: [],
};
export default config;
