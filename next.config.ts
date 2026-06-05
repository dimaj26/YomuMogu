import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    // Разрешаем unsafe-eval в режиме разработки для работы горячей перезагрузки (HMR) и отладки React
    const scriptSrc = isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com"
      : "script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com";

    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico|images/).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src * data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' http://127.0.0.1:8765 https://www.youtube.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; child-src 'self' https://www.youtube.com https://www.youtube-nocookie.com; frame-ancestors 'none';`
          }
        ]
      }
    ];
  }
};

export default nextConfig;
