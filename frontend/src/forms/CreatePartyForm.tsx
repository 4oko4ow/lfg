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

    const canSubmit = useMemo(() => {
        if (availableMethods.length === 0) return false;
        if (selectedMethods.length === 0) return false;
        return true;
    }, [availableMethods.length, selectedMethods.length]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!goal.trim()) {
            return;
        }

        if (!canSubmit) {
            return;
        }

        analytics.createPartySubmit(game);

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

        if (contacts.length === 0) {
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
            className="mb-6 space-y-3 rounded-xl border border-zinc-700/50 bg-zinc-800/60 backdrop-blur-sm p-4 max-w-screen-md mx-auto shadow-lg hover:shadow-xl hover:border-zinc-600 transition-all duration-300 animate-fadeIn"
        >
            <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <BoltIcon className="h-4 w-4 text-blue-500 animate-pulse" />
                {t("form.title", "Создать пати")}
            </h2>

            <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-[200px] relative">
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                        {t("form.labels.game", "Игра")}
                    </label>
                    <select
                        value={game}
                        onChange={(e) => setGame(e.target.value as GameSlug)}
                        className="w-full rounded-xl border-2 border-zinc-700/60 bg-zinc-900/70 backdrop-blur-sm px-4 py-3 text-sm font-medium text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 focus:bg-zinc-900/90 transition-all duration-200 shadow-sm hover:border-zinc-600"
                    >
                        {games.map((g) => (
                            <option key={g.slug} value={g.slug} className="bg-zinc-900">
                                {g.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="relative w-full sm:w-24">
                    <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                        {t("form.labels.slots", "Слоты")}
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={slots}
                            min={2}
                            max={10}
                            onChange={(e) => setSlots(parseInt(e.target.value || "0", 10))}
                            className="w-full rounded-xl border-2 border-zinc-700/60 bg-zinc-900/70 backdrop-blur-sm px-4 py-3 pl-10 text-sm font-medium text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 focus:bg-zinc-900/90 transition-all duration-200 shadow-sm hover:border-zinc-600"
                            placeholder={t("form.labels.slots", "Слоты")}
                        />
                        <UserGroupIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    {t("form.labels.description", "Описание")}
                </label>
                <input
                    type="text"
                    placeholder={t(
                        "form.placeholders.description",
                        "Напиши пару слов о себе: цель, возраст, микро и т.п."
                    )}
                    required
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full rounded-xl border-2 border-zinc-700/60 bg-zinc-900/70 backdrop-blur-sm px-4 py-3 text-sm font-medium text-white placeholder:text-zinc-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 focus:bg-zinc-900/90 transition-all duration-200 shadow-sm hover:border-zinc-600"
                />
            </div>

            <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-900/50 p-3">
                <p className="text-xs text-zinc-400">
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
                                    className={`cursor-pointer rounded-xl border-2 px-4 py-2 text-xs font-semibold uppercase tracking-wide transition-all duration-200 ${
                                        selectedMethods.includes(method)
                                            ? "border-blue-500/60 bg-gradient-to-r from-blue-500/20 to-blue-600/20 text-blue-200 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 scale-105"
                                            : "border-zinc-700/60 bg-zinc-800/50 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/70 hover:scale-105 active:scale-95"
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
                <div className="space-y-2 rounded-xl border-2 border-zinc-700/50 bg-zinc-900/40 backdrop-blur-sm p-4">
                    <label className="block text-xs font-medium text-zinc-400">
                        {t("form.preferred_contact", "Предпочтительный способ связи")}
                    </label>
                    <select
                        value={preferredMethod ?? selectedMethods[0] ?? ""}
                        onChange={(e) => setPreferredMethod(e.target.value as ContactMethodType)}
                        className="w-full rounded-xl border-2 border-zinc-700/60 bg-zinc-900/70 backdrop-blur-sm px-4 py-2.5 text-sm font-medium text-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 focus:bg-zinc-900/90 transition-all duration-200 shadow-sm hover:border-zinc-600"
                    >
                        {selectedMethods.map((method) => (
                            <option key={method} value={method} className="bg-zinc-900">
                                {method.toUpperCase()}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                        {t(
                            "form.preferred_contact_hint",
                            "Этот контакт будет отображаться первым в списке"
                        )}
                    </p>
                </div>
            )}

            {!canSubmit && (
                <div className="rounded-lg border-2 border-yellow-500/50 bg-yellow-500/10 p-3">
                    <p className="text-xs font-medium text-yellow-200">
                        {availableMethods.length === 0
                            ? t("form.no_contacts_required", "You need to add at least one contact in your profile to create a party.")
                            : t("form.select_contact_required", "Please select at least one contact method to show in your listing.")}
                    </p>
                </div>
            )}

            <button
                type="submit"
                disabled={!canSubmit || !goal.trim()}
                className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 sm:w-auto ${
                    !canSubmit || !goal.trim()
                        ? "bg-zinc-700 cursor-not-allowed opacity-50"
                        : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 shadow-lg hover:shadow-blue-500/50 active:scale-95"
                }`}
            >
                {t("form.cta", "Создать пати")}
            </button>
        </form>
    );
}
