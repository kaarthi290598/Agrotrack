"use client";

import React from "react";
import { SignIn, SignInButton, SignOutButton, Show } from "@clerk/nextjs";
import { Clock, Receipt, BarChart3 } from "lucide-react";
import Image from "next/image";
import { hideSignUpElements } from "../../lib/clerk-appearance";

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen min-h-[100dvh] w-full flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-emerald-500 selection:text-white transition-colors duration-200">
      {/* LEFT SIDE: 50% Width Panel on Desktop / Full Viewport Height on Mobile */}
      <div className="w-full lg:w-1/2 min-h-screen min-h-[100dvh] flex flex-col justify-center items-start px-5 py-8 sm:p-12 lg:p-16 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 relative overflow-hidden">
        {/* Subtle Ambient Emerald Glow */}
        <div className="absolute top-1/3 left-10 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1 w-full max-w-2xl mx-auto lg:mx-0 my-auto">
          {/* Header Brand Logo - Centered */}
          <div className="flex justify-center w-full -mb-10 sm:-mb-14 md:-mb-20">
            <div className="relative w-full h-52 sm:h-72 md:h-80 lg:h-96">
              <Image 
                src="/logo.png" 
                alt="Arkit Vedham India Pvt Ltd Logo" 
                fill 
                className="object-contain object-center mix-blend-multiply dark:mix-blend-screen"
                priority
              />
            </div>
          </div>

          {/* 3 Small Feature Cards Box */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-start gap-3.5 hover:border-emerald-500/30 transition-colors text-left">
              <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <Clock className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Session Billing & Tracking</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Real-time check-in timings and automated hourly rate calculation.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-start gap-3.5 hover:border-emerald-500/30 transition-colors text-left">
              <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <Receipt className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Instant Invoicing & Receipts</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Generate professional GST invoices and printable PDF slips.</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex items-start gap-3.5 hover:border-emerald-500/30 transition-colors text-left">
              <div className="p-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Analytics & Reports</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">Comprehensive revenue metrics, monthly trends, and billing history.</p>
              </div>
            </div>
          </div>

          {/* Mobile Auth Buttons (Modal Mode on Mobile - Below lg Breakpoint) */}
          <div className="block lg:hidden pt-2 w-full">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-98 transition-all cursor-pointer">
                  Sign In
                </button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <SignOutButton>
                <button className="w-full py-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-sm cursor-pointer">
                  Sign Out
                </button>
              </SignOutButton>
            </Show>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: 50% Width Panel on Desktop (Embedded Clerk SignIn Component - Hidden on Mobile) */}
      <div className="hidden lg:flex w-1/2 flex-col justify-center items-center p-12 bg-white dark:bg-slate-900 relative z-10 min-h-screen min-h-[100dvh]">
        <div className="w-full flex items-center justify-center">
          <Show when="signed-out">
            <SignIn
              routing="hash"
              appearance={{ elements: hideSignUpElements }}
            />
          </Show>
          <Show when="signed-in">
            <div className="text-center space-y-4">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">You are currently signed in.</p>
              <SignOutButton>
                <button className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 cursor-pointer">
                  Sign Out
                </button>
              </SignOutButton>
            </div>
          </Show>
        </div>
      </div>
    </div>
  );
};
