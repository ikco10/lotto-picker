import { STORAGE_KEY } from "@/src/lib/constants";
import type { SavedRecommendation } from "@/src/types/lotto";

const isSavedRecommendation = (value: unknown): value is SavedRecommendation => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<SavedRecommendation>;

  return (
    typeof item.id === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.period === "string" &&
    typeof item.mode === "string" &&
    Array.isArray(item.numbers) &&
    item.numbers.every(
      (set) => Array.isArray(set) && set.every((number) => typeof number === "number"),
    )
  );
};

const migrateLegacyRecommendation = (value: unknown): SavedRecommendation | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as {
    id?: unknown;
    createdAt?: unknown;
    period?: unknown;
    mode?: unknown;
    numbers?: unknown;
  };

  if (
    typeof item.id === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.period === "string" &&
    typeof item.mode === "string" &&
    Array.isArray(item.numbers) &&
    item.numbers.every((number) => typeof number === "number")
  ) {
    return {
      id: item.id,
      createdAt: item.createdAt,
      period: item.period as SavedRecommendation["period"],
      mode: item.mode as SavedRecommendation["mode"],
      numbers: [item.numbers as number[]],
    };
  }

  return null;
};

export const loadSavedRecommendations = (raw: string | null) => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => (isSavedRecommendation(item) ? item : migrateLegacyRecommendation(item)))
      .filter((item): item is SavedRecommendation => item !== null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
};

export const serializeSavedRecommendations = (items: SavedRecommendation[]) =>
  JSON.stringify(items);

export const getStorageKey = () => STORAGE_KEY;
