import type { Metadata } from "next";
import { Kanit, Sarabun } from "next/font/google";
import "./globals.css";

const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700"],
  variable: "--font-kanit",
  display: "swap",
});

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap",
});

export const metadata: Metadata = {
  title: "เส้นทางโฆษณา",
  description:
    "อัปโหลดภาพหน้าจอ Ads Manager คำนวณอิมเพรสชันต่อบาท และแนะนำว่าแอดเซ็ตไหนควรเปิดต่อ",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${kanit.variable} ${sarabun.variable}`}>
      <body className="font-body text-[15px] leading-relaxed">{children}</body>
    </html>
  );
}
