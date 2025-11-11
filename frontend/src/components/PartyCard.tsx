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
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 transition hover:border-blue-500 hover:bg-blue-500/10 ${
                contact.preferred
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-700 bg-zinc-800/60"
              }`}
            >
              {content}
            </a>
          ) : (
            <button
              key={`${contact.type}-${contact.handle}`}
              type="button"
              onClick={() => handleCopy(contact.handle)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 transition hover:border-blue-500 hover:bg-blue-500/10 ${
                contact.preferred
                  ? "border-blue-500 bg-blue-500/10"
                  : "border-zinc-700 bg-zinc-800/60"
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
      className={`rounded-xl p-4 shadow-sm hover:shadow-md transition text-white space-y-3 w-full
      ${isPinned ? "bg-pink-950 border border-pink-600" : "bg-zinc-800 border border-zinc-700"}
    `}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold"> {getGameName(party.game, t)}</h3>

          <div className="flex flex-wrap gap-2">
            {isPinned && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-pink-400 bg-pink-900/60 px-2 py-0.5 rounded-md">
                <BookmarkIcon className="w-4 h-4" />
                {t("party.pinned", { defaultValue: "Закреплено" })}
              </span>
            )}

            {isNewlyCreated && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 bg-blue-900/60 px-2 py-0.5 rounded-md">
                <ClockIcon className="w-4 h-4" />
                {t("party.new", { defaultValue: "Только что создано" })}
              </span>
            )}

            {isAlmostFull && !isFull && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400 bg-yellow-900/50 px-2 py-0.5 rounded-md">
                <UserGroupIcon className="w-4 h-4" />
                {t("party.almost_full", { defaultValue: "Почти заполнено" })}
              </span>
            )}
          </div>
        </div>

        <span className="text-sm text-zinc-400">
          {timeAgo(party.created_at, t)}
        </span>
      </div>

      <div className="flex items-start gap-2 text-sm text-zinc-300">
        <BoltIcon className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
        <p>{party.goal}</p>
      </div>

      {renderContacts(party.contacts)}

      <div className="flex items-center justify-between text-sm text-zinc-400">
        <div className="flex items-center gap-1">
          <UserGroupIcon className="w-4 h-4 text-zinc-400" />
          <span>
            {t("party.slots_label", {
              joined: party.joined,
              slots: party.slots,
              // RU fallback: "x/y слотов", EN fallback: "x/y slots"
              defaultValue:
                "{{joined}}/{{slots}} " +
                (t("party.slots", { defaultValue: "слотов" }) as string),
            })}
          </span>
        </div>

        <button
          disabled={isFull}
          onClick={handleJoinClick}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition duration-150 ${isFull
              ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
        >
          {isFull ? (
            t("party.full", { defaultValue: "Заполнено" })
          ) : (
            <>
              {t("ui.join_party", { defaultValue: "Вступить" })}
              <ArrowRightIcon className="w-4 h-4 ml-1 inline-block" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}