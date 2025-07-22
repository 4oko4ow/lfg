// src/utils/analytics.ts
import plausible from "plausible-tracker";

const plausibleClient = plausible({
  domain: "findparty.online",
  trackLocalhost: true, // useful for testing locally
});

export const analytics = {
  // Track pageviews manually if needed
  trackPageView: () => plausibleClient.trackPageview(),

  // Automatically track pageviews on navigation (for SPAs)
  enableAutoPageviews: () => plausibleClient.enableAutoPageviews(),

  // Custom events
  createPartySubmit: (game: string) =>
    plausibleClient.trackEvent("create_party_submit", { props: { game } }),

  joinPartyClick: (game: string) =>
    plausibleClient.trackEvent("join_party_click", { props: { game } }),

  filterSelect: (game: string) =>
    plausibleClient.trackEvent("filter_game", { props: { game } }),

  contactCopy: () =>
    plausibleClient.trackEvent("contact_copy"),

  contactClose: () =>
    plausibleClient.trackEvent("contact_close"),

  feedbackClick: () =>
    plausibleClient.trackEvent("feedback_click"),

  // 🟢 Chat-related events:
  chatOpened: () =>
    plausibleClient.trackEvent("chat_opened"),

  chatMessageSent: () =>
    plausibleClient.trackEvent("chat_message_sent"),

  chatMessageTyped: (length: number) =>
    plausibleClient.trackEvent("chat_message_typed", { props: { length } }),

  chatMobile: () =>
    plausibleClient.trackEvent("chat_mobile"),


  suggestGame: (game: string) =>
  plausibleClient.trackEvent("suggest_game", { props: { game } }),

  suggestGameClick: () =>
    plausibleClient.trackEvent("suggest_game_click"),

  noJoinFeedback: (reason: string) =>
    plausibleClient.trackEvent("no_join_feedback", { props: { reason } }),

  noJoinSurveyShown: () =>
  plausibleClient.trackEvent("no_join_survey_shown"),
};  