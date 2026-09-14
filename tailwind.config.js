/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        obsidian: '#131315',
        basalt: '#1E1F22',
        hairline: '#2A2B30',
        sage: '#8FA89B',
        clay: '#D9A07E',
        slate2: '#7F94A6',
        parchment: '#ECEAE6',
        ash: '#8E8B85',
        tension: '#C8964F',
      },
      borderRadius: { '3xl': '24px' },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
