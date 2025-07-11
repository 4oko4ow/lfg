// src/ws/client.ts

import type {  Message, OutgoingMessage } from "../types";


let socket: WebSocket;
const listeners: ((msg: Message) => void)[] = [];

/**
 * Устанавливает WebSocket-подключение и обрабатывает события
 */
export function connectWS() {
  socket = new WebSocket("ws://localhost:8080/ws");

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

/**
 * Подписка на входящие сообщения
 */
export function onMessage(cb: (msg: Message) => void) {
  listeners.push(cb);
}

/**
 * Отправка создания пати
 */
export function sendCreateParty(payload: {
  game: string;
  goal: string;
  slots: number;
  contact?: string;
}) {
  const msg: OutgoingMessage = {
    type: "create_party",
    payload,
  };
  socket.send(JSON.stringify(msg));
}

/**
 * Отправка запроса на вступление в пати
 */
export function sendJoinParty(id: string) {
  const msg: OutgoingMessage = {
    type: "join_party",
    payload: { id },
  };
  socket.send(JSON.stringify(msg));
}