"use client";

import { startTransition, useEffect, useRef, useState } from "react";

import { MODE_OPTIONS, PERIOD_OPTIONS } from "@/src/lib/constants";
import {
  filterDrawsByPeriod,
  formatModeLabel,
  formatPeriodLabel,
  generateRecommendationBatch,
  getTopFrequencyNumbers,
  normalizeRemoteDraws,
} from "@/src/lib/lotto";
import { useCurrentResults } from "@/src/components/app-state-provider";
import {
  copyLottoNumbersImageWithFallback,
  copyLottoNumbersText,
  createRecommendationSharePayload,
  downloadLottoNumbers,
  getClipboardImageSupport,
} from "@/src/lib/share";
import { useSavedRecommendations } from "@/src/hooks/use-saved-recommendations";
import type { GenerationMode, LottoDraw, PeriodKey, SavedRecommendation } from "@/src/types/lotto";

import { LottoBall } from "@/src/components/lotto-ball";

const createSavedRecord = (
  period: PeriodKey,
  mode: GenerationMode,
  resultSets: number[][],
) : SavedRecommendation => {
  const createdAt = new Date().toISOString();
  const seed = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;

  return {
    id: `${createdAt}-${seed}`,
    createdAt,
    period,
    mode,
    numbers: resultSets,
  };
};

