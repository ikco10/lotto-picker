import { PERIOD_MONTHS } from "@/src/lib/constants";
import type {
  GenerationMode,
  LottoDraw,
  PeriodKey,
  RemoteLottoDraw,
} from "@/src/types/lotto";

const TOTAL_NUMBERS = 45;
const NUMBERS_PER_SET = 6;
const CANDIDATE_COUNT = 60;
const RECENCY_DECAY = 0.94;

export type NumberProfile = {
  value: number;
  weight: number;
  finalScore: number;
  frequencyScore: number;
  recencyScore: number;
  missScore: number;
  bonusScore: number;
};

export type FrequencyStat = {
  value: number;
  count: number;
};

const isValidNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= TOTAL_NUMBERS;

const normalizeOneDraw = (raw: RemoteLottoDraw): LottoDraw | null => {
  if (
    "round" in raw &&
    "drawDate" in raw &&
    "numbers" in raw &&
    "bonus" in raw &&
    typeof raw.round === "number" &&
    typeof raw.drawDate === "string" &&
    Array.isArray(raw.numbers) &&
    raw.numbers.every(isValidNumber) &&
    isValidNumber(raw.bonus)
  ) {
    return {
      round: raw.round,
      drawDate: raw.drawDate,
      numbers: [...raw.numbers].sort((a, b) => a - b),
      bonus: raw.bonus,
    };
  }

  if ("drwNo" in raw && "drwNoDate" in raw) {
    const numbers = [
      raw.drwtNo1,
      raw.drwtNo2,
      raw.drwtNo3,
      raw.drwtNo4,
      raw.drwtNo5,
      raw.drwtNo6,
    ];

    if (
      typeof raw.drwNo === "number" &&
      typeof raw.drwNoDate === "string" &&
      numbers.every(isValidNumber) &&
      isValidNumber(raw.bnusNo)
    ) {
      return {
        round: raw.drwNo,
        drawDate: raw.drwNoDate,
        numbers: [...numbers].sort((a, b) => a - b),
        bonus: raw.bnusNo,
      };
    }
  }

  if (
    "draw_no" in raw &&
    "numbers" in raw &&
    "bonus_no" in raw &&
    "date" in raw &&
    typeof raw.draw_no === "number" &&
    Array.isArray(raw.numbers) &&
    raw.numbers.every(isValidNumber) &&
    isValidNumber(raw.bonus_no) &&
    typeof raw.date === "string"
  ) {
    return {
      round: raw.draw_no,
      drawDate: raw.date.slice(0, 10),
      numbers: [...raw.numbers].sort((a, b) => a - b),
      bonus: raw.bonus_no,
    };
  }

  return null;
};

export const normalizeRemoteDraws = (input: unknown): LottoDraw[] => {
  const rawList = Array.isArray(input)
    ? input
    : input && typeof input === "object" && "draws" in input && Array.isArray(input.draws)
      ? input.draws
      : input && typeof input === "object" && "results" in input && Array.isArray(input.results)
        ? input.results
        : input && typeof input === "object" && "data" in input && Array.isArray(input.data)
          ? input.data
          : input && typeof input === "object" && "items" in input && Array.isArray(input.items)
            ? input.items
            : input && typeof input === "object"
              ? Object.values(input)
              : [];

  return rawList
    .map((raw) => normalizeOneDraw(raw as RemoteLottoDraw))
    .filter((draw): draw is LottoDraw => draw !== null)
    .sort((a, b) => a.round - b.round);
};

const shiftMonths = (baseDate: Date, months: number) => {
  const shifted = new Date(baseDate);
  shifted.setMonth(shifted.getMonth() - months);
  return shifted;
};

export const filterDrawsByPeriod = (
  draws: LottoDraw[],
  period: PeriodKey,
  now: Date = new Date(),
) => {
  if (period === "all") {
    return draws;
  }

  const cutoff = shiftMonths(now, PERIOD_MONTHS[period]);

  return draws.filter((draw) => {
    const drawTime = new Date(draw.drawDate).getTime();
    return Number.isFinite(drawTime) && drawTime >= cutoff.getTime();
  });
};

