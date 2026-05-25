import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    // Разрешаем unsafe-eval в режиме разработки для работы горячей перезагрузки (HMR) и отладки React
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'";

    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico|images/).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src * data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://127.0.0.1:8765; frame-ancestors 'none';`
          }
        ]
      }
    ];
  }
};

export default nextConfig;
