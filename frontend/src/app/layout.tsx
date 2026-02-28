import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "what dough",
  description: "the yeast you can do for your group budget",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("events")
    .select("*", { count: "exact", head: true });

  return (
    <html lang="en">
      <body className={`${mono.variable} antialiased`}>
        <main className="min-h-screen md:h-screen md:max-h-screen flex flex-col bg-background overflow-y-auto md:overflow-hidden">
          <div className="mx-4 sm:mx-8 md:mx-24 px-4 pt-6 pb-2 shrink-0">
            <header>
              <Link href="/" className="hover:opacity-80 transition-opacity">
                <h1 className="text-2xl font-bold tracking-tight uppercase">
                  what dough<span className="text-money">.</span>
                </h1>
              </Link>
              <p className="text-sm text-muted-foreground mt-1">
                the yeast you can do for your group budget
              </p>
            </header>
          </div>
          <div className="mx-4 sm:mx-8 md:mx-24 px-4 py-4 flex-1 min-h-0 pb-6 md:pb-4">
            {children}
          </div>
          {count !== null && (
            <footer className="py-4 text-center text-xs text-muted-foreground shrink-0">
              {count.toLocaleString()} event{count !== 1 ? "s" : ""} planned with what dough
            </footer>
          )}
        </main>
      </body>
    </html>
  );
}
