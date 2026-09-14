export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        navy: {
          DEFAULT: "#008643",
          dark: "#006B36",
          light: "#00A257",
        },
        gold: {
          DEFAULT: "#B08B2E",
          light: "#D4AF54",
        },
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        card: "0 2px 8px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04)",
        lifted: "0 12px 24px -8px rgba(0, 134, 67, 0.25)",
      },
    },
  },
  plugins: [],
};
