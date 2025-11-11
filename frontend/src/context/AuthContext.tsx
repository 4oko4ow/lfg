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
  refreshProfile: () => Promise<void>;
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
  return backendBaseUrl ? `${backendBaseUrl}${path}` : path;
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
  const response = await fetch(buildBackendUrl("/auth/session"), {
    credentials: "include",
  });
  if (response.status === 204) {
    return { profile: null, contacts: {} };
  }
  if (!response.ok) {
    throw new Error(`Failed to load session: ${response.status}`);
  }
  const data = (await response.json()) as RawProfile;
  if (!data?.user) {
    return { profile: null, contacts: {} };
  }
  return mapProfile(data);
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
      const botId = data.telegram_bot_id?.trim() ? data.telegram_bot_id : null;
      setTelegramBotId(botId);
      return botId;
    } catch (error) {
      console.error("Failed to load auth config", error);
      setTelegramBotId(null);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { profile: mapped, contacts } = await readProfile();
      setProfile(mapped);
      setContactHandles(contacts);
    } catch (error) {
      console.error(error);
      setProfile(null);
      setContactHandles({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

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
    const botId = telegramBotId ?? (await loadConfig());
    if (!botId) {
      console.error("Telegram bot ID is not configured");
      redirectToCallback("telegram_error", redirect);
      return;
    }

    try {
      const payload = await openTelegramAuth(botId);
      const response = await fetch(buildBackendUrl("/auth/telegram/verify"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        redirectToCallback("success", redirect);
        return;
      }

      const status =
        response.status === 409 ? "telegram_conflict" : "telegram_error";
      redirectToCallback(status, redirect);
    } catch (error) {
      console.error("Telegram auth failed", error);
      redirectToCallback("telegram_error", redirect);
    }
  }, [redirectToCallback, telegramBotId, loadConfig]);

  const signIn = useCallback(
    (provider: SocialProvider) => {
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
