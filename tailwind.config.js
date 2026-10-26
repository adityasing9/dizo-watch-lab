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
          bg: '#0b0f17',
          surface: '#121824',
          card: '#182030',
          border: '#243048',
          text: '#f1f5f9',
          muted: '#94a3b8',
          dim: '#64748b',
          accent: '#06b6d4', // cyan-500
          accentHover: '#0891b2',
          success: '#10b981', // emerald-500
          warning: '#f59e0b', // amber-500
          danger: '#ef4444', // red-500
          info: '#3b82f6', // blue-500
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
