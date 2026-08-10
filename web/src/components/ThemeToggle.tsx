import { useEffect, useState } from "react";
import { useIntl } from "react-intl";

type ThemeOverride = "light" | "dark" | null;

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

/**
 * Light/dark switch, same pattern as LanguageToggle. The pressed button always
 * reflects the theme actually showing: with no override it tracks the system
 * preference; pressing a button pins that theme. The override is session-only
 * React state (no cookie, no localStorage), consistent with docs/privacy.md,
 * so a reload returns to following the system setting.
 */
export function ThemeToggle() {
  const intl = useIntl();
  const [override, setOverride] = useState<ThemeOverride>(null);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // styles.css keys the palette off <html data-theme="...">; without the
  // attribute the prefers-color-scheme media query decides.
  useEffect(() => {
    const root = document.documentElement;
    if (override) root.dataset.theme = override;
    else delete root.dataset.theme;
  }, [override]);

  const effective = override ?? (systemDark ? "dark" : "light");

  return (
    <div
      className="lang-toggle"
      role="group"
      aria-label={intl.formatMessage({ id: "theme.label" })}
    >
      <button
        type="button"
        className="lang-btn"
        aria-pressed={effective === "light"}
        onClick={() => setOverride("light")}
      >
        {intl.formatMessage({ id: "theme.light" })}
      </button>
      <button
        type="button"
        className="lang-btn"
        aria-pressed={effective === "dark"}
        onClick={() => setOverride("dark")}
      >
        {intl.formatMessage({ id: "theme.dark" })}
      </button>
    </div>
  );
}
