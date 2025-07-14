// PartyCard.tsx
import type { Party } from "../types";
import { UserGroupIcon, PhoneIcon, BoltIcon } from "@heroicons/react/24/outline";
import { analytics } from "../utils/analytics";

function timeAgo(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (diff < 60) return `${diff} сек назад`;
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  return `${Math.floor(diff / 3600)} ч назад`;
}

export default function PartyCard({
  party,
  onJoin,
}: {
  party: Party;
  onJoin: (contact: string) => void;
}) {
  const isFull = party.joined >= party.slots;

  const handleJoinClick = () => {
    analytics.joinPartyClick(party.game);
    onJoin(party.contact || "");
  };

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 shadow-sm hover:shadow-md transition text-white space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">{party.game}</h3>
        <span className="text-sm text-zinc-400">{timeAgo(party.created_at)}</span>
      </div>

      <div className="flex items-start gap-2 text-sm text-zinc-300">
        <BoltIcon className="w-4 h-4 mt-0.5 shrink-0 text-blue-400" />
        <p>{party.goal}</p>
      </div>

      {party.contact && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <PhoneIcon className="w-4 h-4 text-green-400" />
          <span>{party.contact}</span>
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
          className={`px-4 py-1.5 rounded text-xs font-medium transition ${
            isFull
              ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {isFull ? "Заполнено" : "Вступить"}
        </button>
      </div>
    </div>
  );
}