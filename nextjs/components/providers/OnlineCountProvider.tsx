'use client'

import { createContext, useContext, useState, type ReactNode } from "react";

type OnlineCountContextValue = {
  onlineCount: number;
  setOnlineCount: (count: number) => void;
};

const OnlineCountContext = createContext<OnlineCountContextValue | undefined>(
  undefined,
);

export function OnlineCountProvider({ children }: { children: ReactNode }) {
  const [onlineCount, setOnlineCount] = useState(0);

  return (
    <OnlineCountContext.Provider value={{ onlineCount, setOnlineCount }}>
      {children}
    </OnlineCountContext.Provider>
  );
}

export function useOnlineCount() {
  const ctx = useContext(OnlineCountContext);
  if (!ctx) {
    throw new Error("useOnlineCount must be used within OnlineCountProvider");
  }
  return ctx;
}
