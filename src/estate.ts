/**
 * Choi Hung Estate district layer: places blocks along a curved arc enclosing a
 * central plaza (the estate's basketball court), instead of the Kowloon layer's
 * rectilinear micro-plot grid. Two new capabilities on top of the shared
 * single-building generator:
 *
 * 1. Curved/arc placement — blocks are laid out at even angular steps around a
 *    circle, each rotated so its arcade-front facade (+Y in the generator's local
 *    space) faces the plaza centre, instead of the grid's translation-only layout.
 * 2. Pastel colour-panel mosaic — reference photos (Wikipedia bird's-eye + the
 *    iconic basketball-court shot) show the real estate is NOT one solid hue per
 *    block; each facade is mostly white/cream with muted pastel panels (mint,
 *    butter yellow, dusty salmon, powder blue, lilac) scattered across window
 *    bays in small clusters. Each of the 7 slab blocks (Yin/Hung/Choi/Fai/Tak/Po/
 *    Che) gets its own seeded mosaic via generator.ts's per-cell `CellTint` hook
 *    (see windowCellContent/generateBuilding), tinting only the wall-panel piece
 *    of each window cell — clustered in ~2×3-cell patches to read as painted
 *    sections rather than single-pixel noise, with a "no tint" outcome kept in
 *    the weighted pick so plenty of the base white/cream shows through.
 */
import { Color, Matrix4 } from "three";
import { defaultParams, type BuildingParams } from "./params";
import { generateBuilding, type Placement, type KitCounts, type CellTint } from "./generator";
import { randFloat, randInt } from "./rng";

export interface EstateParams {
  slabCount: number;
  walkupCount: number;
  radius: number;
  arcStart: number; // degrees
  arcSpan: number; // degrees; < 360 leaves an entrance gap in the enclosing arc
  slabFloors: number;
  walkupFloors: number;
  seed: number;
}

export function defaultEstateParams(): EstateParams {
  return {
    slabCount: 7,
    walkupCount: 4,
    radius: 18,
    arcStart: -90,
    arcSpan: 360,
    slabFloors: 20,
    walkupFloors: 7,
    seed: 0,
  };
}

// real block names, in the order the rainbow hues are traditionally listed
export const BLOCK_NAMES = ["Yin", "Hung", "Choi", "Fai", "Tak", "Po", "Che"];

// muted pastel panel colours, matched against real Choi Hung reference photos —
// "null" is a deliberate weighted option so plenty of the base white/cream facade
// shows through between colour patches, instead of every cell being painted
const PASTEL_PALETTE: (number | null)[] = [
  0xb8dcc8, // mint green
  0xf0dfa0, // butter yellow
  0xe8b8ae, // dusty salmon
  0xb8d4e8, // powder blue
  0xcbc0dc, // pale lilac
  0xf0c9a0, // soft peach
  null, null, // no tint — bare white/cream panel
];

/** small clustered patches (not per-cell noise, not one hue per block) — real
 *  paint sections span a few window bays, so bucket cells into ~2 columns × 3
 *  rows before picking a colour, and hash in the block index so each block's
 *  mosaic differs even at the same seed. */
function mosaicTint(blockIndex: number, seed: number): CellTint {
  return (x, z) => {
    const patchX = Math.floor(x / 2);
    const patchZ = Math.floor(z / 3);
    const patchId = patchX * 4001 + patchZ * 97 + blockIndex * 131;
    const hex = PASTEL_PALETTE[randInt(0, PASTEL_PALETTE.length - 1, patchId, seed + 5050)];
    return hex === null ? undefined : new Color(hex);
  };
}

export interface EstateBlock {
  index: number;
  kind: "slab" | "walkup";
  name: string | null;
  colorIndex: number | null;
  angleDeg: number;
  x: number;
  y: number;
  params: BuildingParams;
}

export interface EstateCoverage {
  blockCount: number;
  minGap: number;
  maxGap: number;
  avgGap: number;
  /** true when every neighbouring pair has a non-negative gap (no footprint overlap)
   *  and no gap exceeds half the arc radius (no visible break in the enclosure) —
   *  the layout's deterministic proxy for "the arc encloses the plaza with no
   *  overlap and no gap", analogous to the Kowloon layer's walkway-connectivity check */
  enclosed: boolean;
}

export interface EstateLayout {
  blocks: EstateBlock[];
  coverage: EstateCoverage;
}

/** evenly interleave two block kinds along the arc (e.g. 7 slabs, 4 walkups) so
 *  neither kind clumps at one end — a simple running-ratio distribution. */
