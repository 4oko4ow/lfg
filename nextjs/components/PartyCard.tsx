'use client';

import type { ReactNode } from "react";
import type { ContactMethod, Party } from "@/lib/types";
import {
  UserGroupIcon,
  BoltIcon,
  ClockIcon,
  BookmarkIcon,
} from "@heroicons/react/24/outline";
import { Timer } from "lucide-react";
import { Gamepad2, MessageCircle, Send } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getGameName } from "@/lib/constants/games";
import CreatorBadge from "@/components/CreatorBadge";

/** Локализованное "time ago" для MVP */
function timeAgo(isoDate: string, t: (k: string, o?: any) => string): string {
  const seconds = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);

  if (seconds < 60) {
    return t("timeago.seconds", { count: seconds, defaultValue: "{{count}} сек назад" });
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) {
    return t("timeago.minute", { defaultValue: "1 мин назад" });
  }
  if (minutes < 60) {
    return t("timeago.minutes", { count: minutes, defaultValue: "{{count}} мин назад" });
  }
  const hours = Math.floor(minutes / 60);
  if (hours === 1) {
    return t("timeago.hour", { defaultValue: "1 ч назад" });
  }
  if (hours < 24) {
    return t("timeago.hours", { count: hours, defaultValue: "{{count}} ч назад" });
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return t("timeago.days_hours", {
    d: days,
    h: remHours,
    defaultValue: "{{d}} дн {{h}} ч назад",
  });
}

const CONTACT_ICONS: Record<string, { icon: ReactNode; label: string }> = {
  steam: {
    icon: <Gamepad2 className="h-4 w-4" />,
    label: "Steam",
  },
  discord: {
    icon: <MessageCircle className="h-4 w-4" />,
    label: "Discord",
  },
  telegram: {
    icon: <Send className="h-4 w-4" />,
    label: "Telegram",
  },
};

