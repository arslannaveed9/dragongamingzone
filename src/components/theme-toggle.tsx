"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

function writeTheme(value: "light" | "dark") {
  localStorage.setItem("gz-theme", value);
  document.cookie = `gz-theme=${value};path=/;max-age=31536000;SameSite=Lax`;
}

export function ThemeToggle({ className }: { className?: string }) {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("gz-theme");
    const hasCookie = document.cookie.split(";").some((part) => part.trim().startsWith("gz-theme="));
    if (!hasCookie && (stored === "light" || stored === "dark")) {
      document.documentElement.classList.toggle("dark", stored === "dark");
      writeTheme(stored);
    }
    setLight(!document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const isDark = document.documentElement.classList.toggle("dark");
    writeTheme(isDark ? "dark" : "light");
    setLight(!isDark);
  }

  return (
    <Button type="button" variant="outline" size="icon" className={className} aria-label={light ? "Switch to dark mode" : "Switch to light mode"} onClick={toggle}>
      {light ? <Moon /> : <Sun />}
    </Button>
  );
}
