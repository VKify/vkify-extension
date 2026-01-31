/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./welcome.html",
    "./uninstall.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0077FF',
          hover: '#0066DD',
          light: '#E3F2FF',
        },
        vk: {
          blue: '#0077FF',
          dark: '#1A1A1A',
          gray: {
            50: '#F7F8FA',
            100: '#EDEEF0',
            200: '#D3D5D9',
            300: '#99A2AD',
            400: '#818C99',
            500: '#6D7885',
            600: '#4A4A4A',
            700: '#2A2A2A',
            800: '#1E1E1E',
            900: '#141414',
          },
        },
        success: '#4BB34B',
        error: '#E64646',
        warning: '#FFA000',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'popup': '0 8px 24px rgba(0, 0, 0, 0.12)',
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'spin': 'spin 0.5s linear',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { transform: 'scale(1)', opacity: 1 },
          '50%': { transform: 'scale(1.5)', opacity: 0 },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: 0 },
          '100%': { transform: 'translateY(0)', opacity: 1 },
        },
        'fade-in': {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};