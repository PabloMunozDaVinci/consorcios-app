// =============================================================================
// LAYOUT: Auth Pages (Login, Register, etc)
// =============================================================================
// Minimal layout without Header/Footer for auth pages

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Consorcios App - Login",
  description: "Administración de Consorcios",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-gray-50">
        {children}
      </body>
    </html>
  );
}