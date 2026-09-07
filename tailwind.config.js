/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', "Inter", "sans-serif"],
        sans: ["Inter", "sans-serif"],
        mono: ['"IBM Plex Mono"', "monospace"],
      },
      colors: {
        brand: {
          primary: "rgb(var(--brand-primary) / <alpha-value>)",
          light: "rgb(var(--brand-light) / <alpha-value>)",
          faint: "rgb(var(--brand-faint) / <alpha-value>)",
          purple: "rgb(var(--brand-primary) / <alpha-value>)",
        },
        semantic: {
          success: "rgb(var(--semantic-success) / <alpha-value>)",
          warning: "rgb(var(--semantic-warning) / <alpha-value>)",
          error: "rgb(var(--semantic-error) / <alpha-value>)",
          info: "rgb(var(--semantic-info) / <alpha-value>)",
          neutral: "rgb(var(--semantic-neutral) / <alpha-value>)",
        },
        surface: {
          bg: "rgb(var(--surface-bg) / <alpha-value>)",
          card: "rgb(var(--surface-card) / <alpha-value>)",
          panel: "rgb(var(--surface-panel) / <alpha-value>)",
          border: "rgb(var(--surface-border) / <alpha-value>)",
        },
        graphite: {
          950: "rgb(var(--graphite-950) / <alpha-value>)",
          900: "rgb(var(--graphite-900) / <alpha-value>)",
          800: "rgb(var(--graphite-800) / <alpha-value>)",
        },
      },
      borderRadius: {
        card: "18px",
        btn: "10px",
        input: "12px",
      },
      boxShadow: {
        card: "0 6px 18px rgba(2, 6, 23, 0.09)",
        btn: "0 6px 14px rgba(0, 137, 191, 0.14)",
        "btn-hover": "0 8px 18px rgba(0, 137, 191, 0.18)",
      },
    },
  },
  plugins: [],
};
