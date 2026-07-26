"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Building2, 
  LayoutDashboard, 
  Receipt, 
  FileText,
  Users, 
  BarChart3, 
  Settings as SettingsIcon,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Sun,
  Moon,
  ShieldCheck,
  UserCheck
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import {
  canAccessPath,
  getAllowedPaths,
  getDefaultPath,
  hasElevatedAccess,
  isAppAdmin,
} from "../../types";
import { Show, SignInButton, SignUpButton, UserButton, OrganizationSwitcher, useAuth as useClerkAuth, useOrganization } from "@clerk/nextjs";

// Toggle to show/hide testing mode widget in sidebar
const SHOW_TESTING_MODE_WIDGET = false;

interface SidebarItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
}

const allNavigation: SidebarItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "New Bill", href: "/billing", icon: Receipt },
  { name: "Bills List", href: "/bills", icon: FileText },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Members", href: "/members", icon: UserCheck },
  { name: "Reports", href: "/reports", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: SettingsIcon }
];

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded, isRoleLoading, signOut, switchRole } = useAuth();
  const { orgId, orgRole } = useClerkAuth();
  const { organization } = useOrganization();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const role = user?.role;
  const isAdmin = isAppAdmin(role);
  const elevated = hasElevatedAccess(role);
  const allowedPaths = getAllowedPaths(role);

  const navigation = allNavigation
    .filter((item) => allowedPaths.includes(item.href))
    .map((item) => {
      if (item.href === "/bills") {
        return {
          ...item,
          name: elevated ? "Bills & Approvals" : "Bills List",
          icon: elevated ? ShieldCheck : FileText,
        };
      }
      return item;
    });

  // Enforce Convex role permissions on routes (only after role is known)
  useEffect(() => {
    if (!isLoaded || isRoleLoading || !user) return;
    if (!canAccessPath(role, pathname)) {
      router.replace(getDefaultPath(role));
    }
  }, [isLoaded, isRoleLoading, user, role, pathname, router]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark");
      setTheme(isDark ? "dark" : "light");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      if (nextTheme === "dark") {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    }
  };

  const handleNavClick = () => {
    setMobileMenuOpen(false);
  };

  // Avoid flashing member nav/pages while Convex role is still loading
  if (!isLoaded || isRoleLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Loading your workspace…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50/50 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:block">
        <div className="flex h-full flex-col justify-between">
          <div>
            {/* Logo Header */}
            <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-6 dark:border-slate-800">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md shadow-emerald-600/10">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 dark:text-white leading-none">Arkit Vedham India</h1>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">Pvt Ltd</span>
              </div>
            </div>

            {/* Clerk Organization Switcher & ID Details */}
            <div className="px-4 pt-3 pb-1">
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-2 space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block px-1">Active Organization</span>
                <OrganizationSwitcher hidePersonal appearance={{ elements: { rootBox: "w-full flex justify-between" } }} />
                
                {/* Visual Clerk Org ID Debug Badge */}
                <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800/80 px-1 font-mono text-[9.5px]">
                  <div className="flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="truncate max-w-[120px]">{organization?.name || "No Org"}</span>
                    <div className="flex gap-1">
                      {orgRole && (
                        <span className="text-[8px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.5 rounded font-sans uppercase font-extrabold">
                          {orgRole}
                        </span>
                      )}
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-sans uppercase font-extrabold ${
                        role === "ADMIN"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                          : role === "BUSINESS_OPERATIONS_LEAD"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      }`}>
                        {user?.role || "loading"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mode Switcher Widget for Testing (Hidden by default, set SHOW_TESTING_MODE_WIDGET = true to enable) */}
            {SHOW_TESTING_MODE_WIDGET && (
              <div className="px-4 pt-2 pb-1">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 px-1">
                    <span>TESTING MODE</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                      isAdmin 
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                    }`}>
                      {user?.role}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200/60 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => switchRole("ADMIN")}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        isAdmin
                          ? "bg-purple-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Admin</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchRole("SUPERVISOR")}
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                        !isAdmin
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                      }`}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Supervisor</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation links */}
            <nav className="space-y-1 px-4 py-3">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-100"
                    }`}
                  >
                    <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`} />
                    <span className="flex-1">{item.name}</span>
                    {isActive && <ChevronRight className="h-4 w-4 text-emerald-600/70 dark:text-emerald-400/70" />}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Desktop Sidebar Bottom Section */}
          <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-3">
            {/* Desktop Theme Switcher */}
            <div className="flex items-center rounded-lg bg-slate-100 p-1 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => theme !== "light" && toggleTheme()}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100 font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Sun className={`h-3.5 w-3.5 ${theme === "light" ? "text-amber-500" : "text-slate-400"}`} />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => theme !== "dark" && toggleTheme()}
                className={`flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-slate-900 text-white shadow-xs dark:bg-emerald-950 dark:text-emerald-300 dark:border dark:border-emerald-800/50 font-bold"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                <Moon className={`h-3.5 w-3.5 ${theme === "dark" ? "text-emerald-400" : "text-slate-400"}`} />
                <span>Dark</span>
              </button>
            </div>

            {/* User Profile / Clerk Auth */}
            <div className="flex items-center gap-3 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
              <Show when="signed-in">
                <div className="flex items-center justify-between w-full">
                  <UserButton showName appearance={{ elements: { userButtonOuterIdentifier: "text-slate-900 dark:text-slate-100 font-semibold text-xs" } }} />
                </div>
              </Show>
              <Show when="signed-out">
                <div className="flex items-center gap-2 w-full">
                  <SignInButton mode="modal">
                    <button className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors cursor-pointer">
                      Sign In
                    </button>
                  </SignInButton>
                  <SignUpButton mode="modal">
                    <button className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                      Sign Up
                    </button>
                  </SignUpButton>
                </div>
              </Show>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="relative z-50 md:hidden">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" 
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Panel */}
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col justify-between bg-white dark:bg-slate-900 shadow-xl border-r border-slate-100 dark:border-slate-800 animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Arkit Vedham India</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile Clerk Organization Switcher & Details */}
              <div className="px-4 pt-3 pb-1">
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-2 space-y-1.5">
                  <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block px-1">Active Organization</span>
                  <OrganizationSwitcher hidePersonal appearance={{ elements: { rootBox: "w-full flex justify-between" } }} />
                  
                  <div className="pt-1 border-t border-slate-200/60 dark:border-slate-800/80 px-1 font-mono text-[9.5px]">
                    <div className="flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400">
                      <span className="truncate max-w-[120px]">{organization?.name || "No Org"}</span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-sans uppercase font-extrabold ${
                        role === "ADMIN"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300"
                          : role === "BUSINESS_OPERATIONS_LEAD"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      }`}>
                        {user?.role || "loading"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <nav className="space-y-1 px-4 py-3">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={handleNavClick}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`} />
                      <span className="flex-1">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Mobile Drawer Bottom Section */}
            <div className="border-t border-slate-100 dark:border-slate-800 p-4 space-y-3">
              {/* Theme Switcher */}
              <div className="flex items-center rounded-lg bg-slate-100 p-1 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50">
                <button
                  type="button"
                  onClick={() => theme !== "light" && toggleTheme()}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    theme === "light"
                      ? "bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100 font-bold"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  <Sun className={`h-3.5 w-3.5 ${theme === "light" ? "text-amber-500" : "text-slate-400"}`} />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => theme !== "dark" && toggleTheme()}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-slate-900 text-white shadow-xs dark:bg-emerald-950 dark:text-emerald-300 dark:border dark:border-emerald-800/50 font-bold"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  <Moon className={`h-3.5 w-3.5 ${theme === "dark" ? "text-emerald-400" : "text-slate-400"}`} />
                  <span>Dark</span>
                </button>
              </div>

              {/* User Profile / Clerk Auth */}
              <div className="flex items-center gap-3 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <Show when="signed-in">
                  <div className="flex items-center justify-between w-full">
                    <UserButton showName appearance={{ elements: { userButtonOuterIdentifier: "text-slate-900 dark:text-slate-100 font-semibold text-xs" } }} />
                  </div>
                </Show>
                <Show when="signed-out">
                  <div className="flex items-center gap-2 w-full">
                    <SignInButton mode="modal">
                      <button className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors cursor-pointer">
                        Sign In
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        Sign Up
                      </button>
                    </SignUpButton>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Area */}
      <div className="flex flex-1 flex-col md:pl-64">
        {/* Mobile Sticky Header */}
        <header className="sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 sm:px-6 dark:border-slate-800 dark:bg-slate-900/90 md:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-md">
              <Building2 className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-white leading-none block">Arkit Vedham India</span>
              <span className="text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">
                {user?.role || "Supervisor"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              title="Toggle Theme Mode"
            >
              {theme === "light" ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5 text-amber-500" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer transition-colors"
              aria-label="Open mobile menu"
            >
              <Menu className="h-5.5 w-5.5" />
            </button>
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 animate-in fade-in duration-300">
          {children}
        </main>
      </div>
    </div>
  );
};
