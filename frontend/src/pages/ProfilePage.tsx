import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth, type SocialProvider } from "../context/AuthContext";
import {
  contactHandleToInput,
  normalizeContactHandle,
} from "../utils/contactHelpers";
import type { UserStats, Party } from "../types";
import {
  Trophy,
  TrendingUp,
  Users,
  Gamepad2,
  Trash2,
  Flame,
  Star,
  Award,
} from "lucide-react";
import PartyCard from "../components/PartyCard";
import { analytics } from "../utils/analytics";

const PROVIDERS: {
  id: SocialProvider;
  title: string;
  description: string;
  placeholder: string;
}[] = [
    {
      id: "steam",
      title: "Steam",
      description: "profile.steam_description",
      placeholder: "https://steamcommunity.com/id/username",
    },
    {
      id: "discord",
      title: "Discord",
      description: "profile.discord_description",
      placeholder: "username или @username",
    },
  ];

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

export default function ProfilePage() {
  const { lang } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    profile,
    loading,
    contactHandles,
    linkProvider,
    updateContactHandle,
  } = useAuth();

  const [values, setValues] = useState<Record<SocialProvider, string>>({
    steam: "",
    discord: "",
    telegram: "",
  });
  const [stats, setStats] = useState<UserStats | null>(null);
  const [userParties, setUserParties] = useState<Party[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [activeTab, setActiveTab] = useState<"contacts" | "parties" | "stats">("stats");

  useEffect(() => {
    setValues({
      steam: contactHandleToInput(contactHandles.steam),
      discord: contactHandleToInput(contactHandles.discord),
      telegram: contactHandleToInput(contactHandles.telegram),
    });
  }, [contactHandles]);

  useEffect(() => {
    if (loading === false && !profile) {
      navigate(`/${lang ?? "en"}`, { replace: true });
    }
  }, [profile, loading, lang, navigate]);

  useEffect(() => {
    if (profile) {
      analytics.profilePageView();
      fetchStats();
      fetchUserParties();
    }
  }, [profile]);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const response = await fetch(`${BACKEND_URL}/api/user/stats`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchUserParties = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/user/parties`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setUserParties(data);
      }
    } catch (error) {
      console.error("Error fetching user parties:", error);
    }
  };

  const handleDeleteParty = async (partyId: string) => {
    if (!confirm(t("profile.parties.delete_confirm", "Are you sure you want to delete this party?"))) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/parties/delete`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: partyId }),
      });

      if (response.ok) {
        const deletedParty = userParties.find((p) => p.id === partyId);
        if (deletedParty) {
          analytics.partyDeleted(deletedParty.game);
        }
        toast.success(t("profile.parties.deleted", "Party deleted"));
        setUserParties((prev) => prev.filter((p) => p.id !== partyId));
      } else {
        toast.error(t("toasts.error", "Something went wrong"));
      }
    } catch (error) {
      console.error("Error deleting party:", error);
      toast.error(t("toasts.error", "Something went wrong"));
    }
  };

  const linkedProviders = useMemo(() => {
    const set = new Set<string>();
    profile?.identities.forEach((identity) => {
      if (identity.provider) set.add(identity.provider);
    });
    return set;
  }, [profile]);

  const handleLink = async (provider: SocialProvider) => {
    try {
      linkProvider(provider);
    } catch (error) {
      console.error(error);
      toast.error(t("auth.error", "Failed to authenticate"));
    }
  };

  const handleSave = async (provider: SocialProvider) => {
    try {
      const handle = normalizeContactHandle(provider, values[provider]);
      await updateContactHandle(provider, handle);
      analytics.contactSave(provider);
      toast.success(t("profile.saved", "Saved"));
    } catch (error) {
      console.error(error);
      toast.error(t("toasts.error", "Something went wrong"));
    }
  };

  if (loading || !profile) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4 text-white">
        <span className="text-sm text-zinc-300">
          {t("auth.loading", "Loading...")}
        </span>
      </div>
    );
  }

  const currentLang = lang ?? "en";
  const feedPath = `/${currentLang}/feed`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 text-white">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">
          {t("profile.title", "Your Profile")}
        </h1>
        <p className="text-zinc-400">
          {t("profile.description", "Manage your contacts, view stats, and manage your parties.")}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-zinc-800">
        <button
          onClick={() => {
            setActiveTab("stats");
            analytics.profileTabSwitch("stats");
          }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "stats"
            ? "border-b-2 border-blue-500 text-blue-400"
            : "text-zinc-400 hover:text-zinc-200"
            }`}
        >
          {t("profile.tabs.stats", "Stats & Achievements")}
        </button>
        <button
          onClick={() => {
            setActiveTab("parties");
            analytics.profileTabSwitch("parties");
          }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "parties"
            ? "border-b-2 border-blue-500 text-blue-400"
            : "text-zinc-400 hover:text-zinc-200"
            }`}
        >
          {t("profile.tabs.parties", "My Parties")} ({userParties?.length || 0})
        </button>
        <button
          onClick={() => {
            setActiveTab("contacts");
            analytics.profileTabSwitch("contacts");
          }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "contacts"
            ? "border-b-2 border-blue-500 text-blue-400"
            : "text-zinc-400 hover:text-zinc-200"
            }`}
        >
          {t("profile.tabs.contacts", "Contacts")}
        </button>
      </div>

      {/* Stats Tab */}
      {activeTab === "stats" && (
        <div className="space-y-6">
          {loadingStats ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-600 border-t-blue-500"></div>
            </div>
          ) : stats ? (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="mb-2 flex items-center gap-2 text-blue-400">
                    <Gamepad2 className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase">
                      {t("profile.stats.created", "Created")}
                    </span>
                  </div>
                  <p className="text-3xl font-bold">{stats.parties_created}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="mb-2 flex items-center gap-2 text-purple-400">
                    <Users className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase">
                      {t("profile.stats.joined", "Joined")}
                    </span>
                  </div>
                  <p className="text-3xl font-bold">{stats.parties_joined}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="mb-2 flex items-center gap-2 text-yellow-400">
                    <TrendingUp className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase">
                      {t("profile.stats.xp", "Total XP")}
                    </span>
                  </div>
                  <p className="text-3xl font-bold">{stats.total_xp}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="mb-2 flex items-center gap-2 text-pink-400">
                    <Trophy className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase">
                      {t("profile.stats.level", "Level")}
                    </span>
                  </div>
                  <p className="text-3xl font-bold">{stats.level}</p>
                </div>
              </div>

              {/* Streaks */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="mb-2 flex items-center gap-2 text-orange-400">
                    <Flame className="h-5 w-5" />
                    <span className="text-sm font-semibold">
                      {t("profile.stats.current_streak", "Current Streak")}
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{stats.current_streak} {t("profile.stats.days", "days")}</p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <div className="mb-2 flex items-center gap-2 text-yellow-400">
                    <Star className="h-5 w-5" />
                    <span className="text-sm font-semibold">
                      {t("profile.stats.longest_streak", "Longest Streak")}
                    </span>
                  </div>
                  <p className="text-2xl font-bold">{stats.longest_streak} {t("profile.stats.days", "days")}</p>
                </div>
              </div>

              {/* Achievements */}
              {stats.achievements && stats.achievements.length > 0 && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                    <Award className="h-5 w-5 text-yellow-400" />
                    {t("profile.achievements.title", "Achievements")}
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {stats.achievements.map((ach) => (
                      <div
                        key={ach.type}
                        className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4"
                      >
                        <div className="mb-1 font-semibold">{ach.name}</div>
                        <div className="text-xs text-zinc-400">
                          {new Date(ach.unlocked_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
              <p className="text-zinc-400">
                {t("profile.stats.no_stats", "No stats yet. Create your first party to get started!")}
              </p>
              <Link
                to={feedPath}
                className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                {t("profile.stats.create_first", "Create Your First Party")}
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Parties Tab */}
      {activeTab === "parties" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {t("profile.parties.title", "My Parties")}
            </h2>
            <Link
              to={feedPath}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              {t("profile.parties.create_new", "Create New Party")}
            </Link>
          </div>

          {!userParties || userParties.length === 0 ? (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
              <p className="mb-4 text-zinc-400">
                {t("profile.parties.empty", "You haven't created any parties yet.")}
              </p>
              <Link
                to={feedPath}
                className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                {t("profile.parties.create_first", "Create Your First Party")}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {userParties.map((party) => (
                <div
                  key={party.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                >
                  <div className="mb-3">
                    <PartyCard party={party} onContactClick={() => { }} />
                  </div>
                  <div className="flex gap-2 border-t border-zinc-800 pt-3">
                    <button
                      onClick={() => handleDeleteParty(party.id)}
                      className="flex items-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("ui.delete", "Delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contacts Tab */}
      {activeTab === "contacts" && (
        <div className="space-y-6">
          {PROVIDERS.map((provider) => {
            const isLinked = linkedProviders.has(provider.id);
            return (
              <div
                key={provider.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5"
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold">{provider.title}</h2>
                    <p className="text-sm text-zinc-400">
                      {t(provider.description)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleLink(provider.id)}
                    className="rounded border border-blue-500 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-300 transition hover:bg-blue-500/10"
                  >
                    {isLinked
                      ? t("profile.relink", "Reconnect")
                      : t("profile.connect", "Connect")}
                  </button>
                </div>

                <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                  {t("profile.contact_label", "Contact for ads")}
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    disabled={!isLinked}
                    value={values[provider.id]}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [provider.id]: e.target.value }))
                    }
                    placeholder={provider.placeholder}
                    className="w-full rounded-lg border border-zinc-700/50 bg-zinc-900/50 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 transition-colors hover:border-zinc-600 hover:bg-zinc-900/70 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleSave(provider.id)}
                    disabled={!isLinked}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:opacity-50"
                  >
                    {t("profile.save", "Save")}
                  </button>
                </div>
                {!isLinked && (
                  <p className="mt-2 text-xs text-zinc-500">
                    {t(
                      "profile.link_required",
                      "Connect the account first to set up the contact."
                    )}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
