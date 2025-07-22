import type { Party } from "../types";
import {
  UserGroupIcon,
  PhoneIcon,
  BoltIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { analytics } from "../utils/analytics";
import { ArrowRightIcon } from "@heroicons/react/24/solid";
import { sendJoinParty } from "../ws/client";

function timeAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60) return `${diff} сек назад`;
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  return `${Math.floor(diff / 3600)} ч назад`;
}

export default function PartyCard({
  party,
  onJoin,
  isNewlyCreated = false,
}: {
  party: Party;
  onJoin: (contact: string) => void;
  isNewlyCreated?: boolean;
}) {
  const isFull = party.joined >= party.slots;
  const isAlmostFull = party.joined === party.slots - 1;

  const handleJoinClick = () => {
    analytics.joinPartyClick(party.game);
    onJoin(party.contact || "");
    sendJoinParty(party.id);
  };

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-sm hover:shadow-md transition text-white space-y-3 w-full max-w-screen-sm mx-auto">      <div className="flex justify-between items-start">
      <div className="space-y-1">
        <h3 className="text-xl font-semibold">{party.game}</h3>
        <div className="flex flex-wrap gap-2">
          {isNewlyCreated && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 bg-blue-900/60 px-2 py-0.5 rounded-md">
              <ClockIcon className="w-4 h-4" />
              Только что создано
            </span>
          )}
          {isAlmostFull && !isFull && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400 bg-yellow-900/50 px-2 py-0.5 rounded-md">
              <UserGroupIcon className="w-4 h-4" />
              Почти заполнено
            </span>
          )}
        </div>
      </div>
      <span className="text-sm text-zinc-400">{timeAgo(party.created_at)}</span>
    </div>

      <div className="flex items-start gap-2 text-sm text-zinc-300">
        <BoltIcon className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
        <p>{party.goal}</p>
      </div>

      {party.contact && (
        <div className="flex flex-wrap items-start gap-2 text-sm text-zinc-400">
          <PhoneIcon className="w-4 h-4 text-green-400 shrink-0" />
          <span className="break-all min-w-0">{party.contact}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-zinc-400">
        <div className="flex items-center gap-1">
          <UserGroupIcon className="w-4 h-4 text-zinc-400" />
          <span>
            {party.joined}/{party.slots} слотов
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
            "Заполнено"
          ) : (
            <>
              Вступить
              <ArrowRightIcon className="w-4 h-4 ml-1 inline-block" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}