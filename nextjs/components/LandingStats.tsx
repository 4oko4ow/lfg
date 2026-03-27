'use client';

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Gamepad2, CheckCircle2 } from "lucide-react";
import { connectWS, onMessage, socket } from "@/lib/ws/client";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOnlineCount } from "@/components/providers/OnlineCountProvider";

interface Stats {
  parties_created: number;
  people_joined: number;
  parties_filled: number;
}

export function LandingStats() {
  const router = useRouter();
  const { profile, loading } = useAuth();
  const { onlineCount, setOnlineCount } = useOnlineCount();

  useEffect(() => {
    if (!loading && profile) {
      router.replace("/feed");
    }
  }, [profile, loading, router]);

  const [partiesCount, setPartiesCount] = useState<number | null>(null);
  const [isWsLoading, setIsWsLoading] = useState(true);
  const [hasReceivedParties, setHasReceivedParties] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const hasReceivedDataRef = useRef(false);

  useEffect(() => {
    connectWS();

    const timeoutId = setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setIsWsLoading(false);
      }
    }, 5000);

    onMessage((msg) => {
      switch (msg.type) {
        case "initial_state":
          setPartiesCount((msg.payload as unknown[]).length);
          setHasReceivedParties(true);
          hasReceivedDataRef.current = true;
          setIsWsLoading(false);
          break;
        case "online_count":
          setOnlineCount(msg.payload as number);
          if (!hasReceivedDataRef.current) {
            hasReceivedDataRef.current = true;
            setIsWsLoading(false);
          }
          break;
        case "new_party":
          setPartiesCount((prev) => (prev ?? 0) + 1);
          break;
        case "party_remove":
          setPartiesCount((prev) => Math.max(0, (prev ?? 0) - 1));
          break;
      }
    });

    return () => {
      clearTimeout(timeoutId);
      if (socket) {
        socket.close();
      }
    };
  }, [setOnlineCount]);

  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
    fetch(`${backendUrl}/api/stats`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch stats");
        return res.json();
      })
      .then((data: Stats) => {
        setStats(data);
        setIsLoadingStats(false);
      })
      .catch(() => {
        setIsLoadingStats(false);
      });
  }, []);

  const skeleton = (
    <div className="h-9 w-24 animate-pulse rounded-md bg-gradient-to-r from-zinc-700/30 via-zinc-600/40 to-zinc-700/30" />
  );

  return (
    <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2 text-blue-400">
          <Users className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-wide">Онлайн сейчас</span>
        </div>
        {isWsLoading ? skeleton : <p className="text-3xl font-bold">{onlineCount}</p>}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2 text-purple-400">
          <Gamepad2 className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-wide">Активные пати</span>
        </div>
        {!hasReceivedParties ? skeleton : <p className="text-3xl font-bold">{partiesCount ?? 0}</p>}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2 text-green-400">
          <Gamepad2 className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-wide">Пати создано</span>
        </div>
        {isLoadingStats ? skeleton : <p className="text-3xl font-bold">{stats?.parties_created ?? 0}</p>}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2 text-yellow-400">
          <Users className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-wide">Игроков вступило</span>
        </div>
        {isLoadingStats ? skeleton : <p className="text-3xl font-bold">{stats?.people_joined ?? 0}</p>}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2 text-pink-400">
          <CheckCircle2 className="h-6 w-6" />
          <span className="text-sm font-semibold uppercase tracking-wide">Пати заполнено</span>
        </div>
        {isLoadingStats ? skeleton : <p className="text-3xl font-bold">{stats?.parties_filled ?? 0}</p>}
      </div>
    </div>
  );
}
