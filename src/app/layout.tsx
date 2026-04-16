import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Consorcios App",
  description: "Administración de Consorcios",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen flex flex-col bg-white">
        <Header />
        <main className="flex-1 container mx-auto px-3 sm:px-4 py-4 sm:py-6">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-4 text-center text-sm text-gray-500">
      <p>© {new Date().getFullYear()} Consorcios App • Administración Zero-Cost</p>
    </footer>
  );
}