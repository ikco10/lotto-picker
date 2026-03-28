"use client";

import { useEffect, useState } from "react";

import {
  getStorageKey,
  loadSavedRecommendations,
  serializeSavedRecommendations,
} from "@/src/lib/storage";
import type { SavedRecommendation } from "@/src/types/lotto";

export const useSavedRecommendations = () => {
  const [records, setRecords] = useState<SavedRecommendation[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    const timer = window.setTimeout(() => {
      if (!active) {
        return;
      }

      const stored = localStorage.getItem(getStorageKey());
      setRecords(loadSavedRecommendations(stored));
      setLoaded(true);
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    localStorage.setItem(getStorageKey(), serializeSavedRecommendations(records));
  }, [loaded, records]);

  return {
    records,
    setRecords,
    loaded,
  };
};
