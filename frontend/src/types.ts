export type ContactMethodType = "steam" | "discord" | "telegram";

export type ContactMethod = {
  type: ContactMethodType;
  handle: string;
  url?: string;
  preferred?: boolean;
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
  expires_at?: string;
  contacts?: ContactMethod[];
  pinned?: boolean;
  user_id?: string;
};

export type UserStats = {
  parties_created: number;
  parties_joined: number;
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  achievements?: Achievement[];
};

export type Achievement = {
  type: string;
  name: string;
  unlocked_at: string;
};

export type ChatMessage = {
  id: string;
  user_id: string;
  user_display_name: string;
  message: string;
  client_msg_id?: string;
  created_at: string;
};

export type PublicProfile = {
  user_id: string;
  display_name: string;
  avatar_url: string;
  level: number;
  total_xp: number;
  parties_created: number;
  parties_joined: number;
  current_streak: number;
  achievements: string[];
};

export type Message =
  | { type: "initial_state"; payload: Party[] }
  | { type: "new_party"; payload: Party }
  | { type: "party_update"; payload: Party }
  | { type: "party_remove"; payload: { id: string } }
  | { type: "online_count"; payload: number }
  | { type: "join_party"; payload: { id: string } }
  | { type: "chat_message"; payload: ChatMessage };

export type OutgoingMessage =
  | {
      type: "create_party";
      payload: {
        game: string;
        goal: string;
        slots: number;
        expires_at?: string;
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
    }
  | {
      type: "send_chat";
      payload: {
        message: string;
        client_msg_id: string;
      };
    };