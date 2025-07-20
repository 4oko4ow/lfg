// src/ws/client.ts
import type { Message, OutgoingMessage } from "../types";

export let socket: WebSocket | null = null; // <-- экспортируем

const listeners: ((msg: Message) => void)[] = [];

export function connectWS() {
  socket = new WebSocket("wss://lfg.fly.dev/ws");

  socket.onmessage = (event) => {
    try {
      const msg: Message = JSON.parse(event.data);
      listeners.forEach((cb) => cb(msg));
    } catch (e) {
      console.error("Invalid message", e);
    }
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
  contact?: string;
}) {
  if (socket?.readyState === WebSocket.OPEN) {
    const msg: OutgoingMessage = {
      type: "create_party",
      payload,
    };
    socket.send(JSON.stringify(msg));
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