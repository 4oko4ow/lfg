// src/utils/analytics.ts
// Umami Analytics integration

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, eventData?: Record<string, string | number>) => void;
    };
  }
}

// Helper function to safely track events with Umami
const track = (eventName: string, eventData?: Record<string, string | number>) => {
  if (typeof window !== "undefined" && window.umami) {
    try {
      window.umami.track(eventName, eventData);
    } catch (error) {
      console.warn("Analytics tracking error:", error);
    }
  }
};

export const analytics = {
  // Track pageviews manually if needed
  trackPageView: (url?: string) => {
    track("pageview", url ? { url } : undefined);
  },

  // Automatically track pageviews on navigation (for SPAs)
  // Umami automatically tracks pageviews, but we can enable manual tracking if needed
  enableAutoPageviews: () => {
    // Umami automatically tracks pageviews with the script tag
    // This is a no-op but kept for API compatibility
  },

  // Custom events
  createPartySubmit: (game: string) => {
    track("create_party_submit", { game });
  },

  joinPartyClick: (game: string) => {
    track("join_party_click", { game });
  },

  filterSelect: (game: string) => {
    track("filter_select", { game });
  },

  contactCopy: () => {
    track("contact_copy");
  },

  contactClose: () => {
    track("contact_close");
  },

  feedbackClick: () => {
    track("feedback_click");
  },

  // Chat-related events:
  chatOpened: () => {
    track("chat_opened");
  },

  chatMessageSent: () => {
    track("chat_message_sent");
  },

  chatMessageTyped: (length: number) => {
    track("chat_message_typed", { length });
  },

  chatMobile: () => {
    track("chat_mobile");
  },

  suggestGame: (game: string) => {
    track("suggest_game", { game });
  },

  suggestGameClick: () => {
    track("suggest_game_click");
  },

  noJoinFeedback: (reason: string) => {
    track("no_join_feedback", { reason });
  },

  noJoinSurveyShown: () => {
    track("no_join_survey_shown");
  },

  // Authentication events
  loginAttempt: (provider: string) => {
    track("login_attempt", { provider });
  },

  loginSuccess: (provider: string) => {
    track("login_success", { provider });
  },

  loginError: (provider: string, error?: string) => {
    track("login_error", { provider, error: error || "unknown" });
  },

  logout: () => {
    track("logout");
  },

  // Party lifecycle events
  partyCreated: (game: string, slots: number) => {
    track("party_created", { game, slots });
  },

  partyDeleted: (game: string) => {
    track("party_deleted", { game });
  },

  partyView: (game: string, partyId: string) => {
    track("party_view", { game, party_id: partyId });
  },

  partyFullClick: (game: string) => {
    track("party_full_click", { game });
  },

  // Navigation/Page events
  profilePageView: () => {
    track("profile_page_view");
  },

  landingPageView: () => {
    track("landing_page_view");
  },

  feedPageView: () => {
    track("feed_page_view");
  },

  // Language/UI events
  languageSwitch: (from: string, to: string) => {
    track("language_switch", { from, to });
  },

  // Profile events
  profileTabSwitch: (tab: string) => {
    track("profile_tab_switch", { tab });
  },

  contactSave: (provider: string) => {
    track("contact_save", { provider });
  },

  providerLink: (provider: string) => {
    track("provider_link", { provider });
  },

  // WebSocket/Connection events
  wsConnected: () => {
    track("ws_connected");
  },

  wsDisconnected: () => {
    track("ws_disconnected");
  },

  wsError: (error?: string) => {
    track("ws_error", { error: error || "unknown" });
  },

  // Error events
  apiError: (endpoint: string, status: number) => {
    track("api_error", { endpoint, status });
  },

  // Contact modal events
  contactModalOpened: (game: string, partyId: string) => {
    track("contact_modal_opened", { game, party_id: partyId });
  },
};  