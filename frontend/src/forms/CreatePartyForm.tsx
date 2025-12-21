import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { sendCreateParty } from "../ws/client";
import { UserGroupIcon, BoltIcon, ClockIcon } from "@heroicons/react/24/outline";
import { Search, ChevronDown } from "lucide-react";
import { analytics } from "../utils/analytics";
import { getGames, type GameSlug } from "../constants/games";
import { useAuth } from "../context/AuthContext";
import type { ContactMethodType, Party } from "../types";
import { contactHandleToMethod } from "../utils/contactHelpers";
import LoginModal from "../components/modals/LoginModal";

export default function CreatePartyForm({ 
    parties = [], 
    onSuccess 
}: { 
    parties?: Party[];
    onSuccess?: () => void;
}) {
    const { t } = useTranslation();
    const { lang } = useParams();
    const tt = useCallback((key: string, opts?: { defaultValue?: string }) => t(key, opts), [t]);

    const games = useMemo(() => getGames(tt), [tt]);
    const [game, setGame] = useState<GameSlug>(games[0]?.slug ?? "abioticfactor");
    const [goal, setGoal] = useState("");
    const [slots, setSlots] = useState(5);
    const [expirationEnabled, setExpirationEnabled] = useState(false);
    const [expirationHours, setExpirationHours] = useState(24);
    const { contactHandles, profile } = useAuth();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showOtherGames, setShowOtherGames] = useState(false);
    const [gameSearchQuery, setGameSearchQuery] = useState("");
    const otherGamesRef = useRef<HTMLDivElement>(null);

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

    // Calculate game popularity from parties
    const gameCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        parties.forEach((party) => {
            const slug = party.game.toLowerCase();
            counts[slug] = (counts[slug] || 0) + 1;
        });
        return counts;
    }, [parties]);

    // Sort games by popularity (most popular first)
    const sortedGames = useMemo(() => {
        return [...games].sort((a, b) => {
            const countA = gameCounts[a.slug.toLowerCase()] || 0;
            const countB = gameCounts[b.slug.toLowerCase()] || 0;
            if (countB !== countA) return countB - countA;
            return a.name.localeCompare(b.name);
        });
    }, [games, gameCounts]);

    // Popular games (with at least 1 party) - show first 5, or first 5 overall if none have parties
    const popularGames = useMemo(() => {
        const withParties = sortedGames.filter((g) => (gameCounts[g.slug.toLowerCase()] || 0) > 0);
        if (withParties.length > 0) {
            return withParties.slice(0, 5);
        }
        // If no games have parties, show first 5 alphabetically
        return sortedGames.slice(0, 5);
    }, [sortedGames, gameCounts]);

    // Other games (rest of the games)
    const otherGames = useMemo(() => {
        const popularSlugs = new Set(popularGames.map((g) => g.slug));
        return sortedGames.filter((g) => !popularSlugs.has(g.slug));
    }, [sortedGames, popularGames]);

    // Filtered other games based on search
    const filteredOtherGames = useMemo(() => {
        if (!gameSearchQuery.trim()) return otherGames;
        const query = gameSearchQuery.toLowerCase();
        return otherGames.filter((g) => g.name.toLowerCase().includes(query));
    }, [otherGames, gameSearchQuery]);

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

    // Close other games select on outside click
    useEffect(() => {
        if (!showOtherGames) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (otherGamesRef.current && !otherGamesRef.current.contains(target)) {
                setShowOtherGames(false);
                setGameSearchQuery("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showOtherGames]);

    const canSubmit = useMemo(() => {
        if (availableMethods.length === 0) return false;
        if (selectedMethods.length === 0) return false;
        return true;
    }, [availableMethods.length, selectedMethods.length]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        console.log("📝 Form submit triggered");
        console.log("   goal:", goal);
        console.log("   canSubmit:", canSubmit);
        console.log("   availableMethods:", availableMethods);
        console.log("   selectedMethods:", selectedMethods);
        
        if (!goal.trim()) {
            console.warn("⚠️  Goal is empty, not submitting");
            return;
        }

        if (!canSubmit) {
            console.warn("⚠️  Cannot submit:", { availableMethods: availableMethods.length, selectedMethods: selectedMethods.length });
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

        console.log("   contacts:", contacts);
        
        if (contacts.length === 0) {
            console.warn("⚠️  No contacts generated, not submitting");
            return;
        }

        console.log("✅ Sending create_party:", { game, goal, slots, contacts });
        sendCreateParty({ game, goal, slots, contacts });
        setGoal("");
        setSelectedMethods(availableMethods);
        setPreferredMethod(availableMethods[0] ?? null);
        
        // Call onSuccess callback if provided (e.g., to close modal)
        if (onSuccess) {
            onSuccess();
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3"
        >
            <div className="flex items-center gap-3 mb-1">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-full"></div>
                    <BoltIcon className="h-6 w-6 text-blue-400 relative" />
                </div>
                <h2 className="text-xl font-bold text-white bg-gradient-to-r from-white to-zinc-200 bg-clip-text text-transparent">
                    {t("form.title", "Создать пати")}
                </h2>
            </div>

            <div className="space-y-3">
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    {t("form.labels.game", "Игра")}
                </label>
                
                {/* Popular Games */}
                {popularGames.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
                                {t("form.popular_games", "Популярные")}
                            </span>
                            {popularGames.some((g) => gameCounts[g.slug.toLowerCase()] > 0) && (
                                <span className="text-xs text-zinc-500">
                                    {t("form.by_ads_count", "по количеству объявлений")}
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {popularGames.map((g) => {
                                const count = gameCounts[g.slug.toLowerCase()] || 0;
                                const isSelected = game === g.slug;
                                return (
                                    <button
                                        key={g.slug}
                                        type="button"
                                        onClick={() => {
                                            setGame(g.slug);
                                            setShowOtherGames(false);
                                            setGameSearchQuery("");
                                        }}
                                        className={`relative group rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                                            isSelected
                                                ? "bg-gradient-to-r from-blue-600 via-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/40 border border-blue-400/50"
                                                : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/80 border border-zinc-700/50 hover:border-zinc-600/70"
                                        }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-lg blur-sm"></div>
                                        )}
                                        <span className="relative flex items-center gap-2">
                                {g.name}
                                            {count > 0 && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                                                    isSelected
                                                        ? "bg-white/20 text-white"
                                                        : "bg-zinc-700/50 text-zinc-400"
                                                }`}>
                                                    {count}
                                                </span>
                                            )}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Other Games - Custom Select with Search */}
                {otherGames.length > 0 && (
                    <div className="space-y-2" ref={otherGamesRef}>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
                                {t("form.other_games", "Другие игры")}
                            </span>
                </div>

                        {!showOtherGames ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setShowOtherGames(true);
                                    setGameSearchQuery("");
                                }}
                                className="w-full rounded-lg border-2 border-zinc-700/50 bg-zinc-900/50 px-4 py-2 pr-10 text-sm text-white transition-all duration-200 hover:border-zinc-600/70 focus:border-blue-500/50 focus:bg-zinc-900/70 text-left flex items-center justify-between"
                            >
                                <span>
                                    {games.find((g) => g.slug === game && !popularGames.some((pg) => pg.slug === g.slug))?.name || t("form.select_game", "Выберите игру")}
                                </span>
                                <ChevronDown className="h-4 w-4 text-zinc-500" />
                            </button>
                        ) : (
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <input
                            type="text"
                            value={gameSearchQuery}
                            onChange={(e) => setGameSearchQuery(e.target.value)}
                            placeholder={t("form.search_games", "Поиск игр...")}
                            className="w-full pl-10 pr-10 py-2 rounded-lg border-2 border-zinc-700/50 bg-zinc-900/50 text-sm text-white placeholder:text-zinc-500 transition-all duration-200 hover:border-zinc-600/70 focus:border-blue-500/50 focus:bg-zinc-900/70"
                            autoFocus
                        />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowOtherGames(false);
                                            setGameSearchQuery("");
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                                        aria-label={t("ui.close", "Закрыть")}
                                    >
                                        <ChevronDown className="h-4 w-4 rotate-180" />
                                    </button>
                                </div>
                                {filteredOtherGames.length > 0 ? (
                                    <div className="max-h-48 overflow-y-auto rounded-lg border-2 border-zinc-700/50 bg-zinc-900/50 p-2 space-y-1">
                                        {filteredOtherGames.map((g) => {
                                            const isSelected = game === g.slug;
                                            return (
                                                <button
                                                    key={g.slug}
                                                    type="button"
                                                    onClick={() => {
                                                        setGame(g.slug);
                                                        setShowOtherGames(false);
                                                        setGameSearchQuery("");
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                                                        isSelected
                                                            ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-300 border border-blue-500/30"
                                                            : "text-zinc-300 hover:bg-zinc-800/60 hover:text-white"
                                                    }`}
                                                >
                                                    {g.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-lg border-2 border-zinc-700/50 bg-zinc-900/50 p-4 text-center">
                                        <p className="text-sm text-zinc-500">
                                            {t("form.no_games_found", "Игры не найдены")}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                <div className="relative w-full sm:w-32">
                    <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                        {t("form.labels.slots", "Слоты")}
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={slots}
                            min={2}
                            max={10}
                            onChange={(e) => setSlots(parseInt(e.target.value || "0", 10))}
                            className="w-full rounded-lg border-2 border-zinc-700/50 bg-zinc-900/50 px-4 py-2 pl-10 text-sm text-white transition-all duration-200 hover:border-zinc-600/70 focus:border-blue-500/50 focus:bg-zinc-900/70"
                            placeholder={t("form.labels.slots", "Слоты")}
                        />
                        <UserGroupIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
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
                    className="w-full rounded-lg border-2 border-zinc-700/50 bg-zinc-900/50 px-4 py-2 text-sm text-white placeholder:text-zinc-500 transition-all duration-200 hover:border-zinc-600/70 focus:border-blue-500/50 focus:bg-zinc-900/70"
                />
            </div>

            {/* Expiration (Optional) */}
            <div className="space-y-2 rounded-lg border border-zinc-700/50 bg-zinc-900/30 p-3">
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs font-medium text-zinc-400 cursor-pointer">
                        <ClockIcon className="h-4 w-4 text-zinc-500" />
                        {t("form.expiration.label", "Автоматически скрыть через")}
                    </label>
                    <button
                        type="button"
                        onClick={() => {
                            setExpirationEnabled(!expirationEnabled);
                            if (expirationEnabled) {
                                setExpirationHours(24);
                            }
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            expirationEnabled
                                ? "bg-gradient-to-r from-blue-600 to-blue-500"
                                : "bg-zinc-700"
                        }`}
                    >
                        <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                expirationEnabled ? "translate-x-5" : "translate-x-1"
                            }`}
                        />
                    </button>
                </div>
                {expirationEnabled && (
                    <div className="space-y-2 pt-2">
                        <div className="flex flex-wrap gap-2">
                            {[1, 3, 6, 12, 24, 72].map((hours) => (
                                <button
                                    key={hours}
                                    type="button"
                                    onClick={() => setExpirationHours(hours)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                        expirationHours === hours
                                            ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-500/30 scale-105"
                                            : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/80 hover:scale-105 active:scale-95"
                                    }`}
                                >
                                    {hours < 24
                                        ? `${hours} ${t("form.expiration.hours", "ч")}`
                                        : hours === 24
                                        ? t("form.expiration.day", "1 день")
                                        : `${hours / 24} ${t("form.expiration.days", "дня")}`}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                min="1"
                                max="168"
                                value={expirationHours}
                                onChange={(e) => setExpirationHours(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full rounded-lg border-2 border-zinc-700/50 bg-zinc-900/50 px-4 py-1.5 text-sm text-white placeholder:text-zinc-500 transition-all duration-200 hover:border-zinc-600/70 focus:border-blue-500/50 focus:bg-zinc-900/70"
                                placeholder={t("form.expiration.custom_hours", "Кастомное количество часов")}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                                {t("form.expiration.hours_short", "ч")}
                            </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 leading-relaxed">
                            {t(
                                "form.expiration.hint",
                                "Объявление автоматически скроется через указанное время"
                            )}
                        </p>
                    </div>
                )}
            </div>

            <div className="space-y-2 rounded-lg border border-zinc-700/50 bg-zinc-900/30 p-3">
                <p className="text-sm text-zinc-400">
                    {t(
                        "form.contact_methods",
                        "Выберите способы связи, которые хотите показать"
                    )}
                </p>
                {!profile ? (
                    <div className="space-y-2">
                        <p className="text-sm text-zinc-400">
                            {t(
                                "form.login_required",
                                "Для создания пати необходимо войти в систему."
                            )}
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowLoginModal(true)}
                            className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                        >
                            {t("auth.sign_in", "Войти")}
                        </button>
                        {showLoginModal && (
                            <LoginModal onClose={() => setShowLoginModal(false)} />
                        )}
                    </div>
                ) : availableMethods.length === 0 ? (
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
                <div className="space-y-2 rounded-lg border border-zinc-700/50 bg-zinc-900/30 p-3">
                    <label className="block text-sm font-semibold text-zinc-300">
                        {t("form.preferred_contact", "Предпочтительный способ связи")}
                    </label>
                    <select
                        value={preferredMethod ?? selectedMethods[0] ?? ""}
                        onChange={(e) => setPreferredMethod(e.target.value as ContactMethodType)}
                        className="w-full rounded-lg border border-zinc-700/50 bg-zinc-900/50 px-4 py-2 text-sm text-white transition-colors hover:border-zinc-600 hover:bg-zinc-900/70"
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
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                    <p className="text-xs text-yellow-200">
                        {availableMethods.length === 0
                            ? t("form.no_contacts_required", "You need to add at least one contact in your profile to create a party.")
                            : t("form.select_contact_required", "Please select at least one contact method to show in your listing.")}
                    </p>
                </div>
            )}

            <button
                type="submit"
                disabled={!canSubmit || !goal.trim()}
                className={`w-full rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ${
                    !canSubmit || !goal.trim()
                        ? "bg-zinc-700 cursor-not-allowed opacity-50"
                        : "bg-gradient-to-r from-blue-600 via-blue-500 to-purple-500 hover:from-blue-500 hover:via-blue-400 hover:to-purple-400 hover:shadow-lg hover:shadow-blue-500/40 border border-blue-400/30"
                }`}
            >
                <span className="flex items-center justify-center gap-2">
                    {(!canSubmit || !goal.trim()) ? null : <BoltIcon className="h-4 w-4" />}
                {t("form.cta", "Создать пати")}
                </span>
            </button>
        </form>
    );
}
