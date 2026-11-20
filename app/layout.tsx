import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "لوتی پریمیوم | عضویت ویژه",
  description: "لوتی پریمیوم؛ فضای عضویت ویژه با طراحی لوکس و دسترسی امن",
  applicationName: "لوتی پریمیوم",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#090909",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        {children}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </body>
    </html>
  );
}
