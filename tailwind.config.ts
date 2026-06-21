import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        primary: {
          // Привязано к CSS-переменной темы окна (см. utils/themePalette.ts):
          // через `<alpha-value>` модификаторы прозрачности (bg-primary/10 и т.п.)
          // продолжают работать. --primary-rgb — каналы "r g b".
          DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)',
          hover: 'var(--primary-hover)',
          light: 'var(--primary-light)',
          strong: 'var(--primary-strong)',
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
        card: '0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.08)',
        popup: '0 8px 24px rgba(0, 0, 0, 0.12)',
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.22s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        spin: 'spin 0.5s linear',
      },
      keyframes: {
        'pulse-ring': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.5)', opacity: '0' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(12px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
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

export default config;