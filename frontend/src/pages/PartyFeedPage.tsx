import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  HelpCircle,
  MessageCircle,
} from "lucide-react";

import { connectWS, onMessage, socket } from "../ws/client";
import PartyCard from "../components/PartyCard";
import type { ContactMethod, Message, Party } from "../types";
import CreatePartyForm from "../forms/CreatePartyForm";
import FeedbackButton from "../components/FeedbackButton";
import { analytics } from "../utils/analytics";
import ContactModal from "../components/ContactModal";
import Chat from "../components/Chat";
import ChatDrawer from "../components/ChatDrawer";
import SuggestGameModal from "../components/modals/SuggestGameModal";
import { NoJoinSurvey } from "../components/NoJoinSurvey";
import { DynamicMeta } from "../components/DynamicMeta";

import { getGames } from "../constants/games";

function PartyFeedPage() {
  const { t } = useTranslation();
  const location = useLocation();

  const tt = useCallback(
    (key: string, opts?: { defaultValue?: string }) => t(key, opts),
    [t]
  );

  const games = useMemo(() => getGames(tt), [tt]);

  const ALL_LABEL = t("filters.all_games", "Все");

  const gameOptions = useMemo(
    () => [ALL_LABEL, ...games.map((g) => g.name)],
    [ALL_LABEL, games]
  );

  const [parties, setParties] = useState<Party[]>([]);
  const [filter, setFilter] = useState<string>(ALL_LABEL);
  const [contactModal, setContactModal] = useState<ContactMethod[] | null>(null);
  const [contactPartyId, setContactPartyId] = useState<string>("");
  const [chatOpen, setChatOpen] = useState(false);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
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

  useEffect(() => {
    connectWS();

    const fallbackTimeout = setTimeout(() => setLoading(false), 15000);

    onMessage((msg: Message) => {
      switch (msg.type) {
        case "initial_state":
          setParties(msg.payload);
          setLoading(false);
          clearTimeout(fallbackTimeout);
          break;
        case "new_party":
          setParties((prev) => [msg.payload, ...prev]);
          break;
        case "party_remove":
          setParties((prev) => prev.filter((p) => p.id !== msg.payload.id));
          break;
        case "party_update":
          setParties((prev) =>
            prev.map((p) => (p.id === msg.payload.id ? msg.payload : p))
          );
          break;
        case "online_count":
          setOnlineCount(msg.payload);
          break;
      }
    });
    analytics.enableAutoPageviews();

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
    analytics.joinPartyClick(party.game);
    setJoinClicked(true);
    setContactPartyId(party.id);
    setContactModal(party.contacts ?? []);
  };

  return (
    <>
      <DynamicMeta />
      <main className="mx-auto w-full max-w-5xl px-4 py-4 sm:py-6 text-white">
        <section className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold">
            {t("hero.title", "Найди команду для игры")}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400">
            {t("hero.subtitle", "Вступай в готовые пати или создай своё объявление")}
          </p>
        </section>

        <CreatePartyForm />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3 text-xs sm:text-sm text-zinc-400">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {gameOptions.map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`rounded-full px-2.5 py-1 sm:px-3 text-[10px] sm:text-xs uppercase tracking-wide transition-all duration-200 ${
                  filter === option
                    ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/30 scale-105"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:scale-105 active:scale-95"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-flex items-center gap-2 text-sm text-zinc-400">
              <div className="h-4 w-4 border-2 border-zinc-600 border-t-blue-500 rounded-full animate-spin"></div>
              {t("ui.loading", "Загружаем объявления...")}
            </div>
          </div>
        ) : filteredParties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700/50 bg-zinc-900/30 backdrop-blur-sm p-10 text-center animate-fadeIn">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-800/50 mb-4">
              <Search className="h-8 w-8 text-zinc-500" />
            </div>
            <p className="text-sm text-zinc-400 mb-2">
              {t(
                "filters.empty",
                "Пока нет объявлений. Стань первым и создай своё!"
              )}
            </p>
            <p className="text-xs text-zinc-500">
              {t("filters.empty_hint", "Создай своё объявление выше 👆")}
            </p>
          </div>
        ) : (
          <div className="space-y-3 max-w-screen-md mx-auto">
            {filteredParties.map((party, index) => (
              <div 
                key={party.id} 
                className="animate-fadeIn"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <PartyCard party={party} onContactClick={() => handleContactClick(party)} />
              </div>
            ))}
          </div>
        )}

        <NoJoinSurvey visible={showSurvey} />

        <FeedbackButton />
        {suggestModalOpen && (
          <SuggestGameModal onClose={() => setSuggestModalOpen(false)} />
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
          className="fixed bottom-4 left-4 sm:hidden flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/50 transition-all duration-200 hover:from-blue-500 hover:to-blue-400 hover:shadow-xl hover:shadow-blue-500/60 hover:scale-110 active:scale-95 z-50 animate-fadeIn"
          aria-label={t("chat.title", "Чат")}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      <button
        onClick={() => setSuggestModalOpen(true)}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-600 to-pink-500 px-3 py-2 sm:px-4 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-pink-500/50 transition-all duration-200 hover:from-pink-500 hover:to-pink-400 hover:shadow-xl hover:shadow-pink-500/60 hover:scale-105 active:scale-95 z-50 animate-fadeIn"
      >
        <HelpCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">{t("hero.suggest_game", "Нет нужной игры?")}</span>
        <span className="sm:hidden">{t("hero.suggest_game_short", "Игра?")}</span>
      </button>
    </>
  );
}

export default PartyFeedPage;
