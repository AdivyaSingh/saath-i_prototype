/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary:  '#1B3A6B',   // Navy — headers, key actions, student nav
        accent:   '#2E75B6',   // Blue — interactive elements, buttons
        warm:     '#E87722',   // Orange — companion, encouragement, primary CTAs
        success:  '#2E8B57',   // Green — mastery, achievements, correct states
        calm:     '#00B0A0',   // Teal — teacher interface accents
        muted:    '#6B7280',   // Grey — secondary text
        surface:  '#F5F5F5',   // Off-white — page backgrounds
        card:     '#FFFFFF',   // Pure white — card backgrounds
      },
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
