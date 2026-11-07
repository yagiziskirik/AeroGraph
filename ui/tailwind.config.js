/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: {
          0: "var(--void-0, #060709)",
          1: "var(--void-1, #0B0D12)",
          2: "var(--void-2, #11151E)",
          3: "var(--void-3, #181E2B)",
        },
        border: {
          hairline: "var(--border-hairline, #222A3A)",
          active: "var(--border-active, #3B4861)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent-rgb, 16 185 129) / <alpha-value>)",
          phosphor: "#10B981",
          nvg: "#22E385",
          amber: "#F59E0B",
          cyan: "#38BDF8",
          coral: "#EF4444",
        },
        text: {
          primary: "var(--text-primary, #F8FAFC)",
          muted: "var(--text-muted, #94A3B8)",
          dim: "var(--text-dim, #475569)",
        },
      },
      fontFamily: {
        sans: ['"Chakra Petch"', 'system-ui', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'Consolas', 'monospace'],
        panel: ['"Chakra Petch"', 'sans-serif'],
      },
      boxShadow: {
        'accent-glow-sm': '0 0 10px -2px var(--accent-glow, rgba(16, 185, 129, 0.35))',
        'accent-glow': '0 0 20px -4px var(--accent-glow, rgba(16, 185, 129, 0.4))',
        'amber-glow-sm': '0 0 10px -2px rgba(245, 158, 11, 0.4)',
        'cyan-glow-sm': '0 0 10px -2px rgba(56, 189, 248, 0.4)',
        'coral-glow-sm': '0 0 10px -2px rgba(239, 68, 68, 0.4)',
      },
    },
  },
  plugins: [],
};
