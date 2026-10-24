import type { NextConfig } from "next";
const config: NextConfig = {
  output: "export",
  allowedDevOrigins: ["127.0.0.1", "localhost", "terminal.local"],
  images: { unoptimized: true },
  trailingSlash: true,
};
export default config;
