# 🌈 彩虹邨 Choi Hung Estate

> Maintained by **Johnny Lai** ([LinkedIn](https://www.linkedin.com/in/icomppower)) — part of the [Narrated History Map](https://app.notion.com/p/39a1f269eaea8187881ccf72882077b6) series, forked from [BuildingGeneratorThreeJS](https://github.com/icomppower/BuildingGeneratorThreeJS) (also the base for [九龍城寨 · Kowloon Walled City](https://github.com/icomppower/kowloon-walled-city)).

A procedural Hong Kong building generator for Three.js, ported from a Blender
geometry-nodes setup (`procedural-hong-kong-building/source/procedural_building.blend`),
extended here with two new district-layer capabilities:

- **Colour-band material** (`src/estate.ts` + `src/kit.ts`) — each of the 7 rainbow
  slab blocks (Yin/Hung/Choi/Fai/Tak/Po/Che) gets a fixed per-instance paint tint on
  its facade, layered on top of the shared texture-mapped material with zero bleed
  between blocks.
- **Curved/arc placement** (`src/estate.ts`) — blocks are laid out at even angular
  steps around a circle enclosing the estate's central plaza, instead of the base
  generator's rectilinear lot grid.

Original model URL : https://sketchfab.com/3d-models/procedural-hong-kong-building-528a732e84c44fd49c4726f341014a23

The original 592-node "build system" node group was reverse-engineered into a
TypeScript placement algorithm ([docs/BUILD_SYSTEM.md](docs/BUILD_SYSTEM.md)); the
~190 building parts (walls, windows, AC units, clotheslines, storefronts, roof props…)
are exported from the .blend into a single instanced asset kit
(`public/assets/kit.glb` + `kit_manifest.json`).

## Run

```sh
npm install
npm run dev
```

All 18 generator parameters from the Blender modifier (floors, footprint, AC/clothline/
lights probabilities, window type & open amount, curtains, store state, seed, low-poly
toggle…) are exposed as live sliders.

## Re-exporting the asset kit

If you edit assets in the .blend, re-run the export (Blender 4.2+):

```sh
blender --background procedural-hong-kong-building/source/procedural_building.blend \
        --python tools/export_kit.py -- public/assets/kit.glb public/assets/kit_manifest.json
```

## Structure

- `src/generator.ts` — the ported node graph: grids, seeded RNG, placements
- `src/kit.ts` — GLB kit loader + InstancedMesh builder (incl. per-instance colour tint)
- `src/estate.ts` — Choi Hung Estate district layer: arc placement + colour bands
- `src/city.ts` — Kowloon Walled City district layer (dense grid + walkway graph)
- `src/rng.ts` — Blender-style hash(id, seed) random values
- `src/main.ts` — scene, lighting, lil-gui controls
- `tools/` — Blender headless scripts (kit export, node-graph dump), Puppeteer snapshot scripts
