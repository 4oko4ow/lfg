import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { connectWS, onMessage, socket } from "./ws/client";
import { MessageCircle, Search, HelpCircle, Sparkles } from "lucide-react";
import PartyCard from "./components/PartyCard";
import type { Message, Party } from "./types";
import CreatePartyForm from "./forms/CreatePartyForm";
import FeedbackButton from "./components/FeedbackButton";
import { analytics } from "./utils/analytics";
import ContactModal from "./components/ContactModal";
import Chat from "./components/Chat";
import ChatDrawer from "./components/ChatDrawer";
import SuggestGameModal from "./components/modals/SuggestGameModal";
import { NoJoinSurvey } from "./components/NoJoinSurvey";
import { DynamicMeta } from "./components/DynamicMeta";
import LangSync from "./components/LangSync";

import { getGames, nameToSlugMap } from "./constants/games";
import RedirectOnRoot from "./components/RedirectOnRoot";
import LanguageSwitcher from "./components/LanguageSwitcher";

function App() {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  // t-адаптер под helpers из constants/games.ts
  const tt = useCallback(
    (key: string, opts?: { defaultValue?: string }) => t(key, opts),
    [t]
  );

  // Принудительно синхронизируем язык из /en|/ru
  useEffect(() => {
    const pathLang =
      location.pathname.match(/^\/(en|ru)(\/|$)/i)?.[1]?.toLowerCase() || "en";
    if (i18n.language !== pathLang) {
      i18n.changeLanguage(pathLang);
      document.documentElement.lang = pathLang;
      try {
        localStorage.setItem("lang", pathLang);
      } catch { }
    }
  }, [location.pathname, i18n]);

  // Текущий язык для построения ссылок
  const currentLang = useMemo(
    () =>
      location.pathname.match(/^\/(en|ru)(\/|$)/i)?.[1]?.toLowerCase() || "en",
    [location.pathname]
  );

  // Единый список игр [{ slug, name }] и мапа name->slug
  const games = useMemo(() => getGames(tt), [tt]);
  const nameToSlug = useMemo(() => nameToSlugMap(games), [games]);

  // Локализованная метка «Все»
  const ALL_LABEL = t("filters.all_games", "Все");

  // Кнопки фильтра
  const gameOptions = useMemo(
    () => [ALL_LABEL, ...games.map((g) => g.name)],
    [ALL_LABEL, games]
  );

  // ---- состояние
  const [parties, setParties] = useState<Party[]>([]);
  const [filter, setFilter] = useState<string>(ALL_LABEL);
  const [contactModal, setContactModal] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showSurvey, setShowSurvey] = useState(false);
  const [joinClicked, setJoinClicked] = useState(false);
  const [contactPartyId, setContactPartyId] = useState<string>("");

  const handleCloseModal = () => {
    analytics.contactClose();
    setContactModal(null);
  };

  // heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "heartbeat" }));
      }
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // WS загрузка
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

  // Применяем фильтр из ?game=<slug>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("game"); // repo, dota2, ...
    const found = games.find((g) => g.slug === slug);
    setFilter(found ? found.name : ALL_LABEL);
  }, [games, ALL_LABEL, location.search]);


  // Не показываем заполненные пати старше 3 дней
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  // И незаполненные старше 3 недель
  const THREE_WEEKS_MS = 21 * 24 * 60 * 60 * 1000;


  // Сортировка карточек
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

      // скрываем:
      // 1) если пати полная и ей > 3 дней
      // 2) если пати НЕ заполнена и ей > 3 недель
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

  const isMobile =
    typeof window !== "undefined" ? window.innerWidth < 768 : false;

  // мини‑опрос «почему не вступили»
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

  return (
    <>
      {/* редиректит / → /<lang> на основе autodetect (i18next) */}
      <RedirectOnRoot />
      <LangSync />
      <DynamicMeta />

      <div className="w-full overflow-x-hidden p-6 max-w-3xl mx-auto text-white">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-center flex items-center gap-2 mx-auto sm:mx-0">
            <Search size={24} />
            {t("home.title", "Поиск тиммейтов")}
          </h1>
          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
        </div>

        <div className="sm:hidden mb-3 flex justify-center">
          <LanguageSwitcher />
        </div>

        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="bg-blue-950 text-blue-300 text-sm px-4 py-2 rounded-lg text-center flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
            <div className="flex items-center gap-1 justify-center">
              <Sparkles size={16} />
              <span>
                {t(
                  "banner.welcome",
                  "Сайт только запустился — добро пожаловать!"
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 justify-center text-zinc-400 text-sm">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span>
                  {t("chat.online", "Сейчас онлайн")}:{" "}
                  <span className="text-white font-medium">{onlineCount}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              analytics.suggestGameClick();
              setSuggestModalOpen(true);
            }}
            className="text-sm text-zinc-300 hover:text-white underline"
          >
            <HelpCircle className="inline mr-1" size={16} />
            {t("suggest_game.cta", "Хочешь, чтобы здесь появилась твоя игра?")}
          </button>
        </div>

        <CreatePartyForm />

        <div className="flex flex-wrap gap-2 mb-6 justify-center sm:justify-start">
          {gameOptions.map((g) => (
            <button
              key={g}
              onClick={() => {
                setFilter(g);
                analytics.filterSelect(g);

                const isAll = g === ALL_LABEL;
                const slug = nameToSlug[g.toLowerCase()];
                const url =
                  isAll || !slug
                    ? `/${currentLang}`
                    : `/${currentLang}?game=${slug}`;
                window.history.pushState({}, "", url);
              }}
              className={`px-4 py-1.5 text-sm rounded-lg border transition-all ${filter === g
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700"
                }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="space-y-4 mb-18">
          {loading ? (
            <div className="text-zinc-500 text-sm text-center py-12">
              {t("loading.parties", "Загрузка пати...")}
            </div>
          ) : filteredParties.length === 0 ? (
            <div className="text-zinc-500 text-sm text-center py-12">
              {t("empty.parties", "Нет активных пати")}
            </div>
          ) : (
            filteredParties.map((party) => (
              <PartyCard
                key={party.id}
                party={party}
                onJoin={(contact) => {
                  setJoinClicked(true);
                  setContactModal(contact);
                  setContactPartyId(party.id);
                }}
              />
            ))
          )}
        </div>

        <FeedbackButton />

        {contactModal && (
          <ContactModal
            contact={contactModal}
            partyId={contactPartyId}
            onClose={handleCloseModal}
          />
        )}

        {!isMobile && <Chat />}

        {isMobile && (
          <>
            <button
              onClick={() => setChatOpen(true)}
              className="fixed bottom-14 right-4 z-50 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white shadow-md flex items-center gap-2"
            >
              <MessageCircle size={18} />
              {t("nav.chat", "Чат")}
              <span className="relative">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              </span>
            </button>

            {chatOpen && <ChatDrawer onClose={() => setChatOpen(false)} />}
          </>
        )}

        {suggestModalOpen && (
          <SuggestGameModal onClose={() => setSuggestModalOpen(false)} />
        )}

        <NoJoinSurvey visible={showSurvey} />

        {/* SEO-текст — скрытый, можно позже локализовать */}
        <div style={{ display: "none" }}>
          <h2>Поиск тиммейтов в CS2</h2>
          <p>
            Найди команду или напарников для CS2. Удобный поиск и быстрый вход в
            игру.
          </p>
          <h2>Тиммейты для Dota 2</h2>
          <p>
            Ищешь пати в Доту? Создай объявление или вступи в команду прямо
            сейчас.
          </p>
          <h2>С кем поиграть в Rust</h2>
          <p>Rust требует координации — найди напарников и выживай вместе.</p>
          <h2>Поиск друзей в Minecraft</h2>
          <p>
            Найди игроков для выживания, креатива, мини‑игр или модов в
            Minecraft.
          </p>
          <h2>Пати в Escape from Tarkov</h2>
          <p>Играешь в Тарков? Найди пати с голосом и опытом прямо сейчас.</p>
          <h2>Поиск команды в PEAK</h2>
          <p>Совместные забеги в PEAK намного веселее — найди тиммейтов здесь.</p>
          <h2>Напарники для R.E.P.O</h2>
          <p>Быстрый поиск игроков в R.E.P.O — вступай в пати или создавай своё.</p>
          <h2>Найти тиммейтов в Fortnite</h2>
          <p>Не хочешь играть в соло? Найди пати для Fortnite без регистрации.</p>
          <h2>Пати в Roblox</h2>
          <p>
            Объединяйтесь в любимых режимах Roblox. Найди с кем играть прямо
            сейчас.
          </p>
          <h2>С кем поиграть в Valorant</h2>
          <p>
            Найди команду для ранкеда или казуальной игры в Valorant.
          </p>
          <h2>Игроки для Apex Legends</h2>
          <p>
            Быстрый подбор тиммейтов в Apex — создавай пати и побеждай.
          </p>
          <h2>С кем поиграть в The Finals</h2>
          <p>
            Хочешь побед? Собери команду для The Finals на FindParty.
          </p>
          <h2>Пати в Marvel Rivals</h2>
          <p>
            Найди напарников по Marvel Rivals — быстро, бесплатно, удобно.
          </p>
          <h2>Deep Rock Galactic — экипаж в поиске</h2>
          <p>
            Собери команду гномов и иди копать вместе в Deep Rock Galactic.
          </p>
          <h2>Baldur’s Gate 3 — совместное прохождение</h2>
          <p>
            Проходи BG3 в кооперативе. Найди с кем исследовать мир и делать
            выборы.
          </p>
          <h2>Поиск тиммейтов в Garry’s Mod</h2>
          <p>
            Создай или найди пати для ролевых и кооп режимов в Garry’s Mod.
          </p>
        </div>
      </div>
    </>
  );
}

export default App;