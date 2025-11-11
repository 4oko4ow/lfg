import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Provider, Session, User } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import type {
  ContactHandle,
  ContactHandlesMap,
  ContactMethodType,
} from "../types";

export type SocialProvider = ContactMethodType;

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  contactHandles: ContactHandlesMap;
  refreshUser: () => Promise<void>;
  signIn: (provider: SocialProvider) => Promise<void>;
  signOut: () => Promise<void>;
  linkProvider: (provider: SocialProvider) => Promise<void>;
  updateContactHandle: (
    provider: SocialProvider,
    handle: ContactHandle | null
  ) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const getRedirectTo = () =>
  `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(
    window.location.pathname + window.location.search
  )}`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const contactHandles = useMemo<ContactHandlesMap>(() => {
    const raw = (user?.user_metadata?.contact_handles || {}) as Record<
      ContactMethodType,
      ContactHandle
    >;
    return raw ?? {};
  }, [user]);

  const refreshUser = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setUser(data.user);
    }
  }, []);

  const signIn = useCallback(async (provider: SocialProvider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider as unknown as Provider,
      options: {
        redirectTo: getRedirectTo(),
        skipBrowserRedirect: false,
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const linkProvider = useCallback(
    async (provider: SocialProvider) => {
      if (!session) {
        await signIn(provider);
        return;
      }
      const { error } = await supabase.auth.linkIdentity({
        provider: provider as unknown as Provider,
      });
      if (error) throw error;
    },
    [session, signIn]
  );

  const updateContactHandle = useCallback(
    async (provider: SocialProvider, handle: ContactHandle | null) => {
      const updated: ContactHandlesMap = {
        ...contactHandles,
      };
      if (handle) {
        updated[provider] = handle;
      } else {
        delete updated[provider];
      }

      const { data, error } = await supabase.auth.updateUser({
        data: {
          contact_handles: updated,
        },
      });

      if (error) throw error;
      if (data.user) {
        setUser(data.user);
      } else {
        await refreshUser();
      }
    },
    [contactHandles, refreshUser]
  );

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      contactHandles,
      refreshUser,
      signIn,
      signOut,
      linkProvider,
      updateContactHandle,
    }),
    [
      user,
      session,
      loading,
      contactHandles,
      refreshUser,
      signIn,
      signOut,
      linkProvider,
      updateContactHandle,
    ]
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
