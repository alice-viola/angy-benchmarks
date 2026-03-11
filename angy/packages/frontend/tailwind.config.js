/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef7ff',
          100: '#d9ecff',
          200: '#bcddff',
          300: '#8ec8ff',
          400: '#59a8ff',
          500: '#3384fc',
          600: '#1d64f2',
          700: '#154fde',
          800: '#1840b4',
          900: '#19398e',
          950: '#142456',
        },
        accent: {
          50: '#fef3f2',
          100: '#fee4e2',
          200: '#fececa',
          300: '#fcaba4',
          400: '#f87c70',
          500: '#ef5544',
          600: '#dc3826',
          700: '#b92c1c',
          800: '#99281b',
          900: '#7f261d',
          950: '#450f0a',
        },
      },
    },
  },
  plugins: [],
};
