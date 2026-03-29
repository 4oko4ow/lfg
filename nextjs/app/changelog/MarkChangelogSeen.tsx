'use client';

import { useEffect } from "react";
import { LATEST_CHANGELOG_DATE, CHANGELOG_SEEN_KEY } from "@/lib/changelog";

export function MarkChangelogSeen() {
  useEffect(() => {
    localStorage.setItem(CHANGELOG_SEEN_KEY, LATEST_CHANGELOG_DATE);
  }, []);
  return null;
}
