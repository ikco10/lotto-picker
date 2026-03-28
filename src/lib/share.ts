"use client";

import type { SavedRecommendation } from "@/src/types/lotto";

type SharePayload = {
  title: string;
  subtitle: string;
  caption: string;
  numbers: number[][];
};

const WIDTH = 960;
const OUTER_PADDING = 32;
const SET_HEIGHT = 124;
const SET_GAP = 18;
const BALL_RADIUS = 44;
const BALL_STEP = 124;
const COLORS = {
  backgroundTop: "#f8fbff",
  backgroundBottom: "#f5fbf8",
  card: "#ffffff",
  border: "#e7eef6",
  number: "#0f172a",
};

const BALL_COLORS = [
  "#fde68a",
  "#bfdbfe",
  "#fecdd3",
  "#bbf7d0",
  "#ddd6fe",
];

const numberFill = (value: number) => {
  if (value <= 10) {
    return BALL_COLORS[0];
  }
  if (value <= 20) {
    return BALL_COLORS[1];
  }
  if (value <= 30) {
    return BALL_COLORS[2];
  }
  if (value <= 40) {
    return BALL_COLORS[3];
  }
  return BALL_COLORS[4];
};

const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image load failed"));
    image.src = url;
  });

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("blob create failed"));
        return;
      }
      resolve(blob);
    }, "image/png");
  });

const createSvgMarkup = ({ numbers }: SharePayload) => {
  const contentHeight =
    numbers.length * SET_HEIGHT + Math.max(0, numbers.length - 1) * SET_GAP;
  const height = OUTER_PADDING * 2 + contentHeight;
  const cardWidth = WIDTH - OUTER_PADDING * 2;
  const ballsWidth = BALL_RADIUS * 2 + BALL_STEP * (Math.max(0, numbers[0]?.length ?? 0) - 1);
  const ballStartX = OUTER_PADDING + (cardWidth - ballsWidth) / 2 + BALL_RADIUS;

  const setsMarkup = numbers
    .map((set, index) => {
      const top = OUTER_PADDING + index * (SET_HEIGHT + SET_GAP);

      const balls = set
        .map((value, ballIndex) => {
          const cx = ballStartX + ballIndex * BALL_STEP;
          const cy = top + SET_HEIGHT / 2;
          const fill = numberFill(value);

          return `
            <circle cx="${cx}" cy="${cy}" r="${BALL_RADIUS}" fill="${fill}" stroke="rgba(15,23,42,0.05)" />
            <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-family="Pretendard Variable, Pretendard, Noto Sans KR, sans-serif" font-size="36" font-weight="700" letter-spacing="-0.7" fill="${COLORS.number}">
              ${value}
            </text>
          `;
        })
        .join("");

      return `
        <rect x="${OUTER_PADDING}" y="${top}" width="${WIDTH - OUTER_PADDING * 2}" height="${SET_HEIGHT}" rx="28" fill="${COLORS.card}" stroke="${COLORS.border}" />
        ${balls}
      `;
    })
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${COLORS.backgroundTop}" />
          <stop offset="100%" stop-color="${COLORS.backgroundBottom}" />
        </linearGradient>
      </defs>
      <rect width="${WIDTH}" height="${height}" rx="32" fill="url(#bg)" />
      ${setsMarkup}
    </svg>
  `;
};

const createShareBlob = async (payload: SharePayload) => {
  const svg = createSvgMarkup(payload);
  const svgUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  const image = await loadImage(svgUrl);
  const canvas = document.createElement("canvas");
  const contentHeight =
    payload.numbers.length * SET_HEIGHT + Math.max(0, payload.numbers.length - 1) * SET_GAP;
  const height = OUTER_PADDING * 2 + contentHeight;

  canvas.width = WIDTH;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("canvas unsupported");
  }

  context.drawImage(image, 0, 0, WIDTH, height);

  return canvasToBlob(canvas);
};

const downloadFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const downloadLottoNumbers = async (payload: SharePayload) => {
  const blob = await createShareBlob(payload);
  downloadFile(blob, `lotto-picker-${Date.now()}.png`);
  return "downloaded" as const;
};

export const copyLottoNumbersImage = async (payload: SharePayload) => {
  const blob = await createShareBlob(payload);
  const ClipboardItemCtor =
    typeof ClipboardItem !== "undefined"
      ? ClipboardItem
      : typeof window !== "undefined" && "ClipboardItem" in window
        ? window.ClipboardItem
        : null;

  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard ||
    !ClipboardItemCtor
  ) {
    throw new Error("clipboard unsupported");
  }

  await navigator.clipboard.write([
    new ClipboardItemCtor({
      "image/png": blob,
    }),
  ]);

  return "copied" as const;
};

export const createRecommendationSharePayload = (
  record: Pick<SavedRecommendation, "createdAt" | "mode" | "period" | "numbers">,
) => ({
  title: "로또 추천 5세트",
  subtitle: "",
  caption: "",
  numbers: record.numbers,
});
