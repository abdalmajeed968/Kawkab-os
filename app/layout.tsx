import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "KAWKAB OS",
  description: "Amazon business operating system",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
