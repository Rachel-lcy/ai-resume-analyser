/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

module.exports = nextConfig;