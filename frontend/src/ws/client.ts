// src/ws/client.ts
import type { ContactMethod, Message, OutgoingMessage } from "../types";
import { analytics } from "../utils/analytics";

export let socket: WebSocket | null = null; // <-- экспортируем

const listeners: ((msg: Message) => void)[] = [];
let reconnectAttempt = 0;
let disconnectTime: number | null = null;
let connectionStartTime: number | null = null;

function getWebSocketURL(): string {
  const rawBackendBaseUrl = (import.meta.env.VITE_BACKEND_URL ?? "").trim();
  const backendBaseUrl = rawBackendBaseUrl.endsWith("/")
    ? rawBackendBaseUrl.slice(0, -1)
    : rawBackendBaseUrl;
  
  if (!backendBaseUrl) {
    console.warn("VITE_BACKEND_URL is not set, using default WebSocket URL");
    return "wss://lfg.findparty.online/ws";
  }
  
  // Convert http:// to ws:// and https:// to wss://
  const wsUrl = backendBaseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
  return `${wsUrl}/ws`;
}

export function connectWS() {
  const wsUrl = getWebSocketURL();
  console.log("[WebSocket] Connecting to:", wsUrl);
  
  // Трекинг попытки переподключения
  if (disconnectTime !== null) {
    const timeSinceDisconnect = Date.now() - disconnectTime;
    reconnectAttempt++;
    analytics.wsReconnectAttempt(reconnectAttempt, timeSinceDisconnect);
  } else {
    reconnectAttempt = 0;
  }
  
  socket = new WebSocket(wsUrl);
  connectionStartTime = Date.now();

  socket.onopen = () => {
    console.log("✅ WebSocket connected");
    analytics.wsConnected();
    
    // Трекинг успешного переподключения
    if (reconnectAttempt > 0) {
      const totalTime = disconnectTime ? Date.now() - disconnectTime : 0;
      analytics.wsReconnectSuccess(reconnectAttempt, totalTime);
      reconnectAttempt = 0;
      disconnectTime = null;
    }
    
    // Трекинг длительности соединения при закрытии
    if (connectionStartTime) {
      const connectionDuration = Date.now() - connectionStartTime;
      // Отслеживаем длительность только для стабильных соединений (> 5 секунд)
      if (connectionDuration > 5000) {
        analytics.wsConnectionDuration(connectionDuration);
      }
    }
  };

  socket.onmessage = (event) => {
    try {
      const msg: Message = JSON.parse(event.data);
      listeners.forEach((cb) => cb(msg));
    } catch (e) {
      console.error("Invalid message", e);
    }
  };

  socket.onerror = (error) => {
    console.error("❌ WebSocket error:", error);
    const errorMessage = error instanceof Error ? error.message : "connection_error";
    analytics.wsError(errorMessage);
    
    // Трекинг неудачного переподключения
    if (reconnectAttempt > 0) {
      analytics.wsReconnectFailed(reconnectAttempt, errorMessage);
    }
  };

  socket.onclose = () => {
    console.warn("WebSocket closed, retrying in 2s");
    analytics.wsDisconnected();
    
    // Сохраняем время отключения для трекинга
    disconnectTime = Date.now();
    
    // Трекинг длительности соединения
    if (connectionStartTime) {
      const connectionDuration = Date.now() - connectionStartTime;
      if (connectionDuration > 1000) { // Трекаем только соединения длительнее 1 секунды
        analytics.wsConnectionDuration(connectionDuration);
      }
    }
    
    setTimeout(connectWS, 2000);
  };
}

export function onMessage(cb: (msg: Message) => void) {
  listeners.push(cb);
}

export function sendCreateParty(payload: {
  game: string;
  goal: string;
  slots: number;
  expires_at?: string;
  contacts?: ContactMethod[];
}) {
  if (!socket) {
    console.error("❌ WebSocket not initialized. Cannot send create_party");
    return;
  }

  if (socket.readyState === WebSocket.CONNECTING) {
    // Ждем подключения
    socket.addEventListener("open", () => {
      if (!socket) {
        console.error("❌ WebSocket not initialized in open handler");
        return;
      }
      const msg: OutgoingMessage = {
        type: "create_party",
        payload,
      };
      socket.send(JSON.stringify(msg));
      console.log("✅ Sent create_party after connection");
    }, { once: true });
    return;
  }

  if (socket.readyState === WebSocket.OPEN) {
    const msg: OutgoingMessage = {
      type: "create_party",
      payload,
    };
    socket.send(JSON.stringify(msg));
    console.log("✅ Sent create_party:", payload);
  } else {
    console.error("❌ WebSocket not ready. State:", socket.readyState);
    console.error("   CONNECTING:", WebSocket.CONNECTING);
    console.error("   OPEN:", WebSocket.OPEN);
    console.error("   CLOSING:", WebSocket.CLOSING);
    console.error("   CLOSED:", WebSocket.CLOSED);
  }
}

export function sendJoinParty(id: string) {
  if (socket?.readyState === WebSocket.OPEN) {
    const msg: OutgoingMessage = {
      type: "join_party",
      payload: { id },
    };
    socket.send(JSON.stringify(msg));
  }
}