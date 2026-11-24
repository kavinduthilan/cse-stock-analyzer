import "./globals.css";
import { Hanken_Grotesk } from "next/font/google";
import Link from "next/link";
import type { Metadata } from "next";

const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans" });
export const metadata: Metadata = { title: "CSE Analyzer", description: "Colombo Stock Exchange market analysis" };

const links = [["/", "Market"], ["/stocks", "Stocks"], ["/sectors", "Sectors"], ["/announcements", "Announcements"]];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <header className="bg-ink text-white">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
            <Link href="/" className="font-bold tracking-tight text-lg">CSE Analyzer</Link>
            <nav className="flex gap-4 text-sm text-white/80">
              {links.map(([h, l]) => <Link key={h} href={h} className="hover:text-white">{l}</Link>)}
            </nav>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
        <footer className="max-w-6xl mx-auto px-4 pb-8 text-xs text-muted">
          Data from cse.lk. For information only, not investment advice.
        </footer>
      </body>
    </html>
  );
}
