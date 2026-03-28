import type { GenerationMode, PeriodKey } from "@/src/types/lotto";

export const LOTTO_DATA_SOURCES = [
  "https://smok95.github.io/lotto/results/all.json",
  "https://cdn.jsdelivr.net/gh/smok95/lotto@main/results/all.json",
  "https://raw.githubusercontent.com/smok95/lotto/main/results/all.json",
] as const;
export const STORAGE_KEY = "lotto-weighted-recommender-history";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "5y", label: "최근 5년" },
  { key: "2y", label: "최근 2년" },
  { key: "6m", label: "최근 6개월" },
];

export const MODE_OPTIONS: { key: GenerationMode; label: string }[] = [
  { key: "weighted", label: "가중 모드" },
  { key: "uniform", label: "균등 모드" },
  { key: "diversified", label: "분산 모드" },
];

export const PERIOD_MONTHS: Record<Exclude<PeriodKey, "all">, number> = {
  "5y": 60,
  "2y": 24,
  "6m": 6,
};
