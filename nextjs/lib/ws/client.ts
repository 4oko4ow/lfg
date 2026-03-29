// src/ws/client.ts
import type { ContactMethod, Message, OutgoingMessage } from "@/lib/types";

export let socket: WebSocket | null = null; // <-- экспортируем

const listeners: ((msg: Message) => void)[] = [];

function getWebSocketURL(): string {
  const rawBackendBaseUrl = (process.env.NEXT_PUBLIC_BACKEND_URL ?? "").trim();
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

  socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    console.log("✅ WebSocket connected");
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
  };

  socket.onclose = () => {
    console.warn("WebSocket closed, retrying in 2s");
    setTimeout(connectWS, 2000);
  };
}

export function onMessage(cb: (msg: Message) => void): () => void {
  listeners.push(cb);
  return () => {
    const idx = listeners.indexOf(cb);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export function sendCreateParty(payload: {
  game: string;
  goal: string;
  slots: number;
  expires_at?: string;
  scheduled_at?: string;
  contacts?: ContactMethod[];
  mic_required?: boolean;
  age_range?: string;
  skill_level?: string;
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