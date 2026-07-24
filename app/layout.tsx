import {ClerkProvider} from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../components/auth/AuthProvider";
import { ToastProvider } from "../components/ui/Toast";
import { ProtectedLayout } from "../components/auth/ProtectedLayout";
import { DashboardLayout } from "../components/layout/DashboardLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agro Track - Billing & Session Management",
  description: "Agro Track: Track machine rental sessions, manage farmer details, and generate professional invoices.",
};

import { Show } from "@clerk/nextjs";
import ConvexClientProvider from "../components/ConvexClientProvider";
import { LandingPage } from "../components/landing/LandingPage";

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
        <ClerkProvider>
          <ConvexClientProvider>
            <AuthProvider>
              <ToastProvider>
                <ProtectedLayout>
                  <Show when="signed-out">
                    <LandingPage />
                  </Show>
                  <Show when="signed-in">
                    <DashboardLayout>{children}</DashboardLayout>
                  </Show>
                </ProtectedLayout>
              </ToastProvider>
            </AuthProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}