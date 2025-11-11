import type { ReactNode } from "react";
import type { ContactMethod, Party } from "../types";
import {
  UserGroupIcon,
  BoltIcon,
  ClockIcon,
  BookmarkIcon,
} from "@heroicons/react/24/outline";
import { ArrowRightIcon } from "@heroicons/react/24/solid";
import { Gamepad2, MessageCircle, Send } from "lucide-react";
import { analytics } from "../utils/analytics";
import { useTranslation } from "react-i18next";
import { getGameName } from "../constants/games";
import { StarIcon } from "@heroicons/react/20/solid";
import toast from "react-hot-toast";

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
  // если нет ключа — покажем "Xd Xh ago" / "дн ч назад"
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
  onJoin,
}: {
  party: Party;
  onJoin: () => void;
}) {
  const { t } = useTranslation();

  const isFull = party.joined >= party.slots;
  const isAlmostFull = party.joined === party.slots - 1 && party.slots > 2;
  const isPinned = party.pinned;

  const handleJoinClick = () => {
    analytics.joinPartyClick(party.game);
    onJoin();
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t("ui.copied", "Скопировано"));
    } catch {
      toast.error(t("toasts.error", "Что-то пошло не так"));
    }
  };

  const renderContacts = (contacts?: ContactMethod[]) => {
    if (!contacts || contacts.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
        {contacts.map((contact) => {
          const config = CONTACT_ICONS[contact.type] ?? {
            icon: <MessageCircle className="h-4 w-4" />,
            label: contact.type,
          };
          const content = (
            <>
              {config.icon}
              <span className="font-medium text-zinc-200">{config.label}</span>
              <span className="text-zinc-400">{contact.handle}</span>
              {contact.preferred && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-200">
                  <StarIcon className="h-3 w-3" />
                  {t("party.preferred", "Основной")}
                </span>
              )}
            </>
          );

          return contact.url ? (
            <a
              key={`${contact.type}-${contact.handle}`}
              href={contact.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all duration-200 hover:border-blue-500 hover:bg-blue-500/10 hover:scale-105 active:scale-95 ${
                contact.preferred
                  ? "border-blue-500/50 bg-blue-500/10 shadow-md shadow-blue-500/20"
                  : "border-zinc-700/50 bg-zinc-800/40 hover:border-zinc-600"
              }`}
            >
              {content}
            </a>
          ) : (
            <button
              key={`${contact.type}-${contact.handle}`}
              type="button"
              onClick={() => handleCopy(contact.handle)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 transition-all duration-200 hover:border-blue-500 hover:bg-blue-500/10 hover:scale-105 active:scale-95 ${
                contact.preferred
                  ? "border-blue-500/50 bg-blue-500/10 shadow-md shadow-blue-500/20"
                  : "border-zinc-700/50 bg-zinc-800/40 hover:border-zinc-600"
              }`}
            >
              {content}
            </button>
          );
        })}
      </div>
    );
  };

  const createdAgoMinutes =
    (Date.now() - new Date(party.created_at).getTime()) / 60000;
  const isNewlyCreated = createdAgoMinutes < 30;

  return (
    <div
      className={`rounded-2xl p-5 shadow-lg hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 text-white space-y-4 w-full animate-fadeIn relative overflow-hidden
      ${isPinned 
        ? "bg-gradient-to-br from-pink-950/60 via-pink-900/40 to-pink-950/60 border-2 border-pink-600/60 hover:border-pink-500/80 hover:scale-[1.02]" 
        : "bg-gradient-to-br from-zinc-800/90 via-zinc-800/70 to-zinc-900/90 backdrop-blur-sm border border-zinc-700/60 hover:border-zinc-600/80 hover:bg-zinc-800/95 hover:scale-[1.02]"
      }
    `}
    >
      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/5 to-transparent rounded-full blur-2xl pointer-events-none" />
      
      <div className="flex justify-between items-start relative z-10">
        <div className="space-y-2 flex-1">
          <h3 className="text-xl font-bold text-white tracking-tight">
            {getGameName(party.game, t)}
          </h3>

          <div className="flex flex-wrap gap-2">
            {isPinned && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-pink-300 bg-gradient-to-r from-pink-900/80 to-pink-800/60 px-3 py-1 rounded-full border border-pink-600/40 shadow-md shadow-pink-500/20">
                <BookmarkIcon className="w-3.5 h-3.5" />
                {t("party.pinned", { defaultValue: "Закреплено" })}
              </span>
            )}

            {isNewlyCreated && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300 bg-gradient-to-r from-blue-900/80 to-blue-800/60 px-3 py-1 rounded-full border border-blue-600/40 shadow-md shadow-blue-500/20">
                <ClockIcon className="w-3.5 h-3.5" />
                {t("party.new", { defaultValue: "Только что создано" })}
              </span>
            )}

            {isAlmostFull && !isFull && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-yellow-300 bg-gradient-to-r from-yellow-900/80 to-yellow-800/60 px-3 py-1 rounded-full border border-yellow-600/40 shadow-md shadow-yellow-500/20">
                <UserGroupIcon className="w-3.5 h-3.5" />
                {t("party.almost_full", { defaultValue: "Почти заполнено" })}
              </span>
            )}
          </div>
        </div>

        <span className="text-xs font-medium text-zinc-400 bg-zinc-900/50 px-2.5 py-1 rounded-lg border border-zinc-700/50 whitespace-nowrap ml-3">
          {timeAgo(party.created_at, t)}
        </span>
      </div>

      <div className="flex items-start gap-3 text-sm text-zinc-200 relative z-10">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
          <BoltIcon className="w-4 h-4 text-blue-400" />
        </div>
        <p className="flex-1 leading-relaxed">{party.goal}</p>
      </div>

      {renderContacts(party.contacts)}

      <div className="flex items-center justify-between pt-2 border-t border-zinc-700/50 relative z-10">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900/50 border border-zinc-700/50">
            <UserGroupIcon className="w-4 h-4 text-zinc-400" />
            <span className="text-sm font-medium text-zinc-300">
              <span className="text-white font-semibold">{party.joined}</span>
              <span className="text-zinc-500 mx-1">/</span>
              <span className="text-zinc-400">{party.slots}</span>
            </span>
          </div>
        </div>

        <button
          disabled={isFull}
          onClick={handleJoinClick}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
            isFull
              ? "bg-zinc-800/50 text-zinc-500 cursor-not-allowed border border-zinc-700/50"
              : "bg-gradient-to-r from-blue-600 via-blue-500 to-blue-600 hover:from-blue-500 hover:via-blue-400 hover:to-blue-500 text-white shadow-lg hover:shadow-xl hover:shadow-blue-500/50 active:scale-95 border border-blue-400/20"
          }`}
        >
          {isFull ? (
            <>
              <span className="text-xs">🔒</span>
              {t("party.full", { defaultValue: "Заполнено" })}
            </>
          ) : (
            <>
              {t("ui.join_party", { defaultValue: "Вступить" })}
              <ArrowRightIcon className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}