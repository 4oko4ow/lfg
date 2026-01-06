import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useOnlineCount } from "../context/OnlineCountContext";
import {
  Gamepad2,
  Users,
  Zap,
  Trophy,
  ArrowRight,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";
import { connectWS, onMessage, socket } from "../ws/client";
import { analytics } from "../utils/analytics";

interface Stats {
  parties_created: number;
  people_joined: number;
  parties_filled: number;
}

export default function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { onlineCount, setOnlineCount } = useOnlineCount();
  const [partiesCount, setPartiesCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasReceivedParties, setHasReceivedParties] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const hasReceivedDataRef = useRef(false);
  const landingStartTime = useRef(Date.now());

  useEffect(() => {
    analytics.landingPageView();

    // Трекинг retention
    const lastVisit = localStorage.getItem("last_visit");
    const isReturning = !!lastVisit;
    analytics.sessionStart(isReturning);

    if (lastVisit) {
      const daysSince = Math.floor((Date.now() - parseInt(lastVisit)) / (1000 * 60 * 60 * 24));
      if (daysSince > 0) {
        analytics.userReturned(daysSince);
      }
    }
    localStorage.setItem("last_visit", Date.now().toString());

    connectWS();

    // Таймаут на случай, если данные не придут
    const timeoutId = setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setIsLoading(false);
      }
    }, 5000);

    onMessage((msg) => {
      switch (msg.type) {
        case "initial_state":
          setPartiesCount((msg.payload as any[]).length);
          setHasReceivedParties(true);
          hasReceivedDataRef.current = true;
          setIsLoading(false);
          break;
        case "online_count":
          setOnlineCount(msg.payload as number);
          if (!hasReceivedDataRef.current) {
            hasReceivedDataRef.current = true;
            setIsLoading(false);
          }
          break;
        case "new_party":
          setPartiesCount((prev) => (prev ?? 0) + 1);
          break;
        case "party_remove":
          setPartiesCount((prev) => Math.max(0, (prev ?? 0) - 1));
          break;
      }
    });

    return () => {
      clearTimeout(timeoutId);
      if (socket) {
        socket.close();
      }
    };
  }, [setOnlineCount]);

  // Load stats from API
  useEffect(() => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";
    fetch(`${backendUrl}/api/stats`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch stats");
        return res.json();
      })
      .then((data: Stats) => {
        setStats(data);
        setIsLoadingStats(false);
      })
      .catch((err) => {
        console.error("Error loading stats:", err);
        setIsLoadingStats(false);
      });
  }, []);

  const currentLang = window.location.pathname.match(/^\/(en|ru)(\/|$)/i)?.[1]?.toLowerCase() || "en";
  const feedPath = `/${currentLang}/feed`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-20 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h1 className="mb-6 text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {t("landing.hero.title", "Find Your Gaming Squad")}
              </span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-xl text-zinc-300 sm:text-2xl">
              {t(
                "landing.hero.subtitle",
                "Connect with players, join parties, and level up your gaming experience. No registration required."
              )}
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to={feedPath}
                onClick={() => {
                  const duration = Date.now() - landingStartTime.current;
                  analytics.timeToFeed(duration);
                  analytics.timeToFirstAction("feed", duration);
                }}
                className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/50 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/60"
              >
                {t("landing.cta.browse", "Browse Parties")}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              {!profile && (
                <button
                  onClick={() => navigate(`/${currentLang}/profile`)}
                  className="rounded-full border-2 border-zinc-600 bg-zinc-900/50 px-8 py-4 text-lg font-semibold text-white transition-all duration-200 hover:border-zinc-400 hover:bg-zinc-800/50"
                >
                  {t("landing.cta.create", "Create Your First Party")}
                </button>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2 text-blue-400">
                <Users className="h-6 w-6" />
                <span className="text-sm font-semibold uppercase tracking-wide">
                  {t("landing.stats.online", "Online Now")}
                </span>
              </div>
              {isLoading ? (
                <div className="h-9 w-24 animate-pulse rounded-md bg-gradient-to-r from-zinc-700/30 via-zinc-600/40 to-zinc-700/30"></div>
              ) : (
                <p className="text-3xl font-bold">{onlineCount}</p>
              )}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2 text-purple-400">
                <Gamepad2 className="h-6 w-6" />
                <span className="text-sm font-semibold uppercase tracking-wide">
                  {t("landing.stats.parties", "Active Parties")}
                </span>
              </div>
              {!hasReceivedParties ? (
                <div className="h-9 w-24 animate-pulse rounded-md bg-gradient-to-r from-zinc-700/30 via-zinc-600/40 to-zinc-700/30"></div>
              ) : (
                <p className="text-3xl font-bold">{partiesCount ?? 0}</p>
              )}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2 text-green-400">
                <Gamepad2 className="h-6 w-6" />
                <span className="text-sm font-semibold uppercase tracking-wide">
                  {t("landing.stats.parties_created", "Parties Created")}
                </span>
              </div>
              {isLoadingStats ? (
                <div className="h-9 w-24 animate-pulse rounded-md bg-gradient-to-r from-zinc-700/30 via-zinc-600/40 to-zinc-700/30"></div>
              ) : (
                <p className="text-3xl font-bold">{stats?.parties_created ?? 0}</p>
              )}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2 text-yellow-400">
                <Users className="h-6 w-6" />
                <span className="text-sm font-semibold uppercase tracking-wide">
                  {t("landing.stats.people_joined", "People Joined")}
                </span>
              </div>
              {isLoadingStats ? (
                <div className="h-9 w-24 animate-pulse rounded-md bg-gradient-to-r from-zinc-700/30 via-zinc-600/40 to-zinc-700/30"></div>
              ) : (
                <p className="text-3xl font-bold">{stats?.people_joined ?? 0}</p>
              )}
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2 text-pink-400">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-sm font-semibold uppercase tracking-wide">
                  {t("landing.stats.parties_filled", "Parties Filled")}
                </span>
              </div>
              {isLoadingStats ? (
                <div className="h-9 w-24 animate-pulse rounded-md bg-gradient-to-r from-zinc-700/30 via-zinc-600/40 to-zinc-700/30"></div>
              ) : (
                <p className="text-3xl font-bold">{stats?.parties_filled ?? 0}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-4xl font-bold">
            {t("landing.features.title", "Why Choose FindParty?")}
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 backdrop-blur-sm transition-all duration-200 hover:border-blue-500/50 hover:bg-zinc-900/50">
              <div className="mb-4 inline-flex rounded-full bg-blue-500/20 p-3">
                <Zap className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                {t("landing.features.fast.title", "Lightning Fast")}
              </h3>
              <p className="text-zinc-400">
                {t(
                  "landing.features.fast.desc",
                  "Find or create a party in seconds. No lengthy signups or complicated forms."
                )}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 backdrop-blur-sm transition-all duration-200 hover:border-purple-500/50 hover:bg-zinc-900/50">
              <div className="mb-4 inline-flex rounded-full bg-purple-500/20 p-3">
                <Trophy className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                {t("landing.features.gamified.title", "Gamified Experience")}
              </h3>
              <p className="text-zinc-400">
                {t(
                  "landing.features.gamified.desc",
                  "Earn XP, unlock achievements, and climb the leaderboard as you play and create parties."
                )}
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 backdrop-blur-sm transition-all duration-200 hover:border-pink-500/50 hover:bg-zinc-900/50">
              <div className="mb-4 inline-flex rounded-full bg-pink-500/20 p-3">
                <MessageCircle className="h-6 w-6 text-pink-400" />
              </div>
              <h3 className="mb-2 text-xl font-semibold">
                {t("landing.features.community.title", "Active Community")}
              </h3>
              <p className="text-zinc-400">
                {t(
                  "landing.features.community.desc",
                  "Join live chat, connect with players, and build your gaming network."
                )}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-4xl rounded-2xl border border-zinc-800 bg-gradient-to-r from-blue-600/20 to-purple-600/20 p-12 text-center backdrop-blur-sm">
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            {t("landing.cta_section.title", "Ready to Find Your Squad?")}
          </h2>
          <p className="mb-8 text-lg text-zinc-300">
            {t(
              "landing.cta_section.subtitle",
              "Join thousands of players finding their perfect gaming partners."
            )}
          </p>
          <Link
            to={feedPath}
            onClick={() => {
              const duration = Date.now() - landingStartTime.current;
              analytics.timeToFeed(duration);
              analytics.timeToFirstAction("feed", duration);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-500/50 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/60"
          >
            {t("landing.cta_section.button", "Get Started Now")}
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}

