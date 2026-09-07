// craco.config.js
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
  enableVisualEdits: isDevServer, // Only enable during dev server
};

// Conditionally load visual edits modules only in dev mode
let setupDevServer;
let babelMetadataPlugin;

if (config.enableVisualEdits) {
  setupDevServer = require("./plugins/visual-edits/dev-server-setup");
  babelMetadataPlugin = require("./plugins/visual-edits/babel-metadata-plugin");
}

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

// KORUMA: localhost adresli bir üretim derlemesi çıkmasın.
//
// CRA, REACT_APP_* değişkenlerini pakete GÖMER. Localde deneme yaparken
// .env.local içinde REACT_APP_BACKEND_URL=http://localhost:8787 duruyor;
// o dosya yerindeyken `npm run build` çalıştırılıp klasör elle yayına
// atılırsa canlı site localhost'a sorar ve hiç veri göstermez. Ekranda bu
// "bütün veriler gitti" gibi görünür — oysa veri yerinde durur, uygulama
// yanlış adrese sorar. Derleme burada duruyor.
//
// Netlify kendi ortam değişkeniyle derlediği için oradaki akış etkilenmez;
// .env.local zaten git tarafından takip edilmiyor.
//
// DEĞERİ KENDİMİZ ÇÖZÜYORUZ: bu dosya çalıştığında CRA henüz .env
// dosyalarını yüklememiş oluyor, yukarıdaki dotenv çağrısı da yalnızca
// `.env`i okuyor. İlk sürüm bu yüzden değişkeni hep "boş" görüyordu ve
// korumanın var olma sebebi olan durumu yakalamıyordu.
function _arkaUcAdresi() {
  if (process.env.REACT_APP_BACKEND_URL) return process.env.REACT_APP_BACKEND_URL;
  // CRA'nın okuma sırası (öncelikli olan önce).
  const dosyalar = [".env.production.local", ".env.local", ".env.production", ".env"];
  for (const ad of dosyalar) {
    const p = path.resolve(__dirname, ad);
    if (!fs.existsSync(p)) continue;
    for (const satir of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = satir.match(/^\s*REACT_APP_BACKEND_URL\s*=\s*(.*)\s*$/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  return "";
}

if (process.env.NODE_ENV === "production") {
  const arkaUc = _arkaUcAdresi();
  if (/localhost|127\.0\.0\.1/.test(arkaUc)) {
    throw new Error(
      "\n\nÜRETİM DERLEMESİ DURDURULDU\n" +
      "REACT_APP_BACKEND_URL yerel bir adrese bakıyor: " + arkaUc + "\n" +
      "Bu paket yayına alınırsa site hiç veri gösteremez.\n\n" +
      "Yayın derlemesi için frontend/.env.local dosyasını geçici olarak\n" +
      "kaldırın ya da gerçek adresi verin:\n" +
      "  REACT_APP_BACKEND_URL=https://<arka-uc-adresiniz> npm run build\n"
    );
  }
  if (!arkaUc) {
    console.warn(
      "\nUYARI: REACT_APP_BACKEND_URL boş. Paket 'undefined/api' adresine\n" +
      "istek atar ve site çalışmaz. Yayın ortamında bu değişkeni tanımlayın.\n"
    );
  }
}

const webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {
      // Add ignored patterns to reduce watched directories
      webpackConfig.watchOptions = {
        ...webpackConfig.watchOptions,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/build/**',
          '**/dist/**',
          '**/coverage/**',
          '**/public/**',
        ],
      };

      // Granular chunk splitting — separates heavy libs so users only
      // re-download what changed between deployments.
      if (process.env.NODE_ENV === 'production') {
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          splitChunks: {
            chunks: 'all',
            maxInitialRequests: 8,
            maxAsyncRequests: 12,
            cacheGroups: {
              // React core — tiny, rarely changes
              react: {
                name: 'vendor-react',
                test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom|scheduler)[\\/]/,
                chunks: 'all',
                priority: 40,
                enforce: true,
              },
              // Radix UI — large but stable
              radix: {
                name: 'vendor-radix',
                test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
                chunks: 'initial',
                priority: 35,
                enforce: true,
              },
              // Chart.js — only loaded on dashboard
              charts: {
                name: 'vendor-charts',
                test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/,
                chunks: 'async',
                priority: 30,
                enforce: true,
              },
              // FullCalendar — large, only on calendar page
              fullcalendar: {
                name: 'vendor-fullcalendar',
                test: /[\\/]node_modules[\\/]@fullcalendar[\\/]/,
                chunks: 'async',
                priority: 30,
                enforce: true,
              },
              // xlsx — only used for export
              xlsx: {
                name: 'vendor-xlsx',
                test: /[\\/]node_modules[\\/]xlsx[\\/]/,
                chunks: 'async',
                priority: 30,
                enforce: true,
              },
              // DnD — only on kanban page
              dnd: {
                name: 'vendor-dnd',
                test: /[\\/]node_modules[\\/]@hello-pangea[\\/]/,
                chunks: 'async',
                priority: 30,
                enforce: true,
              },
              // Geri kalan node_modules.
              //
              // 'all' DEĞİL 'initial'. 'all' iken yalnızca lazy sayfalarda
              // kullanılan satıcı kodu da bu ortak parçaya toplanıyor ve o
              // parça ilk açılışta indiği için hepsi eager oluyordu.
              //
              // Ölçüldü — ilk 407 KB'ın içinde şunlar vardı ve hiçbiri ilk
              // boyamada gerekli değil: react-grid-layout (yalnızca Dashboard),
              // react-day-picker + date-fns (yalnızca tarih seçici),
              // preact (FullCalendar'ın iç bağımlılığı) ve react-redux
              // (@hello-pangea/dnd'nin iç bağımlılığı). Üst paketleri zaten
              // async gruplardaydı ama BAĞIMLILIKLARI buraya düşüyordu.
              vendors: {
                name: 'vendor-misc',
                test: /[\\/]node_modules[\\/]/,
                chunks: 'initial',
                priority: 10,
                reuseExistingChunk: true,
              },
            },
          },
        };
      }

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }
      return webpackConfig;
    },
  },
};

// Only add babel metadata plugin during dev server
if (config.enableVisualEdits && babelMetadataPlugin) {
  webpackConfig.babel = {
    plugins: [babelMetadataPlugin],
  };
}

webpackConfig.devServer = (devServerConfig) => {
  // Apply visual edits dev server setup only if enabled
  if (config.enableVisualEdits && setupDevServer) {
    devServerConfig = setupDevServer(devServerConfig);
  }

  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

module.exports = webpackConfig;
