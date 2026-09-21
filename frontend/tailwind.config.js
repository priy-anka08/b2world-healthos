/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Sidebar + login now match the dusty-teal family too
        brand: {
          50: "#f4f8f7",
          100: "#DCEBE8",
          200: "#c3ddd8",
          300: "#a0c7c1",
          400: "#7daaa4",
          500: "#5F8F8B",
          600: "#4d7975",
          700: "#3f635f",
          800: "#33504d",
          900: "#2a413f",
          950: "#1c2f2d",
        },
        accent: {
          50: "#f1f7ef",
          100: "#e0efdb",
          200: "#c3dfba",
          300: "#a6cf9a",
          400: "#95bf8e",
          500: "#7AA874",
          600: "#699463",
          700: "#557a51",
        },
        // Main content pages — same dusty teal, kept as its own name too
        teal: {
          50: "#f4f8f7",
          100: "#DCEBE8",
          200: "#c3ddd8",
          300: "#a0c7c1",
          400: "#7daaa4",
          500: "#5F8F8B",
          600: "#4d7975",
          700: "#3f635f",
          800: "#33504d",
          900: "#2a413f",
        },
        success: { 50: "#f1f7ef", 100: "#e0efdb", 400: "#95bf8e", 500: "#7AA874", 600: "#699463", 700: "#557a51" },
        warning: { 50: "#fdf6ec", 100: "#faebd2", 400: "#eec48f", 500: "#E9B872", 600: "#d9a35a", 700: "#b3803f" },
        error: { 50: "#fbf1f1", 100: "#f6dede", 400: "#e29999", 500: "#D97777", 600: "#c65f5f", 700: "#a24a4a" },
        ink: {
          50: "#FAF8F4",
          100: "#eef0f3",
          200: "#E5E7EB",
          300: "#b7c0cc",
          400: "#8d97a6",
          500: "#6b7484",
          600: "#535b6b",
          700: "#374151",
          800: "#2c3140",
          900: "#1a1e29",
          950: "#0e1017",
        },
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(95,143,139,0.05), 0 1px 3px 0 rgba(95,143,139,0.08)",
        "card-hover": "0 8px 20px -4px rgba(95,143,139,0.16), 0 2px 6px -2px rgba(95,143,139,0.10)",
        glow: "0 0 0 1px rgba(95,143,139,0.18), 0 4px 16px -2px rgba(95,143,139,0.35)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #5F8F8B 0%, #4d7975 45%, #557a51 100%)",
        "sidebar-gradient": "linear-gradient(180deg, #1c2f2d 0%, #2a413f 55%, #1c2f2d 100%)",
        "teal-gradient": "linear-gradient(135deg, #5F8F8B 0%, #4d7975 100%)",
      },
    },
  },
  plugins: [],
};