const smoothNormalize = (values: number[]) => {
  const min = Math.min(...values);
  const max = Math.max(...values);

  if (!Number.isFinite(min) || !Number.isFinite(max) || max === min) {
    return values.map(() => 0.5);
  }

  const range = max - min;
  return values.map((value) => (value - min + range * 0.12) / (range * 1.24));
};

export const getTopFrequencyNumbers = (draws: LottoDraw[], limit = 6): FrequencyStat[] => {
  const counts = Array.from({ length: TOTAL_NUMBERS }, (_, index) => ({
    value: index + 1,
    count: 0,
  }));

  for (const draw of draws) {
    for (const number of draw.numbers) {
      counts[number - 1].count += 1;
    }
  }

  return counts
    .sort((a, b) => {
      if (b.count === a.count) {
        return a.value - b.value;
      }
      return b.count - a.count;
    })
    .slice(0, limit);
};

const buildNumberProfiles = (draws: LottoDraw[]): NumberProfile[] => {
  const weightedFrequency = Array.from({ length: TOTAL_NUMBERS }, () => 0);

  for (let drawIndex = 0; drawIndex < draws.length; drawIndex += 1) {
    const draw = draws[drawIndex];
    const reverseIndex = draws.length - 1 - drawIndex;
    const timeWeight = RECENCY_DECAY ** reverseIndex;

    for (const value of draw.numbers) {
      weightedFrequency[value - 1] += timeWeight;
    }
  }

  const logFrequency = weightedFrequency.map((value) => Math.log1p(value));
  const normalized = smoothNormalize(logFrequency);

  return Array.from({ length: TOTAL_NUMBERS }, (_, index) => {
    const finalScore = normalized[index];

    return {
      value: index + 1,
      frequencyScore: weightedFrequency[index],
      recencyScore: 0,
      missScore: 0,
      bonusScore: 0,
      finalScore,
      weight: Math.exp(finalScore) + 1,
    };
  });
};

export const getTopNumberProfiles = (draws: LottoDraw[], limit = 6) => {
  return buildNumberProfiles(draws)
    .sort((a, b) => {
      if (b.finalScore === a.finalScore) {
        return a.value - b.value;
      }
      return b.finalScore - a.finalScore;
    })
    .slice(0, limit);
};

export const createWeightMap = (draws: LottoDraw[]) => {
  return buildNumberProfiles(draws).map((profile) => profile.weight);
};

const pickWeightedNumber = (candidates: number[], weights: number[]) => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = Math.random() * total;

  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) {
      return candidates[index];
    }
  }

  return candidates[candidates.length - 1];
};

