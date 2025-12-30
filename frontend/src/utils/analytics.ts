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

  // ===== ДЕТАЛЬНЫЙ ТРЕКИНГ =====

  // Детальная авторизация
  loginStart: (provider: string) => {
    track("login_start", { provider, timestamp: Date.now() });
  },

  loginComplete: (provider: string, duration: number) => {
    track("login_complete", { provider, duration_ms: duration });
  },

  loginFailed: (provider: string, errorType: string, errorMessage?: string) => {
    track("login_failed", {
      provider,
      error_type: errorType,
      error_message: errorMessage || "unknown"
    });
  },

  loginCancelled: (provider: string) => {
    track("login_cancelled", { provider });
  },

  loginTimeout: (provider: string, timeoutMs: number) => {
    track("login_timeout", { provider, timeout_ms: timeoutMs });
  },

  // Воронка присоединения к партии
  partyCardViewed: (game: string, partyId: string, position: number) => {
    track("party_card_viewed", { game, party_id: partyId, position });
  },

  partyCardHover: (game: string, partyId: string) => {
    track("party_card_hover", { game, party_id: partyId });
  },

  contactModalClosed: (game: string, partyId: string, action: "copy" | "close" | "none") => {
    track("contact_modal_closed", { game, party_id: partyId, action });
  },

  contactModalClosedWithoutAction: (game: string, partyId: string, timeOpen: number) => {
    track("contact_modal_closed_no_action", {
      game,
      party_id: partyId,
      time_open_ms: timeOpen
    });
  },

  // Детальный трекинг чата
  chatOpenedDetailed: (source: "button" | "auto" | "mobile") => {
    track("chat_opened_detailed", { source });
  },

  chatClosed: (timeOpen: number, messagesCount: number) => {
    track("chat_closed", { time_open_ms: timeOpen, messages_count: messagesCount });
  },

  chatMessageFailed: (error: string) => {
    track("chat_message_failed", { error });
  },

  chatMessageAttempt: (length: number) => {
    track("chat_message_attempt", { length });
  },

  chatCollapsed: () => {
    track("chat_collapsed");
  },

  chatExpanded: () => {
    track("chat_expanded");
  },

  // Время до первого действия
  timeToFeed: (duration: number) => {
    track("time_to_feed", { duration_ms: duration });
  },

  timeToJoin: (duration: number) => {
    track("time_to_join", { duration_ms: duration });
  },

  timeToCreateParty: (duration: number) => {
    track("time_to_create_party", { duration_ms: duration });
  },

  timeToFirstAction: (action: string, duration: number) => {
    track("time_to_first_action", { action, duration_ms: duration });
  },

  // Retention и сессии
  sessionStart: (isReturning: boolean) => {
    track("session_start", { is_returning: isReturning ? 1 : 0 });
  },

  sessionEnd: (duration: number, actionsCount: number) => {
    track("session_end", { duration_ms: duration, actions_count: actionsCount });
  },

  userReturned: (daysSinceLastVisit: number) => {
    track("user_returned", { days_since_last_visit: daysSinceLastVisit });
  },

  // Детальный WebSocket трекинг
  wsReconnectAttempt: (attemptNumber: number, timeSinceDisconnect: number) => {
    track("ws_reconnect_attempt", {
      attempt_number: attemptNumber,
      time_since_disconnect_ms: timeSinceDisconnect
    });
  },

  wsReconnectSuccess: (attemptNumber: number, totalTime: number) => {
    track("ws_reconnect_success", {
      attempt_number: attemptNumber,
      total_time_ms: totalTime
    });
  },

  wsReconnectFailed: (attemptNumber: number, error: string) => {
    track("ws_reconnect_failed", {
      attempt_number: attemptNumber,
      error
    });
  },

  wsConnectionDuration: (duration: number) => {
    track("ws_connection_duration", { duration_ms: duration });
  },

  // Опрос "почему не присоединились"
  noJoinSurveyClosed: (timeShown: number, responded: boolean) => {
    track("no_join_survey_closed", {
      time_shown_ms: timeShown,
      responded: responded ? 1 : 0
    });
  },

  noJoinSurveyDismissed: (timeShown: number) => {
    track("no_join_survey_dismissed", { time_shown_ms: timeShown });
  },

  // Создание партии - детали
  createPartyStart: (game: string) => {
    track("create_party_start", { game });
  },

  createPartyAbandoned: (game: string, step: string, timeSpent: number) => {
    track("create_party_abandoned", {
      game,
      abandoned_at_step: step,
      time_spent_ms: timeSpent
    });
  },

  createPartyValidationError: (game: string, field: string) => {
    track("create_party_validation_error", { game, field });
  },

  // Фильтры и поиск
  filterApplied: (game: string, partiesCount: number) => {
    track("filter_applied", { game, parties_count: partiesCount });
  },

  filterCleared: () => {
    track("filter_cleared");
  },

  // Просмотр профиля
  profileSectionViewed: (section: string) => {
    track("profile_section_viewed", { section });
  },

  // Ошибки API
  apiErrorDetailed: (endpoint: string, method: string, status: number, error: string) => {
    track("api_error_detailed", {
      endpoint,
      method,
      status,
      error
    });
  },
};  