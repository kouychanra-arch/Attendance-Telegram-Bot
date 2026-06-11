"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid Hydration Mismatch
  React.useEffect(() => {
    setTimeout(() => {
      setMounted(true);
    }, 0);
  }, []);

  if (!mounted) {
    return <div className="w-10 h-10 rounded-xl" />;
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative w-10 h-10 rounded-xl bg-white/20 dark:bg-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-100 hover:bg-white/30 dark:hover:bg-slate-700 transition-colors shadow-sm outline-none border border-black/5 dark:border-white/10"
      aria-label="Toggle Theme"
    >
      <Sun className={`absolute w-5 h-5 transition-all ${isDark ? 'scale-0 opacity-0 relative' : 'scale-100 opacity-100'} text-amber-500`} />
      <Moon className={`absolute w-5 h-5 transition-all ${isDark ? 'scale-100 opacity-100' : 'scale-0 opacity-0 relative'} text-indigo-400`} />
    </button>
  );
}
