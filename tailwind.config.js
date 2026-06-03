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
      animation: {
        fadeIn: 'fadeIn 0.4s ease-out forwards',
        slideUp: 'slideUp 0.4s ease-out forwards',
        breathe: 'breathe 4s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        scaleIn: 'scaleIn 0.3s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(0.85)', opacity: '0.7' },
          '50%': { transform: 'scale(1.15)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.9)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
