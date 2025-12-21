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
};  