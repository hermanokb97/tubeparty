/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    dark: '#050505',
                    red: '#0A84FF',
                    gray: '#1C1C1E',
                    text: '#F5F5F7',
                }
            },
            fontFamily: {
                sans: [
                    '-apple-system',
                    'BlinkMacSystemFont',
                    '"SF Pro Display"',
                    '"SF Pro Text"',
                    '"Segoe UI"',
                    'sans-serif',
                ],
            },
        },
    },
    plugins: [],
}
