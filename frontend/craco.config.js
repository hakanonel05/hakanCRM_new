// craco.config.js
const path = require("path");
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
                chunks: 'all',
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
              // Everything else from node_modules
              vendors: {
                name: 'vendor-misc',
                test: /[\\/]node_modules[\\/]/,
                chunks: 'all',
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
