import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "../supabaseClient";
import { analytics } from "../utils/analytics";
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { useAuth } from "../context/AuthContext";
import LoginModal from "./modals/LoginModal";

const Chat = ({
  isMobile = false,
  onClose,
  onlineCount = 0,
}: {
  isMobile?: boolean;
  onClose?: () => void;
  onlineCount?: number;
}) => {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (isMobile) return false;
    const saved = localStorage.getItem("chat_collapsed");
    return saved === "true";
  });

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel("chat-room")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => {
          const newMsg = payload.new;

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;

            const filtered = prev.filter(
              (m) => m.client_msg_id !== newMsg.client_msg_id
            );

            return [...filtered, newMsg];
          });
        }
      )
      .subscribe();

    if (isMobile) analytics.chatMobile();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Draggable functionality for desktop
  useEffect(() => {
    if (isMobile || !chatRef.current) return;

    const chatElement = chatRef.current;
    let currentIsDragging = false;
    let currentDragOffset = { x: 0, y: 0 };

    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const header = target.closest('[data-drag-handle]');
      if (!header || target.tagName === 'BUTTON') return;
      
      e.preventDefault();
      currentIsDragging = true;
      setIsDragging(true);
      const rect = chatElement.getBoundingClientRect();
      currentDragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!currentIsDragging) return;
      
      const newX = e.clientX - currentDragOffset.x;
      const newY = e.clientY - currentDragOffset.y;
      
      // Constrain to viewport
      const maxX = window.innerWidth - chatElement.offsetWidth;
      const maxY = window.innerHeight - chatElement.offsetHeight;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      currentIsDragging = false;
      setIsDragging(false);
    };

    chatElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      chatElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMobile]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Сохраняем состояние сворачивания в localStorage
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem("chat_collapsed", String(isCollapsed));
    }
  }, [isCollapsed, isMobile]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Chat load error:", error);
      return;
    }

    const ordered = (data || []).reverse();

    setMessages((prev) => {
      const withoutOptimistic = prev.filter((m) => !m.optimistic);
      return [...withoutOptimistic, ...ordered];
    });
  };

  const sendMessage = async () => {
    if (!profile) return;
    
    const trimmed = input.trim();
    if (!trimmed) return;

    const client_msg_id = `msg-${Date.now()}-${Math.random()}`;

    const optimisticMessage = {
      id: client_msg_id,
      client_msg_id,
      user_id: profile.id,
      user_display_name: profile.displayName,
      message: trimmed,
      created_at: new Date().toISOString(),
      optimistic: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInput("");
    scrollToBottom();

    const { error } = await supabase.from("chat_messages").insert({
      user_id: profile.id,
      anon_id: profile.id, // Use user_id as anon_id for authenticated users
      message: trimmed,
      client_msg_id,
    });

    if (error) {
      console.error("Chat send error:", error);
    } else {
      analytics.chatMessageSent();
      analytics.chatMessageTyped(trimmed.length);
    }
  };

  const timeFmt = new Intl.DateTimeFormat(i18n.language, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const displayName = (msg: any) => {
    return msg.user_display_name || msg.user_id || t("profile.anonymous", "Player");
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div
      ref={chatRef}
      className={
        isMobile
          ? "fixed inset-0 z-50 flex flex-col bg-zinc-950 overflow-hidden"
          : isCollapsed
          ? `fixed w-80 bg-zinc-900 border border-zinc-700/50 rounded-lg flex flex-col shadow-lg overflow-hidden z-50 ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`
          : `fixed w-80 h-96 bg-zinc-900 border border-zinc-700/50 rounded-lg flex flex-col shadow-lg overflow-hidden z-50 ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`
      }
      style={
        !isMobile && position.x !== 0 && position.y !== 0
          ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto', transform: 'none' }
          : !isMobile
          ? { right: '1rem', top: '50%', transform: 'translateY(-50%)' }
          : {}
      }
    >
      <div 
        data-drag-handle
        className={`bg-zinc-800 p-3 text-sm font-semibold border-b border-zinc-700 flex items-center justify-between ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex items-center gap-2">
          {t("chat.title", "Chat")}
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </div>
        <div className="flex items-center gap-3">
          {!isMobile && (
            <button
              type="button"
              onClick={toggleCollapse}
              className="text-zinc-400 hover:text-white transition-colors p-1"
              aria-label={isCollapsed ? t("chat.expand", "Expand chat") : t("chat.collapse", "Collapse chat")}
              title={isCollapsed ? t("chat.expand", "Expand chat") : t("chat.collapse", "Collapse chat")}
            >
              {isCollapsed ? (
                <ChevronUpIcon className="w-5 h-5" />
              ) : (
                <ChevronDownIcon className="w-5 h-5" />
              )}
            </button>
          )}
          <span className="text-xs text-zinc-400 font-normal">
            {t("hero.online", "Online: {{count}}", { count: onlineCount })}
          </span>
          {isMobile && (
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors"
              aria-label={t("ui.close", "Close")}
              title={t("ui.close", "Close")}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {messages.length === 0 ? (
              <div className="text-zinc-500 text-center py-6">
                {t("chat.empty", "No messages yet")}
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`text-sm pb-2 ${msg.optimistic ? "opacity-70 italic" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-blue-400 font-medium text-xs">
                      {displayName(msg)}
                    </span>
                    <span className="text-zinc-500 text-[10px] whitespace-nowrap">
                      {timeFmt.format(new Date(msg.created_at))}
                    </span>
                  </div>
                  <div className="text-zinc-200 break-words text-xs">{msg.message}</div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-zinc-700/50 bg-zinc-950">
            {!profile ? (
              <div className="text-center py-2">
                <p className="text-xs text-zinc-400 mb-2">
                  {t("chat.login_required", "Sign in to chat")}
                </p>
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  {t("auth.sign_in", "Sign in")}
                </button>
                {showLoginModal && (
                  <LoginModal onClose={() => setShowLoginModal(false)} />
                )}
              </div>
            ) : (
              <input
                className="w-full text-sm p-2 bg-zinc-800 border border-zinc-700/50 text-white rounded-lg transition-colors hover:border-zinc-600"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder={t("chat.placeholder", "Write a message…")}
                autoFocus={isMobile}
                onFocus={scrollToBottom}
                inputMode="text"
                autoComplete="off"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Chat;