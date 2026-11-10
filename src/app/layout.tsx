import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
});

export const metadata: Metadata = {
  title: { default: "Memo POS", template: "%s · Memo POS" },
  description: "Store inventory, memos, dues and returns",
  applicationName: "Memo POS",
  appleWebApp: { capable: true, title: "Memo POS", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#f5f6f3", colorScheme: "light" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plex.variable}>
      <body className="font-sans">
        {children}
        <PwaRegister />
        <Toaster theme="light" position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
