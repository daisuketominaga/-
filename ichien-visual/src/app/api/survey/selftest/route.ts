import { NextResponse } from "next/server";
import { readSurvey } from "@/lib/surveyRead";
import { TEST_IMAGES } from "@/lib/testdata";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/**
 * 読み取りの自己テスト。同梱のテスト画像を読み取り、期待値（辺長・面積・座標系）と比べた結果を返す。
 * GET /api/survey/selftest?only=1 で 2 枚目だけ、など。
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const only = url.searchParams.get("only");
  const targets = only ? [TEST_IMAGES[Number(only)]].filter(Boolean) : TEST_IMAGES;
  const results = [];
  for (const t of targets) {
    const t0 = Date.now();
    try {
      const r = await readSurvey({ b64: t.b64, mediaType: t.mime });
      const edges = r.site.edges as { index: number; length?: number; road?: boolean; roadWidth?: number }[];
      const gotLengths = edges.map((e) => e.length ?? null);
      // 座標から辺長を計算（coords があれば）
      const fromCoords = r.coords && r.coords.length >= 3 ? r.coords.map((c, i) => { const n = r.coords![(i + 1) % r.coords!.length]; return +Math.hypot(n.X - c.X, n.Y - c.Y).toFixed(3); }) : null;
      const sorted = (a: (number | null)[]) => a.filter((v): v is number => v !== null).map((v) => +v.toFixed(2)).sort((x, y) => x - y);
      const expSorted = sorted(t.expect.lengths);
      const gotSorted = sorted(gotLengths);
      const coordSorted = fromCoords ? sorted(fromCoords) : null;
      const match = (g: number[]) => t.expect.lengths.filter((e) => g.some((v) => Math.abs(v - e) <= 0.02)).length;
      results.push({
        name: t.name,
        ms: Date.now() - t0,
        expect: t.expect,
        got: { area: r.site.areaOverride, lengths: gotLengths, lengthsFromCoords: fromCoords, points: r.site.points.length, coordSystem: r.coordSystem, road: edges.filter((e) => e.road).map((e) => ({ index: e.index, width: e.roadWidth })), notes: r.notes, coords: r.coords },
        score: {
          areaOk: r.site.areaOverride !== undefined && Math.abs(r.site.areaOverride - t.expect.area) < 0.01,
          lengthsMatched: `${match(gotSorted)}/${t.expect.lengths.length}`,
          lengthsFromCoordsMatched: coordSorted ? `${match(coordSorted)}/${t.expect.lengths.length}` : null,
          coordSystemOk: t.expect.coordSystem ? (r.coordSystem ?? "").includes(t.expect.coordSystem.slice(0, 2)) : null,
          expSorted,
          gotSorted,
          coordSorted,
        },
        usage: r.usage,
      });
    } catch (e) {
      results.push({ name: t.name, ms: Date.now() - t0, error: (e as Error).message });
    }
  }
  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}
