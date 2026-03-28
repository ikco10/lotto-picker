"use client";

import { useEffect, useRef, useState } from "react";

import { sampleDraws } from "@/src/data/lotto-sample";
import { LottoBall } from "@/src/components/lotto-ball";
import {
  getMatchSummary,
  normalizeRemoteDraws,
  parseLottoQrValue,
} from "@/src/lib/lotto";
import type { ParsedQrTicket } from "@/src/lib/lotto";
import type { LottoDraw } from "@/src/types/lotto";

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
  const [draws, setDraws] = useState<LottoDraw[]>(sampleDraws);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("이미지를 선택하면 QR 코드를 읽습니다.");
  const [ticket, setTicket] = useState<ParsedQrTicket | null>(null);
  const [rawQrValue, setRawQrValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const detectorSupported = getBarcodeDetector() !== null;

  useEffect(() => {
    let active = true;

    const loadDraws = async () => {
      try {
        const response = await fetch("/api/lotto", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("fetch failed");
        }

        const data = await response.json();
        const normalized = normalizeRemoteDraws(data.draws);

        if (active && normalized.length > 0) {
          setDraws(normalized);
        }
      } catch {
      }
    };

    void loadDraws();

    return () => {
      active = false;
    };
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }
    setStatus("loading");
    setMessage("QR 코드를 읽는 중입니다.");
    setTicket(null);
    setRawQrValue(null);

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

      const detectedValue = detections[0].rawValue;
      setRawQrValue(detectedValue);
      const parsed = parseLottoQrValue(detectedValue);

      if (!parsed) {
        setStatus("error");
        setMessage("QR은 읽었지만 로또 형식을 해석하지 못했습니다.");
        return;
      }

      setTicket(parsed);
      setStatus("success");
      setMessage("QR 코드를 읽었습니다.");
    } catch {
      setStatus("error");
      setMessage("이미지 QR 인식에 실패했습니다. 다른 이미지로 다시 시도해 주세요.");
    }
  };

  const reset = () => {
    setStatus("idle");
    setMessage("이미지를 선택하면 QR 코드를 읽습니다.");
    setTicket(null);
    setRawQrValue(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const draw = ticket ? draws.find((item) => item.round === ticket.round) ?? null : null;

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
            {status !== "idle" ? (
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
          <div className="rounded-[24px] bg-slate-50/90 px-4 py-4 ring-1 ring-white/80">
            <p className="text-sm font-semibold text-slate-900">
              {status === "loading" ? "분석 중" : status === "success" ? "인식 완료" : status === "error" ? "인식 실패" : "대기 중"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
          </div>

          {ticket ? (
            <div className="space-y-4">
              <div className="rounded-[24px] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbfd_100%)] px-4 py-4 ring-1 ring-white/90">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-black text-slate-900">{ticket.round}회차</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {draw ? `${draw.drawDate} 추첨 기준` : "현재 미추첨 또는 결과 데이터 없음"}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                    {ticket.numbers.length}세트
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {ticket.numbers.map((set, index) => {
                  const summary = draw ? getMatchSummary(set, draw) : null;

                  return (
                    <div
                      key={`${ticket.round}-${index}`}
                      className="rounded-[22px] bg-[linear-gradient(135deg,#ffffff_0%,#f7fbfd_100%)] px-3.5 py-3 ring-1 ring-white/90"
                    >
                      <div className="grid grid-cols-6 justify-items-center gap-1.5">
                        {set.map((value) => (
                          <LottoBall
                            key={`${ticket.round}-${index}-${value}`}
                            value={value}
                            className={
                              draw
                                ? draw.numbers.includes(value)
                                  ? "ring-2 ring-emerald-400 shadow-[0_8px_18px_rgba(16,185,129,0.18)]"
                                  : "opacity-45"
                                : ""
                            }
                          />
                        ))}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                          {index + 1}세트
                        </span>
                        {draw ? (
                          <>
                            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
                              {summary?.matchCount ?? 0}개 일치{summary?.bonusMatched ? " + 보너스" : ""}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                                summary?.rank
                                  ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                                  : "bg-slate-50 text-slate-500 ring-slate-200"
                              }`}
                            >
                              {summary?.rank ? `${summary.rank}등` : "낙첨"}
                            </span>
                          </>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                            현재 미추첨
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-[24px] bg-slate-50/90 px-4 py-8 text-center text-sm text-slate-500 ring-1 ring-white/80">
                {rawQrValue
                  ? "QR 원문은 읽었지만 로또 형식으로 변환하지 못했습니다."
                  : "아직 읽은 QR 결과가 없습니다."}
              </div>
              {rawQrValue ? (
                <div className="rounded-[24px] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbfd_100%)] px-4 py-4 ring-1 ring-white/90">
                  <p className="text-sm font-semibold text-slate-900">읽은 QR 원문</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-sm leading-6 text-slate-600">
                    {rawQrValue}
                  </pre>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
