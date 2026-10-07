/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        // Light theme surfaces
        surface: {
          DEFAULT: '#FFFFFF',
          2: '#F1F5F9',
          3: '#F8FAFC',
        },
        // Brand
        brand: {
          DEFAULT: '#4F46E5',
          light: '#EEF2FF',
          hover: '#4338CA',
        },
      },
      borderColor: {
        DEFAULT: '#E2E8F0',
        subtle: '#F1F5F9',
        strong: '#CBD5E1',
      },
      boxShadow: {
        sm:  '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
        md:  '0 4px 16px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.04)',
        lg:  '0 12px 40px rgba(15,23,42,0.12), 0 4px 16px rgba(15,23,42,0.06)',
        xl:  '0 24px 60px rgba(15,23,42,0.16), 0 8px 24px rgba(15,23,42,0.08)',
      },
      animation: {
        'fade-in':    'fadeIn 0.25s ease forwards',
        'scale-in':   'fadeInScale 0.2s ease forwards',
        'slide-down': 'slideDown 0.2s ease forwards',
        'spin-slow':  'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInScale: {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '20px',
      },
    },
  },
  plugins: [],
};
