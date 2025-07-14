// src/utils/analytics.ts
import plausible from "plausible-tracker";

const { trackEvent } = plausible();

export const analytics = {
  createPartySubmit: (game: string) =>
    trackEvent("create_party_submit", { props: { game } }),
  joinPartyClick: (game: string) =>
    trackEvent("join_party_click", { props: { game } }),
  filterSelect: (game: string) =>
    trackEvent("filter_game", { props: { game } }),
  feedbackClick: () =>
    trackEvent("feedback_click"),
};