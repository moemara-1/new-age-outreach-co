import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAX — Lead Generation",
  description: "AI-powered local business lead generation system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0C0C0C] text-white antialiased font-[Inter,system-ui,sans-serif]">
        {children}
      </body>
    </html>
  );
}
