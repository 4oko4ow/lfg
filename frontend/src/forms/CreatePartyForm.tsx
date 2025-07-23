import { useState } from "react";
import { sendCreateParty } from "../ws/client";
import { UserGroupIcon, PhoneIcon, BoltIcon } from "@heroicons/react/24/outline";
import { analytics } from "../utils/analytics";

const games =  [ "R.E.P.O", "Dota 2", "CS2", "PEAK", "PUBG", "Minecraft", "Tarkov","Fortnite", "The Finals","Marvel Rivals"];

export default function CreatePartyForm() {
    const [game, setGame] = useState(games[0]);
    const [goal, setGoal] = useState("");
    const [slots, setSlots] = useState(5);
    const [contact, setContact] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        analytics.createPartySubmit(game);
        e.preventDefault();
        if (!goal.trim()) return;
        sendCreateParty({ game, goal, slots, contact });
        setGoal("");
        setContact("");
    };

    return (
        <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl space-y-4 mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <BoltIcon className="w-5 h-5 text-blue-500" />
                Создать пати
            </h2>

            <div className="flex flex-wrap gap-3">
                <select
                    value={game}
                    onChange={(e) => setGame(e.target.value)}
                    className="px-4 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm w-full sm:w-auto"
                >
                    {games.map((g) => (
                        <option key={g} value={g}>
                            {g}
                        </option>
                    ))}
                </select>

                <div className="relative w-full sm:w-24">
                    <input
                        type="number"
                        value={slots}
                        min={2}
                        max={10}
                        onChange={(e) => setSlots(parseInt(e.target.value))}
                        className="pl-9 pr-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm w-full"
                        placeholder="Слоты"
                    />
                    <UserGroupIcon className="w-5 h-5 text-zinc-500 absolute left-2 top-2.5 pointer-events-none" />
                </div>
            </div>

            <input
                type="text"
                placeholder="Напиши пару слов о себе: цель, возраст, микро и т.п."
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full px-4 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm"
            />

            <div className="relative">
                <input
                    type="text"
                    placeholder="Контакт (Discord, Telegram, Steam, VK...)"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full px-4 py-2 pl-10 rounded bg-zinc-800 border border-zinc-700 text-white text-sm"
                />
                <PhoneIcon className="w-5 h-5 text-zinc-500 absolute left-3 top-2.5 pointer-events-none" />
            </div>

            <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded transition"
            >
                Создать пати
            </button>
        </form>
    );
}