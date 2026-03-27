'use client'

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
} from "@/lib/types";
import { analytics } from "@/lib/utils/analytics";

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
  telegramBotUsername: string | null;
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

const rawBackendBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").trim();
const backendBaseUrl = rawBackendBaseUrl.endsWith("/")
  ? rawBackendBaseUrl.slice(0, -1)
  : rawBackendBaseUrl;

const buildBackendUrl = (path: string): string => {
  if (!path.startsWith("/")) {
    throw new Error(`Backend paths must start with '/': ${path}`);
  }
  if (!backendBaseUrl) {
    console.warn("NEXT_PUBLIC_BACKEND_URL is not set, using relative paths. This may cause CORS issues if frontend and backend are on different domains.");
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
    const response = await fetch(buildBackendUrl("/auth/session"), {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (response.status === 204) return { profile: null, contacts: {} };
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { profile: null, contacts: {} };
      }
      throw new Error(`Failed to load session: ${response.status}`);
    }
    const data = (await response.json()) as RawProfile;
    if (!data?.user) return { profile: null, contacts: {} };
    return mapProfile(data);
  } catch (error) {
    console.error("[Auth] Failed to read profile:", error);
    return { profile: null, contacts: {} };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [contactHandles, setContactHandles] = useState<ContactHandlesMap>({});
  const [loading, setLoading] = useState(true);
  const [telegramBotId, setTelegramBotId] = useState<string | null>(null);
  const [telegramBotUsername, setTelegramBotUsername] = useState<string | null>(null);

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
        telegram_bot_username?: string | null;
      };
      const rawBotId = data.telegram_bot_id;
      const botId =
        rawBotId && typeof rawBotId === "string" && rawBotId.trim() !== ""
          ? rawBotId.trim()
          : null;
      setTelegramBotId(botId);
      const rawUsername = data.telegram_bot_username;
      const botUsername =
        rawUsername &&
        typeof rawUsername === "string" &&
        rawUsername.trim() !== ""
          ? rawUsername.trim()
          : null;
      setTelegramBotUsername(botUsername);
      return botId;
    } catch (error) {
      console.error("Failed to load auth config", error);
      setTelegramBotId(null);
      setTelegramBotUsername(null);
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

  const redirectToCallback = useCallback(
    (status: string, provider: string, redirect: string) => {
      window.location.href = `/auth/callback?status=${status}&provider=${provider}&redirect=${encodeURIComponent(redirect)}`;
    },
    [],
  );

  const handleTelegramAuth = useCallback(
    async (link = false) => {
      const redirect = getRedirectPath();
      let botId = telegramBotId;

      if (!botId) {
        botId = await loadConfig();
      }

      if (!botId) {
        redirectToCallback("telegram_error", "telegram", redirect);
        return;
      }

      sessionStorage.setItem("telegram_auth_redirect", redirect);

      const origin = window.location.origin;
      const callbackUrl = `${origin}/auth/telegram/callback`;
      const params = new URLSearchParams({
        bot_id: botId,
        return_to: callbackUrl,
        request_access: "write",
      });
      if (link) {
        params.set("link", "1");
      }
      window.location.href = `https://oauth.telegram.org/auth?${params.toString()}`;
    },
    [telegramBotId, loadConfig, redirectToCallback],
  );

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
      analytics.providerLinked(provider);
      if (provider === "telegram") {
        void handleTelegramAuth(true);
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
      telegramBotUsername,
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
      telegramBotUsername,
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
