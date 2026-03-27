'use client';

import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { sendCreateParty } from "@/lib/ws/client";
import { BoltIcon } from "@heroicons/react/24/outline";
import { Search, ChevronDown, Plus, Minus, Gamepad2, MessageCircle, Send } from "lucide-react";
import { analytics } from "@/lib/utils/analytics";
import { getGames, type GameSlug } from "@/lib/constants/games";
import { useAuth } from "@/components/providers/AuthProvider";
import type { ContactHandle, ContactMethodType, Party } from "@/lib/types";
import { contactHandleToMethod } from "@/lib/utils/contactHelpers";
import LoginModal from "@/components/modals/LoginModal";

const CONTACT_ICONS: Partial<Record<ContactMethodType, React.ReactNode>> = {
    steam: <Gamepad2 className="h-3.5 w-3.5" />,
    discord: <MessageCircle className="h-3.5 w-3.5" />,
    telegram: <Send className="h-3.5 w-3.5" />,
};

export default function CreatePartyForm({
    parties = [],
    onSuccess
}: {
    parties?: Party[];
    onSuccess?: () => void;
}) {
    const { t } = useTranslation();

    const games = useMemo(() => getGames(t), [t]);
    const [game, setGame] = useState<GameSlug>(games[0]?.slug ?? "abioticfactor");
    const [goal, setGoal] = useState("");
    const [slots, setSlots] = useState(5);
    const [scheduleOption, setScheduleOption] = useState<'now' | 'in_2h' | 'tonight' | 'tomorrow'>('now');
    const { contactHandles, profile } = useAuth();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const noContactsTracked = useRef(false);
    const goalRef = useRef(goal);
    const gameRef = useRef(game);
    const [showOtherGames, setShowOtherGames] = useState(false);
    const [gameSearchQuery, setGameSearchQuery] = useState("");
    const otherGamesRef = useRef<HTMLDivElement>(null);
    const formStartTracked = useRef(false);

    // Sync refs during render - no useEffect needed
    goalRef.current = goal;
    gameRef.current = game;

    const effectiveContactHandles = useMemo((): Partial<Record<ContactMethodType, ContactHandle>> => {
        const handles: Partial<Record<ContactMethodType, ContactHandle>> = { ...contactHandles };
        profile?.identities?.forEach((identity) => {
            if (handles[identity.provider]?.handle) return;
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

    useEffect(() => {
        return () => {
            if (goalRef.current.trim()) {
                analytics.createPartyAbandonedWithText(gameRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!profile || formStartTracked.current) return;
        formStartTracked.current = true;
        analytics.createPartyStart(game);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]); // intentionally exclude game - only track once on first show

    useEffect(() => {
        if (!profile) return;
        if (availableMethods.length === 0 && !noContactsTracked.current) {
            noContactsTracked.current = true;
            analytics.createPartyBlockedNoContacts(game);
        }
    }, [profile, availableMethods.length, game]);

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
            if (otherGamesRef.current && !otherGamesRef.current.contains(e.target as HTMLElement)) {
                setShowOtherGames(false);
                setGameSearchQuery("");
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showOtherGames]);

    function getScheduledAt(option: string): string | undefined {
        if (option === 'now') return undefined;
        const now = new Date();
        if (option === 'in_2h') {
            return new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
        }
        if (option === 'tonight') {
            const t = new Date(now);
            t.setHours(20, 0, 0, 0);
            if (t <= now) t.setDate(t.getDate() + 1);
            return t.toISOString();
        }
        if (option === 'tomorrow') {
            const t = new Date(now);
            t.setDate(t.getDate() + 1);
            t.setHours(20, 0, 0, 0);
            return t.toISOString();
        }
        return undefined;
    }

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

        sendCreateParty({ game, goal, slots, contacts, scheduled_at: getScheduledAt(scheduleOption) });
        setGoal("");
        onSuccess?.();
    };

    if (!profile) {
        return (
            <div className="space-y-4 text-center py-6">
                <div className="relative mx-auto w-fit">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                    <BoltIcon className="h-10 w-10 text-blue-400 relative mx-auto" />
                </div>
                <div>
                    <p className="text-white font-semibold">{t("form.title")}</p>
                    <p className="text-sm text-zinc-500 mt-1">{t("form.login_required")}</p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowLoginModal(true)}
                    className="rounded-lg bg-blue-600 hover:bg-blue-500 px-6 py-2.5 text-sm font-semibold text-white"
                >
                    {t("auth.sign_in")}
                </button>
                {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
            </div>
        );
    }

    const selectedInOther = games.find(
        (g) => g.slug === game && !popularGames.some((pg) => pg.slug === g.slug)
    );
    const canSubmit = availableMethods.length > 0 && goal.trim().length > 0;

    return (
        <form onSubmit={handleSubmit} className="space-y-4">

            {/* Game selection */}
            <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {t("form.labels.game")}
                </p>

                {/* Popular game chips */}
                {popularGames.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
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
                                    className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border transition-all ${
                                        isSelected
                                            ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/25"
                                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                                    }`}
                                >
                                    {g.name}
                                    {count > 0 && (
                                        <span className={`font-mono text-[10px] tabular-nums ${isSelected ? "text-blue-200" : "text-zinc-600"}`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Other games dropdown */}
                {otherGames.length > 0 && (
                    <div ref={otherGamesRef}>
                        {!showOtherGames ? (
                            <button
                                type="button"
                                onClick={() => { setShowOtherGames(true); setGameSearchQuery(""); }}
                                className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 py-0.5"
                            >
                                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                {selectedInOther
                                    ? <span className="text-blue-400 font-semibold">{selectedInOther.name}</span>
                                    : <span>{t("form.other_games")}</span>
                                }
                            </button>
                        ) : (
                            <div className="space-y-1.5">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={gameSearchQuery}
                                        onChange={(e) => setGameSearchQuery(e.target.value)}
                                        placeholder={t("form.search_games")}
                                        className="w-full pl-9 pr-8 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-600 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => { setShowOtherGames(false); setGameSearchQuery(""); }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400"
                                        aria-label={t("ui.close")}
                                    >
                                        <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                                    </button>
                                </div>
                                {filteredOtherGames.length > 0 ? (
                                    <div className="max-h-44 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 p-1 space-y-0.5">
                                        {filteredOtherGames.map((g) => {
                                            const isSelected = game === g.slug;
                                            return (
                                                <button
                                                    key={g.slug}
                                                    type="button"
                                                    onClick={() => { setGame(g.slug); setShowOtherGames(false); setGameSearchQuery(""); }}
                                                    className={`w-full text-left px-3 py-1.5 rounded-md text-xs font-medium ${
                                                        isSelected
                                                            ? "bg-blue-600/15 text-blue-300"
                                                            : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                                                    }`}
                                                >
                                                    {g.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-zinc-600 px-1 py-2">{t("form.no_games_found")}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Description */}
            <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {t("form.labels.description")}
                </label>
                <input
                    type="text"
                    placeholder={t("form.placeholders.description")}
                    required
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 hover:border-zinc-700 focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20"
                />
            </div>

            {/* Slots stepper */}
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {t("form.labels.slots")}
                </span>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => setSlots((s) => Math.max(2, s - 1))}
                        disabled={slots <= 2}
                        className="h-7 w-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-700 disabled:opacity-25 disabled:cursor-not-allowed"
                        aria-label="Decrease slots"
                    >
                        <Minus className="h-3 w-3" />
                    </button>
                    <span className="font-mono text-sm text-white w-5 text-center tabular-nums select-none">
                        {slots}
                    </span>
                    <button
                        type="button"
                        onClick={() => setSlots((s) => Math.min(10, s + 1))}
                        disabled={slots >= 10}
                        className="h-7 w-7 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-white hover:border-zinc-700 disabled:opacity-25 disabled:cursor-not-allowed"
                        aria-label="Increase slots"
                    >
                        <Plus className="h-3 w-3" />
                    </button>
                </div>
            </div>

            {/* Schedule selector */}
            <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                    {t("form.schedule.label")}
                </p>
                <div className="flex gap-1.5 flex-wrap">
                    {(['now', 'in_2h', 'tonight', 'tomorrow'] as const).map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => setScheduleOption(opt)}
                            className={`rounded-md px-3 py-1.5 text-xs font-semibold border transition-all ${
                                scheduleOption === opt
                                    ? "bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-500/25"
                                    : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                            }`}
                        >
                            {t(`form.schedule.${opt}`)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Contact info */}
            {availableMethods.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 shrink-0">
                        {t("form.contact_methods")}
                    </span>
                    <div className="flex gap-1.5 flex-wrap">
                        {availableMethods.map((method) => (
                            <span
                                key={method}
                                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-medium"
                            >
                                {CONTACT_ICONS[method]}
                                {effectiveContactHandles[method]?.handle}
                            </span>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
                    <p className="text-xs text-yellow-300/80 leading-relaxed">
                        {t("form.no_contacts_required", "You need to add at least one contact in your profile to create a party.")}{" "}
                        <a
                            href="/profile"
                            className="text-yellow-300 underline underline-offset-2 hover:text-yellow-200"
                        >
                            {t("form.go_to_profile")}
                        </a>
                    </p>
                </div>
            )}

            {/* Submit */}
            <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full rounded-lg py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 ${
                    canSubmit
                        ? "bg-blue-600 hover:bg-blue-500"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                }`}
            >
                {canSubmit && <BoltIcon className="h-4 w-4" />}
                {t("form.cta")}
            </button>
        </form>
    );
}
