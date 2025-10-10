/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  // compiler: {
  //   target: 'es5',
  // },
  images: { unoptimized: true },
};

module.exports = nextConfig;
