export type LottoDraw = {
  round: number;
  drawDate: string;
  numbers: number[];
  bonus: number;
};

export type PeriodKey = "all" | "5y" | "2y" | "6m";

export type GenerationMode = "weighted" | "uniform" | "diversified";

export type SavedRecommendation = {
  id: string;
  createdAt: string;
  period: PeriodKey;
  mode: GenerationMode;
  numbers: number[][];
};

export type RemoteLottoDraw =
  | LottoDraw
  | {
      drwNo?: number;
      drwNoDate?: string;
      bnusNo?: number;
      drwtNo1?: number;
      drwtNo2?: number;
      drwtNo3?: number;
      drwtNo4?: number;
      drwtNo5?: number;
      drwtNo6?: number;
    }
  | {
      draw_no?: number;
      bonus_no?: number;
      date?: string;
      numbers?: number[];
    }
  | Record<string, unknown>;
