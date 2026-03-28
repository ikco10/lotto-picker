import { LOTTO_DATA_URL } from "@/src/lib/constants";
import { normalizeRemoteDraws } from "@/src/lib/lotto";

export async function GET() {
  try {
    const response = await fetch(LOTTO_DATA_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`upstream ${response.status}`);
    }

    const payload = await response.json();
    const draws = normalizeRemoteDraws(payload);

    if (draws.length === 0) {
      throw new Error("empty payload");
    }

    return Response.json({
      draws,
      source: "remote",
    });
  } catch {
    return Response.json(
      {
        error: "lotto data unavailable",
      },
      {
        status: 503,
      },
    );
  }
}
