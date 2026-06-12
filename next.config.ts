import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Nota: NO usar experimental.optimizePackageImports con @mantine/*.
  // Rompe los compound components (Table.Thead, Tabs.Panel, …) dejándolos
  // undefined en runtime, y no reducía el tamaño del bundle. Mantine y
  // @tabler/icons-react ya vienen optimizados por defecto en Next.
};

export default nextConfig;
