import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "ResourceHub | Resource Reservation Management",
  description: "Organise shared resources, coordinate reservations and see availability at a glance.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Sora:wght@500;600;700;800&display=swap"
        />
      </head>
      <body>
        <div className="orb orb-a" aria-hidden />
        <div className="orb orb-b" aria-hidden />
        <header className="topbar">
          <div className="topbar-inner">
            <Link href="/" className="logo">
              <span className="logo-mark">◈</span>
              <span>Resource<b>Hub</b></span>
            </Link>
            <Nav />
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="footer">
          <span>ResourceHub</span> · Smart resource reservations, zero double-bookings.
        </footer>
      </body>
    </html>
  );
}
