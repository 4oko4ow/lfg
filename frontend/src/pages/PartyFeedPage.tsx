import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  HelpCircle,
  MessageCircle,
  ChevronDown,
  Sparkles,
} from "lucide-react";

import { connectWS, onMessage, socket, sendJoinParty } from "../ws/client";
import PartyCard from "../components/PartyCard";
import PartyCardSkeleton from "../components/PartyCardSkeleton";
import type { ContactMethod, Message, Party } from "../types";
import FeedbackButton from "../components/FeedbackButton";
import { analytics } from "../utils/analytics";
import ContactModal from "../components/ContactModal";
import Chat from "../components/Chat";
import ChatDrawer from "../components/ChatDrawer";
import SuggestGameModal from "../components/modals/SuggestGameModal";
import CreatePartyModal from "../components/modals/CreatePartyModal";
import LoginModal from "../components/modals/LoginModal";
import { NoJoinSurvey } from "../components/NoJoinSurvey";
import { DynamicMeta } from "../components/DynamicMeta";
import { useOnlineCount } from "../context/OnlineCountContext";
import { useAuth } from "../context/AuthContext";

import { getGames } from "../constants/games";

function PartyFeedPage() {
  const { t } = useTranslation();
  const location = useLocation();

  const tt = useCallback(
    (key: string, opts?: { defaultValue?: string }) => t(key, opts),
    [t]
  );

  const games = useMemo(() => getGames(tt), [tt]);

  // Try to load cached parties for instant display - MUST be declared before useMemo that uses it
  const [parties, setParties] = useState<Party[]>(() => {
    try {
      const cached = localStorage.getItem("cached_parties");
      if (cached) {
        const parsed = JSON.parse(cached);
        const cacheTime = localStorage.getItem("cached_parties_time");
        // Use cache if less than 30 seconds old
        if (cacheTime && Date.now() - parseInt(cacheTime) < 30000) {
          return parsed;
        }
      }
    } catch {
      // Ignore cache errors
    }
    return [];
  });

  const ALL_LABEL = t("filters.all_games");
  const [filter, setFilter] = useState<string>(ALL_LABEL);
  const [showGameFilter, setShowGameFilter] = useState(false);
  const [gameFilterQuery, setGameFilterQuery] = useState("");

  // Calculate game popularity from parties
  const gameCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    parties.forEach((party) => {
      const slug = party.game.toLowerCase();
      counts[slug] = (counts[slug] || 0) + 1;
    });
    return counts;
  }, [parties]);

  // Sort games by popularity
  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      const countA = gameCounts[a.slug.toLowerCase()] || 0;
      const countB = gameCounts[b.slug.toLowerCase()] || 0;
      if (countB !== countA) return countB - countA;
      return a.name.localeCompare(b.name);
    });
  }, [games, gameCounts]);

  // Top popular games (top 4 with parties, or first 4 if none have parties)
  const popularGames = useMemo(() => {
    const withParties = sortedGames.filter((g) => (gameCounts[g.slug.toLowerCase()] || 0) > 0);
    if (withParties.length > 0) {
      return withParties.slice(0, 4);
    }
    return sortedGames.slice(0, 4);
  }, [sortedGames, gameCounts]);

  // Other games (not in popular)
  const otherGames = useMemo(() => {
    const popularSlugs = new Set(popularGames.map((g) => g.slug));
    return sortedGames.filter((g) => !popularSlugs.has(g.slug));
  }, [sortedGames, popularGames]);

  // Filtered other games based on search
  const filteredOtherGames = useMemo(() => {
    if (!gameFilterQuery.trim()) return otherGames;
    const query = gameFilterQuery.toLowerCase();
    return otherGames.filter((g) => g.name.toLowerCase().includes(query));
  }, [otherGames, gameFilterQuery]);

  const [contactModal, setContactModal] = useState<ContactMethod[] | null>(null);
  const [contactPartyId, setContactPartyId] = useState<string>("");
  const [chatOpen, setChatOpen] = useState(false);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [createPartyModalOpen, setCreatePartyModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const { onlineCount, setOnlineCount } = useOnlineCount();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [showSurvey, setShowSurvey] = useState(false);
  const [joinClicked, setJoinClicked] = useState(false);

  const isMobile =
    typeof window !== "undefined" ? window.innerWidth < 768 : false;

  // Always show chat on desktop
  useEffect(() => {
    if (!isMobile) {
      setChatOpen(true);
    }
  }, [isMobile]);

  const handleCloseModal = () => {
    analytics.contactClose();
    setContactModal(null);
    setContactPartyId("");
  };

  // Проверяем, есть ли сохраненная пати для присоединения после авторизации
  useEffect(() => {
    if (profile && parties.length > 0) {
      const pendingJoinData = sessionStorage.getItem("pending_join_party");
      if (pendingJoinData) {
        try {
          const partyData = JSON.parse(pendingJoinData);
          // Небольшая задержка, чтобы убедиться, что профиль полностью загружен
          setTimeout(() => {
            const party = parties.find(p => p.id === partyData.id);
            if (party) {
              const isFull = party.joined >= party.slots;
              
              // Для заполненных пати проверяем, является ли пользователь участником или создателем
              if (isFull) {
                // Проверяем, является ли пользователь создателем
                const isCreator = profile && party.user_id && profile.id === party.user_id;
                
                // Проверяем, является ли пользователь участником
                const joinedParties = JSON.parse(localStorage.getItem("joined_parties") || "[]") as string[];
                const isMember = joinedParties.includes(party.id);
                
                // Если пользователь не создатель и не участник - не показываем контакты
                if (!isCreator && !isMember) {
                  sessionStorage.removeItem("pending_join_party");
                  return;
                }
              }
              
              // Открываем модалку контактов для сохраненной пати
              analytics.joinPartyClick(party.game);
              analytics.contactModalOpened(party.game, party.id);
              
              // Трекинг времени до присоединения
              const feedStartTime = sessionStorage.getItem("feed_start_time");
              if (feedStartTime) {
                const duration = Date.now() - parseInt(feedStartTime);
                analytics.timeToJoin(duration);
                analytics.timeToFirstAction("join", duration);
              }
              
              // Сохраняем game для трекинга в модалке
              sessionStorage.setItem(`contact_modal_game_${party.id}`, party.game);
              if (party.joined >= party.slots) {
                analytics.partyFullClick(party.game);
              }
              setJoinClicked(true);
              setContactPartyId(party.id);
              setContactModal(party.contacts ?? []);
            }
            sessionStorage.removeItem("pending_join_party");
          }, 100);
        } catch (error) {
          console.error("Failed to parse pending join party data:", error);
          sessionStorage.removeItem("pending_join_party");
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, parties]);

  useEffect(() => {
    connectWS();

    const fallbackTimeout = setTimeout(() => setLoading(false), 15000);

    onMessage((msg: Message) => {
      switch (msg.type) {
        case "initial_state":
          setParties(msg.payload);
          setLoading(false);
          clearTimeout(fallbackTimeout);
          // Cache parties for instant display on next load
          try {
            localStorage.setItem("cached_parties", JSON.stringify(msg.payload));
            localStorage.setItem("cached_parties_time", Date.now().toString());
          } catch {
            // Ignore storage errors
          }
          break;
        case "new_party":
          // Track party creation success
          const newParty = msg.payload as Party;
          analytics.partyCreated(newParty.game, newParty.slots);
          
          // Если пользователь - создатель партии, добавляем в localStorage как "joined"
          // чтобы кнопка сразу показывала контакты
          if (profile && newParty.user_id && profile.id === newParty.user_id) {
            const joinedParties = JSON.parse(localStorage.getItem("joined_parties") || "[]") as string[];
            if (!joinedParties.includes(newParty.id)) {
              joinedParties.push(newParty.id);
              localStorage.setItem("joined_parties", JSON.stringify(joinedParties));
            }
          }
          
          setParties((prev) => {
            const updated = [msg.payload, ...prev];
            // Update cache
            try {
              localStorage.setItem("cached_parties", JSON.stringify(updated));
              localStorage.setItem("cached_parties_time", Date.now().toString());
            } catch {
              // Ignore storage errors
            }
            return updated;
          });
          break;
        case "party_remove":
          setParties((prev) => {
            const updated = prev.filter((p) => p.id !== msg.payload.id);
            // Remove from joined_parties if present
            try {
              const joinedParties = JSON.parse(localStorage.getItem("joined_parties") || "[]") as string[];
              const filtered = joinedParties.filter((id) => id !== msg.payload.id);
              localStorage.setItem("joined_parties", JSON.stringify(filtered));
            } catch {
              // Ignore storage errors
            }
            // Update cache
            try {
              localStorage.setItem("cached_parties", JSON.stringify(updated));
              localStorage.setItem("cached_parties_time", Date.now().toString());
            } catch {
              // Ignore storage errors
            }
            return updated;
          });
          break;
        case "party_update":
          setParties((prev) => {
            const updated = prev.map((p) => {
              if (p.id === msg.payload.id) {
                const updatedParty = msg.payload as Party;
                // Если пользователь вступил в эту партию, сохраняем в localStorage
                if (profile && updatedParty.joined > p.joined) {
                  const joinedParties = JSON.parse(localStorage.getItem("joined_parties") || "[]") as string[];
                  if (!joinedParties.includes(updatedParty.id)) {
                    joinedParties.push(updatedParty.id);
                    localStorage.setItem("joined_parties", JSON.stringify(joinedParties));
                  }
                }
                return updatedParty;
              }
              return p;
            });
            // Update cache
            try {
              localStorage.setItem("cached_parties", JSON.stringify(updated));
              localStorage.setItem("cached_parties_time", Date.now().toString());
            } catch {
              // Ignore storage errors
            }
            return updated;
          });
          break;
        case "online_count":
          setOnlineCount(msg.payload);
          break;
      }
    });
    analytics.enableAutoPageviews();
    analytics.feedPageView();
    
    // Трекинг времени до первого присоединения
    const feedStartTime = Date.now();
    sessionStorage.setItem("feed_start_time", feedStartTime.toString());

    return () => clearTimeout(fallbackTimeout);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const slug = params.get("game");
    const found = games.find((g) => g.slug === slug);
    setFilter(found ? found.name : ALL_LABEL);
  }, [games, ALL_LABEL, location.search]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "heartbeat" }));
      }
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;

  const filteredParties = useMemo(() => {
    // Convert filter (game name) to slug for comparison
    const selectedGame = games.find((g) => g.name === filter);
    const selectedSlug = selectedGame?.slug;
    
    const byGame =
      filter === ALL_LABEL
        ? parties
        : parties.filter((p) => p.game.toLowerCase() === selectedSlug?.toLowerCase());

    const pruned = byGame.filter((p) => {
      // Check if party has expired
      if (p.expires_at) {
        const expiresAt = new Date(p.expires_at).getTime();
        if (Date.now() >= expiresAt) {
          return false; // Hide expired parties
        }
      }

      const isFull = p.joined >= p.slots;
      const ageMs = Date.now() - new Date(p.created_at).getTime();

      const isOldFull = isFull && ageMs > THREE_DAYS_MS;
      const isStaleUnfilled = !isFull && ageMs > THREE_WEEKS_MS;

      return !(isOldFull || isStaleUnfilled);
    });

    return pruned.sort((a, b) => {
      const getPriority = (p: Party) => {
        if (p.pinned) return 100;
        const createdAgoMin = (Date.now() - new Date(p.created_at).getTime()) / 60000;
        if (createdAgoMin < 60) return 50;
        if (p.joined === p.slots - 1 && p.slots > 2) return 10;
        if (p.joined >= p.slots) return -10;
        return 0;
      };

      const d = getPriority(b) - getPriority(a);
      if (d !== 0) return d;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [parties, filter, ALL_LABEL, games]);

  // Close game filter when clicking outside
  useEffect(() => {
    if (!showGameFilter) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-game-filter]')) {
        setShowGameFilter(false);
        setGameFilterQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showGameFilter]);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("no_join_survey_shown") === "true";
    if (filteredParties.length > 0 && !joinClicked && !alreadyShown) {
      const timeout = setTimeout(() => {
        analytics.noJoinSurveyShown();
        setShowSurvey(true);
        sessionStorage.setItem("no_join_survey_shown", "true");
      }, 15000);
      return () => clearTimeout(timeout);
    }
  }, [filter, filteredParties.length, joinClicked]);

  const handleContactClick = (party: Party) => {
    const isFull = party.joined >= party.slots;
    
    // Для заполненных пати проверяем, является ли пользователь участником или создателем
    if (isFull) {
      const isAuthenticated = profile !== null;
      if (!isAuthenticated) {
        // Неавторизованные пользователи не могут видеть контакты заполненных пати
        return;
      }
      
      // Проверяем, является ли пользователь создателем
      const isCreator = profile && party.user_id && profile.id === party.user_id;
      
      // Проверяем, является ли пользователь участником
      const joinedParties = JSON.parse(localStorage.getItem("joined_parties") || "[]") as string[];
      const isMember = joinedParties.includes(party.id);
      
      // Если пользователь не создатель и не участник - не показываем контакты
      if (!isCreator && !isMember) {
        return;
      }
    }
    
    analytics.joinPartyClick(party.game);
    analytics.contactModalOpened(party.game, party.id);
    
    // Трекинг времени до присоединения
    const feedStartTime = sessionStorage.getItem("feed_start_time");
    if (feedStartTime) {
      const duration = Date.now() - parseInt(feedStartTime);
      analytics.timeToJoin(duration);
      analytics.timeToFirstAction("join", duration);
    }
    
    // Сохраняем game для трекинга в модалке
    sessionStorage.setItem(`contact_modal_game_${party.id}`, party.game);
    if (party.joined >= party.slots) {
      analytics.partyFullClick(party.game);
    }
    setJoinClicked(true);
    setContactPartyId(party.id);
    setContactModal(party.contacts ?? []);
  };

  const handleJoinClick = (party: Party) => {
    const isAuthenticated = profile !== null;
    analytics.joinButtonClick(party.game, party.id, isAuthenticated);
    
    if (!isAuthenticated) {
      // Пользователь не залогинен - открываем модалку авторизации
      analytics.joinButtonClickUnauthenticated(party.game, party.id);
      analytics.loginModalOpenedFromJoin(party.game, party.id);
      // Сохраняем информацию о пати для открытия после авторизации
      sessionStorage.setItem("pending_join_party", JSON.stringify({
        id: party.id,
        game: party.game,
        contacts: party.contacts,
      }));
      setLoginModalOpen(true);
    } else {
      // Пользователь залогинен
      // Проверяем, является ли пользователь создателем партии
      if (profile && party.user_id && profile.id === party.user_id) {
        // Создатель не может вступить в свою партию - просто показываем контакты
        handleContactClick(party);
        return;
      }
      
      // Проверяем, не вступил ли пользователь уже в эту партию
      // (используем localStorage для отслеживания на клиенте)
      const joinedParties = JSON.parse(localStorage.getItem("joined_parties") || "[]") as string[];
      if (joinedParties.includes(party.id)) {
        // Пользователь уже вступил - показываем контакты
        handleContactClick(party);
        return;
      }
      
      // Пользователь может вступить - отправляем запрос и открываем контакты
      handleContactClick(party);
      // Отправляем join_party через WebSocket
      sendJoinParty(party.id);
      
      // Сохраняем в localStorage, что пользователь вступил
      joinedParties.push(party.id);
      localStorage.setItem("joined_parties", JSON.stringify(joinedParties));
    }
  };

  const handleLoginModalClose = () => {
    setLoginModalOpen(false);
    // Если пользователь закрыл модалку без авторизации, очищаем сохраненную пати
    // Если авторизация прошла успешно, информация останется в sessionStorage
    // и модалка контактов откроется автоматически через useEffect
    if (!profile) {
      sessionStorage.removeItem("pending_join_party");
    }
  };

  return (
    <>
      <DynamicMeta />
      <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 text-white">
        {/* Hero Section */}
        <section className="mb-8">
          <div className="text-center space-y-4">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
            {t("hero.title")}
          </h1>
            <p className="text-sm sm:text-base text-zinc-400 max-w-2xl mx-auto">
            {t("hero.subtitle")}
          </p>
            <button
              onClick={() => setCreatePartyModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-purple-500 px-6 py-3 text-sm sm:text-base font-semibold text-white shadow-lg shadow-blue-500/50 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/60 mt-2"
            >
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
              {t("hero.create_party")}
            </button>

            {/* Communities hint */}
            <a
              href="/communities"
              onClick={() => analytics.communitiesLinkClickBanner()}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-emerald-400 transition-colors"
            >
              <span>Управляете сообществом?</span>
              <span className="text-emerald-400 font-medium">Интеграция для Discord / Telegram →</span>
            </a>
          </div>
        </section>

        {/* Game Filter Section */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <div className="relative flex items-center justify-center w-5 h-5">
              <div className="absolute inset-0 bg-blue-500/20 blur-md rounded-full"></div>
              <Sparkles className="h-5 w-5 text-blue-400 relative" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-zinc-100 leading-tight">
              {t("filters.title")}
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* "All" button - always first */}
            <button
              onClick={() => setFilter(ALL_LABEL)}
              className={`group relative rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 flex items-center justify-center min-h-[38px] ${
                filter === ALL_LABEL
                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
                  : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/80 border border-zinc-700/50"
              }`}
            >
              {filter === ALL_LABEL && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-lg blur-sm"></div>
              )}
              <span className="relative flex items-center gap-1.5">
                {filter === ALL_LABEL && <Sparkles className="h-3 w-3" />}
                {ALL_LABEL}
              </span>
            </button>

            {/* Popular games as chips */}
            {popularGames.map((game) => {
              const count = gameCounts[game.slug.toLowerCase()] || 0;
              const isSelected = filter === game.name;
              return (
                <button
                  key={game.slug}
                  onClick={() => {
                    setFilter(game.name);
                    setShowGameFilter(false);
                    setGameFilterQuery("");
                  }}
                  className={`group relative rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 flex items-center justify-center min-h-[38px] ${
                    isSelected
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
                      : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/80 border border-zinc-700/50"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-lg blur-sm"></div>
                  )}
                  <span className="relative flex items-center gap-1.5">
                    {game.name}
                    {loading ? (
                      <span className={`px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? "bg-white/20"
                          : "bg-zinc-700/60"
                      }`}>
                        <div className="h-3 w-4 animate-pulse rounded bg-zinc-600/50"></div>
                      </span>
                    ) : count > 0 ? (
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-zinc-700/60 text-zinc-400"
                      }`}>
                        {count}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}

            {/* Other games dropdown */}
            {otherGames.length > 0 && (
              <div className="relative" data-game-filter>
                <button
                  onClick={() => {
                    setShowGameFilter(!showGameFilter);
                    if (!showGameFilter) setGameFilterQuery("");
                  }}
                  className={`group relative rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 min-h-[38px] ${
                    filter !== ALL_LABEL && !popularGames.some((g) => g.name === filter)
                      ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30"
                      : "bg-zinc-800/60 text-zinc-300 hover:bg-zinc-700/80 border border-zinc-700/50"
                  }`}
                >
                  {filter !== ALL_LABEL && !popularGames.some((g) => g.name === filter) && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-lg blur-sm"></div>
                  )}
                  <span className="relative">
                    {filter !== ALL_LABEL && !popularGames.some((g) => g.name === filter)
                      ? games.find((g) => g.name === filter)?.name || t("filters.more")
                      : t("filters.more")}
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 relative transition-transform duration-200 ${showGameFilter ? "rotate-180" : ""}`} />
                </button>

                {showGameFilter && (
                  <div className="absolute top-full left-0 mt-2 z-50 w-72 sm:w-80 rounded-xl border border-zinc-700/60 bg-gradient-to-br from-zinc-900/98 to-zinc-950/98 backdrop-blur-md shadow-2xl shadow-zinc-900/80 overflow-hidden">
                    <div className="p-3 border-b border-zinc-700/50 bg-zinc-800/30">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <input
                          type="text"
                          value={gameFilterQuery}
                          onChange={(e) => setGameFilterQuery(e.target.value)}
                          placeholder={t("filters.search_games")}
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-700/50 bg-zinc-900/70 text-sm text-white placeholder:text-zinc-500 transition-all duration-200 hover:border-zinc-600/70 focus:border-blue-500/50 focus:bg-zinc-900/90 focus:ring-2 focus:ring-blue-500/20"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-2">
                      {filteredOtherGames.length > 0 ? (
                        <div className="space-y-1">
                          {filteredOtherGames.map((game) => {
                            const count = gameCounts[game.slug.toLowerCase()] || 0;
                            const isSelected = filter === game.name;
                            return (
              <button
                                key={game.slug}
                                onClick={() => {
                                  setFilter(game.name);
                                  setShowGameFilter(false);
                                  setGameFilterQuery("");
                                }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-200 flex items-center justify-between group ${
                                  isSelected
                                    ? "bg-gradient-to-r from-blue-600/30 to-purple-600/30 text-blue-200 border border-blue-500/40 shadow-md shadow-blue-500/10"
                                    : "text-zinc-300 hover:bg-zinc-800/70 hover:text-white border border-transparent"
                                }`}
                              >
                                <span className="font-medium">{game.name}</span>
                                {count > 0 && (
                                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${
                                    isSelected
                                      ? "bg-blue-500/20 text-blue-200"
                                      : "bg-zinc-700/50 text-zinc-400 group-hover:bg-zinc-700/70"
                                  }`}>
                                    {count}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 text-center">
                          <Search className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                          <p className="text-sm text-zinc-500 font-medium">
                            {t("filters.no_games_found")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {loading && parties.length === 0 ? (
          <div className="space-y-4 max-w-screen-md mx-auto">
            {[1, 2, 3].map((i) => (
              <div 
                key={i} 
                className="animate-fadeIn"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <PartyCardSkeleton />
              </div>
            ))}
          </div>
        ) : loading && parties.length > 0 ? (
          <div className="space-y-4 max-w-screen-md mx-auto">
            {/* Show cached parties immediately */}
            {filteredParties.map((party, index) => (
              <div 
                key={party.id} 
                className="animate-fadeIn"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <PartyCard 
                  party={party} 
                  onContactClick={() => handleContactClick(party)}
                  onJoinClick={() => handleJoinClick(party)}
                  position={index}
                />
        </div>
            ))}
            {/* Show skeleton for new items being loaded */}
            {[1, 2].map((i) => (
              <div 
                key={`skeleton-${i}`} 
                className="animate-fadeIn opacity-50"
                style={{ animationDelay: `${(filteredParties.length + i) * 100}ms` }}
              >
                <PartyCardSkeleton />
            </div>
            ))}
          </div>
        ) : filteredParties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700/50 bg-gradient-to-br from-zinc-900/40 to-zinc-950/40 backdrop-blur-sm p-12 text-center animate-fadeIn max-w-2xl mx-auto">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-zinc-800/50 to-zinc-900/50 mb-6 border border-zinc-700/50">
              <Search className="h-10 w-10 text-zinc-500" />
            </div>
            <p className="text-base font-medium text-zinc-300 mb-2">
              {t("filters.empty")}
            </p>
            <button
              onClick={() => setCreatePartyModalOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/50 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:shadow-blue-500/60"
            >
              <Sparkles className="h-4 w-4" />
              {t("hero.create_party")}
            </button>
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl mx-auto">
            {filteredParties.map((party, index) => (
              <div 
                key={party.id} 
                className="animate-fadeIn"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <PartyCard 
                  party={party} 
                  onContactClick={() => handleContactClick(party)}
                  onJoinClick={() => handleJoinClick(party)}
                  position={index}
                />
              </div>
            ))}
          </div>
        )}

        <NoJoinSurvey visible={showSurvey} />

        <FeedbackButton />
        {suggestModalOpen && (
          <SuggestGameModal onClose={() => setSuggestModalOpen(false)} />
        )}
        {createPartyModalOpen && (
          <CreatePartyModal 
            onClose={() => setCreatePartyModalOpen(false)} 
            parties={parties}
          />
        )}
        {loginModalOpen && (
          <LoginModal onClose={handleLoginModalClose} />
        )}
      </main>

      {contactModal && (
        <ContactModal
          contacts={contactModal}
          partyId={contactPartyId}
          onClose={handleCloseModal}
        />
      )}

      {isMobile ? (
        chatOpen && <ChatDrawer onClose={() => setChatOpen(false)} />
      ) : (
        <Chat onlineCount={onlineCount} />
      )}

      {/* Mobile chat button - floating on the left */}
      {isMobile && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 left-6 sm:hidden flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-purple-500 text-white shadow-xl shadow-blue-500/50 transition-all duration-300 hover:from-blue-500 hover:via-blue-400 hover:to-purple-400 hover:shadow-2xl hover:shadow-blue-500/70 hover:scale-110 active:scale-95 z-50 animate-fadeIn border border-blue-400/30"
          aria-label={t("chat.title")}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-md"></div>
          <MessageCircle className="h-6 w-6 relative" />
        </button>
      )}

      <button
        onClick={() => setSuggestModalOpen(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-600 via-pink-500 to-rose-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-xl shadow-pink-500/50 transition-all duration-300 hover:from-pink-500 hover:via-pink-400 hover:to-rose-400 hover:shadow-2xl hover:shadow-pink-500/70 hover:scale-105 active:scale-95 z-50 animate-fadeIn border border-pink-400/30"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-pink-400/20 to-rose-400/20 rounded-full blur-md"></div>
        <HelpCircle className="h-4 w-4 sm:h-5 sm:w-5 relative" />
        <span className="hidden sm:inline relative">{t("hero.suggest_game")}</span>
        <span className="sm:hidden relative">{t("hero.suggest_game_short")}</span>
      </button>
    </>
  );
}

export default PartyFeedPage;
