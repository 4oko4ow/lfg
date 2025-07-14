// src/utils/analytics.ts
import plausible from "plausible-tracker";

const plausibleClient = plausible({
  domain: "findparty.online",
  trackLocalhost: true, // optional, useful for testing locally
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

  feedbackClick: () =>
    plausibleClient.trackEvent("feedback_click"),
};