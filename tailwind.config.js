import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [here('./index.html'), here('./src/**/*.{js,ts,jsx,tsx}')],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
