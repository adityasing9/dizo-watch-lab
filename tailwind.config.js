/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        lab: {
          bg: '#0a0f1d', // Dark navy
          surface: '#10172a', // Navy surface
          card: '#162238', // Elevated navy card
          border: '#223252', // Clean contrasting border
          text: '#f8fafc', // High-contrast text
          muted: '#94a3b8',
          dim: '#64748b',
          accent: '#facc15', // Bright yellow accent
          accentHover: '#eab308', // Darker yellow hover
          accentText: '#0a0f1d', // Contrast dark text on bright yellow
          success: '#10b981', // emerald-500
          warning: '#f59e0b', // amber-500
          danger: '#ef4444', // red-500
          info: '#38bdf8', // sky-400
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
