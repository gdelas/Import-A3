import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EFA Contable | Procesador de asientos",
  description: "Procesador de facturas, extractos y consultas contables para A3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
