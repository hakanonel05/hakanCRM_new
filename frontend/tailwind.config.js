/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Urbanist', 'system-ui', '-apple-system', 'sans-serif'],
                heading: ['Urbanist', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 2px)',
                sm: 'calc(var(--radius) - 4px)'
            },
            colors: {
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
                surface: 'hsl(var(--surface))',
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))'
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))'
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                    hover: 'hsl(var(--primary-hover))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))'
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))'
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                    hover: 'hsl(var(--primary-hover))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                },
                status: {
                    'success-bg': 'hsl(var(--status-success-bg))',
                    'success-fg': 'hsl(var(--status-success-fg))',
                    'info-bg': 'hsl(var(--status-info-bg))',
                    'info-fg': 'hsl(var(--status-info-fg))',
                    'warning-bg': 'hsl(var(--status-warning-bg))',
                    'warning-fg': 'hsl(var(--status-warning-fg))',
                    'purple-bg': 'hsl(var(--status-purple-bg))',
                    'purple-fg': 'hsl(var(--status-purple-fg))',
                    'danger-bg': 'hsl(var(--status-danger-bg))',
                    'danger-fg': 'hsl(var(--status-danger-fg))',
                    'pink-bg': 'hsl(var(--status-pink-bg))',
                    'pink-fg': 'hsl(var(--status-pink-fg))',
                },
                // === Lumina MD3 Design Tokens ===
                'primary-container': '#1b405b',
                'on-primary': '#ffffff',
                'on-primary-container': '#89accb',
                'primary-fixed': '#cce5ff',
                'primary-fixed-dim': '#a7caeb',
                'secondary-md': '#50625c',
                'secondary-container': '#d3e7df',
                'on-secondary-container': '#566862',
                'secondary-fixed': '#d3e7df',
                'tertiary-md': '#0e2a3d',
                'tertiary-fixed': '#cbe6ff',
                'tertiary-fixed-dim': '#afcae2',
                'tertiary-container': '#264054',
                'on-tertiary-container': '#91abc3',
                'surface-lm': '#f6fafd',
                'surface-dim': '#d6dbdd',
                'surface-bright': '#f6fafd',
                'surface-container': '#eaeef1',
                'surface-container-low': '#f0f4f7',
                'surface-container-high': '#e5e9ec',
                'surface-container-highest': '#dfe3e6',
                'surface-container-lowest': '#ffffff',
                'on-surface': '#171c1f',
                'on-surface-variant': '#42474d',
                'outline-md': '#72777e',
                'outline-variant': '#c2c7ce',
                'inverse-surface': '#2c3134',
                'inverse-on-surface': '#edf1f4',
                'error-container': '#ffdad6',
                'on-error-container': '#93000a',
            },
            boxShadow: {
                'soft': '0 2px 8px -2px rgba(0,0,0,0.04), 0 4px 16px -4px rgba(0,0,0,0.04)',
                'soft-lg': '0 8px 24px -8px rgba(0,0,0,0.08), 0 4px 8px -4px rgba(0,0,0,0.04)',
                'glow': '0 0 24px -4px hsl(var(--accent) / 0.35)',
                'glow-lg': '0 0 32px -2px hsl(var(--accent) / 0.45)',
                'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
                'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
            },
            keyframes: {
                'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
                'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
                'fade-in-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'fade-in-up': 'fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
            },
            backdropBlur: {
                xs: '2px',
            },
        }
    },
    plugins: [require("tailwindcss-animate")],
};
