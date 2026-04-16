// =============================================================================
// LAYOUT: Auth Pages (Login, Register, etc)
// =============================================================================
// Minimal layout without Header/Footer for auth pages

import type { Metadata } from "next";

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
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  );
}