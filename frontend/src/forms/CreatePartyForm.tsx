import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { sendCreateParty } from "../ws/client";
import { UserGroupIcon, BoltIcon } from "@heroicons/react/24/outline";
import { Search, ChevronDown } from "lucide-react";
import { analytics } from "../utils/analytics";
import { getGames, type GameSlug } from "../constants/games";
import { useAuth } from "../context/AuthContext";
import type { ContactHandle, ContactMethodType, Party } from "../types";
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
    const { contactHandles, profile } = useAuth();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const noContactsTracked = useRef(false);
    const goalRef = useRef(goal);
    const gameRef = useRef(game);
    const [showOtherGames, setShowOtherGames] = useState(false);
    const [gameSearchQuery, setGameSearchQuery] = useState("");
    const otherGamesRef = useRef<HTMLDivElement>(null);
    const formStartTracked = useRef(false);

    // Derive contact handles from OAuth identities as fallback
    // so users don't need to visit Profile before creating a party
    const effectiveContactHandles = useMemo((): Partial<Record<ContactMethodType, ContactHandle>> => {
        const handles: Partial<Record<ContactMethodType, ContactHandle>> = { ...contactHandles };
        profile?.identities?.forEach((identity) => {
            if (handles[identity.provider]?.handle) return; // explicit contact takes priority
            if (!identity.username) return;
            const p = identity.provider;
            if (p === "telegram") {
                const username = identity.username.replace(/^@/, "");
                handles[p] = { handle: `@${username}`, url: `https://t.me/${username}` };
            } else if (p === "discord") {
                handles[p] = { handle: identity.username, url: identity.url };
            } else if (p === "steam") {
                handles[p] = { handle: identity.username, url: identity.url };
            }
        });
        return handles;
    }, [contactHandles, profile?.identities]);

    const availableMethods = useMemo(
        () =>
            (Object.keys(effectiveContactHandles) as ContactMethodType[]).filter((key) =>
                Boolean(effectiveContactHandles[key]?.handle)
            ),
        [effectiveContactHandles]
    );

    // Keep refs in sync for unmount cleanup
    useEffect(() => { goalRef.current = goal; }, [goal]);
    useEffect(() => { gameRef.current = game; }, [game]);

    // Track abandonment when form unmounts with text already entered
    useEffect(() => {
        return () => {
            if (goalRef.current.trim()) {
                analytics.createPartyAbandonedWithText(gameRef.current);
            }
        };
    }, []);

    // Track form start only once user is logged in and the form is usable
    useEffect(() => {
        if (!profile || formStartTracked.current) return;
        formStartTracked.current = true;
        analytics.createPartyStart(game);
    }, [profile, game]);

    // Track when logged-in user is blocked by missing contacts
    useEffect(() => {
        if (!profile) return;
        if (availableMethods.length === 0 && !noContactsTracked.current) {
            noContactsTracked.current = true;
            analytics.createPartyBlockedNoContacts(game);
        }
    }, [profile, availableMethods.length, game]);

    // Calculate game popularity from parties
    const gameCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        parties.forEach((party) => {
            const slug = party.game.toLowerCase();
            counts[slug] = (counts[slug] || 0) + 1;
        });
        return counts;
    }, [parties]);

    const sortedGames = useMemo(() => {
        return [...games].sort((a, b) => {
            const countA = gameCounts[a.slug.toLowerCase()] || 0;
            const countB = gameCounts[b.slug.toLowerCase()] || 0;
            if (countB !== countA) return countB - countA;
            return a.name.localeCompare(b.name);
        });
    }, [games, gameCounts]);

    const popularGames = useMemo(() => {
        const withParties = sortedGames.filter((g) => (gameCounts[g.slug.toLowerCase()] || 0) > 0);
        return withParties.length > 0 ? withParties.slice(0, 5) : sortedGames.slice(0, 5);
    }, [sortedGames, gameCounts]);

    const otherGames = useMemo(() => {
        const popularSlugs = new Set(popularGames.map((g) => g.slug));
        return sortedGames.filter((g) => !popularSlugs.has(g.slug));
    }, [sortedGames, popularGames]);

    const filteredOtherGames = useMemo(() => {
        if (!gameSearchQuery.trim()) return otherGames;
        const query = gameSearchQuery.toLowerCase();
        return otherGames.filter((g) => g.name.toLowerCase().includes(query));
    }, [otherGames, gameSearchQuery]);

    useEffect(() => {
        if (!games.find((g) => g.slug === game)) {
            setGame(games[0]?.slug ?? "abioticfactor");
        }
    }, [games, game]);

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!goal.trim() || availableMethods.length === 0) return;

        analytics.createPartySubmit(game, slots);

        const contacts = availableMethods
            .map((method, i) =>
                contactHandleToMethod(method, effectiveContactHandles[method], i === 0)
            )
            .filter((c): c is NonNullable<typeof c> => Boolean(c));

        if (contacts.length === 0) return;

        sendCreateParty({ game, goal, slots, contacts });
        setGoal("");
        onSuccess?.();
    };

    // Gate: not logged in
    if (!profile) {
        return (
            <div className="space-y-4 text-center py-4">
                <div className="relative mx-auto w-fit">
                    <div className="absolute inset-0 bg-blue-500/20 blur-lg rounded-full" />
                    <BoltIcon className="h-10 w-10 text-blue-400 relative mx-auto" />
                </div>
                <p className="text-white font-semibold text-lg">{t("form.title")}</p>
                <p className="text-sm text-zinc-400">{t("form.login_required")}</p>
                <button
                    type="button"
                    onClick={() => setShowLoginModal(true)}
                    className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:scale-105 shadow-md"
                >
                    {t("auth.sign_in")}
                </button>
                {showLoginModal && (
                    <LoginModal onClose={() => setShowLoginModal(false)} />
                )}
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex items-center gap-3 mb-1">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-full" />
                    <BoltIcon className="h-6 w-6 text-blue-400 relative" />
                </div>
                <h2 className="text-xl font-bold text-white bg-gradient-to-r from-white to-zinc-200 bg-clip-text text-transparent">
                    {t("form.title")}
                </h2>
            </div>

            {/* Game selection */}
            <div className="space-y-3">
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                    {t("form.labels.game")}
                </label>

                {popularGames.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
                                {t("form.popular_games")}
                            </span>
                            {popularGames.some((g) => gameCounts[g.slug.toLowerCase()] > 0) && (
                                <span className="text-xs text-zinc-500">{t("form.by_ads_count")}</span>
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
                                        className={`relative group rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${isSelected
                                            ? "bg-gradient-to-r from-blue-600 via-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/40 border border-blue-400/50"
                                            : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/80 border border-zinc-700/50 hover:border-zinc-600/70"
                                            }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-lg blur-sm" />
                                        )}
                                        <span className="relative flex items-center gap-2">
                                            {g.name}
                                            {count > 0 && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-zinc-700/50 text-zinc-400"}`}>
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

                {otherGames.length > 0 && (
                    <div className="space-y-2" ref={otherGamesRef}>
                        <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">
                            {t("form.other_games")}
                        </span>
                        {!showOtherGames ? (
                            <button
                                type="button"
                                onClick={() => { setShowOtherGames(true); setGameSearchQuery(""); }}
                                className="w-full rounded-lg border-2 border-zinc-700/50 bg-zinc-900/50 px-4 py-2 pr-10 text-sm text-white transition-all duration-200 hover:border-zinc-600/70 text-left flex items-center justify-between"
                            >
                                <span>
                                    {games.find((g) => g.slug === game && !popularGames.some((pg) => pg.slug === g.slug))?.name || t("form.select_game")}
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
                                        placeholder={t("form.search_games")}
                                        className="w-full pl-10 pr-10 py-2 rounded-lg border-2 border-zinc-700/50 bg-zinc-900/50 text-sm text-white placeholder:text-zinc-500 transition-all duration-200 hover:border-zinc-600/70 focus:border-blue-500/50"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setShowOtherGames(false); setGameSearchQuery(""); }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
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
                                                    onClick={() => { setGame(g.slug); setShowOtherGames(false); setGameSearchQuery(""); }}
                                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${isSelected
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
                                        <p className="text-sm text-zinc-500">{t("form.no_games_found")}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Description + Slots in a row */}
            <div className="flex gap-3 items-end">
                <div className="flex-1">
                    <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                        {t("form.labels.description")}
                    </label>
                    <input
                        type="text"
                        placeholder={t("form.placeholders.description")}
                        required
                        value={goal}
                        onChange={(e) => setGoal(e.target.value)}
                        className="w-full rounded-lg border-2 border-zinc-700/50 bg-zinc-900/50 px-4 py-2 text-sm text-white placeholder:text-zinc-500 transition-all duration-200 hover:border-zinc-600/70 focus:border-blue-500/50 focus:bg-zinc-900/70"
                    />
                </div>
                <div className="w-24 shrink-0">
                    <label className="block text-sm font-semibold text-zinc-300 mb-1.5">
                        {t("form.labels.slots")}
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={slots}
                            min={2}
                            max={10}
                            onChange={(e) => setSlots(parseInt(e.target.value || "0", 10))}
                            className="w-full rounded-lg border-2 border-zinc-700/50 bg-zinc-900/50 px-4 py-2 pl-9 text-sm text-white transition-all duration-200 hover:border-zinc-600/70 focus:border-blue-500/50 focus:bg-zinc-900/70"
                        />
                        <UserGroupIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    </div>
                </div>
            </div>

            {/* Contact info - read-only display */}
            {availableMethods.length > 0 ? (
                <div className="rounded-lg border border-zinc-700/50 bg-zinc-900/30 px-3 py-2.5 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-zinc-500">{t("form.contact_methods")}</span>
                    {availableMethods.map((method) => (
                        <span
                            key={method}
                            className="text-xs px-2 py-0.5 rounded-full bg-zinc-700/60 text-zinc-300 font-medium"
                        >
                            {method.charAt(0).toUpperCase() + method.slice(1)}: {effectiveContactHandles[method]?.handle}
                        </span>
                    ))}
                </div>
            ) : (
                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                    <p className="text-xs text-yellow-200">
                        {t("form.no_contacts_required", "You need to add at least one contact in your profile to create a party.")}{" "}
                        <a href={`/${lang ?? "en"}/profile`} className="underline text-yellow-300">
                            {t("form.go_to_profile")}
                        </a>
                    </p>
                </div>
            )}

            <button
                type="submit"
                disabled={availableMethods.length === 0 || !goal.trim()}
                className={`w-full rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all duration-200 ${availableMethods.length === 0 || !goal.trim()
                    ? "bg-zinc-700 cursor-not-allowed opacity-50"
                    : "bg-gradient-to-r from-blue-600 via-blue-500 to-purple-500 hover:from-blue-500 hover:via-blue-400 hover:to-purple-400 hover:shadow-lg hover:shadow-blue-500/40 border border-blue-400/30"
                    }`}
            >
                <span className="flex items-center justify-center gap-2">
                    {availableMethods.length > 0 && goal.trim() && <BoltIcon className="h-4 w-4" />}
                    {t("form.cta")}
                </span>
            </button>
        </form>
    );
}
