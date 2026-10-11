/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0A0A0B',
        surface: '#131314',
        'surface-container': '#201f20',
        primary: '#d0bcff',
        'on-primary': '#3c0091',
        'on-surface': '#e5e2e3',
        'on-surface-variant': '#cbc3d7',
        tertiary: '#ffb4aa',
        'on-tertiary': '#690003',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(to right, #0A0A0B 0%, rgba(10,10,11,0.8) 40%, transparent 100%), linear-gradient(to top, #0A0A0B 0%, transparent 40%)',
      },
    },
  },
  plugins: [],
};
