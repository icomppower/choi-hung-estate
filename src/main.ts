import {
  ACESFilmicToneMapping, AmbientLight, BoxGeometry, Color, DirectionalLight,
  Fog, Group, Mesh, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera,
  PlaneGeometry, Scene, SRGBColorSpace, WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import GUI from "lil-gui";
import { defaultParams, type BuildingParams } from "./params";
import { generateBuilding } from "./generator";
import { Kit } from "./kit";

const app = document.getElementById("app")!;
const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = PCFShadowMap;
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
renderer.outputColorSpace = SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = new Color(0x201612);
scene.fog = new Fog(0x201612, 40, 140);

const camera = new PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 500);
camera.position.set(10, 6, 12);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3.5, 0);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.52;

// lighting: warm key + cool ambient, evening Hong Kong mood
const sun = new DirectionalLight(0xffe0b3, 2.2);
sun.position.set(18, 24, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -14;
sun.shadow.camera.right = 14;
sun.shadow.camera.top = 16;
sun.shadow.camera.bottom = -4;
sun.shadow.camera.far = 80;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(new AmbientLight(0x8fa3c0, 0.75));
const fill = new DirectionalLight(0x6f87b8, 0.5);
fill.position.set(-12, 10, -14);
scene.add(fill);

// ground
const ground = new Mesh(
  new PlaneGeometry(300, 300),
  new MeshStandardMaterial({ color: 0x22262c, roughness: 0.95 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Blender is Z-up: build everything in Blender space inside a rotated root
const root = new Group();
root.rotation.x = -Math.PI / 2;
scene.add(root);

const kit = new Kit();
const params: BuildingParams = defaultParams();
let building: Group | null = null;

const shellMat = new MeshStandardMaterial({ color: 0x8d8577, roughness: 0.9 });

function buildLowPolyShell(p: BuildingParams): Group {
  const g = new Group();
  const body = new Mesh(new BoxGeometry(p.length, p.width, p.floor), shellMat);
  body.position.set(0, 0, p.floor / 2);
  const roof = new Mesh(new BoxGeometry(p.length + 0.4, p.width + 1.0, 0.4), shellMat);
  roof.position.set(0, 0, p.floor + 0.15);
  for (const m of [body, roof]) {
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

function regenerate(): void {
  if (building) {
    root.remove(building);
    building.traverse(o => {
      const im = o as { isInstancedMesh?: boolean; dispose?: () => void };
      if (im.isInstancedMesh) im.dispose?.();
    });
  }
  building = params.lowPoly
    ? buildLowPolyShell(params)
    : kit.buildGroup(generateBuilding(params, kit));
  root.add(building);
}

// UI — mirrors the 18 node-group inputs
const gui = new GUI({ title: "build system" });
const dims = gui.addFolder("dimensions");
dims.add(params, "floor", 3, 14, 1);
dims.add(params, "length", 2, 16, 1);
dims.add(params, "width", 2, 10, 1);
const probs = gui.addFolder("probabilities");
probs.add(params, "acUnit", 0, 1, 0.01).name("AC unit");
probs.add(params, "roofProbability", 0, 1, 0.01).name("window awning");
probs.add(params, "clothlineProbability", 0, 1, 0.01).name("clothline");
probs.add(params, "lights", 0, 1, 0.01);
probs.add(params, "windowType", 0, 1, 0.01).name("window type");
probs.add(params, "windowOpenAmount", 0, 1, 0.01).name("window open");
probs.add(params, "curtainClose", 0, 1, 0.01).name("curtain close");
probs.add(params, "closedOpenStore", 0, 1, 0.01).name("open store");
probs.add(params, "roofOnStore", 0, 1, 0.01).name("roof on store");
probs.add(params, "objectOnGround", 0, 1, 0.01).name("ground objects");
probs.add(params, "storeSign", 0, 1, 0.01).name("store sign");
probs.add(params, "objectOnRoof", 0, 1, 0.01).name("roof objects");
const misc = gui.addFolder("misc");
misc.add(params, "randomise", 0, 1000, 1).name("seed");
misc.add(params, "lowPoly").name("low poly");
gui.onChange(() => regenerate());

// dev hooks: window.__setParams({...}) regenerates; window.__setCamera(px,py,pz, tx,ty,tz)
const devWindow = window as unknown as {
  __setParams?: (p: Partial<BuildingParams>) => void;
  __setCamera?: (px: number, py: number, pz: number, tx: number, ty: number, tz: number) => void;
};
devWindow.__setParams = p => {
  Object.assign(params, p);
  gui.controllersRecursive().forEach(c => c.updateDisplay());
  regenerate();
};
devWindow.__setCamera = (px, py, pz, tx, ty, tz) => {
  camera.position.set(px, py, pz);
  controls.target.set(tx, ty, tz);
  controls.update();
};

kit.load("/assets/kit.glb", "/assets/kit_manifest.json").then(() => {
  document.getElementById("loading")?.remove();
  regenerate();
}).catch(err => {
  const el = document.getElementById("loading");
  if (el) el.textContent = `FAILED TO LOAD KIT: ${err}`;
  console.error(err);
});

addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
