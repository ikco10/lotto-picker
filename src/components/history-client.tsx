"use client";

import { startTransition, useEffect, useMemo, useState } from "react";

import { sampleDraws } from "@/src/data/lotto-sample";
import { useSavedRecommendations } from "@/src/hooks/use-saved-recommendations";
import {
  formatMatchSummaryLabel,
  formatModeLabel,
  formatPeriodLabel,
  getReferenceDrawForDate,
  getMatchSummary,
  normalizeRemoteDraws,
} from "@/src/lib/lotto";
import {
  copyLottoNumbersImageWithFallback,
  copyLottoNumbersText,
  createRecommendationSharePayload,
  downloadLottoNumbers,
} from "@/src/lib/share";
import type { LottoDraw, SavedRecommendation } from "@/src/types/lotto";

import { LottoBall } from "@/src/components/lotto-ball";

const dateLabel = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
  }).format(new Date(value));

const timeLabel = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeStyle: "short",
  }).format(new Date(value));

export const HistoryClient = () => {
  const { records, setRecords, loaded } = useSavedRecommendations();
  const [draws, setDraws] = useState<LottoDraw[]>(sampleDraws);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<"latest" | "oldest">("latest");
  const [shareState, setShareState] = useState<Record<string, string>>({});

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

  const filteredRecords = useMemo(() => {
    const next = [...records];

    next.sort((a, b) =>
      sortOrder === "latest"
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt),
    );

    return next;
  }, [records, sortOrder]);

  const groupedRecords = filteredRecords.reduce<Record<string, SavedRecommendation[]>>((accumulator, record) => {
    const groupKey = record.createdAt.slice(0, 10);
    accumulator[groupKey] ??= [];
    accumulator[groupKey].push(record);
    return accumulator;
  }, {});
  const latestDraw = draws.at(-1) ?? sampleDraws.at(-1) ?? null;

  const deleteRecord = (id: string) => {
    startTransition(() => {
      setRecords(records.filter((record) => record.id !== id));
      setSelectedIds((current) => current.filter((recordId) => recordId !== id));
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0 || !window.confirm("선택한 기록을 삭제할까요?")) {
      return;
    }

    const selectedSet = new Set(selectedIds);

    startTransition(() => {
      setRecords(records.filter((record) => !selectedSet.has(record.id)));
      setSelectedIds([]);
    });
  };

  const deleteAll = () => {
    if (records.length === 0 || !window.confirm("저장된 기록을 모두 삭제할까요?")) {
      return;
    }

    startTransition(() => {
      setRecords([]);
      setSelectedIds([]);
    });
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredRecords.map((record) => record.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const downloadRecord = async (record: SavedRecommendation) => {
    setShareState((current) => ({ ...current, [record.id]: "이미지 준비 중" }));

    try {
      await downloadLottoNumbers(createRecommendationSharePayload(record));
      setShareState((current) => ({
        ...current,
        [record.id]: "PNG 파일로 저장했습니다.",
      }));
    } catch (error) {
      setShareState((current) => ({
        ...current,
        [record.id]:
          error instanceof DOMException && error.name === "AbortError"
            ? "저장이 취소되었습니다."
            : "PNG 파일을 저장하지 못했습니다.",
      }));
    }
  };

  const copyRecord = async (record: SavedRecommendation) => {
    setShareState((current) => ({ ...current, [record.id]: "이미지 준비 중" }));

    try {
      const result = await copyLottoNumbersImageWithFallback(createRecommendationSharePayload(record));
      setShareState((current) => ({
        ...current,
        [record.id]: result.message,
      }));
    } catch (error) {
      setShareState((current) => ({
        ...current,
        [record.id]:
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "클립보드 권한이 필요합니다."
            : "이미지를 복사하지 못했습니다.",
      }));
    }
  };

  const copyRecordText = async (record: SavedRecommendation) => {
    setShareState((current) => ({ ...current, [record.id]: "텍스트 준비 중" }));

    try {
      await copyLottoNumbersText(createRecommendationSharePayload(record));
      setShareState((current) => ({
        ...current,
        [record.id]: "번호를 클립보드에 복사했습니다.",
      }));
    } catch (error) {
      setShareState((current) => ({
        ...current,
        [record.id]:
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "클립보드 권한이 필요합니다."
            : "번호를 복사하지 못했습니다.",
      }));
    }
  };

  if (!loaded) {
    return (
      <div className="rounded-[32px] bg-white/80 p-5 text-sm text-slate-500 shadow-sm ring-1 ring-white/80 backdrop-blur">
        기록을 불러오는 중입니다.
      </div>
    );
  }

  const entries = Object.entries(groupedRecords);
  const visibleIds = filteredRecords.map((record) => record.id);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        <section className="rounded-[28px] bg-white/85 p-3.5 shadow-sm ring-1 ring-white/80 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-600">기록 정렬</p>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as "latest" | "oldest")}
              className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 outline-none"
            >
              <option value="latest">최신순</option>
              <option value="oldest">오래된순</option>
            </select>
          </div>
        </section>

        <div className="rounded-[32px] bg-white/80 p-5 text-sm text-slate-500 shadow-sm ring-1 ring-white/80 backdrop-blur">
          저장된 기록이 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] bg-white/85 p-3.5 shadow-sm ring-1 ring-white/80 backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-700">저장된 기록</p>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
              {filteredRecords.length}개
            </span>
            {latestDraw ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                최신 {latestDraw.round}회차
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="inline-flex rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200">
              <button
                type="button"
                onClick={() => setSortOrder("latest")}
                className={`min-w-18 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  sortOrder === "latest"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                최신순
              </button>
              <button
                type="button"
                onClick={() => setSortOrder("oldest")}
                className={`min-w-18 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  sortOrder === "oldest"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500"
                }`}
              >
                오래된순
              </button>
            </div>
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className={`min-w-24 rounded-xl px-3 py-2 text-sm font-semibold ring-1 transition ${
                allVisibleSelected
                  ? "bg-slate-900 text-white ring-slate-900"
                  : "bg-slate-50 text-slate-700 ring-slate-200"
              }`}
            >
              전체선택
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={selectedIds.length === 0}
              className="min-w-24 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-rose-600 ring-1 ring-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              선택삭제
            </button>
            <button
              type="button"
              onClick={deleteAll}
              disabled={records.length === 0}
              className="min-w-24 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              전체삭제
            </button>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
              선택 {selectedIds.length}
            </span>
          </div>
        </div>
      </section>

      {entries.map(([groupKey, items]) => (
        <section
          key={groupKey}
          className="rounded-[30px] bg-white/80 p-4 shadow-sm ring-1 ring-white/80 backdrop-blur"
        >
          <h2 className="text-base font-bold text-slate-900">{dateLabel(items[0].createdAt)}</h2>
          <div className="mt-3 space-y-3">
            {items.map((record) => {
              const referenceDraw = getReferenceDrawForDate(record.createdAt, draws);

              return (
                <article
                  key={record.id}
                  className="rounded-[22px] bg-[linear-gradient(135deg,#ffffff_0%,#f7fbfd_100%)] px-3.5 py-3 ring-1 ring-white/90"
                >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-start gap-2.5">
                    <label className="mt-0.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(record.id)}
                        onChange={() => toggleSelect(record.id)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900"
                      />
                    </label>
                    <div className="text-sm leading-5 text-slate-600">
                      <p className="font-semibold text-slate-900">{timeLabel(record.createdAt)}</p>
                      <p>{formatPeriodLabel(record.period)} · {formatModeLabel(record.mode)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => downloadRecord(record)}
                      className="rounded-xl bg-[linear-gradient(135deg,#fff5d1_0%,#ffe8a3_100%)] px-3 py-1.5 text-sm font-semibold text-amber-950 ring-1 ring-amber-200"
                    >
                      PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => copyRecord(record)}
                      className="rounded-xl bg-[linear-gradient(135deg,#f4edff_0%,#e8ddff_100%)] px-3 py-1.5 text-sm font-semibold text-violet-950 ring-1 ring-violet-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      이미지
                    </button>
                    <button
                      type="button"
                      onClick={() => copyRecordText(record)}
                      className="rounded-xl bg-[linear-gradient(135deg,#eef2ff_0%,#dfe7ff_100%)] px-3 py-1.5 text-sm font-semibold text-indigo-950 ring-1 ring-indigo-200"
                    >
                      텍스트
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRecord(record.id)}
                      className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-rose-600 ring-1 ring-rose-200"
                    >
                      삭제
                    </button>
                  </div>
                </div>
                {shareState[record.id] ? (
                  <p className="mt-2 text-sm text-slate-500">{shareState[record.id]}</p>
                ) : null}
                <div className="mt-3 space-y-1.5">
                  {record.numbers.map((set, index) => (
                    <div key={`${record.id}-${index}`} className="rounded-[18px] bg-white/70 px-2.5 py-2 ring-1 ring-white/90">
                      <div className="grid grid-cols-6 justify-items-center gap-1.5">
                        {set.map((value) => (
                          <LottoBall
                            key={`${record.id}-${index}-${value}`}
                            value={value}
                            className={
                              referenceDraw
                                ? referenceDraw.numbers.includes(value)
                                  ? "ring-2 ring-emerald-400 shadow-[0_8px_18px_rgba(16,185,129,0.18)]"
                                  : "opacity-45"
                                : ""
                            }
                          />
                        ))}
                      </div>
                      {referenceDraw ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {(() => {
                            const summary = getMatchSummary(set, referenceDraw);

                            return (
                              <>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                  {referenceDraw.round}회차 기준
                                </span>
                                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-100">
                                  {formatMatchSummaryLabel(summary)}
                                </span>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                                    summary.rank
                                      ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                                      : "bg-slate-50 text-slate-500 ring-slate-200"
                                  }`}
                                >
                                  {summary.rank ? `${summary.rank}등` : "낙첨"}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="mt-2">
                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                            현재 미추첨
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};
