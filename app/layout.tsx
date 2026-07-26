import {ClerkThemeProvider} from "../components/auth/ClerkThemeProvider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../components/auth/AuthProvider";
import { ToastProvider } from "../components/ui/Toast";
import { ProtectedLayout } from "../components/auth/ProtectedLayout";
import { AppShell } from "../components/auth/AppShell";
import ConvexClientProvider from "../components/ConvexClientProvider";
import { assertClerkConvexPairing } from "../lib/env";

// Fail the server render if Clerk keys and Convex URL are cross-wired.
assertClerkConvexPairing("RootLayout");

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arkit Innovatives pvt ltd",
  description: "Arkit Innovatives pvt ltd application",
  applicationName: "Arkit Innovatives",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `
          }}
        />
      </head>
      <body className="min-h-full bg-slate-50/50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100">
        <ClerkThemeProvider>
          <ConvexClientProvider>
            <AuthProvider>
              <ToastProvider>
                <ProtectedLayout>
                  <AppShell>{children}</AppShell>
                </ProtectedLayout>
              </ToastProvider>
            </AuthProvider>
          </ConvexClientProvider>
        </ClerkThemeProvider>
      </body>
    </html>
  );
}