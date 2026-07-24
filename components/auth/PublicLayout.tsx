"use client";

import React from "react";

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <div className="min-h-screen bg-slate-50 dark:bg-slate-950">{children}</div>;
};
