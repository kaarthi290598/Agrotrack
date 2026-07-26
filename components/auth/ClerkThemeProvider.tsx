"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { getClerkAppearance } from "../../lib/clerk-appearance";

function readIsDarkMode() {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
}

export function ClerkThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(readIsDarkMode);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains("dark"));

    syncTheme();

    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });

    const onStorage = (event: StorageEvent) => {
      if (event.key === "theme") syncTheme();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      observer.disconnect();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <ClerkProvider
      appearance={getClerkAppearance(isDark)}
      taskUrls={{
        "choose-organization": "/session-tasks/choose-organization",
      }}
    >
      {children}
    </ClerkProvider>
  );
}
