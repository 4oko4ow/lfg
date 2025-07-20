import { useEffect, useState } from "react";
import { connectWS, onMessage } from "./ws/client";
import { MessageCircle, Search } from "lucide-react";
import PartyCard from "./components/PartyCard";
import type { Message, Party } from "./types";
import CreatePartyForm from "./forms/CreatePartyForm";
import FeedbackButton from "./components/FeedbackButton";
import { analytics } from "./utils/analytics";
import ContactModal from "./components/ContactModal";
import Chat from "./components/Chat";
import ChatDrawer from "./components/ChatDrawer";


const gameOptions = ["Все", "Dota 2", "CS2", "PEAK", "R.E.P.O", "PUBG", "Minecraft", "Tarkov"];


function App() {
  const [parties, setParties] = useState<Party[]>([]);
  const [filter, setFilter] = useState<string>("Все");
  const [contactModal, setContactModal] = useState<string | null>(null);

  const handleCloseModal = () => {
    analytics.contactClose();
    setContactModal(null);
  }

  useEffect(() => {
    connectWS();
    onMessage((msg: Message) => {
      switch (msg.type) {
        case "initial_state":
          setParties(msg.payload);
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
      }
    });
    analytics.enableAutoPageviews();
  }, []);

  const filteredParties = (
    filter === "Все"
      ? parties
      : parties.filter((p) => p.game.toLowerCase() === filter.toLowerCase())
  ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const isMobile = window.innerWidth < 768;
  const [chatOpen, setChatOpen] = useState(false);


  return (
    <div className="p-6 max-w-3xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-6 text-center flex items-center justify-center gap-2">
        <Search size={24} />
        Поиск тиммейтов
      </h1>


      <CreatePartyForm />

      <div className="flex flex-wrap gap-2 mb-6 justify-center sm:justify-start">
        {gameOptions.map((g) => (
          <button
            key={g}
            onClick={() => {
              setFilter(g)
              analytics.filterSelect(g);
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
        {filteredParties.map((party) => (
          <PartyCard key={party.id} party={party} onJoin={(contact) => setContactModal(contact)} />
        ))}

        {filteredParties.length === 0 && (
          <div className="text-zinc-500 text-sm text-center py-12">
            Нет активных пати
          </div>
        )}
      </div>
      <FeedbackButton />

      {contactModal && (
        <ContactModal contact={contactModal} onClose={handleCloseModal} />
      )}

      {!isMobile && <Chat />}

      {isMobile && (
        <>
          <button
            onClick={() => setChatOpen(true)}
            className="fixed bottom-14 right-4 z-50 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white shadow-md flex items-center gap-2"
          >
            <MessageCircle size={18} />
            Чат
            {/* Пульсирующая точка */}
            <span className="relative">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500  animate-pulse"></span>
            </span>
          </button>

          {chatOpen && (
            <ChatDrawer onClose={() => setChatOpen(false)} />
          )}
        </>
      )}
    </div>

  );
}

export default App;