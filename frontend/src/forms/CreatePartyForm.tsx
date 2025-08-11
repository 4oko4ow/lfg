import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { sendCreateParty } from "../ws/client";
import { UserGroupIcon, PhoneIcon, BoltIcon } from "@heroicons/react/24/outline";
import { analytics } from "../utils/analytics";
import { getGames, type GameSlug } from "../constants/games";

export default function CreatePartyForm() {
    const { t } = useTranslation();
    const tt = useCallback((key: string, opts?: { defaultValue?: string }) => t(key, opts), [t]);

    const games = useMemo(() => getGames(tt), [tt]); // [{slug, name}]
    const [game, setGame] = useState<GameSlug>(games[0]?.slug ?? "abioticfactor");
    const [goal, setGoal] = useState("");
    const [slots, setSlots] = useState(5);
    const [contact, setContact] = useState("");

    // если язык сменился — актуализируем выбранную игру
    useEffect(() => {
        if (!games.find((g) => g.slug === game)) {
            setGame(games[0]?.slug ?? "abioticfactor");
        }
    }, [games, game]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        analytics.createPartySubmit(game);
        if (!goal.trim()) return; // MVP-валидация
        sendCreateParty({ game, goal, slots, contact }); // отправляем SLUG
        setGoal("");
        setContact("");
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-zinc-900 border border-zinc-700 p-4 rounded-xl space-y-4 mb-6"
        >
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <BoltIcon className="w-5 h-5 text-blue-500" />
                {t("form.title", "Создать пати")}
            </h2>

            <div className="flex flex-wrap gap-3">
                <select
                    value={game}
                    onChange={(e) => setGame(e.target.value as GameSlug)}
                    className="px-4 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm w-full sm:w-auto"
                >
                    {games.map((g) => (
                        <option key={g.slug} value={g.slug}>
                            {g.name}
                        </option>
                    ))}
                </select>

                <div className="relative w-full sm:w-24">
                    <input
                        type="number"
                        value={slots}
                        min={2}
                        max={10}
                        onChange={(e) => setSlots(parseInt(e.target.value || "0", 10))}
                        className="pl-9 pr-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm w-full"
                        placeholder={t("form.labels.slots", "Слоты")}
                    />
                    <UserGroupIcon className="w-5 h-5 text-zinc-500 absolute left-2 top-2.5 pointer-events-none" />
                </div>
            </div>

            <input
                type="text"
                placeholder={t(
                    "form.placeholders.description",
                    "Напиши пару слов о себе: цель, возраст, микро и т.п."
                )}
                required
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full px-4 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm"
            />

            <div className="relative">
                <input
                    type="text"
                    required
                    placeholder={t(
                        "form.placeholders.contact",
                        "Контакт (Discord, Telegram, Steam, VK...)"
                    )}
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
                {t("form.cta", "Создать пати")}
            </button>
        </form>
    );
}