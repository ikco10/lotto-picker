import { LOTTO_DATA_SOURCES } from "@/src/lib/constants";
import { normalizeRemoteDraws } from "@/src/lib/lotto";
import type { LottoDraw } from "@/src/types/lotto";

const API_CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5_000;

type CachedLottoResponse = {
  draws: LottoDraw[];
  source: string;
  fetchedAt: string;
};

let cachedResponse: CachedLottoResponse | null = null;
let cachedAt = 0;

const fetchDrawsFromSource = async (source: string) => {
  const response = await fetch(source, {
    next: {
      revalidate: 300,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`upstream ${response.status}`);
  }

  const payload = await response.json();
  const draws = normalizeRemoteDraws(payload);

  if (draws.length === 0) {
    throw new Error("empty payload");
  }

  return draws;
};

export async function GET() {
  const now = Date.now();

  if (cachedResponse && now - cachedAt < API_CACHE_TTL_MS) {
    return Response.json({
      ...cachedResponse,
      stale: false,
      cache: "memory",
    });
  }

  const errors: string[] = [];

  for (const source of LOTTO_DATA_SOURCES) {
    try {
      const draws = await fetchDrawsFromSource(source);
      const nextResponse = {
        draws,
        source,
        fetchedAt: new Date().toISOString(),
      };

      cachedResponse = nextResponse;
      cachedAt = Date.now();

      return Response.json({
        ...nextResponse,
        stale: false,
        cache: "miss",
      });
    } catch (error) {
      errors.push(`${source}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  if (cachedResponse) {
    return Response.json({
      ...cachedResponse,
      stale: true,
      cache: "memory",
    });
  }

  {
    return Response.json(
      {
        error: "lotto data unavailable",
        details: errors.slice(0, 3),
      },
      {
        status: 503,
      },
    );
  }
}