const longestConsecutiveRun = (numbers: number[]) => {
  let longest = 1;
  let current = 1;

  for (let index = 1; index < numbers.length; index += 1) {
    if (numbers[index] === numbers[index - 1] + 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }

  return longest;
};

export const hasInvalidPattern = (numbers: number[]) => {
  const oddCount = numbers.filter((value) => value % 2 === 1).length;
  return longestConsecutiveRun(numbers) >= 4 || oddCount === 0 || oddCount === NUMBERS_PER_SET;
};

const createCandidateSet = (profiles: NumberProfile[]) => {
  const availableNumbers = Array.from({ length: TOTAL_NUMBERS }, (_, index) => index + 1);
  const selected = new Set<number>();

  while (selected.size < NUMBERS_PER_SET && availableNumbers.length > 0) {
    const candidateWeights = availableNumbers.map(
      (value) => profiles[value - 1].weight * (0.92 + Math.random() * 0.16),
    );
    const picked = pickWeightedNumber(availableNumbers, candidateWeights);
    selected.add(picked);
    availableNumbers.splice(availableNumbers.indexOf(picked), 1);
  }

  return [...selected].sort((a, b) => a - b);
};

const createUniformCandidateSet = () => {
  const availableNumbers = Array.from({ length: TOTAL_NUMBERS }, (_, index) => index + 1);
  const selected: number[] = [];

  while (selected.length < NUMBERS_PER_SET && availableNumbers.length > 0) {
    const pickedIndex = Math.floor(Math.random() * availableNumbers.length);
    selected.push(availableNumbers[pickedIndex]);
    availableNumbers.splice(pickedIndex, 1);
  }

  return selected.sort((a, b) => a - b);
};

const calculateSumScore = (numbers: number[]) => {
  const target = 138;
  const distance = Math.abs(numbers.reduce((sum, value) => sum + value, 0) - target);
  return Math.max(0, 1 - distance / 70);
};

const calculateOddEvenScore = (numbers: number[]) => {
  const oddCount = numbers.filter((value) => value % 2 === 1).length;
  return Math.max(0, 1 - Math.abs(oddCount - 3) / 3);
};

const calculateRangeBalanceScore = (numbers: number[]) => {
  const buckets = [0, 0, 0, 0, 0];
  for (const value of numbers) {
    if (value <= 9) buckets[0] += 1;
    else if (value <= 19) buckets[1] += 1;
    else if (value <= 29) buckets[2] += 1;
    else if (value <= 39) buckets[3] += 1;
    else buckets[4] += 1;
  }

  const coverageScore = buckets.filter((count) => count > 0).length / buckets.length;
  const concentrationPenalty = Math.max(...buckets) > 2 ? 0.25 : 0;

  return Math.max(0, coverageScore - concentrationPenalty);
};

const calculateConsecutiveScore = (numbers: number[]) => {
  const longestRun = longestConsecutiveRun(numbers);

  if (longestRun <= 2) {
    return 1;
  }

  if (longestRun === 3) {
    return 0.45;
  }

  return 0;
};

const calculateDiversityPenalty = (numbers: number[], existingResults: number[][]) => {
  if (existingResults.length === 0) {
    return 0;
  }

  const overlapRatios = existingResults.map((existing) => {
    const overlap = numbers.filter((value) => existing.includes(value)).length;
    return overlap / NUMBERS_PER_SET;
  });

  const averageOverlap =
    overlapRatios.reduce((sum, value) => sum + value, 0) / overlapRatios.length;

  return averageOverlap * 0.28;
};

const calculateLowBiasScore = (numbers: number[], draws: LottoDraw[]) => {
  const frequencies = getTopFrequencyNumbers(draws, TOTAL_NUMBERS);
  const frequencyMap = new Map(frequencies.map((item) => [item.value, item.count]));
  const maxCount = Math.max(1, ...frequencies.map((item) => item.count));
  const averagePopularity =
    numbers.reduce((sum, value) => sum + (frequencyMap.get(value) ?? 0) / maxCount, 0) /
    NUMBERS_PER_SET;

  return 1 - averagePopularity;
};

const evaluateWeightedCombination = (numbers: number[], profiles: NumberProfile[]) => {
  if (numbers.length !== NUMBERS_PER_SET || hasInvalidPattern(numbers)) {
    return -Infinity;
  }

  const baseWeight =
    numbers.reduce((sum, value) => sum + profiles[value - 1].finalScore, 0) / NUMBERS_PER_SET;
  const oddEvenScore = calculateOddEvenScore(numbers);
  const consecutiveScore = calculateConsecutiveScore(numbers);

  return (
    0.78 * baseWeight +
    0.12 * oddEvenScore +
    0.1 * consecutiveScore
  );
};

const evaluateDiversifiedCombination = (numbers: number[], draws: LottoDraw[], existing: number[][]) => {
  if (numbers.length !== NUMBERS_PER_SET || hasInvalidPattern(numbers)) {
    return -Infinity;
  }

  const sumScore = calculateSumScore(numbers);
  const oddEvenScore = calculateOddEvenScore(numbers);
  const rangeBalanceScore = calculateRangeBalanceScore(numbers);
  const consecutiveScore = calculateConsecutiveScore(numbers);
  const lowBiasScore = calculateLowBiasScore(numbers, draws);
  const diversityBonus = 1 - calculateDiversityPenalty(numbers, existing);

  return (
    0.3 * sumScore +
    0.22 * oddEvenScore +
    0.2 * rangeBalanceScore +
    0.12 * consecutiveScore +
    0.1 * lowBiasScore +
    0.16 * diversityBonus
  );
};

export const generateNumberSet = (draws: LottoDraw[]) => {
  const profiles = buildNumberProfiles(draws);

  let bestNumbers = [3, 11, 19, 27, 36, 44];
  let bestScore = -Infinity;

  for (let candidateIndex = 0; candidateIndex < CANDIDATE_COUNT; candidateIndex += 1) {
    const candidate = createCandidateSet(profiles);
    const candidateScore = evaluateWeightedCombination(candidate, profiles);

    if (candidateScore > bestScore) {
      bestScore = candidateScore;
      bestNumbers = candidate;
    }
  }

  return bestNumbers;
};

const pickScoredCandidate = (
  scoredCandidates: { numbers: number[]; score: number }[],
  existingResults: number[][],
) => {
  const sorted = [...scoredCandidates]
    .map((candidate) => ({
      numbers: candidate.numbers,
      score: candidate.score - calculateDiversityPenalty(candidate.numbers, existingResults),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  const weights = sorted.map((candidate) => Math.exp(candidate.score * 3.2));
  const total = weights.reduce((sum, value) => sum + value, 0);
  let cursor = Math.random() * total;

  for (let index = 0; index < sorted.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) {
      return sorted[index].numbers;
    }
  }

  return sorted[0]?.numbers ?? [3, 11, 19, 27, 36, 44];
};

export const generateRecommendationBatch = (
  draws: LottoDraw[],
  period: PeriodKey,
  mode: GenerationMode,
  batchSize = 5,
) => {
  const weightedDraws = filterDrawsByPeriod(draws, period);
  const sourceDraws = mode === "weighted" ? weightedDraws : draws;
  const profiles = buildNumberProfiles(sourceDraws);
  const results: number[][] = [];
  const usedKeys = new Set<string>();

  while (results.length < batchSize) {
    if (mode === "uniform") {
      let candidate = createUniformCandidateSet();
      let safety = 0;
      while ((hasInvalidPattern(candidate) || usedKeys.has(candidate.join("-"))) && safety < 100) {
        candidate = createUniformCandidateSet();
        safety += 1;
      }

      usedKeys.add(candidate.join("-"));
      results.push(candidate);
      continue;
    }

    const scoredCandidates: { numbers: number[]; score: number }[] = [];

    for (let candidateIndex = 0; candidateIndex < CANDIDATE_COUNT; candidateIndex += 1) {
      const candidate =
        mode === "weighted" ? createCandidateSet(profiles) : createUniformCandidateSet();
      const key = candidate.join("-");
      if (usedKeys.has(key)) {
        continue;
      }

      const candidateScore =
        mode === "weighted"
          ? evaluateWeightedCombination(candidate, profiles)
          : evaluateDiversifiedCombination(candidate, draws, results);
      scoredCandidates.push({
        numbers: candidate,
        score: candidateScore,
      });
    }

    const bestNumbers = pickScoredCandidate(scoredCandidates, results);
    const bestKey = bestNumbers.join("-");
    usedKeys.add(bestKey);
    results.push(bestNumbers);
  }

  return results;
};

export const formatPeriodLabel = (period: PeriodKey) => {
  switch (period) {
    case "all":
      return "전체";
    case "5y":
      return "최근 5년";
    case "2y":
      return "최근 2년";
    case "6m":
      return "최근 6개월";
  }
};

export const formatModeLabel = (mode: GenerationMode) => {
  switch (mode) {
    case "weighted":
      return "가중 모드";
    case "uniform":
      return "균등 모드";
    case "diversified":
      return "분산 모드";
  }
};

export type MatchSummary = {
  matchCount: number;
  bonusMatched: boolean;
  rank: 1 | 2 | 3 | 4 | 5 | null;
};

export type ParsedQrTicket = {
  round: number;
  numbers: number[][];
  rawValue: string;
};

export const getMatchSummary = (numbers: number[], draw: LottoDraw): MatchSummary => {
  const matchCount = numbers.filter((value) => draw.numbers.includes(value)).length;
  const bonusMatched = numbers.includes(draw.bonus);

  if (matchCount === 6) {
    return { matchCount, bonusMatched, rank: 1 };
  }

  if (matchCount === 5 && bonusMatched) {
    return { matchCount, bonusMatched, rank: 2 };
  }

  if (matchCount === 5) {
    return { matchCount, bonusMatched, rank: 3 };
  }

  if (matchCount === 4) {
    return { matchCount, bonusMatched, rank: 4 };
  }

  if (matchCount === 3) {
    return { matchCount, bonusMatched, rank: 5 };
  }

  return { matchCount, bonusMatched, rank: null };
};

export const parseLottoQrValue = (rawValue: string): ParsedQrTicket | null => {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return null;
  }

  let encoded = trimmed;

  try {
    const url = new URL(trimmed);
    encoded = url.searchParams.get("v") ?? trimmed;
  } catch {
  }

  const decoded = decodeURIComponent(encoded);
  const roundMatch = decoded.match(/(\d{4,5})(?=q\d{12})/);

  if (!roundMatch) {
    return null;
  }

  const round = Number.parseInt(roundMatch[1], 10);
  const numberGroups = Array.from(decoded.matchAll(/q(\d{12})/g), (match) => match[1]);
  const numbers = numberGroups
    .map((segment) => Array.from({ length: 6 }, (_, index) => Number.parseInt(segment.slice(index * 2, index * 2 + 2), 10)))
    .filter(
      (set) =>
        set.length === 6 &&
        set.every((value) => Number.isInteger(value) && value >= 1 && value <= 45),
    );

  if (numbers.length === 0) {
    return null;
  }

  return {
    round,
    numbers,
    rawValue: trimmed,
  };
};

const KST_OFFSET = 9 * 60 * 60 * 1000;
const DRAW_HOUR = 20;
const DRAW_MINUTE = 35;

const toKstDate = (value: string | Date) => {
  const base = value instanceof Date ? value : new Date(value);
  return new Date(base.getTime() + KST_OFFSET);
};

const formatKstDateKey = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getNextDrawDateKey = (createdAt: string) => {
  const created = new Date(createdAt);

  if (!Number.isFinite(created.getTime())) {
    return null;
  }

  const createdKst = toKstDate(created);
  const weekday = createdKst.getUTCDay();
  const minutes = createdKst.getUTCHours() * 60 + createdKst.getUTCMinutes();
  const drawMinutes = DRAW_HOUR * 60 + DRAW_MINUTE;

  let daysUntilDraw = (6 - weekday + 7) % 7;

  if (daysUntilDraw === 0 && minutes > drawMinutes) {
    daysUntilDraw = 7;
  }

  const target = new Date(createdKst);
  target.setUTCDate(target.getUTCDate() + daysUntilDraw);

  return formatKstDateKey(target);
};

export const getReferenceDrawForDate = (createdAt: string, draws: LottoDraw[]) => {
  const targetDateKey = getNextDrawDateKey(createdAt);

  if (!targetDateKey) {
    return null;
  }

  return draws.find((draw) => draw.drawDate === targetDateKey) ?? null;
};
