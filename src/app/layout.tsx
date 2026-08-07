import type { Metadata } from "next";
import { Outfit, Source_Sans_3 } from "next/font/google";
import { AppProvider } from "@/context/AppContext";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

const display = Outfit({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Source_Sans_3({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Closer — Banking that turns dollars into time",
  description:
    "AI-powered banking prototype for college students. Closer converts money into time toward the goals you care about.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="h-dvh overflow-hidden antialiased">
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