export default function PartyCard({
  party,
  onContactClick,
  onJoinClick,
  onFullClick,
}: {
  party: Party;
  onContactClick: () => void;
  onJoinClick: () => void;
  onFullClick?: () => void;
}) {
  const { t } = useTranslation();

  const isFull = party.joined >= party.slots;
  const isAlmostFull = party.joined === party.slots - 1 && party.slots > 2;
  const isPinned = party.pinned;

const renderContacts = (contacts?: ContactMethod[]) => {
    if (!contacts || contacts.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-zinc-300">
        {contacts.map((contact) => {
          const config = CONTACT_ICONS[contact.type] ?? {
            icon: <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" />,
            label: contact.type,
          };
          return (
            <span
              key={`${contact.type}-${contact.handle}`}
              className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold ${
                contact.preferred
                  ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                  : "border-zinc-700/50 bg-zinc-800/40 text-zinc-400"
              }`}
            >
              {config.icon}
              <span>{config.label}</span>
            </span>
          );
        })}
      </div>
    );
  };

  const createdAgoMinutes =
    (Date.now() - new Date(party.created_at).getTime()) / 60000;
  const isNewlyCreated = createdAgoMinutes < 30;

  const getTimeUntilExpiration = () => {
    if (!party.expires_at) return null;
    const expiresAt = new Date(party.expires_at).getTime();
    const now = Date.now();
    const diffMs = expiresAt - now;
    if (diffMs <= 0) return null;

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} ${t("timeago.days_short")}`;
    } else if (hours > 0) {
      return `${hours} ${t("timeago.hours_short")}`;
    } else {
      return `${minutes} ${t("timeago.minutes_short")}`;
    }
  };

  const timeUntilExpiration = getTimeUntilExpiration();
  const isExpiringSoon = party.expires_at && new Date(party.expires_at).getTime() - Date.now() < 2 * 60 * 60 * 1000;

  const getScheduledLabel = () => {
    if (!party.scheduled_at) return null;
    const scheduledDate = new Date(party.scheduled_at);
    const now = new Date();
    const timeStr = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const isToday = scheduledDate.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = scheduledDate.toDateString() === tomorrow.toDateString();

    if (isToday) return t("party.scheduled_today", { time: timeStr });
    if (isTomorrow) return t("party.scheduled_tomorrow", { time: timeStr });
    return t("party.scheduled_at", { time: timeStr });
  };

  const scheduledLabel = getScheduledLabel();

  return (
    <div
      className={`group relative rounded-xl p-5 sm:p-6 border transition-all duration-300 text-white space-y-4 w-full backdrop-blur-sm
      ${isPinned
          ? "bg-gradient-to-br from-pink-950/40 via-pink-900/30 to-purple-950/40 border-pink-500/50 hover:border-pink-400/70 hover:shadow-lg hover:shadow-pink-500/20"
          : "bg-gradient-to-br from-zinc-800/60 via-zinc-800/40 to-zinc-900/60 border-zinc-700/60 hover:border-zinc-600/80 hover:shadow-xl hover:shadow-zinc-900/50"
        }
    `}
    >

      <div className="flex justify-between items-start gap-4">
        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex items-center gap-2.5">
            <h3 className="text-xl sm:text-2xl font-bold text-white bg-gradient-to-r from-white to-zinc-200 bg-clip-text text-transparent truncate">
              {getGameName(party.game, t)}
            </h3>
            {isPinned && (
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-pink-500/20 blur-md rounded-full"></div>
                <BookmarkIcon className="w-5 h-5 text-pink-400 relative" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {isPinned && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-200 bg-gradient-to-r from-pink-500/20 to-pink-600/20 px-3 py-1.5 rounded-lg border border-pink-500/40 shadow-md shadow-pink-500/10 backdrop-blur-sm">
                <BookmarkIcon className="w-4 h-4" />
                {t("party.pinned")}
              </span>
            )}

            {isNewlyCreated && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-200 bg-gradient-to-r from-blue-500/20 to-blue-600/20 px-3 py-1.5 rounded-lg border border-blue-500/40 shadow-md shadow-blue-500/10 backdrop-blur-sm animate-pulse">
                <ClockIcon className="w-4 h-4" />
                {t("party.new")}
              </span>
            )}

            {scheduledLabel && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-200 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 px-3 py-1.5 rounded-lg border border-emerald-500/40 shadow-md shadow-emerald-500/10 backdrop-blur-sm">
                <ClockIcon className="w-4 h-4" />
                {scheduledLabel}
              </span>
            )}

            {isAlmostFull && !isFull && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-200 bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 px-3 py-1.5 rounded-lg border border-yellow-500/40 shadow-md shadow-yellow-500/10 backdrop-blur-sm">
                <UserGroupIcon className="w-4 h-4" />
                {t("party.almost_full")}
              </span>
            )}

            {timeUntilExpiration && (
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border shadow-md backdrop-blur-sm ${
                isExpiringSoon
                  ? "text-red-200 bg-gradient-to-r from-red-500/20 to-red-600/20 border-red-500/40 shadow-red-500/10 animate-pulse"
                  : "text-purple-200 bg-gradient-to-r from-purple-500/20 to-purple-600/20 border-purple-500/40 shadow-purple-500/10"
              }`}>
                <Timer className="w-4 h-4" />
                {t("party.expires_in")} {timeUntilExpiration}
              </span>
            )}
          </div>
        </div>

        <span className="text-xs font-medium text-zinc-400 whitespace-nowrap px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 flex-shrink-0">
          {timeAgo(party.created_at, t)}
        </span>
      </div>

      <div className="flex items-start gap-3 text-sm text-zinc-200 bg-zinc-900/30 rounded-lg p-4 border border-zinc-700/30">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-full"></div>
          <BoltIcon className="w-5 h-5 mt-0.5 text-blue-400 relative" />
        </div>
        <p className="flex-1 leading-relaxed break-words">{party.goal}</p>
      </div>

      {/* Creator badge */}
      {party.user_id && (
        <div className="flex items-center">
          <CreatorBadge userId={party.user_id} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-zinc-700/50">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
          {renderContacts(party.contacts)}
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gradient-to-r from-zinc-800/60 to-zinc-900/60 border border-zinc-700/50">
            <UserGroupIcon className="w-4 h-4 text-zinc-400" />
            <div className="flex items-center gap-1.5 text-sm">
              <span className={`font-bold ${isFull ? 'text-red-400' : isAlmostFull ? 'text-yellow-400' : 'text-green-400'}`}>
                {party.joined}
              </span>
              <span className="text-zinc-500">/</span>
              <span className="text-zinc-300 font-medium">{party.slots}</span>
            </div>
          </div>
          <div onClick={isFull ? onFullClick : undefined}>
            <button
              onClick={onJoinClick}
              disabled={isFull}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                isFull
                  ? "bg-zinc-800/50 text-zinc-500 border border-zinc-700/50 cursor-not-allowed opacity-50"
                  : "bg-gradient-to-r from-blue-600 via-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/50 hover:from-blue-500 hover:via-blue-400 hover:to-purple-400 hover:shadow-xl hover:shadow-blue-500/60 hover:scale-105 active:scale-95"
              }`}
            >
              {isFull ? t("party.full") : t("ui.join_party")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
