import {
  defaultTheme,
  isThemeName,
  resolveTheme,
  themeCookieMaxAgeSeconds,
  themeCookieName,
  type ThemeName,
} from "./theme";

export interface CalandraThemeStore {
  getThemePreference(): Promise<string | null | undefined>;
  setThemePreference(theme: ThemeName): Promise<void>;
}

export interface ThemePersistenceHost {
  cookie: string;
  setCookie(cookie: string): void;
  desktopStore?: CalandraThemeStore | undefined;
  initialDesktopTheme?: string | undefined;
}

declare global {
  interface Window {
    __CALANDRA_INITIAL_THEME__?: string;
    __CALANDRA_THEME_STORE__?: CalandraThemeStore;
  }
}

export function getBrowserThemePersistenceHost(): ThemePersistenceHost {
  return {
    cookie: document.cookie,
    setCookie(cookie: string) {
      document.cookie = cookie;
    },
    desktopStore: window.__CALANDRA_THEME_STORE__,
    initialDesktopTheme: window.__CALANDRA_INITIAL_THEME__,
  };
}

export function resolveInitialTheme(
  host = getBrowserThemePersistenceHost(),
): ThemeName {
  return resolveTheme(host.initialDesktopTheme ?? readThemeCookie(host.cookie));
}

export async function readThemePreference(
  host = getBrowserThemePersistenceHost(),
): Promise<ThemeName> {
  if (host.desktopStore) {
    try {
      const desktopTheme = await host.desktopStore.getThemePreference();
      return resolveTheme(desktopTheme ?? host.initialDesktopTheme);
    } catch {
      return resolveInitialTheme(host);
    }
  }

  return resolveInitialTheme(host);
}

export async function persistThemePreference(
  theme: ThemeName,
  host = getBrowserThemePersistenceHost(),
): Promise<"desktop" | "cookie"> {
  const selectedTheme = isThemeName(theme) ? theme : defaultTheme;

  if (host.desktopStore) {
    try {
      await host.desktopStore.setThemePreference(selectedTheme);
      return "desktop";
    } catch {
      writeThemeCookie(host, selectedTheme);
      return "cookie";
    }
  }

  writeThemeCookie(host, selectedTheme);
  return "cookie";
}

function writeThemeCookie(host: ThemePersistenceHost, theme: ThemeName): void {
  host.setCookie(
    `${themeCookieName}=${encodeURIComponent(
      theme,
    )}; path=/; max-age=${themeCookieMaxAgeSeconds}; samesite=lax`,
  );
}

function readThemeCookie(cookie: string): string | undefined {
  const escapedCookieName = themeCookieName.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const match = cookie.match(
    new RegExp(`(?:^|; )${escapedCookieName}=([^;]+)`),
  );
  return match ? decodeURIComponent(match[1] ?? "") : undefined;
}
