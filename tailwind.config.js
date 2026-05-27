/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        hub: {
          bg: '#0c0d10',
          surface: '#14161c',
          surface2: '#1a1d26',
          border: '#2a2f3d',
          muted: '#8b93a8',
          accent: '#f97316',
          'accent-hover': '#ea580c',
          online: '#22c55e',
        },
      },
      fontFamily: {
        display: ['"DM Sans"', 'system-ui', 'sans-serif'],
        body: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