const ChoiceButtonGroup = <T extends string>({
  value,
  options,
  onChange,
  disabled = false,
  columns = 2,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (next: T) => void;
  disabled?: boolean;
  columns?: 2 | 3;
}) => {
  return (
    <div className={columns === 3 ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-3"}>
      {options.map((option) => {
        const active = option.key === value;

        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            disabled={disabled}
            className={`rounded-2xl px-4 py-4 text-sm font-semibold transition ${
              active
                ? "bg-sky-100 text-sky-900 ring-1 ring-sky-200 shadow-sm"
                : "bg-white text-slate-700 ring-1 ring-slate-200"
            } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export const LottoGenerator = () => {
  const [draws, setDraws] = useState<LottoDraw[]>([]);
  const [drawsError, setDrawsError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [mode, setMode] = useState<GenerationMode>("weighted");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareOptionsOpen, setShareOptionsOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [shouldFocusResults, setShouldFocusResults] = useState(false);
  const { results, setResults } = useCurrentResults();
  const { records, setRecords, loaded } = useSavedRecommendations();
  const resultsRef = useRef<HTMLElement | null>(null);
  const resultsSignature = JSON.stringify(results);
  const isAlreadySaved = results.length > 0 && records.some((record) => JSON.stringify(record.numbers) === resultsSignature);
  const clipboardSupport = getClipboardImageSupport();

  useEffect(() => {
    let active = true;

    const loadDraws = async () => {
      try {
        setDrawsError(null);
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
        if (active) {
          setDrawsError("회차 데이터를 불러오지 못했습니다.");
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadDraws();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!shouldFocusResults || results.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setShouldFocusResults(false);
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [results, shouldFocusResults]);

  const generate = () => {
    setIsGenerating(true);
    setShouldFocusResults(true);
    setShareOptionsOpen(false);
    setShareFeedback(null);
    startTransition(() => {
      setResults(generateRecommendationBatch(draws, period, mode, 5));
    });
    window.setTimeout(() => {
      setIsGenerating(false);
    }, 220);
  };

  const saveCurrentResults = () => {
    if (!loaded || results.length === 0 || isAlreadySaved) {
      return;
    }

    setIsSaving(true);
    startTransition(() => {
      const nextRecords = [createSavedRecord(period, mode, results), ...records];
      setRecords(nextRecords);
    });
    window.setTimeout(() => {
      setIsSaving(false);
    }, 220);
  };

  const sharePayload = createRecommendationSharePayload({
    createdAt: new Date().toISOString(),
    period,
    mode,
    numbers: results,
  });

  const downloadCurrentResults = async () => {
    if (results.length === 0 || isSharing) {
      return;
    }

    setIsSharing(true);
    setShareFeedback(null);

    try {
      await downloadLottoNumbers(sharePayload);
      setShareFeedback("PNG 파일로 저장했습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setShareFeedback("저장이 취소되었습니다.");
      } else {
        setShareFeedback("PNG 파일을 저장하지 못했습니다.");
      }
    } finally {
      setShareOptionsOpen(false);
      setIsSharing(false);
    }
  };

  const copyCurrentResults = async () => {
    if (results.length === 0 || isSharing) {
      return;
    }

    setIsSharing(true);
    setShareFeedback(null);

    try {
      const result = await copyLottoNumbersImageWithFallback(sharePayload);
      setShareFeedback(result.message);
    } catch {
      setShareFeedback("이미지를 복사하지 못했습니다.");
    } finally {
      setShareOptionsOpen(false);
      setIsSharing(false);
    }
  };

  const copyCurrentResultsText = async () => {
    if (results.length === 0 || isSharing) {
      return;
    }

    setIsSharing(true);
    setShareFeedback(null);

    try {
      await copyLottoNumbersText(sharePayload);
      setShareFeedback("번호를 클립보드에 복사했습니다.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setShareFeedback("클립보드 권한이 필요합니다.");
      } else if (error instanceof Error && error.message === "secure context required") {
        setShareFeedback("보안 연결에서만 복사할 수 있습니다.");
      } else {
        setShareFeedback("번호를 복사하지 못했습니다.");
      }
    } finally {
      setShareOptionsOpen(false);
      setIsSharing(false);
    }
  };

  const openShareOptions = () => {
    if (results.length === 0 || isSharing) {
      return;
    }

    setShareFeedback(null);
    setShareOptionsOpen(true);
  };

  const periodDraws = filterDrawsByPeriod(draws, period);
  const infoDraws = periodDraws;
  const topNumbers = getTopFrequencyNumbers(infoDraws, 6);
  const effectivePeriodCount = periodDraws.length;
  const periodDisabled = mode !== "weighted";

  return (
    <div className="space-y-5">
      {drawsError ? (
        <div className="rounded-[24px] bg-rose-50/90 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-100">
          {drawsError}
        </div>
      ) : null}
      <section className="rounded-[28px] bg-white/90 p-5 shadow-sm ring-1 ring-slate-200">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">기간 선택</p>
            <div className="mt-3">
              <ChoiceButtonGroup
                value={period}
                options={PERIOD_OPTIONS}
                onChange={setPeriod}
                disabled={periodDisabled}
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-500">모드 선택</p>
            <div className="mt-3">
              <ChoiceButtonGroup
                value={mode}
                options={MODE_OPTIONS}
                onChange={setMode}
                columns={3}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={generate}
            disabled={isLoading}
            className={`w-full rounded-2xl px-5 py-4 text-base font-bold text-white transition active:scale-[0.985] disabled:cursor-not-allowed ${
              isGenerating
                ? "bg-emerald-600 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]"
                : "bg-emerald-500"
            } disabled:bg-emerald-300`}
          >
            {isGenerating ? "생성 중" : "번호 생성"}
          </button>

        </div>
      </section>

      <section className="rounded-[32px] bg-white/80 p-5 shadow-sm ring-1 ring-white/80 backdrop-blur">
        <div className="space-y-4">
          <div className="rounded-[28px] bg-[linear-gradient(135deg,#fff8ee_0%,#eef8ff_52%,#f4fff8_100%)] px-4 py-4 ring-1 ring-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xl font-black text-slate-900">{formatPeriodLabel(period)}</p>
                {isLoading ? (
                  <span className="mt-2 block h-4 w-24 animate-pulse rounded-full bg-white/80" />
                ) : (
                  <p className="mt-1 text-sm text-slate-500">{effectivePeriodCount}회차 데이터</p>
                )}
              </div>
              <div className="rounded-full bg-white/85 px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-white/90">
                {formatModeLabel(mode)}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] bg-slate-50/90 px-4 py-4 ring-1 ring-white/80">
            {isLoading ? (
              <div>
                <span className="block h-4 w-20 animate-pulse rounded-full bg-white" />
                <div className="mt-3 grid grid-cols-6 gap-1.5">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="flex flex-col items-center gap-1">
                      <span className="h-10 w-10 animate-pulse rounded-full bg-white ring-1 ring-slate-200 sm:h-11 sm:w-11" />
                      <span className="h-3 w-8 animate-pulse rounded-full bg-white" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-900">
                    {`${periodDraws.length}회차 기준`}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-6 gap-1.5">
                  {topNumbers.map((item) => (
                    <div key={item.value} className="flex flex-col items-center gap-1">
                      <LottoBall value={item.value} />
                      <span className="text-[11px] font-medium text-slate-500">
                        {item.count}회
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section
        ref={resultsRef}
        className="rounded-[32px] bg-white/80 p-5 shadow-sm ring-1 ring-white/80 backdrop-blur"
      >
        <div className="space-y-2">
          {results.length === 0 ? (
            <div className="rounded-[24px] bg-slate-50/90 px-4 py-5 text-sm text-slate-500 ring-1 ring-white/80">
              버튼을 눌러 5세트를 생성하세요.
            </div>
          ) : (
            results.map((numbers, index) => (
              <div
                key={`${numbers.join("-")}-${index}`}
                className="rounded-[24px] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbfd_100%)] px-2.5 py-2.5 ring-1 ring-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
              >
                <div className="grid grid-cols-6 justify-items-center gap-1.5">
                  {numbers.map((value) => (
                    <LottoBall key={`${index}-${value}`} value={value} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {results.length > 0 ? (
          <div className="mt-5 rounded-[28px] bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(244,249,255,0.92)_100%)] p-2 ring-1 ring-white/90 shadow-[0_14px_30px_rgba(148,163,184,0.10)]">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={generate}
                disabled={isLoading || isGenerating}
                className="rounded-2xl bg-[linear-gradient(135deg,#def7e9_0%,#cef1dd_100%)] px-4 py-3.5 text-sm font-semibold text-emerald-950 ring-1 ring-emerald-200 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? "생성 중" : "재생성"}
              </button>
              <button
                type="button"
                onClick={saveCurrentResults}
                disabled={!loaded || results.length === 0 || isAlreadySaved}
                className={`rounded-2xl px-4 py-3.5 text-sm font-semibold transition active:scale-[0.985] disabled:cursor-not-allowed ${
                  isSaving
                    ? "bg-[linear-gradient(135deg,#cfe8ff_0%,#badcff_100%)] text-sky-950 shadow-[0_0_0_4px_rgba(96,165,250,0.12)] ring-1 ring-sky-200"
                    : "bg-[linear-gradient(135deg,#dceeff_0%,#c8e3ff_100%)] text-sky-950 ring-1 ring-sky-200"
                } disabled:bg-slate-100 disabled:text-slate-400 disabled:ring-slate-200`}
              >
                저장
              </button>
            <button
              type="button"
              onClick={openShareOptions}
              disabled={isSharing}
              className="rounded-2xl bg-[linear-gradient(135deg,#fff5d1_0%,#ffe8a3_100%)] px-4 py-3.5 text-sm font-semibold text-amber-950 ring-1 ring-amber-200 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
            >
              공유
            </button>
          </div>
          </div>
        ) : null}
        {shareFeedback ? <p className="mt-2 text-sm text-slate-500">{shareFeedback}</p> : null}

      </section>

      {shareOptionsOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/28 p-4 sm:items-center">
          <button
            type="button"
            aria-label="공유 선택 닫기"
            onClick={() => setShareOptionsOpen(false)}
            className="absolute inset-0"
          />
          <div className="relative z-10 w-full max-w-sm rounded-[28px] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.18)] ring-1 ring-slate-200">
            <div className="mb-3">
              <p className="text-base font-bold text-slate-900">공유 방식 선택</p>
              <p className="mt-1 text-sm text-slate-500">이미지를 저장하거나 번호를 복사할 수 있습니다.</p>
            </div>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={downloadCurrentResults}
                disabled={isSharing}
                className="rounded-2xl bg-[linear-gradient(135deg,#fff7de_0%,#ffefbf_100%)] px-4 py-3.5 text-sm font-semibold text-amber-950 ring-1 ring-amber-200 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
              >
                PNG 저장
              </button>
              {clipboardSupport.reason !== "samsung_browser" ? (
                <button
                  type="button"
                  onClick={copyCurrentResults}
                  disabled={isSharing}
                  className="rounded-2xl bg-[linear-gradient(135deg,#f4edff_0%,#e8ddff_100%)] px-4 py-3.5 text-sm font-semibold text-violet-950 ring-1 ring-violet-200 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  이미지 복사
                </button>
              ) : null}
              <button
                type="button"
                onClick={copyCurrentResultsText}
                disabled={isSharing}
                className="rounded-2xl bg-[linear-gradient(135deg,#eef2ff_0%,#dfe7ff_100%)] px-4 py-3.5 text-sm font-semibold text-indigo-950 ring-1 ring-indigo-200 transition active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
              >
                텍스트 복사
              </button>
              <button
                type="button"
                onClick={() => setShareOptionsOpen(false)}
                className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition active:scale-[0.985]"
              >
                취소
              </button>
            </div>
            {!clipboardSupport.supported ? (
              <p className="mt-3 text-sm text-slate-500">
                {clipboardSupport.reason === "samsung_browser"
                  ? "삼성 브라우저에서는 이미지 복사 대신 PNG 저장 또는 텍스트 복사를 사용해 주세요."
                  : clipboardSupport.reason === "secure_context"
                    ? "보안 연결에서만 이미지 복사를 시도할 수 있습니다."
                    : "이미지 복사가 실패하면 다른 방식으로 자동 처리됩니다."}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
