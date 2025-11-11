// src/ws/client.ts
import type { ContactMethod, Message, OutgoingMessage } from "../types";

export let socket: WebSocket | null = null; // <-- экспортируем

const listeners: ((msg: Message) => void)[] = [];

export function connectWS() {
  socket = new WebSocket("wss://lfg.fly.dev/ws");

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

export function onMessage(cb: (msg: Message) => void) {
  listeners.push(cb);
}

export function sendCreateParty(payload: {
  game: string;
  goal: string;
  slots: number;
  contacts?: ContactMethod[];
}) {
  if (!socket) {
    console.error("❌ WebSocket not initialized. Cannot send create_party");
    return;
  }

  if (socket.readyState === WebSocket.CONNECTING) {
    // Ждем подключения
    socket.addEventListener("open", () => {
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