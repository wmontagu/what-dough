import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "what dough",
  description: "figure out the budget, together",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${mono.variable} antialiased`}>
        <main className="min-h-screen bg-background">
          <div className="mx-auto max-w-lg px-4 py-12">
            <header className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight uppercase">
                what dough<span className="text-money">.</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                figure out the budget, together
              </p>
            </header>
            {children}
          </div>
        </main>
      </body>
    </html>
  );
}
