/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,tsx}',
    './src/**/*.{js,ts,tsx}',
    './components/**/*.{js,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        snap: {
          yellow: '#FFFC00',
          black: '#000000',
          ghost: '#FFFFFF',
          gray: '#8A8A8A',
          darkgray: '#1A1A1A',
          surface: '#111111',
          danger: '#FF3B30',
        },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
