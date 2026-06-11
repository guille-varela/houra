import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Mejora el tree-shaking de los barrels de Mantine/tabler para reducir
    // el tamaño del Worker (límite de 3 MiB en Cloudflare Workers Free).
    optimizePackageImports: [
      '@mantine/core',
      '@mantine/dates',
      '@mantine/form',
      '@mantine/hooks',
      '@mantine/notifications',
      '@tabler/icons-react',
    ],
  },
};

export default nextConfig;
