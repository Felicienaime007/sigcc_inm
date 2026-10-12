import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Build allégé pour Docker (serveur standalone). */
  output: "standalone",
};

export default nextConfig;
