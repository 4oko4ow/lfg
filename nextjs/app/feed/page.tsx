'use client';

import { Suspense } from "react";
import { PartyFeedPageContent } from "./PageContent";

export default function FeedPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white">Loading...</div>}>
      <PartyFeedPageContent />
    </Suspense>
  );
}
