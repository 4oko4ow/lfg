'use client'

import { AuthProvider } from "./AuthProvider";
import { OnlineCountProvider } from "./OnlineCountProvider";
import { I18nProvider } from "./I18nProvider";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <OnlineCountProvider>
          {children}
          <Toaster />
        </OnlineCountProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
