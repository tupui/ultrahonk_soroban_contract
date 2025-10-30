import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    wasm(),
    topLevelAwait(),
    nodePolyfills({
      // Polyfill Node.js globals and modules for browser
      include: ['buffer', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
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

  // Resolve aliases (following noir-playground)
  resolve: {
    alias: {
      'pino': 'pino/browser.js',
    }
  },

  // Configure dependency optimization (following noir-playground exactly)
  optimizeDeps: {
    include: ['buffer', 'process'],
    exclude: [
      '@noir-lang/noir_wasm',
      '@noir-lang/noirc_abi',
      '@noir-lang/acvm_js',
      '@noir-lang/noir_js',
      '@aztec/bb.js'
    ],
    force: true,
  },

  // Worker configuration (following noir-playground)
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
      output: {
        manualChunks: {
          noir: ['@noir-lang/noir_js', '@aztec/bb.js']
        }
      }
    }
  },

});
