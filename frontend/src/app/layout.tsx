import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "what dough",
  description: "figure out the budget, together",
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
        <main className="h-screen flex flex-col bg-background">
          <div className="mx-24 px-4 pt-6 pb-2 shrink-0">
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
          <div className="mx-24 px-4 py-4 flex-1 min-h-0">
            {children}
          </div>
          {count !== null && (
            <footer className="py-4 text-center text-xs text-muted-foreground shrink-0">
              {count.toLocaleString()} total event{count !== 1 ? "s" : ""}, budgeted better with What Dough.
            </footer>
          )}
        </main>
      </body>
    </html>
  );
}
