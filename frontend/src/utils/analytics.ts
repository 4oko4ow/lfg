// src/utils/analytics.ts
// Analytics removed - all methods are no-ops

export const analytics = {
  // Track pageviews manually if needed
  trackPageView: () => {},

  // Automatically track pageviews on navigation (for SPAs)
  enableAutoPageviews: () => {},

  // Custom events
  createPartySubmit: (_game: string) => {},

  joinPartyClick: (_game: string) => {},

  filterSelect: (_game: string) => {},

  contactCopy: () => {},

  contactClose: () => {},

  feedbackClick: () => {},

  // Chat-related events:
  chatOpened: () => {},

  chatMessageSent: () => {},

  chatMessageTyped: (_length: number) => {},

  chatMobile: () => {},

  suggestGame: (_game: string) => {},

  suggestGameClick: () => {},

  noJoinFeedback: (_reason: string) => {},

  noJoinSurveyShown: () => {},
};  