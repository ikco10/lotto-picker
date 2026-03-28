"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type BarcodeDetectorResult = {
  rawValue?: string;
};

type BarcodeDetectorLike = {
  detect: (image: ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas) => Promise<BarcodeDetectorResult[]>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const getBarcodeDetector = (): BarcodeDetectorCtor | null => {
  if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
    return null;
  }

  return window.BarcodeDetector as BarcodeDetectorCtor;
};

export const QrScannerClient = () => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("이미지를 선택하면 QR 코드를 읽습니다.");
  const [result, setResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const detectorSupported = getBarcodeDetector() !== null;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const nextPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(nextPreviewUrl);
    setStatus("loading");
    setMessage("QR 코드를 읽는 중입니다.");
    setResult(null);

    const Detector = getBarcodeDetector();

    if (!Detector) {
      setStatus("error");
      setMessage("이 브라우저는 이미지 QR 인식을 지원하지 않습니다. 모바일 크롬에서 시도해 주세요.");
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const detector = new Detector({ formats: ["qr_code"] });
      const detections = await detector.detect(bitmap);
      bitmap.close();

      if (detections.length === 0 || !detections[0].rawValue) {
        setStatus("error");
        setMessage("QR 코드를 찾지 못했습니다. 더 선명한 이미지로 다시 시도해 주세요.");
        return;
      }

      setResult(detections[0].rawValue);
      setStatus("success");
      setMessage("QR 코드를 읽었습니다.");
    } catch {
      setStatus("error");
      setMessage("이미지 QR 인식에 실패했습니다. 다른 이미지로 다시 시도해 주세요.");
    }
  };

  const reset = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    setStatus("idle");
    setMessage("이미지를 선택하면 QR 코드를 읽습니다.");
    setResult(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[32px] bg-white/85 p-5 shadow-sm ring-1 ring-white/80 backdrop-blur">
        <div className="space-y-4">
          <div>
            <p className="text-2xl font-black text-slate-900">QR로 당첨 확인</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              휴대폰에 저장된 로또 QR 이미지를 올리면 우선 QR 원문을 읽어옵니다.
            </p>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-[28px] border border-dashed border-slate-300 bg-[linear-gradient(135deg,#fffdf8_0%,#f3f9ff_100%)] px-5 py-10 text-center transition hover:border-slate-400">
            <span className="text-base font-bold text-slate-900">이미지 선택</span>
            <span className="mt-2 text-sm text-slate-500">PNG, JPG, HEIC 스크린샷 업로드</span>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                detectorSupported
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                  : "bg-amber-50 text-amber-700 ring-amber-100"
              }`}
            >
              {detectorSupported ? "이 브라우저에서 QR 인식 가능" : "이 브라우저에서 QR 인식 미지원"}
            </span>
            {previewUrl ? (
              <button
                type="button"
                onClick={reset}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
              >
                초기화
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] bg-white/80 p-5 shadow-sm ring-1 ring-white/80 backdrop-blur">
        <div className="space-y-4">
          {previewUrl ? (
            <div className="overflow-hidden rounded-[24px] ring-1 ring-slate-200">
              <Image
                src={previewUrl}
                alt="업로드한 QR 이미지 미리보기"
                width={1200}
                height={1200}
                className="block h-auto w-full object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="rounded-[24px] bg-slate-50/90 px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-white/80">
              아직 업로드한 이미지가 없습니다.
            </div>
          )}

          <div className="rounded-[24px] bg-slate-50/90 px-4 py-4 ring-1 ring-white/80">
            <p className="text-sm font-semibold text-slate-900">
              {status === "loading" ? "분석 중" : status === "success" ? "인식 완료" : status === "error" ? "인식 실패" : "대기 중"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
          </div>

          <div className="rounded-[24px] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbfd_100%)] px-4 py-4 ring-1 ring-white/90">
            <p className="text-sm font-semibold text-slate-900">읽어온 QR 원문</p>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-sm leading-6 text-slate-600">
              {result ?? "아직 읽은 결과가 없습니다."}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
};
