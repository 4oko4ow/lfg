// src/utils/analytics.ts
// Umami Analytics integration - Optimized events

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
  // ===== PAGE VIEWS =====

  landingPageView: () => {
    track("page_landing");
  },

  feedPageView: (partiesCount: number) => {
    track("page_feed", { parties_count: partiesCount });
  },

  profilePageView: () => {
    track("page_profile");
  },

  communitiesPageView: () => {
    track("page_communities");
  },

  // ===== AUTHENTICATION =====

  loginAttempt: (provider: string) => {
    track("auth_login_attempt", { provider });
  },

  loginSuccess: (provider: string) => {
    track("auth_login_success", { provider });
  },

  loginError: (provider: string, error?: string) => {
    track("auth_login_error", { provider, error: error || "unknown" });
  },

  logout: () => {
    track("auth_logout");
  },

  // ===== PARTY CREATION =====

  createPartyStart: (game: string) => {
    track("party_create_start", { game });
  },

  createPartySubmit: (game: string, slots: number) => {
    track("party_create_submit", { game, slots });
  },

  createPartyError: (game: string, field: string) => {
    track("party_create_error", { game, field });
  },

  partyDeleted: (game: string) => {
    track("party_deleted", { game });
  },

  // ===== JOIN FUNNEL =====

  joinClick: (game: string, partyId: string) => {
    track("join_click", { game, party_id: partyId });
  },

  joinClickUnauthenticated: (game: string) => {
    track("join_click_unauth", { game });
  },

  contactModalOpened: (game: string) => {
    track("contact_opened", { game });
  },

  contactCopied: (game: string, contactType: string) => {
    track("contact_copied", { game, type: contactType });
  },

  contactModalClosed: (copied: boolean) => {
    track("contact_closed", { copied: copied ? 1 : 0 });
  },

  // ===== CHAT =====

  chatOpened: () => {
    track("chat_opened");
  },

  chatMessageSent: () => {
    track("chat_message_sent");
  },

  // ===== FILTERS =====

  filterApplied: (game: string, partiesCount: number) => {
    track("filter_applied", { game, parties_count: partiesCount });
  },

  filterCleared: () => {
    track("filter_cleared");
  },

  // ===== PROFILE =====

  profileTabSwitch: (tab: string) => {
    track("profile_tab", { tab });
  },

  contactSaved: (provider: string) => {
    track("contact_saved", { provider });
  },

  providerLinked: (provider: string) => {
    track("provider_linked", { provider });
  },

  // ===== SESSION =====

  sessionStart: (isReturning: boolean) => {
    track("session_start", { returning: isReturning ? 1 : 0 });
  },

  // ===== FEEDBACK =====

  noJoinSurveyShown: () => {
    track("survey_shown");
  },

  noJoinFeedback: (reason: string) => {
    track("survey_response", { reason });
  },

  suggestGame: (game: string) => {
    track("game_suggested", { game });
  },

  feedbackClick: () => {
    track("feedback_click");
  },

  // ===== B2B COMMUNITIES =====

  communitiesLinkClick: (source: "header" | "banner" | "feed") => {
    track("communities_click", { source });
  },

  communitiesPricingViewed: () => {
    track("communities_pricing_viewed");
  },

  communitiesFormStart: () => {
    track("communities_form_start");
  },

  communitiesFormSubmit: (data: { platform: string; community_size: string; willing_to_pay: string }) => {
    track("communities_form_submit", data);
  },

  communitiesFormError: (field: string) => {
    track("communities_form_error", { field });
  },

  // ===== ERRORS (only critical) =====

  apiError: (endpoint: string, status: number) => {
    track("error_api", { endpoint, status });
  },

  // ===== LANGUAGE =====

  languageSwitch: (to: string) => {
    track("language_switch", { to });
  },

  // ===== DEPRECATED - kept for backwards compatibility, do nothing =====
  // These can be removed after cleaning up usages in code

  trackPageView: () => {},
  enableAutoPageviews: () => {},
  joinPartyClick: () => {},
  filterSelect: () => {},
  contactCopy: () => {},
  contactClose: () => {},
  chatMessageTyped: () => {},
  chatMobile: () => {},
  suggestGameClick: () => {},
  partyCreated: () => {},
  partyView: () => {},
  partyFullClick: () => {},
  wsConnected: () => {},
  wsDisconnected: () => {},
  wsError: () => {},
  loginStart: () => {},
  loginComplete: () => {},
  loginFailed: () => {},
  loginCancelled: () => {},
  loginTimeout: () => {},
  partyCardViewed: () => {},
  partyCardHover: () => {},
  joinButtonClick: () => {},
  joinButtonClickUnauthenticated: () => {},
  loginModalOpenedFromJoin: () => {},
  contactModalClosedWithoutAction: () => {},
  chatOpenedDetailed: () => {},
  chatClosed: () => {},
  chatMessageFailed: () => {},
  chatMessageAttempt: () => {},
  chatCollapsed: () => {},
  chatExpanded: () => {},
  timeToFeed: () => {},
  timeToJoin: () => {},
  timeToCreateParty: () => {},
  timeToFirstAction: () => {},
  sessionEnd: () => {},
  userReturned: () => {},
  wsReconnectAttempt: () => {},
  wsReconnectSuccess: () => {},
  wsReconnectFailed: () => {},
  wsConnectionDuration: () => {},
  noJoinSurveyClosed: () => {},
  noJoinSurveyDismissed: () => {},
  createPartyAbandoned: () => {},
  createPartyValidationError: () => {},
  profileSectionViewed: () => {},
  apiErrorDetailed: () => {},
  communitiesCtaClick: () => {},
  communitiesLinkClickHeader: () => {},
  communitiesLinkClickBanner: () => {},
};