function interleaveKinds(slabCount: number, walkupCount: number): ("slab" | "walkup")[] {
  const total = slabCount + walkupCount;
  const out: ("slab" | "walkup")[] = [];
  let slabsUsed = 0;
  let walkupsUsed = 0;
  for (let i = 0; i < total; i++) {
    const slabRatio = slabCount ? (slabsUsed + 1) / slabCount : Infinity;
    const walkupRatio = walkupCount ? (walkupsUsed + 1) / walkupCount : Infinity;
    if (slabRatio <= walkupRatio) {
      out.push("slab");
      slabsUsed++;
    } else {
      out.push("walkup");
      walkupsUsed++;
    }
  }
  return out;
}

export function generateEstateLayout(ep: EstateParams): EstateLayout {
  const kinds = interleaveKinds(ep.slabCount, ep.walkupCount);
  const total = kinds.length;
  // a full-circle arc (arcSpan === 360) has no distinct start/end point, so its
  // angular step divides by `total`, not `total - 1` — otherwise the first and
  // last block would land on the same angle and overlap
  const closed = Math.abs(ep.arcSpan) >= 359.999;
  const angleStepDivisor = closed ? total : Math.max(1, total - 1);
  const blocks: EstateBlock[] = [];
  let colorIndex = 0;
  kinds.forEach((kind, i) => {
    const angleDeg = ep.arcStart + (ep.arcSpan * i) / angleStepDivisor;
    const angleRad = (angleDeg * Math.PI) / 180;
    const isSlab = kind === "slab";
    const floor = isSlab ? ep.slabFloors : ep.walkupFloors;
    const length = isSlab ? 7 : 4;
    const width = 3;
    const params: BuildingParams = {
      ...defaultParams(),
      floor,
      length,
      width,
      randomise: randInt(0, 999, i, ep.seed),
      acUnit: randFloat(0.4, 0.85, i, ep.seed + 606),
      clothlineProbability: randFloat(0.3, 0.85, i, ep.seed + 707),
      closedOpenStore: randFloat(0.3, 0.8, i, ep.seed + 808),
      storeSign: randFloat(0.3, 0.9, i, ep.seed + 909),
    };
    const thisColor = isSlab ? colorIndex++ % BLOCK_NAMES.length : null;
    blocks.push({
      index: i,
      kind,
      name: isSlab ? BLOCK_NAMES[thisColor! % BLOCK_NAMES.length] : null,
      colorIndex: thisColor,
      angleDeg,
      x: Math.cos(angleRad) * ep.radius,
      y: Math.sin(angleRad) * ep.radius,
      params,
    });
  });
  return { blocks, coverage: analyzeCoverage(blocks, ep) };
}

function analyzeCoverage(blocks: EstateBlock[], ep: EstateParams): EstateCoverage {
  // the arcade-front facade (width = params.length, see generator.ts) is the edge
  // that faces tangentially along the arc, so it — not the radially-oriented
  // params.width — is the dimension that determines neighbour spacing
  const closed = Math.abs(ep.arcSpan) >= 359.999;
  const pairCount = closed ? blocks.length : blocks.length - 1;
  let minGap = Infinity;
  let maxGap = -Infinity;
  let sumGap = 0;
  let n = 0;
  for (let i = 0; i < pairCount; i++) {
    const a = blocks[i];
    const b = blocks[(i + 1) % blocks.length];
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const gap = dist - a.params.length / 2 - b.params.length / 2;
    minGap = Math.min(minGap, gap);
    maxGap = Math.max(maxGap, gap);
    sumGap += gap;
    n++;
  }
  if (n === 0) { minGap = 0; maxGap = 0; }
  return {
    blockCount: blocks.length,
    minGap,
    maxGap,
    avgGap: n ? sumGap / n : 0,
    enclosed: minGap >= -0.05 && maxGap < ep.radius * 0.5,
  };
}

/** rotates a block so its arcade-front facade (local +Y) faces the plaza centre,
 *  then translates it out to its position on the arc. */
function blockTransform(block: EstateBlock): Matrix4 {
  const facingRad = ((block.angleDeg + 180) * Math.PI) / 180; // direction toward centre
  const rotZ = facingRad - Math.PI / 2; // local +Y -> facingRad, see generator.ts facade convention
  return new Matrix4().makeRotationZ(rotZ).setPosition(block.x, block.y, 0);
}

export function generateEstatePlacements(layout: EstateLayout, counts: KitCounts): Placement[] {
  const out: Placement[] = [];
  for (const block of layout.blocks) {
    const t = blockTransform(block);
    // block.params.randomise is already a per-block seeded value (see
    // generateEstateLayout) — reuse it so each slab block's pastel mosaic is
    // stable under the same estate seed without threading a separate param
    const cellTint = block.colorIndex !== null ? mosaicTint(block.index, block.params.randomise) : undefined;
    for (const pl of generateBuilding(block.params, counts, cellTint)) {
      out.push({ key: pl.key, matrix: t.clone().multiply(pl.matrix), tint: pl.tint });
    }
  }
  return out;
}
