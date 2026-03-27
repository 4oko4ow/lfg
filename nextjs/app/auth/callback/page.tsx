'use client';

import { Suspense } from "react";
import { AuthCallbackPageContent } from "./PageContent";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center text-white">Loading...</div>}>
      <AuthCallbackPageContent />
    </Suspense>
  );
}
