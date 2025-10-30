import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import inject from '@rollup/plugin-inject';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    wasm(),
    topLevelAwait(),
    // Only use nodePolyfills in dev mode for global polyfills
    // In build mode, we use @rollup/plugin-inject instead to avoid import resolution issues
    ...(mode === 'development' ? [
      nodePolyfills({
        // Only polyfill global variables during dev
        globals: {
          Buffer: true,  // Makes Buffer available globally
          global: true,   // Makes global available as globalThis
          process: true,  // Makes process available globally
        },
        // Disable protocol imports to avoid conflicts
        protocolImports: false,
      })
    ] : []),
    // Custom middleware plugin to redirect WASM requests (following noir-playground)
    {
      name: 'wasm-redirect-middleware',
      configureServer(server: any) {
        server.middlewares.use((req: any, res: any, next: any) => {
          if (req.url && req.url.endsWith('.wasm')) {
            // Redirect Vite dependency WASM requests to public directory
            if (req.url.includes('node_modules/.vite/deps/noirc_abi_wasm_bg.wasm')) {
              req.url = '/wasm/noirc_abi_wasm_bg.wasm';
            } else if (req.url.includes('node_modules/.vite/deps/acvm_js_bg.wasm')) {
              req.url = '/wasm/acvm_js_bg.wasm';
            }
          }
          next();
        });
      },
    }
  ],

  // Resolve aliases
  resolve: {
    alias: {
      'pino': 'pino/browser.js',
      // Ensure buffer and process resolve to the actual npm packages
      'buffer': 'buffer/',
      'process/browser': path.resolve(__dirname, 'node_modules/process/browser.js'),
      'process': path.resolve(__dirname, 'node_modules/process/browser.js'),
    }
  },

  // Configure dependency optimization
  optimizeDeps: {
    exclude: [
      '@noir-lang/noir_wasm',
      '@noir-lang/noirc_abi',
      '@noir-lang/acvm_js',
      '@noir-lang/noir_js',
      '@aztec/bb.js'
    ],
    force: true,
  },

  // Worker configuration
  worker: {
    format: 'es',
    plugins: () => [
      wasm(),
      topLevelAwait()
    ],
  },

  // Include WASM as assets
  assetsInclude: ['**/*.wasm'],

  // Development server configuration
  server: {
    port: 3001,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    middlewareMode: false,
  },

  // Build configuration
  build: {
    target: 'es2022',
    rollupOptions: {
      // Use @rollup/plugin-inject for build-time module injection
      // This handles `import { Buffer } from 'buffer'` during production builds
      plugins: [
        inject({
          Buffer: ['buffer', 'Buffer'],
          process: ['process', 'default'],
        })
      ],
      output: {
        manualChunks: {
          noir: ['@noir-lang/noir_js', '@aztec/bb.js']
        }
      }
    }
  },

  // Define globals for browser compatibility (used in both dev and build)
  define: {
    global: 'globalThis',
  },
}));
