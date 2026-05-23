import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico|images/).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src * data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://127.0.0.1:8765; frame-ancestors 'none';"
          }
        ]
      }
    ];
  }
};

export default nextConfig;
