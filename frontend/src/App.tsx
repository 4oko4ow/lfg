import { useEffect, useState } from "react";
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

const gameSlugMap: Record<string, string> = {
  repo: "R.E.P.O",
  dota2: "Dota 2",
  cs2: "CS2",
  peak: "PEAK",
  pubg: "PUBG",
  rust: "Rust",
  minecraft: "Minecraft",
  tarkov: "Tarkov",
  fortnite: "Fortnite",
  roblox: "Roblox",
  valorant: "Valorant",
  apex: "Apex",
  thefinals: "The Finals",
  marvelrivals: "Marvel Rivals",
  deeprockgalactic: "Deep Rock Galactic",
  baldursgate3: "Baldurs Gate 3",
};

const gameOptions = ["Все", "R.E.P.O", "Dota 2", "CS2", "PEAK", "PUBG", "Rust", "Minecraft", "Tarkov", "Fortnite", "Roblox", "Valorant", "Apex", "The Finals", "Marvel Rivals", "Deep Rock Galactic", "Baldurs Gate 3"];
function App() {
  const [parties, setParties] = useState<Party[]>([]);
  const [filter, setFilter] = useState<string>("Все");
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

  useEffect(() => {
    const interval = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "heartbeat" }));
      }
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    connectWS();

    const fallbackTimeout = setTimeout(() => {
      setLoading(false);
    }, 15000);

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

    return () => {
      clearTimeout(fallbackTimeout);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const game = params.get("game");

    const mappedGame = game ? gameSlugMap[game] : undefined;
    if (mappedGame && gameOptions.includes(mappedGame)) {
      setFilter(mappedGame);
    }
  }, []);




  const filteredParties = (
    filter === "Все"
      ? parties
      : parties.filter((p) => p.game.toLowerCase() === filter.toLowerCase())
  ).sort((a, b) => {
    const getPriority = (p: Party) => {
      if (p.pinned) return 100; // 🧷 Закреп
      const createdAgoMin = (Date.now() - new Date(p.created_at).getTime()) / 60000;
      if (createdAgoMin < 60) return 50; // 🕑 Свежие (< 30 мин)
      if (p.joined === p.slots - 1) return 10; // ⚠️ Почти заполненные
      if (p.joined >= p.slots) return -10; // ✅ Уже заполненные
      return 0; // 🔹 Обычные
    };

    const priorityDiff = getPriority(b) - getPriority(a);
    if (priorityDiff !== 0) return priorityDiff;

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("no_join_survey_shown") === "true";

    if (
      filteredParties.length > 0 &&
      !joinClicked &&
      !alreadyShown
    ) {
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
      <DynamicMeta />

      <div className="w-full overflow-x-hidden p-6 max-w-3xl mx-auto text-white">
        <h1 className="text-3xl font-bold mb-4 text-center flex items-center justify-center gap-2">
          <Search size={24} />
          Поиск тиммейтов
        </h1>

        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="bg-blue-950 text-blue-300 text-sm px-4 py-2 rounded-lg text-center flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
            <div className="flex items-center gap-1 justify-center">
              <Sparkles size={16} />
              <span>Сайт только запустился — добро пожаловать!</span>
            </div>

            <div className="flex items-center gap-2 justify-center text-zinc-400 text-sm">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span>
                  Сейчас онлайн: <span className="text-white font-medium">{onlineCount}</span>
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
            Хочешь, чтобы здесь появилась твоя игра?
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

                const gameParam = g.toLowerCase().replaceAll(" ", "");
                const url = gameParam === "все" ? "/" : `/?game=${gameParam}`;
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
              Загрузка пати...
            </div>
          ) : filteredParties.length === 0 ? (
            <div className="text-zinc-500 text-sm text-center py-12">
              Нет активных пати
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
          <ContactModal contact={contactModal} partyId={contactPartyId} onClose={handleCloseModal} />)}

        {!isMobile && <Chat />}

        {isMobile && (
          <>
            <button
              onClick={() => setChatOpen(true)}
              className="fixed bottom-14 right-4 z-50 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white shadow-md flex items-center gap-2"
            >
              <MessageCircle size={18} />
              Чат
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
        <div style={{ display: "none" }}>
          <h2>Поиск тиммейтов в CS2</h2>
          <p>Найди команду или напарников для CS2. Удобный поиск и быстрый вход в игру.</p>

          <h2>Тиммейты для Dota 2</h2>
          <p>Ищешь пати в Доту? Создай объявление или вступи в команду прямо сейчас.</p>

          <h2>С кем поиграть в Rust</h2>
          <p>Rust требует координации — найди напарников и выживай вместе.</p>

          <h2>Поиск друзей в Minecraft</h2>
          <p>Найди игроков для выживания, креатива, мини-игр или модов в Minecraft.</p>

          <h2>Пати в Escape from Tarkov</h2>
          <p>Играешь в Тарков? Найди пати с голосом и опытом прямо сейчас.</p>

          <h2>Поиск команды в PEAK</h2>
          <p>Совместные забеги в PEAK намного веселее — найди тиммейтов здесь.</p>

          <h2>Напарники для REPO</h2>
          <p>Быстрый поиск игроков в R.E.P.O — вступай в пати или создавай своё.</p>

          <h2>Найти тиммейтов в Fortnite</h2>
          <p>Не хочешь играть в соло? Найди пати для Fortnite без регистрации.</p>

          <h2>Пати в Roblox</h2>
          <p>Объединяйтесь в любимых режимах Roblox. Найди с кем играть прямо сейчас.</p>

          <h2>С кем поиграть в Valorant</h2>
          <p>Найди команду для ранкеда или казуальной игры в Valorant.</p>

          <h2>Игроки для Apex Legends</h2>
          <p>Быстрый подбор тиммейтов в Apex — создавай пати и побеждай.</p>

          <h2>С кем поиграть в The Finals</h2>
          <p>Хочешь побед? Собери команду для The Finals на FindParty.</p>

          <h2>Пати в Marvel Rivals</h2>
          <p>Найди напарников по Marvel Rivals — быстро, бесплатно, удобно.</p>

          <h2>Deep Rock Galactic — экипаж в поиске</h2>
          <p>Собери команду гномов и иди копать вместе в Deep Rock Galactic.</p>

          <h2>Baldur’s Gate 3 — совместное прохождение</h2>
          <p>Проходи BG3 в кооперативе. Найди с кем исследовать мир и делать выборы.</p>

          <h2>Поиск тиммейтов в Гарис мод</h2>
          <p>Создай или найди пати для ролевых и кооп режимов в Garry’s Mod.</p>
        </div>

      </div>
    </>
  );
}

export default App;