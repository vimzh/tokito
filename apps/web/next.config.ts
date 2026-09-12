import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Contact spreadsheets travel through a server action; the API caps uploads at 5 MB.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
