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
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 transition-colors ${
                contact.preferred
                  ? "border-blue-500/40 bg-blue-500/10"
                  : "border-zinc-700/40 bg-zinc-800/30 hover:border-zinc-600/60"
              }`}
            >
              {content}
            </a>
          ) : (
            <button
              key={`${contact.type}-${contact.handle}`}
              type="button"
              onClick={() => handleCopy(contact.handle)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 transition-colors ${
                contact.preferred
                  ? "border-blue-500/40 bg-blue-500/10"
                  : "border-zinc-700/40 bg-zinc-800/30 hover:border-zinc-600/60"
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
      className={`rounded-lg p-4 border transition-colors text-white space-y-3 w-full
      ${isPinned 
        ? "bg-pink-950/30 border-pink-600/40 hover:border-pink-500/60" 
        : "bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600/60"
      }
    `}
    >
      
      <div className="flex justify-between items-start">
        <div className="space-y-1.5 flex-1">
          <h3 className="text-lg font-semibold text-white">
            {getGameName(party.game, t)}
          </h3>

          <div className="flex flex-wrap gap-1.5">
            {isPinned && (
              <span className="inline-flex items-center gap-1 text-xs text-pink-300 bg-pink-900/30 px-2 py-0.5 rounded border border-pink-600/30">
                <BookmarkIcon className="w-3 h-3" />
                {t("party.pinned", { defaultValue: "Закреплено" })}
              </span>
            )}

            {isNewlyCreated && (
              <span className="inline-flex items-center gap-1 text-xs text-blue-300 bg-blue-900/30 px-2 py-0.5 rounded border border-blue-600/30">
                <ClockIcon className="w-3 h-3" />
                {t("party.new", { defaultValue: "Только что создано" })}
              </span>
            )}

            {isAlmostFull && !isFull && (
              <span className="inline-flex items-center gap-1 text-xs text-yellow-300 bg-yellow-900/30 px-2 py-0.5 rounded border border-yellow-600/30">
                <UserGroupIcon className="w-3 h-3" />
                {t("party.almost_full", { defaultValue: "Почти заполнено" })}
              </span>
            )}
          </div>
        </div>

        <span className="text-xs text-zinc-400 whitespace-nowrap ml-3">
          {timeAgo(party.created_at, t)}
        </span>
      </div>

      <div className="flex items-start gap-2 text-sm text-zinc-300">
        <BoltIcon className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
        <p>{party.goal}</p>
      </div>

      {renderContacts(party.contacts)}

      <div className="flex items-center justify-between pt-2 border-t border-zinc-700/40">
        <div className="flex items-center gap-1.5 text-sm text-zinc-400">
          <UserGroupIcon className="w-4 h-4" />
          <span>
            <span className="text-white font-medium">{party.joined}</span>
            <span className="mx-1">/</span>
            <span>{party.slots}</span>
          </span>
        </div>

        <button
          disabled={isFull}
          onClick={handleJoinClick}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            isFull
              ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {isFull ? (
            t("party.full", { defaultValue: "Заполнено" })
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