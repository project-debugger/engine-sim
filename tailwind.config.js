/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./web_src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        engineDark: '#0d1117',
        cardDark: '#161b22',
        borderDark: '#30363d',
      }
    },
  },
  plugins: [],
}
