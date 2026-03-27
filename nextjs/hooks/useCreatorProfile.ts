'use client';

import { useState, useEffect, useCallback } from "react";

export interface CreatorProfile {
  user_id: string;
  display_name: string;
  avatar_url?: string;
  level: number;
  total_xp: number;
  parties_created: number;
  parties_joined: number;
  current_streak: number;
  achievements: string[];
}

// Simple in-memory cache
const profileCache = new Map<string, { profile: CreatorProfile; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

const pendingRequests = new Map<string, Promise<CreatorProfile | null>>();

export function useCreatorProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async (id: string): Promise<CreatorProfile | null> => {
    // Check cache first
    const cached = profileCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.profile;
    }

    // Check if there's already a pending request for this user
    const pending = pendingRequests.get(id);
    if (pending) {
      return pending;
    }

    // Create new request
    const request = (async () => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
        const response = await fetch(`${backendUrl}/api/users/${id}/profile`);

        if (!response.ok) {
          if (response.status === 404) {
            return null;
          }
          throw new Error(`HTTP ${response.status}`);
        }

        const data: CreatorProfile = await response.json();

        // Cache the result
        profileCache.set(id, { profile: data, timestamp: Date.now() });

        return data;
      } catch (err) {
        console.error("Error fetching creator profile:", err);
        return null;
      } finally {
        pendingRequests.delete(id);
      }
    })();

    pendingRequests.set(id, request);
    return request;
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchProfile(userId);
        if (!cancelled) {
          setProfile(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [userId, fetchProfile]);

  return { profile, loading, error };
}

// Prefetch profiles for a list of user IDs (useful for party lists)
export function prefetchCreatorProfiles(userIds: string[]) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

  for (const id of userIds) {
    if (!id) continue;

    // Skip if already cached
    const cached = profileCache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      continue;
    }

    // Skip if already fetching
    if (pendingRequests.has(id)) {
      continue;
    }

    // Fetch in background
    const request = fetch(`${backendUrl}/api/users/${id}/profile`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          profileCache.set(id, { profile: data, timestamp: Date.now() });
        }
        return data;
      })
      .catch(() => null)
      .finally(() => {
        pendingRequests.delete(id);
      });

    pendingRequests.set(id, request);
  }
}
