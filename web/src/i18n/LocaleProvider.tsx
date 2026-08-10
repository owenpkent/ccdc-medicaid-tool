import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MESSAGES, detectLocale, type AppLocale } from "./messages";

interface LocaleContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/** Current UI locale plus a setter. Used both by react-intl and by the rules engine. */
export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx;
}

/**
 * Wraps the app in react-intl and exposes the locale through context so
 * non-react-intl code (the rules classifier) can localize too. The locale is
 * kept in memory only: no cookie, no localStorage, consistent with "nothing
 * persists by default" in docs/privacy.md.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(detectLocale);

  // Keep <html lang> in sync so screen readers switch pronunciation correctly.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale }), [locale]);

  return (
    <LocaleContext.Provider value={value}>
      <IntlProvider locale={locale} defaultLocale="en" messages={MESSAGES[locale]}>
        {children}
      </IntlProvider>
    </LocaleContext.Provider>
  );
}
