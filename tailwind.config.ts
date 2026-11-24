import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#10222b", muted: "#5d7079", line: "#d8e0e3", paper: "#f3f6f7",
        sea: "#0e6e73", gain: "#0f8a4f", loss: "#c8372d",
      },
      fontFamily: { sans: ["var(--font-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
} satisfies Config;
