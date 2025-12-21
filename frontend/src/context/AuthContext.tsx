import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  ContactHandle,
  ContactHandlesMap,
  ContactMethodType,
} from "../types";
import { openTelegramAuth } from "../utils/telegramAuth";
import { analytics } from "../utils/analytics";

export type SocialProvider = ContactMethodType;

export type LinkedIdentity = {
  provider: ContactMethodType;
  providerId: string;
  username: string;
  url?: string;
  linkedAt?: string;
};

export type AuthProfile = {
  id: string;
  displayName: string;
  preferredContact: ContactMethodType | null;
  identities: LinkedIdentity[];
};

type AuthContextValue = {
  profile: AuthProfile | null;
  loading: boolean;
  contactHandles: ContactHandlesMap;
  refreshProfile: () => Promise<boolean>;
  signIn: (provider: SocialProvider) => void;
  signOut: () => Promise<void>;
  linkProvider: (provider: SocialProvider) => void;
  updateContactHandle: (
    provider: SocialProvider,
    handle: ContactHandle | null,
  ) => Promise<void>;
  setPreferredContact: (provider: ContactMethodType | null) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const rawBackendBaseUrl = (import.meta.env.VITE_BACKEND_URL ?? "").trim();
const backendBaseUrl = rawBackendBaseUrl.endsWith("/")
  ? rawBackendBaseUrl.slice(0, -1)
  : rawBackendBaseUrl;

const buildBackendUrl = (path: string): string => {
  if (!path.startsWith("/")) {
    throw new Error(`Backend paths must start with '/': ${path}`);
  }
  // If backend URL is not configured, use relative path (assumes same origin)
  // This works for development and same-domain deployments
  if (!backendBaseUrl) {
    console.warn("VITE_BACKEND_URL is not set, using relative paths. This may cause CORS issues if frontend and backend are on different domains.");
    return path;
  }
  return `${backendBaseUrl}${path}`;
};

const getRedirectPath = () => {
  const path = `${window.location.pathname}${window.location.search}`;
  return path || "/";
};

type RawProfile = {
  user: {
    id: string;
    display_name: string;
    preferred_contact?: ContactMethodType | null;
  };
  identities?: {
    provider: ContactMethodType;
    provider_id: string;
    username?: string;
    url?: string;
    linked_at?: string;
  }[];
  contacts?: {
    provider: ContactMethodType;
    handle: string;
    url?: string;
  }[];
};

function mapProfile(raw: RawProfile): {
  profile: AuthProfile;
  contacts: ContactHandlesMap;
} {
  const identities: LinkedIdentity[] =
    raw.identities?.map((identity) => ({
      provider: identity.provider,
      providerId: identity.provider_id,
      username: identity.username ?? "",
      url: identity.url,
      linkedAt: identity.linked_at,
    })) ?? [];

  const contacts: ContactHandlesMap = {};
  raw.contacts?.forEach((contact) => {
    contacts[contact.provider] = {
      handle: contact.handle,
      url: contact.url,
    };
  });

  return {
    profile: {
      id: raw.user.id,
      displayName: raw.user.display_name,
      preferredContact: raw.user.preferred_contact ?? null,
      identities,
    },
    contacts,
  };
}

async function readProfile(): Promise<{
  profile: AuthProfile | null;
  contacts: ContactHandlesMap;
}> {
  try {
    const url = buildBackendUrl("/auth/session");
    console.log("[Auth] Fetching profile from:", url);
    console.log("[Auth] Current origin:", window.location.origin);
    console.log("[Auth] Backend URL:", backendBaseUrl);
    
    const response = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });
    console.log("[Auth] Session response status:", response.status);
    console.log("[Auth] Response headers:", Object.fromEntries(response.headers.entries()));
    
    if (response.status === 204) {
      console.log("[Auth] No session found (204 No Content)");
      return { profile: null, contacts: {} };
    }
    if (!response.ok) {
      // Don't throw for 401/403 - just return no profile
      if (response.status === 401 || response.status === 403) {
        console.log("[Auth] Unauthorized (401/403)");
        return { profile: null, contacts: {} };
      }
      const errorText = await response.text().catch(() => "unknown error");
      console.error("[Auth] Failed to load session:", response.status, errorText);
      throw new Error(`Failed to load session: ${response.status}`);
    }
    const data = (await response.json()) as RawProfile;
    if (!data?.user) {
      console.log("[Auth] Response missing user data");
      return { profile: null, contacts: {} };
    }
    console.log("[Auth] Profile loaded successfully for user:", data.user.id);
    return mapProfile(data);
  } catch (error) {
    // Network errors or other failures - log but don't crash
    console.error("[Auth] Failed to read profile:", error);
    return { profile: null, contacts: {} };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [contactHandles, setContactHandles] = useState<ContactHandlesMap>({});
  const [loading, setLoading] = useState(true);
  const [telegramBotId, setTelegramBotId] = useState<string | null>(null);

  const loadConfig = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch(buildBackendUrl("/auth/config"), {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to load auth config: ${response.status}`);
      }
      const data = (await response.json()) as {
        telegram_bot_id?: string | null;
      };
      // Обрабатываем случай, когда бэкенд возвращает пустую строку или null
      const rawBotId = data.telegram_bot_id;
      const botId = rawBotId && typeof rawBotId === 'string' && rawBotId.trim() !== '' 
        ? rawBotId.trim() 
        : null;
      setTelegramBotId(botId);
      return botId;
    } catch (error) {
      console.error("Failed to load auth config", error);
      setTelegramBotId(null);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<boolean> => {
    try {
      setLoading(true);
      const { profile: mapped, contacts } = await readProfile();
      setProfile(mapped);
      setContactHandles(contacts);
      const success = mapped !== null;
      setLoading(false);
      return success;
    } catch (error) {
      console.error("Failed to refresh profile:", error);
      setProfile(null);
      setContactHandles({});
      setLoading(false);
      return false;
    }
  }, []);

  useEffect(() => {
    // Initial load - don't set loading to false if profile is null on first load
    // This allows the UI to show loading state properly
    const loadInitial = async () => {
      try {
        setLoading(true);
        const { profile: mapped, contacts } = await readProfile();
        setProfile(mapped);
        setContactHandles(contacts);
      } catch (error) {
        console.error("Failed to load initial profile:", error);
        setProfile(null);
        setContactHandles({});
      } finally {
        setLoading(false);
      }
    };
    void loadInitial();
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const redirectToCallback = useCallback((status: string, redirect: string) => {
    window.location.href = `/auth/callback?status=${status}&redirect=${encodeURIComponent(
      redirect,
    )}`;
  }, []);

  const handleTelegramAuth = useCallback(async () => {
    const redirect = getRedirectPath();
    let botId = telegramBotId;
    
    // Если botId еще не загружен, загружаем его
    if (!botId || botId.trim() === "") {
      botId = await loadConfig();
    }
    
    // Проверяем, что botId не пустой
    if (!botId || botId.trim() === "") {
      console.error("Telegram bot ID is not configured. Please check backend configuration.");
      redirectToCallback("telegram_error", redirect);
      return;
    }

    try {
      console.log("[Telegram Auth] Opening Telegram OAuth popup...");
      const payload = await openTelegramAuth(botId.trim());
      console.log("[Telegram Auth] Received payload from Telegram:", payload);
      
      // Convert id from number to string as backend expects string
      const requestBody = {
        id: String(payload.id),
        first_name: payload.first_name,
        last_name: payload.last_name,
        username: payload.username,
        photo_url: payload.photo_url,
        auth_date: payload.auth_date,
        hash: payload.hash,
      };
      
      console.log("[Telegram Auth] Sending verification request to backend...");
      const response = await fetch(buildBackendUrl("/auth/telegram/verify"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(requestBody),
      });

      console.log("[Telegram Auth] Backend response status:", response.status);
      
      if (response.ok) {
        const profile = await response.json();
        console.log("[Telegram Auth] Verification successful, profile:", profile);
        redirectToCallback("success", redirect);
        return;
      }

      const errorText = await response.text().catch(() => "unknown error");
      console.error("[Telegram Auth] Backend verification failed:", response.status, errorText);
      
      const status =
        response.status === 409 ? "telegram_conflict" : "telegram_error";
      redirectToCallback(status, redirect);
    } catch (error) {
      console.error("[Telegram Auth] Error during authentication:", error);
      
      // Если ошибка связана с bot ID, показываем более понятное сообщение
      if (error instanceof Error && error.message.includes("bot ID")) {
        console.error("Telegram bot ID is missing or invalid. Please check backend configuration (TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_ID).");
        redirectToCallback("telegram_error", redirect);
        return;
      }
      
      // Если ошибка "popup closed", возможно auth все-таки прошел
      // Проверим профиль перед редиректом на ошибку
      if (error instanceof Error && (error.message.includes("popup closed") || error.message.includes("cancelled"))) {
        console.log("[Telegram Auth] Popup closed/cancelled, checking if auth succeeded anyway...");
        try {
          // Дадим немного времени для обработки на бэкенде
          await new Promise((resolve) => setTimeout(resolve, 1000));
          
          // Проверим, обновился ли профиль
          const profileLoaded = await refreshProfile();
          if (profileLoaded) {
            console.log("[Telegram Auth] Profile loaded successfully despite popup error - auth succeeded!");
            redirectToCallback("success", redirect);
            return;
          }
        } catch (refreshError) {
          console.warn("[Telegram Auth] Failed to refresh profile after popup error:", refreshError);
        }
      }
      
      redirectToCallback("telegram_error", redirect);
    }
  }, [redirectToCallback, telegramBotId, loadConfig, refreshProfile]);

  const signIn = useCallback(
    (provider: SocialProvider) => {
      analytics.loginAttempt(provider);
      if (provider === "telegram") {
        void handleTelegramAuth();
        return;
      }
      const redirect = encodeURIComponent(getRedirectPath());
      window.location.href = buildBackendUrl(
        `/auth/${provider}/login?redirect=${redirect}`,
      );
    },
    [handleTelegramAuth],
  );

  const linkProvider = useCallback(
    (provider: SocialProvider) => {
      analytics.providerLink(provider);
      if (provider === "telegram") {
        void handleTelegramAuth();
        return;
      }
      const redirect = encodeURIComponent(getRedirectPath());
      window.location.href = buildBackendUrl(
        `/auth/${provider}/login?redirect=${redirect}&link=1`,
      );
    },
    [handleTelegramAuth],
  );

  const signOut = useCallback(async () => {
    analytics.logout();
    await fetch(buildBackendUrl("/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
    setProfile(null);
    setContactHandles({});
  }, []);

  const updateContactHandle = useCallback(
    async (provider: SocialProvider, handle: ContactHandle | null) => {
      const response = await fetch(buildBackendUrl("/auth/contact"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          provider,
          handle: handle?.handle ?? "",
          url: handle?.url ?? "",
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to update contact");
      }
      const data = (await response.json()) as RawProfile;
      const { profile: mapped, contacts } = mapProfile(data);
      setProfile(mapped);
      setContactHandles(contacts);
    },
    [],
  );

  const setPreferredContact = useCallback(
    async (provider: ContactMethodType | null) => {
      const response = await fetch(buildBackendUrl("/auth/preferred"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ provider }),
      });
      if (!response.ok) {
        throw new Error("Failed to update preferred contact");
      }
      const data = (await response.json()) as RawProfile;
      const { profile: mapped, contacts } = mapProfile(data);
      setProfile(mapped);
      setContactHandles(contacts);
    },
    [],
  );

  const value = useMemo(
    () => ({
      profile,
      loading,
      contactHandles,
      refreshProfile,
      signIn,
      signOut,
      linkProvider,
      updateContactHandle,
      setPreferredContact,
    }),
    [
      profile,
      loading,
      contactHandles,
      refreshProfile,
      signIn,
      signOut,
      linkProvider,
      updateContactHandle,
      setPreferredContact,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
