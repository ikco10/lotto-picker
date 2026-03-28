import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMatchSummaryLabel,
  getMatchSummary,
  getReferenceDrawForDate,
  normalizeRemoteDraws,
  parseLottoQrValue,
} from "@/src/lib/lotto";

test("normalizeRemoteDraws supports multiple upstream formats and sorts by round", () => {
  const draws = normalizeRemoteDraws([
    {
      draw_no: 1216,
      numbers: [13, 19, 21, 25, 35, 37],
      bonus_no: 7,
      date: "2026-03-28T00:00:00Z",
    },
    {
      drwNo: 1214,
      drwNoDate: "2026-03-14",
      drwtNo1: 1,
      drwtNo2: 2,
      drwtNo3: 3,
      drwtNo4: 4,
      drwtNo5: 5,
      drwtNo6: 6,
      bnusNo: 7,
    },
    {
      round: 1215,
      drawDate: "2026-03-21",
      numbers: [11, 22, 33, 44, 5, 6],
      bonus: 7,
    },
  ]);

  assert.deepEqual(
    draws.map((draw) => draw.round),
    [1214, 1215, 1216],
  );
  assert.deepEqual(draws[1]?.numbers, [5, 6, 11, 22, 33, 44]);
});

test("parseLottoQrValue parses the lotto qr url payload format", () => {
  const parsed = parseLottoQrValue(
    "http://qr.dhlottery.co.kr/?v=1216m131921253537m102630374243m011226293640m071013364044m021623293643122230566614190050",
  );

  assert.ok(parsed);
  assert.equal(parsed.round, 1216);
  assert.deepEqual(parsed.numbers[0], [13, 19, 21, 25, 35, 37]);
  assert.deepEqual(parsed.numbers[4], [2, 16, 23, 29, 36, 43]);
  assert.equal(parsed.numbers.length, 5);
});

test("getReferenceDrawForDate returns the matching upcoming draw and null when not yet available", () => {
  const draws = [
    {
      round: 1216,
      drawDate: "2026-03-28",
      numbers: [13, 19, 21, 25, 35, 37],
      bonus: 7,
    },
    {
      round: 1217,
      drawDate: "2026-04-04",
      numbers: [1, 2, 3, 4, 5, 6],
      bonus: 7,
    },
  ];

  assert.equal(
    getReferenceDrawForDate("2026-03-28T01:43:00.000Z", draws)?.round,
    1216,
  );
  assert.equal(
    getReferenceDrawForDate("2026-03-28T12:00:00.000Z", draws)?.round,
    1217,
  );
  assert.equal(
    getReferenceDrawForDate("2026-04-11T01:00:00.000Z", draws),
    null,
  );
});

test("match labels only include bonus when the ticket qualifies for second place", () => {
  const draw = {
    round: 1216,
    drawDate: "2026-03-28",
    numbers: [1, 2, 3, 4, 5, 6],
    bonus: 7,
  };

  assert.equal(
    formatMatchSummaryLabel(getMatchSummary([1, 2, 3, 4, 5, 7], draw)),
    "5개 일치 + 보너스",
  );
  assert.equal(
    formatMatchSummaryLabel(getMatchSummary([7, 8, 9, 10, 11, 12], draw)),
    "0개 일치",
  );
});
