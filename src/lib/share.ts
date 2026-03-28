"use client";

import type { SavedRecommendation } from "@/src/types/lotto";

type SharePayload = {
  title: string;
  subtitle: string;
  caption: string;
  numbers: number[][];
};

export type ClipboardSupport = {
  supported: boolean;
  reason?: "secure_context" | "clipboard_api" | "clipboard_item";
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
  const blob = await canvasToBlob(canvas);

  return blob.slice(0, blob.size, "image/png");
};

const downloadFile = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const copyTextWithExecCommand = (text: string) => {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  return copied;
};

export const downloadLottoNumbers = async (payload: SharePayload) => {
  const blob = await createShareBlob(payload);
  downloadFile(blob, `lotto-picker-${Date.now()}.png`);
  return "downloaded" as const;
};

export const shareLottoNumbers = async (payload: SharePayload) => {
  const blob = await createShareBlob(payload);
  const file = new File([blob], `lotto-picker-${Date.now()}.png`, {
    type: "image/png",
  });

  if (typeof navigator === "undefined" || !("share" in navigator)) {
    throw new Error("share unsupported");
  }

  const sharePayload =
    "canShare" in navigator && typeof navigator.canShare === "function"
      ? navigator.canShare({ files: [file] })
        ? { files: [file], title: payload.title, text: payload.caption }
        : { title: payload.title, text: payload.caption }
      : { files: [file], title: payload.title, text: payload.caption };

  await navigator.share(sharePayload);
  return "shared" as const;
};

export const copyLottoNumbersImage = async (payload: SharePayload) => {
  if (typeof document !== "undefined" && !document.hasFocus()) {
    throw new DOMException("Document is not focused.", "NotAllowedError");
  }

  const blob = await createShareBlob(payload);
  const ClipboardItemCtor =
    typeof ClipboardItem !== "undefined"
      ? ClipboardItem
      : typeof window !== "undefined" && "ClipboardItem" in window
        ? window.ClipboardItem
        : null;

  if (
    typeof window === "undefined" ||
    !window.isSecureContext
  ) {
    throw new Error("secure context required");
  }

  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard
  ) {
    throw new Error("clipboard unsupported");
  }

  if (!ClipboardItemCtor) {
    throw new Error("clipboard item unsupported");
  }

  if (
    "supports" in ClipboardItemCtor &&
    typeof ClipboardItemCtor.supports === "function" &&
    !ClipboardItemCtor.supports("image/png")
  ) {
    throw new Error("clipboard png unsupported");
  }

  await navigator.clipboard.write([
    new ClipboardItemCtor({
      "image/png": blob,
    }),
  ]);

  return "copied" as const;
};

export const copyLottoNumbersText = async (payload: SharePayload) => {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext
  ) {
    const text = payload.numbers
      .map((set, index) => `${index + 1}세트: ${set.join(", ")}`)
      .join("\n");

    if (copyTextWithExecCommand(text)) {
      return "copied" as const;
    }

    throw new Error("secure context required");
  }

  if (
    typeof navigator === "undefined" ||
    !navigator.clipboard
  ) {
    const text = payload.numbers
      .map((set, index) => `${index + 1}세트: ${set.join(", ")}`)
      .join("\n");

    if (copyTextWithExecCommand(text)) {
      return "copied" as const;
    }

    throw new Error("clipboard unsupported");
  }

  const text = payload.numbers
    .map((set, index) => `${index + 1}세트: ${set.join(", ")}`)
    .join("\n");

  try {
    await navigator.clipboard.writeText(text);
  } catch {
    if (copyTextWithExecCommand(text)) {
      return "copied" as const;
    }
    throw new Error("text clipboard failed");
  }

  return "copied" as const;
};

export const copyLottoNumbersImageWithFallback = async (payload: SharePayload) => {
  try {
    await copyLottoNumbersImage(payload);
    return {
      status: "copied" as const,
      message: "이미지를 클립보드에 복사했습니다.",
    };
  } catch (error) {
    try {
      await copyLottoNumbersText(payload);
      return {
        status: "copied_text" as const,
        message: "이미지 복사에 실패해 번호 텍스트를 클립보드에 복사했습니다.",
      };
    } catch (textError) {
      try {
        await shareLottoNumbers(payload);
        return {
          status: "shared" as const,
          message: "이미지 복사에 실패해 공유하기를 열었습니다.",
        };
      } catch (shareError) {
        await downloadLottoNumbers(payload);

        if (error instanceof DOMException && error.name === "NotAllowedError") {
          return {
            status: "downloaded" as const,
            message: "이미지 복사와 텍스트 복사에 실패해 PNG 파일로 저장했습니다.",
          };
        }

        if (error instanceof DOMException && error.name === "DataError") {
          return {
            status: "downloaded" as const,
            message: "브라우저가 이미지 클립보드를 지원하지 않아 PNG 파일로 저장했습니다.",
          };
        }

        if (error instanceof Error) {
          if (error.message === "secure context required") {
            return {
              status: "downloaded" as const,
              message: "보안 연결 제약으로 PNG 파일로 저장했습니다.",
            };
          }

          if (error.message === "clipboard unsupported" || error.message === "clipboard item unsupported") {
            return {
              status: "downloaded" as const,
              message: "현재 브라우저에서 이미지 복사를 지원하지 않아 PNG 파일로 저장했습니다.",
            };
          }

          if (error.message === "clipboard png unsupported") {
            return {
              status: "downloaded" as const,
              message: "현재 브라우저에서 PNG 복사를 지원하지 않아 PNG 파일로 저장했습니다.",
            };
          }
        }

        if (shareError instanceof DOMException && shareError.name === "AbortError") {
          return {
            status: "cancelled" as const,
            message: "공유가 취소되었습니다.",
          };
        }

        if (textError instanceof DOMException && textError.name === "NotAllowedError") {
          return {
            status: "downloaded" as const,
            message: "복사 권한이 없어 PNG 파일로 저장했습니다.",
          };
        }

        return {
          status: "downloaded" as const,
          message: "이미지 복사에 실패해 PNG 파일로 저장했습니다.",
        };
      }
    }
  }
};

export const getClipboardImageSupport = (): ClipboardSupport => {
  if (typeof window === "undefined" || !window.isSecureContext) {
    return { supported: false, reason: "secure_context" };
  }

  const ClipboardItemCtor =
    typeof ClipboardItem !== "undefined"
      ? ClipboardItem
      : typeof window !== "undefined" && "ClipboardItem" in window
        ? window.ClipboardItem
        : null;

  if (!navigator.clipboard) {
    return { supported: false, reason: "clipboard_api" };
  }

  if (!ClipboardItemCtor) {
    return { supported: false, reason: "clipboard_item" };
  }

  if (
    "supports" in ClipboardItemCtor &&
    typeof ClipboardItemCtor.supports === "function" &&
    !ClipboardItemCtor.supports("image/png")
  ) {
    return { supported: false, reason: "clipboard_item" };
  }

  return { supported: true };
};

export const createRecommendationSharePayload = (
  record: Pick<SavedRecommendation, "createdAt" | "mode" | "period" | "numbers">,
) => ({
  title: "로또 추천 5세트",
  subtitle: "",
  caption: "",
  numbers: record.numbers,
});
