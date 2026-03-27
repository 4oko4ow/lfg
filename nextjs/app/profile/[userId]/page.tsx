'use client';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Trophy, Users, Flame, Zap } from "lucide-react";

interface PublicProfile {
  display_name: string;
  avatar_url?: string;
  level: number;
  total_xp: number;
  parties_created: number;
  parties_joined: number;
  current_streak: number;
}

const BACKEND_URL = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080").replace(/\/$/, "");

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { t } = useTranslation();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`${BACKEND_URL}/api/users/${userId}/profile`, { credentials: "include" })
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setProfile(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-zinc-500 text-sm">{t("ui.loading", "Loading...")}</div>
      </main>
    );
  }

  if (notFound || !profile) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400">{t("profile.not_found", "Player not found")}</p>
        <Link href="/feed" className="text-blue-400 hover:underline text-sm">
          {t("nav.back_to_feed", "Back to feed")}
        </Link>
      </main>
    );
  }

  const displayName = profile.display_name || t("profile.anonymous", "Player");
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen text-zinc-100 pt-20 pb-16">
      <div className="max-w-lg mx-auto px-4">
        <div className="flex items-center gap-4 mb-8">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-zinc-700"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-lg font-bold text-zinc-400">
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold text-white">{displayName}</h1>
            <p className="text-sm text-zinc-500">
              {t("stats.level", "Level")} {profile.level} · {profile.total_xp} XP
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            {
              icon: <Trophy className="w-4 h-4" />,
              label: t("stats.parties_created", "Parties created"),
              value: profile.parties_created,
            },
            {
              icon: <Users className="w-4 h-4" />,
              label: t("stats.parties_joined", "Parties joined"),
              value: profile.parties_joined,
            },
            {
              icon: <Flame className="w-4 h-4" />,
              label: t("stats.streak", "Current streak"),
              value: profile.current_streak,
            },
            {
              icon: <Zap className="w-4 h-4" />,
              label: t("stats.xp", "Total XP"),
              value: profile.total_xp,
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2"
            >
              <div className="text-zinc-500 flex items-center gap-1.5">
                {s.icon}
                <span className="text-xs">{s.label}</span>
              </div>
              <span className="text-2xl font-bold text-white">{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
