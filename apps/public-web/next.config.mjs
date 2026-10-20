/** @type {import('next').NextConfig} */
const config = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_URL || 'http://localhost:9000'}/api/:path*`,
      },
    ];
  },
};
export default config;
