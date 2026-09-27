import type { Metadata } from "next";
import "./globals.css";
import "./selection.css";
import "./redesign.css";
export const metadata: Metadata = {
  title: "Kusiy · Un paso a la vez",
  description: "Tu espacio para organizarte, practicar y aprender.",
  icons: {
    icon: "/brand/kusiy-logo.png",
    apple: "/brand/kusiy-logo.png",
  },
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
