import { useState, useMemo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { sendCreateParty } from "../ws/client";
import { UserGroupIcon, BoltIcon } from "@heroicons/react/24/outline";
import { analytics } from "../utils/analytics";
import { getGames, type GameSlug } from "../constants/games";
import { useAuth } from "../context/AuthContext";
import type { ContactMethodType } from "../types";
import { contactHandleToMethod } from "../utils/contactHelpers";

export default function CreatePartyForm() {
    const { t } = useTranslation();
    const { lang } = useParams();
    const tt = useCallback((key: string, opts?: { defaultValue?: string }) => t(key, opts), [t]);

    const games = useMemo(() => getGames(tt), [tt]);
    const [game, setGame] = useState<GameSlug>(games[0]?.slug ?? "abioticfactor");
    const [goal, setGoal] = useState("");
    const [slots, setSlots] = useState(5);
    const { contactHandles, profile } = useAuth();

    const availableMethods = useMemo(
        () =>
            (Object.keys(contactHandles) as ContactMethodType[]).filter((key) =>
                Boolean(contactHandles[key]?.handle)
            ),
        [contactHandles]
    );

    const [selectedMethods, setSelectedMethods] = useState<ContactMethodType[]>(availableMethods);
    const [preferredMethod, setPreferredMethod] = useState<ContactMethodType | null>(
        availableMethods[0] ?? null
    );

    useEffect(() => {
        setSelectedMethods(availableMethods);
        setPreferredMethod((prev) =>
            availableMethods.includes(prev as ContactMethodType)
                ? prev
                : availableMethods[0] ?? null
        );
    }, [availableMethods]);

    useEffect(() => {
        if (!profile?.preferredContact) return;
        if (availableMethods.includes(profile.preferredContact)) {
            setPreferredMethod(profile.preferredContact);
        }
    }, [profile?.preferredContact, availableMethods]);

    useEffect(() => {
        if (selectedMethods.length === 0) {
            setPreferredMethod(null);
            return;
        }
        setPreferredMethod((prev) =>
            prev && selectedMethods.includes(prev)
                ? prev
                : selectedMethods[0]
        );
    }, [selectedMethods]);

    useEffect(() => {
        if (!games.find((g) => g.slug === game)) {
            setGame(games[0]?.slug ?? "abioticfactor");
        }
    }, [games, game]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        analytics.createPartySubmit(game);
        if (!goal.trim()) return;

        const effectivePreferred =
            preferredMethod && selectedMethods.includes(preferredMethod)
                ? preferredMethod
                : selectedMethods[0];

        const contacts = selectedMethods
            .map((method) =>
                contactHandleToMethod(
                    method,
                    contactHandles[method],
                    method === effectivePreferred
                )
            )
            .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact));

        if (availableMethods.length > 0 && contacts.length === 0) {
            // хотя бы один контакт должен быть выбран
            return;
        }

        sendCreateParty({ game, goal, slots, contacts });
        setGoal("");
        setSelectedMethods(availableMethods);
        setPreferredMethod(availableMethods[0] ?? null);
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="mb-6 space-y-4 rounded-xl border border-zinc-700 bg-zinc-900 p-4"
        >
            <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <BoltIcon className="h-5 w-5 text-blue-500" />
                {t("form.title", "Создать пати")}
            </h2>

            <div className="flex flex-wrap gap-3">
                <select
                    value={game}
                    onChange={(e) => setGame(e.target.value as GameSlug)}
                    className="w-full rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white sm:w-auto"
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
                        className="w-full rounded bg-zinc-800 px-3 py-2 pl-9 text-sm text-white"
                        placeholder={t("form.labels.slots", "Слоты")}
                    />
                    <UserGroupIcon className="pointer-events-none absolute left-2 top-2.5 h-5 w-5 text-zinc-500" />
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
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white"
            />

            <div className="space-y-3 rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
                <p className="text-sm text-zinc-300">
                    {t(
                        "form.contact_methods",
                        "Выберите способы связи, которые хотите показать"
                    )}
                </p>
                {availableMethods.length === 0 ? (
                    <p className="text-sm text-zinc-400">
                        {t(
                            "form.no_contacts",
                            "У вас не добавлено ни одного контакта. Настройте их в профиле."
                        )}{" "}
                        <Link
                            to={`/${lang ?? "en"}/profile`}
                            className="text-blue-400 underline"
                        >
                            {t("form.go_to_profile", "Перейти в профиль")}
                        </Link>
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {availableMethods.map((method) => (
                            <div key={method} className="flex items-center gap-2">
                                <label
                                    className={`cursor-pointer rounded-full border px-3 py-1 text-xs uppercase tracking-wide transition ${
                                        selectedMethods.includes(method)
                                            ? "border-blue-500 bg-blue-500/20 text-blue-200"
                                            : "border-zinc-700 bg-zinc-800 text-zinc-300"
                                    }`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedMethods.includes(method)}
                                        onChange={(e) => {
                                            setSelectedMethods((prev) => {
                                                if (e.target.checked) {
                                                    return [...prev, method];
                                                }
                                                const next = prev.filter((item) => item !== method);
                                                if (preferredMethod === method) {
                                                    setPreferredMethod(next[0] ?? null);
                                                }
                                                return next;
                                            });
                                        }}
                                        className="hidden"
                                    />
                                    {method.toUpperCase()}
                                </label>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {selectedMethods.length > 0 && (
                <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-900/60 p-4">
                    <label className="block text-xs uppercase tracking-wide text-zinc-400">
                        {t("form.preferred_contact", "Предпочтительный способ связи")}
                    </label>
                    <select
                        value={preferredMethod ?? selectedMethods[0] ?? ""}
                        onChange={(e) => setPreferredMethod(e.target.value as ContactMethodType)}
                        className="w-full rounded border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white"
                    >
                        {selectedMethods.map((method) => (
                            <option key={method} value={method}>
                                {method.toUpperCase()}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-zinc-500">
                        {t(
                            "form.preferred_contact_hint",
                            "Этот контакт будет отображаться первым в списке"
                        )}
                    </p>
                </div>
            )}

            <button
                type="submit"
                disabled={availableMethods.length > 0 && selectedMethods.length === 0}
                className={`w-full rounded px-5 py-2 text-sm font-medium text-white transition sm:w-auto ${
                    availableMethods.length > 0 && selectedMethods.length === 0
                        ? "bg-zinc-700 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700"
                }`}
            >
                {t("form.cta", "Создать пати")}
            </button>
        </form>
    );
}
