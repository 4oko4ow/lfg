export type Party = {
  id: string;
  game: string;
  goal: string;
  slots: number;
  joined: number;
  created_at: string;
  contact?: string;
};

export type Message =
  | { type: "initial_state"; payload: Party[] }
  | { type: "new_party"; payload: Party }
  | { type: "party_update"; payload: Party }
  | { type: "party_remove"; payload: { id: string } }
  | { type: "online_count"; payload: number }; // 🟢 новое

export type OutgoingMessage =
  | {
      type: "create_party";
      payload: {
        game: string;
        goal: string;
        slots: number;
        contact?: string;
      };
    }
  | {
      type: "join_party";
      payload: {
        id: string;
      };
    }
  | {
      type: "heartbeat"; // 🟢 новое сообщение от клиента
    };