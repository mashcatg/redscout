/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{ts,tsx,html}"],
  theme: {
    extend: {
      colors: {
        bg: "hsl(var(--bg))",
        fg: "hsl(var(--fg))",
        muted: "hsl(var(--muted))",
        mutedfg: "hsl(var(--muted-fg))",
        border: "hsl(var(--border))",
        primary: "hsl(var(--primary))",
        primaryfg: "hsl(var(--primary-fg))",
        card: "hsl(var(--card))",
        accent: "hsl(var(--accent))",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["'Instrument Serif'", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
