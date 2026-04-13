import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "EngRisk Learn - Học Tiếng Anh Hiệu Quả",
  description:
    "Nền tảng học tiếng Anh trực tuyến với bài tập tương tác, từ vựng phong phú và luyện nghe chuyên sâu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen flex flex-col bg-gradient-animated font-sans">
        <Providers>
          <Navbar />
          <main className="flex-1 relative z-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
