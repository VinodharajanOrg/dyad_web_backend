/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for Monaco Editor and other libraries
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },

  // TypeScript configuration - fail build on errors
  typescript: {
    // Fail build on TypeScript errors
    ignoreBuildErrors: false,
  },

  // Transpile specific packages that need it
  transpilePackages: ["@modelcontextprotocol/sdk"],

  // Turbopack configuration for Next.js 16+
  turbopack: {
    resolveAlias: {
      "monaco-editor": "monaco-editor/esm/vs/editor/editor.api",
    },
    rules: {
      "*.ttf": {
        loaders: ["file-loader"],
      },
    },
  },

  // Webpack configuration for Monaco Editor and other libraries (fallback for --webpack flag)
  webpack: (config, { isServer }) => {
    // Handle Monaco Editor workers
    config.module.rules.push({
      test: /\.ttf$/,
      type: "asset/resource",
    });

    // Exclude Monaco Editor from optimization to prevent dynamic import issues
    config.module.rules.push({
      test: /node_modules[/\\]monaco-editor/,
      sideEffects: false,
    });

    // Ignore dynamic requires in Monaco Editor and baseline-browser-mapping warnings
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /node_modules[/\\]monaco-editor/,
      },
      {
        module: /baseline-browser-mapping/,
        message: /data in this module is over two months old/,
      },
    ];

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        module: false,
      };

      // Add alias to prevent dynamic import resolution issues
      config.resolve.alias = {
        ...config.resolve.alias,
        "monaco-editor": "monaco-editor/esm/vs/editor/editor.api",
      };
    }

    return config;
  },

  // Proxy API requests to backend
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },

  // Output standalone for Docker if needed
  output: process.env.DOCKER ? "standalone" : undefined,

  // Image optimization
  images: {
    domains: [],
  },

  // Disable x-powered-by header
  poweredByHeader: false,

  // Strict mode
  reactStrictMode: false,

  devIndicators: false
};

export default nextConfig;
