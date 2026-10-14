/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `pg` uses Node-only modules, keep it out of the bundler.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
