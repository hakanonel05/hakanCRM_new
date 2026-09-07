/** @type {import('tailwindcss').Config} */

/* ============================================================================
   Renk sözlüğü src/index.css'teki :root bloğunda. Buradaki iş yalnızca o
   değişkenlere Tailwind adı vermek — hex YAZILMAZ, hepsi hsl(var(--x)).
   Palet ingilizcemerkez.netlify.app'ten birebir alındı.
   ============================================================================ */

module.exports = {
    /* darkMode kaldırıldı: tek tema. Kaynakta zaten tek bir "dark:" sınıfı
       yoktu, karanlık tema yalnızca CSS değişkenleriyle yapılıyordu. */
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
        "./public/index.html"
    ],
    theme: {
        extend: {
            /* Tek aile: Inter. Ayrım yazı tipiyle değil ağırlık ve harf
               aralığıyla. Mono yalnızca sayılarda — tutar ve tarih veridir. */
            fontFamily: {
                sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
                heading: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
            },
            borderRadius: {
                lg: 'var(--radius)',
                md: 'calc(var(--radius) - 4px)',
                sm: 'calc(var(--radius) - 7px)'
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
                /* shadcn'de "accent" hover/seçili ZEMİNİ demek. Vurgu rengi
                   değil — o "brand". */
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                    hover: 'hsl(var(--primary-hover))',
                },
                /* MARKA: turuncu. Vurgu ve kimlik için; düğme zemini DEĞİL. */
                brand: {
                    DEFAULT: 'hsl(var(--brand))',
                    strong: 'hsl(var(--brand-strong))',
                    soft: 'hsl(var(--brand-soft))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))'
                },
                /* Kenar çubuğu ikonları — bkz. index.css'teki not. */
                icon: {
                    analiz: 'hsl(var(--icon-analiz))',
                    kayit: 'hsl(var(--icon-kayit))',
                    akis: 'hsl(var(--icon-akis))',
                    kisi: 'hsl(var(--icon-kisi))',
                    sistem: 'hsl(var(--icon-sistem))',
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                /* Grafik serileri: gökkuşağı değil, mürekkepten kağıda inen
                   bir merdiven + marka turuncusu. Sıra anlam taşıyor. */
                chart: {
                    '1': 'hsl(var(--chart-1))',
                    '2': 'hsl(var(--chart-2))',
                    '3': 'hsl(var(--chart-3))',
                    '4': 'hsl(var(--chart-4))',
                    '5': 'hsl(var(--chart-5))'
                },
                /* Durum renkleri. "purple" ve "pink" KALDIRILDI: kaynakta hiç
                   kullanılmıyorlardı (0 eşleşme) ve mor yasak listesinin ilk
                   maddesi. "info" ayrı bir renk değil, nötr gri yüzey. */
                status: {
                    'success-bg': 'hsl(var(--status-success-bg))',
                    'success-fg': 'hsl(var(--status-success-fg))',
                    'success-line': 'hsl(var(--status-success-line))',
                    'danger-bg': 'hsl(var(--status-danger-bg))',
                    'danger-fg': 'hsl(var(--status-danger-fg))',
                    'danger-line': 'hsl(var(--status-danger-line))',
                    'warning-bg': 'hsl(var(--status-warning-bg))',
                    'warning-fg': 'hsl(var(--status-warning-fg))',
                    'warning-line': 'hsl(var(--status-warning-line))',
                    'info-bg': 'hsl(var(--status-info-bg))',
                    'info-fg': 'hsl(var(--status-info-fg))',
                    'info-line': 'hsl(var(--status-info-line))',
                    'neutral-bg': 'hsl(var(--status-neutral-bg))',
                    'neutral-fg': 'hsl(var(--status-neutral-fg))',
                },

                /* === ESKİ "Lumina MD3" ADLARI ===============================
                   Bunlar lacivert/teal sabit hex'lerdi ve 93 yerde yazılı.
                   Sınıfları silmek o 93 yeri kırardı; bunun yerine hepsi yeni
                   paletteki karşılığına BAĞLANDI. Yeni kodda kullanma —
                   adları artık gösterdikleri şeyi anlatmıyor. */
                'primary-container': 'hsl(var(--foreground))',
                'on-primary': 'hsl(var(--primary-foreground))',
                'on-primary-container': 'hsl(var(--muted-foreground))',
                'primary-fixed': 'hsl(var(--muted))',
                'primary-fixed-dim': 'hsl(var(--input))',
                'secondary-md': 'hsl(var(--muted-foreground))',
                'secondary-container': 'hsl(var(--muted))',
                'on-secondary-container': 'hsl(var(--muted-foreground))',
                'secondary-fixed': 'hsl(var(--muted))',
                'tertiary-md': 'hsl(var(--foreground))',
                'tertiary-fixed': 'hsl(var(--muted))',
                'tertiary-fixed-dim': 'hsl(var(--input))',
                'tertiary-container': 'hsl(var(--muted))',
                'on-tertiary-container': 'hsl(var(--muted-foreground))',
                'surface-lm': 'hsl(var(--background))',
                'surface-dim': 'hsl(var(--input))',
                'surface-bright': 'hsl(var(--card))',
                'surface-container': 'hsl(var(--muted))',
                'surface-container-low': 'hsl(var(--muted))',
                'surface-container-high': 'hsl(var(--muted))',
                'surface-container-highest': 'hsl(var(--input))',
                'surface-container-lowest': 'hsl(var(--card))',
                'on-surface': 'hsl(var(--foreground))',
                'on-surface-variant': 'hsl(var(--muted-foreground))',
                'outline-md': 'hsl(var(--muted-foreground))',
                'outline-variant': 'hsl(var(--input))',
                'inverse-surface': 'hsl(var(--foreground))',
                'inverse-on-surface': 'hsl(var(--background))',
                'error-container': 'hsl(var(--status-danger-bg))',
                'on-error-container': 'hsl(var(--status-danger-fg))',
            },
            /* Gölge yok. Kart ile zemin arasındaki fark tonda ve 1px çizgide.
               shadow-glass 6 yerde yazılı olduğu için adı duruyor ama artık
               hiçbir şey çizmiyor; glow'lar hiç kullanılmıyordu, silindi. */
            boxShadow: {
                'soft': 'none',
                'soft-lg': 'none',
                'glass': 'none',
            },
            keyframes: {
                'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
                'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
                'fade-in-up': { from: { opacity: '0' }, to: { opacity: '1' } },
            },
            animation: {
                'accordion-down': 'accordion-down 0.2s ease-out',
                'accordion-up': 'accordion-up 0.2s ease-out',
                'fade-in-up': 'fade-in-up 0.18s ease both',
            },
        }
    },
    plugins: [require("tailwindcss-animate")],
};
