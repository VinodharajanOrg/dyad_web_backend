import { defineConfig } from "vite";
// import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(() => {
  const port = Number.parseInt(process.env.VITE_PORT || process.env.PORT || '8080', 10);
  
  return {
    server: {
      host: "0.0.0.0", // Listen on all interfaces for Docker networking
      port,
      strictPort: false, // Allow fallback to other ports if port is taken
      cors: true, // Enable CORS for all origins
      allowedHosts: [
        ".localhost",
        "localhost",
        "host.docker.internal",
        "0.0.0.0",
      ],
      hmr: {
        host: "localhost",
        protocol: "ws",
        port, // Use same port as dev server
      },
    },
    plugins: [/* dyadComponentTagger(), */ react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
