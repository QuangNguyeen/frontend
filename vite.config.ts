import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"
import * as nodeModule from "node:module"

export default defineConfig(async () => {
  const plugins = [react()]
  const supportsCloudflarePlugin =
    typeof (nodeModule as { registerHooks?: unknown }).registerHooks === "function"

  if (supportsCloudflarePlugin) {
    const { cloudflare } = await import("@cloudflare/vite-plugin")
    plugins.push(cloudflare())
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
