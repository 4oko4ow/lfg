export type ContactMethodType = "steam" | "discord" | "telegram";

export type ContactMethod = {
  type: ContactMethodType;
  handle: string;
  url?: string;
};

export type ContactHandle = {
  handle: string;
  url?: string;
};

export type ContactHandlesMap = Partial<Record<ContactMethodType, ContactHandle>>;

export type Party = {
  id: string;
  game: string;
  goal: string;
  slots: number;
  joined: number;
  created_at: string;
  contacts?: ContactMethod[];
  pinned?: boolean;
};

export type Message =
  | { type: "initial_state"; payload: Party[] }
  | { type: "new_party"; payload: Party }
  | { type: "party_update"; payload: Party }
  | { type: "party_remove"; payload: { id: string } }
  | { type: "online_count"; payload: number }
  | { type: "join_party"; payload: { id: string } };

export type OutgoingMessage =
  | {
      type: "create_party";
      payload: {
        game: string;
        goal: string;
        slots: number;
        contacts?: ContactMethod[];
      };
    }
  | {
      type: "join_party";
      payload: {
        id: string;
      };
    }
  | {
      type: "heartbeat"; 
    };