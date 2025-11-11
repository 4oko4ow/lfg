import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  MessageCircle,
  Search,
  HelpCircle,
  Sparkles,
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
import LanguageSwitcher from "../components/LanguageSwitcher";

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
    const byGame =
      filter === ALL_LABEL
        ? parties
        : parties.filter((p) => p.game.toLowerCase() === filter.toLowerCase());

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
  }, [parties, filter, ALL_LABEL]);

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

  const handleJoinClick = (party: Party) => {
    analytics.joinPartyClick(party.game);
    setJoinClicked(true);
    setContactPartyId(party.id);
    setContactModal(party.contacts ?? []);
  };

  return (
    <>
      <DynamicMeta />
      <main className="mx-auto w-full max-w-5xl px-4 py-6 text-white">
        <section className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {t("hero.title", "Найди команду для игры")}
            </h1>
            <p className="text-sm text-zinc-400">
              {t("hero.subtitle", "Вступай в готовые пати или создай своё объявление")}
            </p>
          </div>
          <LanguageSwitcher />
        </section>

        <CreatePartyForm />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
          <div className="flex flex-wrap items-center gap-2">
            {gameOptions.map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={`rounded-full px-3 py-1 text-xs uppercase tracking-wide transition ${
                  filter === option
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <MessageCircle className="h-4 w-4" />
              {t("hero.online", { defaultValue: "Онлайн: {{count}}", count: onlineCount })}
            </span>
            <button
              onClick={() => setChatOpen(true)}
              className="flex items-center gap-2 rounded bg-zinc-800 px-3 py-1 text-xs uppercase tracking-wide transition hover:bg-zinc-700"
            >
              <Sparkles className="h-4 w-4" />
              {t("chat.title", "Чат")}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm text-zinc-400">
            {t("ui.loading", "Загружаем объявления...")}
          </div>
        ) : filteredParties.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center text-sm text-zinc-400">
            <Search className="mx-auto mb-3 h-6 w-6 text-zinc-500" />
            {t(
              "filters.empty",
              "Пока нет объявлений. Стань первым и создай своё!"
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredParties.map((party) => (
              <PartyCard key={party.id} party={party} onJoin={() => handleJoinClick(party)} />
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

      {isMobile
        ? chatOpen && <ChatDrawer onClose={() => setChatOpen(false)} />
        : chatOpen && <Chat onClose={() => setChatOpen(false)} />}

      <button
        onClick={() => setSuggestModalOpen(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-pink-500"
      >
        <HelpCircle className="h-4 w-4" />
        {t("hero.suggest_game", "Нет нужной игры?")}
      </button>
    </>
  );
}

export default PartyFeedPage;
