import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Compa Virtual · Un paso a la vez",
  description: "Tu espacio para organizarte, practicar y aprender.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
