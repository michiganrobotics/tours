/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  darkMode: 'media', // Use system preference for dark mode
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Open Sans', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'heading': ['Roboto', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}