'use client';

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { analytics } from "@/lib/utils/analytics";
import { XMarkIcon, ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/solid";
import { MessageCircle } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";
import LoginModal from "@/components/modals/LoginModal";

const buildBackendUrl = (path: string): string => {
  const rawBackendBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").trim();
  const backendBaseUrl = rawBackendBaseUrl.endsWith("/")
    ? rawBackendBaseUrl.slice(0, -1)
    : rawBackendBaseUrl;
  if (!path.startsWith("/")) {
    throw new Error(`Backend paths must start with '/': ${path}`);
  }
  if (!backendBaseUrl) {
    return path;
  }
  return `${backendBaseUrl}${path}`;
};

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
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("chat_collapsed");
    return saved === "true";
  });
  const hasTrackedOpen = useRef(false);

  useEffect(() => {
    fetchMessages();

    if (!hasTrackedOpen.current) {
      analytics.chatOpened();
      hasTrackedOpen.current = true;
    }

    const pollInterval = setInterval(() => {
      if (!isCollapsed) {
        fetchMessages();
      }
    }, 10000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [isCollapsed]);

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

  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem("chat_collapsed", String(isCollapsed));
    }
  }, [isCollapsed, isMobile]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchMessages = async () => {
    try {
      const response = await fetch(buildBackendUrl("/api/chat/messages"), {
        credentials: "include",
      });

      if (!response.ok) {
        console.error("Chat load error:", response.status);
        return;
      }

      const data = await response.json();
      const serverMessages = (data || []).sort((a: any, b: any) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setMessages((prev) => {
        const optimistic = prev.filter((m) => {
          if (!m.optimistic) return false;
          const confirmed = serverMessages.some((sm: any) =>
            sm.client_msg_id === m.client_msg_id || sm.id === m.id
          );
          return !confirmed;
        });

        const allMessages = [...serverMessages, ...optimistic].sort((a: any, b: any) => {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });

        return allMessages;
      });
    } catch (error) {
      console.error("Chat load error:", error);
    }
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

    try {
      const response = await fetch(buildBackendUrl("/api/chat/messages/create"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          user_id: profile.id,
          user_display_name: profile.displayName,
          message: trimmed,
          client_msg_id,
        }),
      });

      if (!response.ok) {
        console.error("Chat send error:", response.status);
      } else {
        analytics.chatMessageSent();
        setTimeout(() => {
          fetchMessages();
        }, 500);
      }
    } catch (error) {
      console.error("Chat send error:", error);
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
          ? "fixed inset-0 z-50 flex flex-col bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 overflow-hidden"
          : isCollapsed
          ? `fixed w-72 sm:w-80 bg-gradient-to-br from-zinc-900/95 to-zinc-950/95 border border-zinc-700/60 rounded-xl flex flex-col shadow-2xl shadow-zinc-900/50 overflow-hidden z-50 backdrop-blur-sm ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`
          : `fixed w-72 sm:w-80 h-80 sm:h-96 bg-gradient-to-br from-zinc-900/95 to-zinc-950/95 border border-zinc-700/60 rounded-xl flex flex-col shadow-2xl shadow-zinc-900/50 overflow-hidden z-50 backdrop-blur-sm ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`
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
        className={`bg-gradient-to-r from-zinc-800/90 to-zinc-900/90 p-3 text-sm font-semibold border-b border-zinc-700/60 flex items-center justify-between backdrop-blur-sm ${!isMobile ? 'cursor-grab active:cursor-grabbing' : ''}`}
      >
        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className="text-white font-bold">{t("chat.title", "Chat")}</span>
          <div className="relative">
            <div className="absolute inset-0 bg-green-500/30 blur-md rounded-full animate-pulse"></div>
            <span className="relative inline-flex h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-green-500 border border-green-400/50" />
          </div>
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
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm bg-gradient-to-b from-zinc-950/50 to-transparent">
            {messages.length === 0 ? (
              <div className="text-zinc-500 text-center py-6 sm:py-8">
                <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-zinc-800/50 mb-3 border border-zinc-700/50">
                  <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 text-zinc-600" />
                </div>
                <p className="text-xs sm:text-sm font-medium">{t("chat.empty", "No messages yet")}</p>
                <p className="text-[10px] sm:text-xs text-zinc-600 mt-1">Be the first to say something!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isSystem = msg.user_display_name === "system" || (!msg.user_id && !msg.optimistic);
                if (isSystem) {
                  return (
                    <div
                      key={msg.id || msg.client_msg_id}
                      className="text-center py-0.5"
                    >
                      <span className="text-zinc-500 text-xs italic">{msg.message}</span>
                    </div>
                  );
                }
                return (
                <div
                  key={msg.id || msg.client_msg_id}
                  className={`group rounded-lg p-2.5 sm:p-3 transition-all duration-200 ${msg.optimistic ? "opacity-70 italic bg-zinc-800/20" : "bg-zinc-800/30 hover:bg-zinc-800/40 border border-zinc-700/30"}`}
                >
                  <div className="flex items-center justify-between mb-1 sm:mb-1.5 gap-2">
                    {msg.user_id ? (
                      <Link
                        href={`/profile/${msg.user_id}`}
                        className="text-blue-400 font-semibold text-[10px] sm:text-xs hover:text-blue-300 transition-colors truncate"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {displayName(msg)}
                      </Link>
                    ) : (
                      <span className="text-blue-400 font-semibold text-[10px] sm:text-xs truncate">
                        {displayName(msg)}
                      </span>
                    )}
                    <span className="text-zinc-500 text-[9px] sm:text-[10px] whitespace-nowrap font-medium flex-shrink-0">
                      {timeFmt.format(new Date(msg.created_at))}
                    </span>
                  </div>
                  <div className="text-zinc-200 break-words text-xs sm:text-sm leading-relaxed">{msg.message}</div>
                </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-zinc-700/60 bg-gradient-to-b from-zinc-950 to-zinc-900/95 backdrop-blur-sm">
            {!profile ? (
              <div className="text-center py-2 sm:py-3">
                <p className="text-xs sm:text-sm text-zinc-400 mb-2 sm:mb-3 font-medium">
                  {t("chat.login_required", "Sign in to chat")}
                </p>
                <button
                  type="button"
                  onClick={() => setShowLoginModal(true)}
                  className="inline-flex items-center gap-1.5 sm:gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold text-white transition-all duration-200 hover:scale-105 active:scale-95 shadow-md hover:shadow-lg"
                >
                  {t("auth.sign_in", "Sign in")}
                </button>
                {showLoginModal && (
                  <LoginModal onClose={() => setShowLoginModal(false)} />
                )}
              </div>
            ) : (
              <input
                className="w-full text-sm p-3 bg-zinc-800/60 border border-zinc-700/50 text-white rounded-lg transition-all duration-200 hover:border-zinc-600/70 focus:border-blue-500/50 focus:bg-zinc-800/80 placeholder:text-zinc-500"
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
