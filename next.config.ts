import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // =============================================================================
  // PRODUCTION OPTIMIZATIONS - Turbopack compatible
  // =============================================================================
  
  // Output standalone para producción (más estable)
  output: 'standalone',
  
  // Optimización de imágenes
  images: {
    unoptimized: false,
  },

  // Experimental features - Turbopack friendly
  experimental: {
    ppr: false,
    taint: true,
  },

  // Turbopack configuration
  turbopack: {},

  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
