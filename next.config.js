/** @type {import('next').NextConfig} */
const nextConfig = {
  // App directory är nu standard i Next.js 14
  experimental: {
    // Ta bort optimizeCss för att undvika critters-fel
    optimizePackageImports: ['react', 'react-dom']
  },
  // Förbättra webpack-konfiguration
  webpack: (config, { dev, isServer }) => {
    // Optimera för utveckling
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  }
}
 
module.exports = nextConfig 