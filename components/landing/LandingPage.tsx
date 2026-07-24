"use client";

import React from "react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Tractor, ShieldCheck, Clock, Receipt, IndianRupee, ArrowRight, CheckCircle2, Lock } from "lucide-react";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-white">
      {/* Standalone Top Navbar */}
      <header className="w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo Header */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <Tractor className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white leading-none">Agro Track</h1>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Machinery & Billing</span>
            </div>
          </div>

          {/* Top Auth Buttons */}
          <div className="flex items-center gap-2.5">
            <SignInButton mode="modal">
              <button className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/10 transition-all cursor-pointer">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer">
                Sign Up
              </button>
            </SignUpButton>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="flex-1 flex flex-col justify-center items-center py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Glow background accent */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto text-center space-y-8">
          {/* Brand badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100/90 dark:bg-emerald-950/70 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold shadow-xs">
            <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Protected Operator Portal</span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {/* Hero Title */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
              Smart Farm Machinery Rental &{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500 dark:from-emerald-400 dark:to-teal-300">
                Automated Billing
              </span>
            </h1>
            <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
              Track field check-in sessions, manage farmer accounts, compute hourly machine rental rates, and generate instant tax invoices.
            </p>
          </div>

          {/* Primary CTA Button */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <SignInButton mode="modal">
              <button className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer group">
                <span>Sign In to Open Console</span>
                <ArrowRight className="h-4.5 w-4.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </SignInButton>

            <SignUpButton mode="modal">
              <button className="w-full sm:w-auto px-8 py-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition-all cursor-pointer">
                Create Operator Account
              </button>
            </SignUpButton>
          </div>

          {/* Feature Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 text-left border-t border-slate-200/80 dark:border-slate-800/80">
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
                <Clock className="h-5.5 w-5.5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">2-Stage Field Check-In</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Log start time when machinery enters the field and complete billing upon check-out.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
              <div className="h-10 w-10 rounded-xl bg-teal-100 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center">
                <IndianRupee className="h-5.5 w-5.5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Paid / Not Paid Toggles</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Instant 1-click status updates for Users and Admins without requiring re-approval.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm space-y-2.5">
              <div className="h-10 w-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                <Receipt className="h-5.5 w-5.5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">PDF Tax Receipts</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Professional A4 printable slips with customer location, GSTIN, and extra charge breakdown.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Notice */}
      <footer className="w-full border-t border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-slate-900/50 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span>Only authenticated operators can access Agro Track billing records. Secured by Clerk & Convex Cloud.</span>
        </div>
      </footer>
    </div>
  );
};
