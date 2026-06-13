import { Sun, Moon } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Açık temaya geç" : "Koyu temaya geç"}
      data-testid="theme-toggle-button"
      className={`relative inline-flex items-center justify-center w-9 h-9 rounded-full border border-border bg-card/60 backdrop-blur-md hover:bg-accent/10 hover:border-accent/40 transition-all duration-300 group ${className}`}
    >
      <Sun
        className={`w-4 h-4 absolute transition-all duration-500 ${
          isDark ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100 text-amber-500"
        }`}
      />
      <Moon
        className={`w-4 h-4 absolute transition-all duration-500 ${
          isDark ? "opacity-100 rotate-0 scale-100 text-primary-fixed-dim" : "opacity-0 -rotate-90 scale-50"
        }`}
      />
      <span className="sr-only">{isDark ? "Açık" : "Koyu"} tema</span>
    </button>
  );
}
