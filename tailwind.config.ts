import type { Config } from "tailwindcss";

/**
 * Pendo brand palette (sampled straight from pendo.io's stylesheet).
 *
 *   pink         #DE2864   primary accent (buttons, chart lead color, links)
 *   hotpink      #FF69B4   hover / highlight
 *   softpink     #FFB3C6   secondary accent
 *   palepink     #FFE4E9   accent background tints
 *   wine         #7A2133   deep secondary
 *   deepwine     #2B0007   near-black burgundy
 *   cream        #F6F7EF   signature warm page background
 *   beige        #F5F1E8   alt card/surface tint
 *   mist         #ECEEE7   divider / subtle border
 *   ink          #101010   headings
 *   body         #2A2A2A   body text
 */

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pendo: {
          pink: "#DE2864",
          hotpink: "#FF69B4",
          softpink: "#FFB3C6",
          palepink: "#FFE4E9",
          wine: "#7A2133",
          deepwine: "#2B0007",
          cream: "#F6F7EF",
          beige: "#F5F1E8",
          mist: "#ECEEE7",
          ink: "#101010",
          body: "#2A2A2A",
        },
        brand: {
          DEFAULT: "#DE2864",
          50: "#FFE4E9",
          100: "#FFB3C6",
          200: "#E4B4BE",
          300: "#FF69B4",
          500: "#DE2864",
          700: "#7A2133",
          900: "#2B0007",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "var(--font-sora)",
          "Sora",
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,16,16,0.04), 0 2px 6px rgba(16,16,16,0.06)",
      },
      borderRadius: {
        xl: "14px",
        "2xl": "20px",
      },
    },
  },
  plugins: [],
};

export default config;
