import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// https://vite.dev/config/
export default defineConfig(() => {
  return {
    plugins: [
      react(),
      nodePolyfills({
        include: ["buffer"],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
      wasm(),
    ],
    build: {
      target: "esnext",
    },
    optimizeDeps: {
      exclude: [
        "@stellar/stellar-xdr-json",
        "@noir-lang/noir_wasm",
        "@noir-lang/noirc_abi",
        "@noir-lang/acvm_js",
        "@noir-lang/noir_js",
        "@aztec/bb.js",
      ],
    },
    assetsInclude: ["**/*.wasm"],
    define: {
      global: "globalThis",
      "process.env": "{}",
    },
    envPrefix: "PUBLIC_",
    server: {
      headers: {
        "Cross-Origin-Embedder-Policy": "credentialless",
        "Cross-Origin-Opener-Policy": "same-origin",
      },
    },
  };
});
