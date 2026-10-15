// Мектептің интерактивті 3D сахнасы (Three.js тікелей). Барлық динамикалық күй snapshotAt(t) нәтижесінен алынады.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ROOMS, Room, FLOOR_H, FRONT_Z, PG_MARKERS, ROUTE_PATHS } from '../data/building';
import { Results, Snapshot } from '../engine/compute';
import type { SceneMode } from '../engine/types';
import { sidingTexture, brickTexture, booksTexture, courtTexture, netTexture, shutterTexture, makeLabel, updateLabel, plateTexture } from './textures';
import { fmt } from '../engine/num';

export interface ViewOpts {
  floor: 'all' | 1 | 2 | 3;
  hideRoof: boolean;
  hideWalls: boolean;
  exploded: boolean;
  showRoutes: boolean;
  showPlans: boolean;
  showLabels: boolean;
}

type V3 = [number, number, number];
const EXPLODE_GAP = 7;
/** Есептік бөлменің орны (мектептің алдындағы алаң, схемалық). */
const ROOM_C = { x: 16, z: 34 };
const STAFF_DX = 3.4;
const COL = {
  wall: 0xeadcb4, brown: 0x4a2f24, slab: 0xd9d4c7, corridor: 0xd3e6e7, room: 0xf3efe6, stair: 0xd8d2c4,
  service: 0xe6e1d6, glass: 0x8fb8d0, frame: 0xffffff, roof: 0x6f7377, red: 0xc8261c, teal: 0x0f8b8d,
};

// Сызықтық жол: доғаның ұзындығы бойынша нүкте алу (шетінен тыс экстраполяция).
class Path {
  pts: THREE.Vector3[]; cum: number[]; len: number;
  constructor(pts: THREE.Vector3[]) {
    this.pts = pts; this.cum = [0];
    for (let i = 1; i < pts.length; i++) this.cum.push(this.cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    this.len = this.cum[this.cum.length - 1];
  }
  at(s: number, out = new THREE.Vector3()) {
    const p = this.pts;
    if (s <= 0) { const d = p[1].clone().sub(p[0]).normalize(); return out.copy(p[0]).addScaledVector(d, s); }
    if (s >= this.len) { const n = p.length; const d = p[n - 1].clone().sub(p[n - 2]).normalize(); return out.copy(p[n - 1]).addScaledVector(d, s - this.len); }
    let i = 1; while (this.cum[i] < s) i++;
    const f = (s - this.cum[i - 1]) / Math.max(1e-9, this.cum[i] - this.cum[i - 1]);
    return out.copy(p[i - 1]).lerp(p[i], f);
  }
  dirAt(s: number) {
    const a = this.at(Math.max(0, Math.min(this.len, s) - 0.2)); const b = this.at(Math.min(this.len, Math.max(0, s) + 0.2));
    return b.sub(a).normalize();
  }
}

export class SchoolScene {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  container: HTMLElement;
  floors: Record<number, THREE.Group> = {};
  outer: Record<number, THREE.Group> = {};
  labels: Record<number, THREE.Group> = {};
  roof = new THREE.Group();
  routesGroup = new THREE.Group();
  plansGroup = new THREE.Group();
  pickables: THREE.Object3D[] = [];
  roomMeshes = new Map<string, THREE.Mesh>();
  selBox: THREE.LineSegments;
  view: ViewOpts = { floor: 'all', hideRoof: false, hideWalls: false, exploded: false, showRoutes: true, showPlans: false, showLabels: true };
  results: Results | null = null;
  onPick: (id: string | null) => void = () => {};
  private raf = 0;
  private ro: ResizeObserver;
  private disposed = false;
  private evacMesh!: THREE.InstancedMesh;
  private evacMax = 140;
  private staffMesh!: THREE.InstancedMesh;
  private ghostMesh!: THREE.InstancedMesh;
  private trucks: Record<string, THREE.Group> = {};
  private truckLabels: Record<string, THREE.Sprite> = {};
  private truckRoad!: Path;
  private hoses: Record<string, { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; count: number }> = {};
  private hydrantHose!: THREE.Mesh; private hydrantCurve!: THREE.CatmullRomCurve3;
  private roomHose: { mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; count: number } | null = null;
  private drops!: THREE.InstancedMesh;
  private tanks: Record<string, { g: THREE.Group; water: THREE.Mesh; label: THREE.Sprite; text: string }> = {};
  private calcRoom!: THREE.Group; private fireGroup!: THREE.Group; private fireDisc!: THREE.Mesh; private fireEdge!: THREE.Mesh;
  private fireFlame!: THREE.Group; private fireLabel!: THREE.Sprite; private fireText = ''; private limitRing!: THREE.Mesh;
  private evacLabels: Record<string, { s: THREE.Sprite; text: string }> = {};
  private staffLabels = new THREE.Group(); private staffKey = '';
  private routeKey = '';
  private paths: Record<string, Path> = {};
  private selectedId: string | null = null;
  private snap: Snapshot | null = null;
  private dummy = new THREE.Object3D();
  private tmp = new THREE.Vector3();
  private matCache: Record<string, THREE.Material> = {};
  private colliders: Record<number, { x0: number; x1: number; z0: number; z1: number }[]> = {};
  private partitions: THREE.Mesh[] = [];
  private ceilings: Record<number, THREE.Group> = {};
  private indoor!: THREE.AmbientLight;
  walk = { on: false, floor: 1 as 1 | 2 | 3, x: 0, z: 0, yaw: 0, pitch: -0.05 };
  private keys = new Set<string>();
  private lastT = performance.now();
  onWalkChange: (on: boolean, floor: number) => void = () => {};

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', 'Мектептің 3D моделі');
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 2000);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.screenSpacePanning = true;
    // Аспан: тік градиент
    const sky = document.createElement('canvas'); sky.width = 4; sky.height = 256;
    const sg = sky.getContext('2d')!; const gr = sg.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#a9cbe6'); gr.addColorStop(0.55, '#e3eff7'); gr.addColorStop(1, '#ffffff');
    sg.fillStyle = gr; sg.fillRect(0, 0, 4, 256);
    const skyTex = new THREE.CanvasTexture(sky); skyTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = skyTex;
    this.scene.fog = new THREE.Fog(0xf4f8fb, 240, 560);

    this.scene.add(new THREE.HemisphereLight(0xdcecff, 0x8a7a5a, 1.25));
    this.indoor = new THREE.AmbientLight(0xffffff, 0); this.scene.add(this.indoor);
    const sun = new THREE.DirectionalLight(0xfff3dc, 2.4); sun.position.set(70, 110, 90);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 90, bottom: -90, near: 10, far: 400 });
    sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
    sun.target.position.set(15, 0, 0); this.scene.add(sun.target); this.scene.add(sun);

    this.buildGround();
    this.buildBuilding();
    this.buildEnvironment();
    this.buildDynamic();
    this.selBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: 0xff6a00 }));
    this.selBox.visible = false; this.selBox.renderOrder = 5; this.scene.add(this.selBox);
    // Көлеңкелер: ғимарат пен көліктер көлеңке түсіреді, жер мен едендер қабылдайды
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const tr = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.Material;
      if (tr?.transparent || (tr as any)?.isMeshBasicMaterial) return;
      if (m.userData.noShadow || m.parent?.name === 'ceiling') { m.receiveShadow = true; return; }
      m.castShadow = true; m.receiveShadow = true;
    });
    this.applyView();
    this.resetCamera();
    this.bindPointer();
    if (import.meta.env.VITE_CAPTURE === '1') (window as any).__school = this; // тек скриншот жинағы үшін
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    const loop = () => { if (this.disposed) return; this.raf = requestAnimationFrame(loop); this.frame(); };
    loop();
  }

  // ---------------- материалдар ----------------
  private mat(key: string, make: () => THREE.Material) { return (this.matCache[key] ??= make()); }
  private std(color: number, extra: THREE.MeshStandardMaterialParameters = {}) {
    return this.mat(`s${color}-${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...extra }));
  }
  private box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); parent.add(m); return m;
  }
  private floorY(level: number) { return level * (FLOOR_H + (this.view.exploded ? EXPLODE_GAP : 0)); }

  // ---------------- жер, ғимарат ----------------
  private buildGround() {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(700, 500), this.std(0x8fa86a, { roughness: 1 }));
    g.rotation.x = -Math.PI / 2; g.position.set(30, -0.02, 10); g.receiveShadow = true; this.scene.add(g);
    // мектеп ауласы (тротуар плиткасы)
    const pave = new THREE.Mesh(new THREE.PlaneGeometry(82, 46), this.std(0xb7b2a8, { roughness: 0.95 }));
    pave.rotation.x = -Math.PI / 2; pave.position.set(0, -0.01, -4); pave.receiveShadow = true; this.scene.add(pave);
    // ағаштар (фотосуреттердегі аула ағаштары сияқты, шартты)
    const trunk = new THREE.CylinderGeometry(0.18, 0.25, 2.2, 6); trunk.translate(0, 1.1, 0);
    const crown = new THREE.IcosahedronGeometry(1.8, 0); crown.translate(0, 3.4, 0);
    const spots: [number, number, number][] = [];
    for (let i = 0; i < 9; i++) spots.push([-44 + i * 2.6 + (i % 2) * 0.8, 22 + (i % 3) * 1.6, 0.8 + (i % 3) * 0.15]);
    for (let i = 0; i < 7; i++) spots.push([30 + i * 3.2, 24 + (i % 2) * 2, 0.9 + (i % 2) * 0.2]);
    for (let i = 0; i < 8; i++) spots.push([-46 + (i % 2) * 2.5, -26 + i * 4, 1 + (i % 3) * 0.12]);
    for (let i = 0; i < 6; i++) spots.push([42 + (i % 2) * 3, -24 + i * 5, 0.95]);
    const ti = new THREE.InstancedMesh(trunk, this.std(0x6b4a32), spots.length);
    const ci = new THREE.InstancedMesh(crown, this.std(0x4f7d3a, { flatShading: true }), spots.length);
    spots.forEach(([x, z, k], i) => { this.dummy.position.set(x, 0, z); this.dummy.rotation.set(0, i, 0); this.dummy.scale.setScalar(k); this.dummy.updateMatrix(); ti.setMatrixAt(i, this.dummy.matrix); ci.setMatrixAt(i, this.dummy.matrix); });
    this.scene.add(ti); this.scene.add(ci);
  }

  private buildBuilding() {
    const siding = sidingTexture();
    const wallMat = (w: number, h: number) => {
      const t = siding.clone(); t.needsUpdate = true; t.repeat.set(w / 4, h / 4); t.wrapS = t.wrapT = THREE.RepeatWrapping;
      const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }); m.userData.collide = true; return m;
    };
    const glass = this.std(COL.glass, { roughness: 0.2, metalness: 0.3 });
    const frame = this.std(COL.frame);

    for (const f of [1, 2, 3] as const) {
      const grp = new THREE.Group(); grp.name = `floor-${f}`;
      const outer = new THREE.Group(); outer.name = `outer-${f}`;
      const labels = new THREE.Group();
      this.floors[f] = grp; this.outer[f] = outer; this.labels[f] = labels;
      grp.add(outer); grp.add(labels); this.scene.add(grp);
      const rooms = ROOMS.filter((r) => r.floor === f);
      const wing = f <= 2;

      // Еден плиталары
      this.box(70, 0.25, FRONT_Z + 3, this.std(COL.slab), 0, -0.13, (FRONT_Z - 3) / 2, grp);
      this.box(15.3, 0.25, 5, this.std(COL.slab), 27.35, -0.13, -5.5, grp);
      if (wing) this.box(20, 0.25, 18, this.std(COL.slab), -13.6, -0.13, -12, grp);

      // Бөлмелер (таңдалатын еден тақталары)
      for (const r of rooms) {
        // Еден түстері фотосуреттер бойынша: дәліз — көкшіл-сұр бояу, кабинеттер — қоңыр ағаш, кітапхана — қызғылт-қоңыр, фойе мен баспалдақ — плитка
        const color = r.kind === 'corridor' ? 0x7f9ea3 : r.kind === 'stair' ? 0xd8ccb4 : r.kind === 'foyer' ? 0xd9cdb4 : r.kind === 'service' ? 0xb9b2a4
          : r.kind === 'gym' ? 0xffffff : r.kind === 'library' ? 0xb4652f : r.kind === 'hall' || r.kind === 'canteen' ? 0x8fa4aa : 0x8e4d2c;
        const w = r.x[1] - r.x[0], d = r.z[1] - r.z[0];
        const m = new THREE.Mesh(new THREE.BoxGeometry(w - 0.12, 0.06, d - 0.12),
          r.kind === 'gym' ? new THREE.MeshStandardMaterial({ map: courtTexture(), roughness: 0.7 }) : new THREE.MeshStandardMaterial({ color, roughness: 0.9 }));
        m.position.set((r.x[0] + r.x[1]) / 2, 0.03, (r.z[0] + r.z[1]) / 2);
        m.userData = { pick: r.id }; grp.add(m); this.pickables.push(m); this.roomMeshes.set(r.id, m);
        if (r.kind !== 'corridor' && w >= 3.5) {
          const lab = makeLabel(r.kind === 'stair' ? 'Баспалдақ' : r.name, { size: 26, scale: r.kind === 'stair' ? 0.7 : 0.8 });
          lab.position.set(m.position.x, 2.6, m.position.z); labels.add(lab);
        }
      }

      // Ішкі қалқалар (кесілген биіктік 2,2 м)
      const pH = 2.2, pm = new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.9 }); pm.userData.collide = true; pm.userData.partition = true;
      const fronts = rooms.filter((r) => r.z[0] === 0).sort((a, b) => a.x[0] - b.x[0]);
      for (const r of fronts) {
        // дәлізге қарайтын қабырға, есік ойығы 1,1 м
        const dx = r.x[0] + 1.2;
        if (r.kind !== 'foyer') { // фойе дәлізге ашық
          this.box(dx - r.x[0] - 0.2, pH, 0.15, pm, (r.x[0] + dx - 0.2) / 2 + 0.1, pH / 2, 0, grp);
          this.box(r.x[1] - dx - 1.1, pH, 0.15, pm, (dx + 1.1 + r.x[1]) / 2, pH / 2, 0, grp);
        }
        this.box(0.15, pH, FRONT_Z, pm, r.x[1], pH / 2, FRONT_Z / 2, grp);
      }
      // артқы бөлік қабырғалары
      this.box(0.15, pH, 5, pm, 28.4, pH / 2, -5.5, grp);
      if (wing) {
        const wr = rooms.filter((r) => r.z[1] <= -3 && r.x[1] <= -3);
        for (const r of wr) {
          if (r.kind === 'corridor') continue;
          this.box(r.x[1] - r.x[0], pH, 0.12, pm, (r.x[0] + r.x[1]) / 2, pH / 2, r.z[0], grp);
          this.box(0.12, pH, r.z[1] - r.z[0] - 1.2, pm, r.x[1] === -3.6 ? r.x[0] : r.x[1], pH / 2, (r.z[0] + r.z[1]) / 2 - 0.6, grp);
        }
      }

      // Баспалдақтар
      this.buildStairs(grp, -35, -28.4, -3, 0, 'x');
      this.buildStairs(grp, 28.4, 35, -8, -3, 'z');

      // ПГ белгілері
      for (const pg of PG_MARKERS.filter((p) => p.floor === f)) this.buildFireCabinet(grp, labels, pg.x);
      // Қолмен іске қосылатын хабарлағыштар және «ШЫҒУ» белгілері — баспалдақ кіреберістерінде (шартты орын)
      for (const x of [-27.6, 18.8]) this.buildCallPoint(grp, x, 1.5, -2.84, 0);
      this.buildExitSign(grp, -28.6, 2.55, -2.84, 0);
      this.buildExitSign(grp, 28.9, 2.55, -2.84, 0);
      if (f === 1) {
        this.buildCallPoint(grp, -15.2, 1.5, -0.12, Math.PI);
        this.buildExitSign(grp, -34.8, 2.55, -1.5, Math.PI / 2);
        this.buildExitSign(grp, -12.9, 3.0, 6.8, Math.PI);
      }

      // Сыртқы қабырғалар мен терезелер
      const wallH = FLOOR_H;
      const fw = this.box(70, wallH, 0.3, wallMat(70, wallH), 0, wallH / 2, FRONT_Z, outer);
      fw.userData = { pick: 'facade' }; this.pickables.push(fw);
      // артқы қабырға: қанат пен артқы блок орындарын қоспай
      const backSegs: [number, number][] = wing ? [[-35, -23.6], [-3.6, 19.7]] : [[-35, 19.7]];
      for (const [a, b] of backSegs) this.box(b - a, wallH, 0.3, wallMat(b - a, wallH), (a + b) / 2, wallH / 2, -3, outer);
      this.box(0.3, wallH, 10, wallMat(10, wallH), -35, wallH / 2, 2, outer);
      this.box(0.3, wallH, 15, wallMat(15, wallH), 35, wallH / 2, -0.5, outer);
      this.box(15.3, wallH, 0.3, wallMat(15, wallH), 27.35, wallH / 2, -8, outer);
      this.box(0.3, wallH, 5, wallMat(5, wallH), 19.7, wallH / 2, -5.5, outer);
      if (wing) {
        this.box(20, wallH, 0.3, wallMat(20, wallH), -13.6, wallH / 2, -21, outer);
        this.box(0.3, wallH, 18, wallMat(18, wallH), -23.6, wallH / 2, -12, outer);
        this.box(0.3, wallH, 18, wallMat(18, wallH), -3.6, wallH / 2, -12, outer);
      }
      // ---- Қасбет фотосуреттер бойынша (1000302673/674/681/685) ----
      const white = this.std(0xf7f5ee);
      const dark = this.std(0x3b2820, { roughness: 0.7 });
      // Ақ қос белдеу: 2 және 3-қабат терезелерінің астында
      if (f >= 2) for (const dy of [0.34, 0.6]) {
        this.box(70.5, 0.13, 0.36, white, 0, dy, FRONT_Z + 0.02, outer);
        this.box(0.36, 0.13, 10.5, white, -35.02, dy, 2, outer);
        this.box(0.36, 0.13, 15.4, white, 35.02, dy, -0.5, outer);
      }
      // Қоңыр цоколь және бұрыштағы қоңыр тік жиектер
      if (f === 1) {
        this.box(70.5, 0.7, 0.42, dark, 0, 0.35, FRONT_Z + 0.06, outer);
        this.box(0.42, 0.7, 10.4, dark, -35.06, 0.35, 2, outer);
        this.box(0.42, 0.7, 15.4, dark, 35.06, 0.35, -0.5, outer);
        for (const [a2, b2] of backSegs) this.box(b2 - a2, 0.7, 0.42, dark, (a2 + b2) / 2, 0.35, -3.06, outer);
        if (wing) { this.box(20.4, 0.7, 0.42, dark, -13.6, 0.35, -21.06, outer); this.box(0.42, 0.7, 18, dark, -23.66, 0.35, -12, outer); this.box(0.42, 0.7, 18, dark, -3.54, 0.35, -12, outer); }
      }
      for (const [cx, cz] of [[-35.05, FRONT_Z + 0.05], [35.05, FRONT_Z + 0.05]] as const) this.box(0.34, wallH, 0.34, dark, cx, wallH / 2, cz, outer);

      // Терезе: ақ жақтау, көлденең фрамуга, тік импост, ақ подоконник
      const win = (x: number, y: number, z: number, w: number, h: number, nz: number, parent: THREE.Object3D, ax: 'z' | 'x' = 'z') => {
        if (ax === 'z') {
          this.box(w + 0.22, h + 0.22, 0.08, frame, x, y, z + nz * 0.16, parent);
          this.box(w, h, 0.06, glass, x, y, z + nz * 0.19, parent);
          this.box(0.07, h, 0.1, frame, x - w / 6, y, z + nz * 0.21, parent);
          this.box(0.07, h, 0.1, frame, x + w / 6, y, z + nz * 0.21, parent);
          this.box(w, 0.07, 0.1, frame, x, y + h * 0.28, z + nz * 0.21, parent);
          this.box(w + 0.4, 0.06, 0.24, white, x, y - h / 2 - 0.12, z + nz * 0.24, parent);
        } else {
          this.box(0.08, h + 0.22, w + 0.22, frame, x + nz * 0.16, y, z, parent);
          this.box(0.06, h, w, glass, x + nz * 0.19, y, z, parent);
          this.box(0.1, h, 0.07, frame, x + nz * 0.21, y, z, parent);
          this.box(0.1, 0.07, w, frame, x + nz * 0.21, y + h * 0.28, z, parent);
        }
      };
      // Басты кіреберіс блогы: x ∈ [−19.6; −6.2]
      const pil = [-19.2, -16.68, -14.16, -11.64, -9.12, -6.6];
      const inEntr = (x: number) => x > -20.1 && x < -5.7;
      for (let x = -33.2; x <= 33.4; x += 3.25) {
        if (inEntr(x)) continue;
        win(x, 1.95, FRONT_Z, 1.45, 1.65, 1, outer);
      }
      if (f >= 2) for (let i = 0; i < pil.length - 1; i++) win((pil[i] + pil[i + 1]) / 2, 1.95, FRONT_Z, 1.35, 1.65, 1, outer);
      // артқы (дәліз жақ) терезелер
      for (let x = -33; x <= 19; x += 3.6) {
        if (wing && x > -24.4 && x < -2.8) continue;
        win(x, 1.95, -3, 1.4, 1.55, -1, outer);
      }
      // Шеткі қабырға: баспалдақтың биік терезесі және қоңыр екі жармалы есік (фото 1000302681)
      if (f === 1) {
        const door = this.std(0x4a3022, { roughness: 0.6 });
        this.box(0.14, 2.3, 2.0, frame, -35.1, 1.15, -1.5, outer);
        this.box(0.16, 2.2, 0.92, door, -35.16, 1.1, -1.98, outer);
        this.box(0.16, 2.2, 0.92, door, -35.16, 1.1, -1.02, outer);
        for (const dz of [-2.4, -0.6]) { const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), this.std(0xeeeeee, { emissive: 0x666655 })); lamp.position.set(-35.25, 2.6, dz); outer.add(lamp); }
        this.box(0.16, 2.2, 1.6, door, 35.16, 1.1, -1.5, outer);
        this.box(1.6, 2.2, 0.16, door, 31.5, 1.1, -8.16, outer);
      } else if (f === 2) {
        win(-35, 2.1, -1.5, 1.5, 3.2, -1, outer, 'x'); // биік баспалдақ терезесі
      } else win(-35, 1.95, -1.5, 1.3, 1.6, -1, outer, 'x');
      if (wing) {
        const high = f === 2;
        for (let z = -19; z <= -5; z += 3.5) {
          win(-23.6, high ? 2.6 : 1.95, z, 2.0, high ? 1.0 : 1.6, -1, outer, 'x');
          win(-3.6, 1.95, z, 1.6, 1.7, 1, outer, 'x');
        }
      }

      // Қоңыр тік элементтер: 2–3-қабатта алтауы, 1-қабатта күнқағарды ұстайтын екі қапталған бағана
      if (f >= 2) for (const x of pil) this.box(0.62, wallH, 0.42, dark, x, wallH / 2, FRONT_Z + 0.2, outer);
      if (f === 3) this.box(13.9, 0.3, 0.5, dark, -12.9, wallH - 0.15, FRONT_Z + 0.22, outer);
      if (f === 1) {
        for (const x of [-19.4, -6.4]) {
          this.box(1.1, 3.35, 1.0, dark, x, 1.68, FRONT_Z + 3.1, outer);
          const plq = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), new THREE.MeshBasicMaterial({ map: plateTexture('ҚАЗ', '#1d4f9c', '#ffffff') }));
          plq.position.set(x, 2.2, FRONT_Z + 3.61); outer.add(plq);
        }
        // әйнектелген тамбур (ақ жақтаулар, ортасында екі жармалы ақ есік)
        const vg = new THREE.Group(); vg.userData = { pick: 'f1-foyer' };
        this.box(11.6, 2.9, 0.08, glass, -12.9, 1.55, FRONT_Z + 3.0, vg);
        for (let x = -18.6; x <= -7.15; x += 1.15) this.box(0.1, 2.9, 0.14, frame, x, 1.55, FRONT_Z + 3.04, vg);
        for (const y of [0.15, 1.15, 2.95]) this.box(11.6, 0.1, 0.14, frame, -12.9, y, FRONT_Z + 3.04, vg);
        this.box(1.5, 2.3, 0.12, white, -12.9, 1.25, FRONT_Z + 3.08, vg);
        this.box(0.06, 2.1, 0.14, this.std(0xb0b0b0), -12.9, 1.25, FRONT_Z + 3.12, vg);
        this.box(0.1, 2.9, 3.0, glass, -18.65, 1.55, FRONT_Z + 1.5, vg);
        this.box(0.1, 2.9, 3.0, glass, -7.15, 1.55, FRONT_Z + 1.5, vg);
        outer.add(vg);
        // күнқағар: қоңыр жиек, ақ асты, үстінде жарық жазуы мен елтаңба
        this.box(16.2, 0.55, 4.6, dark, -12.9, 3.6, FRONT_Z + 2.3, outer);
        this.box(16.0, 0.08, 4.4, white, -12.9, 3.3, FRONT_Z + 2.3, outer);
        const led = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.42), new THREE.MeshBasicMaterial({ map: plateTexture('Қош келдіңіз!', '#101010', '#ffffff') }));
        led.position.set(-12.9, 3.0, FRONT_Z + 3.06); outer.add(led);
        const emb = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.08, 24), this.std(0xd4af37, { metalness: 0.6, roughness: 0.35 }));
        emb.rotation.x = Math.PI / 2; emb.position.set(-12.9, 4.4, FRONT_Z + 0.5); outer.add(emb);
        // жалау (ҚР туы)
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 4.2, 8), this.std(0xcccccc, { metalness: 0.7 }));
        pole.position.set(-13.4, 5.6, FRONT_Z + 1.1); pole.rotation.x = 0.35; outer.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.75), new THREE.MeshStandardMaterial({ color: 0x00afca, side: THREE.DoubleSide }));
        flag.position.set(-12.7, 7.0, FRONT_Z + 1.85); flag.rotation.set(0.35, 0.3, 0); outer.add(flag);
        // қызыл кірпіш жартылай дөңгелек баспалдақ (3 саты) және ақ бүйір сатылар
        [[4.3, 0.15, 0.08], [3.7, 0.3, 0.23], [3.1, 0.45, 0.38]].forEach(([r, h, y]) => {
          const st = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h === 0.15 ? 0.16 : 0.16, 40, 1, false, -Math.PI / 2, Math.PI), this.std(0xb4553f, { roughness: 0.9 }));
          st.position.set(-12.9, y, FRONT_Z + 3.1); outer.add(st);
        });
        for (const sx of [-21.2, -4.6]) for (let i = 0; i < 3; i++) this.box(1.6, 0.16, 0.34, white, sx, 0.08 + i * 0.16, FRONT_Z + 1.4 - i * 0.34, outer);
        // пандус қара металл қоршауымен (сол жақта)
        const rail = this.std(0x1a1a1a, { metalness: 0.5, roughness: 0.4 });
        this.box(7.5, 0.06, 0.06, rail, -26, 0.95, FRONT_Z + 1.4, outer);
        this.box(7.5, 0.06, 0.06, rail, -26, 0.95, FRONT_Z + 2.6, outer);
        for (let x = -29.6; x <= -22.4; x += 0.6) for (const z of [FRONT_Z + 1.4, FRONT_Z + 2.6]) this.box(0.03, 0.9, 0.03, rail, x, 0.47, z, outer);
        this.box(7.5, 0.12, 1.2, this.std(0x9e9a92), -26, 0.06, FRONT_Z + 2.0, outer);
      }
      // Интерьерлер
      this.buildInteriors(f, grp);
      // Ішке кіру режимі үшін соқтығыс қабырғалары (қабат координаталарында)
      const cols: { x0: number; x1: number; z0: number; z1: number }[] = [];
      grp.updateMatrixWorld(true);
      grp.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !(m.material as THREE.Material)?.userData?.collide) return;
        const g = m.geometry as THREE.BoxGeometry; const pr = g.parameters; if (!pr) return;
        if ((m.material as THREE.Material).userData.partition) this.partitions.push(m);
        cols.push({ x0: m.position.x - pr.width / 2, x1: m.position.x + pr.width / 2, z0: m.position.z - pr.depth / 2, z1: m.position.z + pr.depth / 2 });
      });
      this.colliders[f] = cols;
      // Сыртқы қабырғалардың ішкі беті — ақ (ішке кіргенде қаптама көрінбейді)
      const inner = this.std(0xf4f1ea);
      grp.traverse((o) => {
        const m = o as THREE.Mesh; const mat = m.material as THREE.MeshStandardMaterial;
        if (!m.isMesh || Array.isArray(m.material) || !mat?.userData?.collide || mat.userData.partition) return;
        const pr = (m.geometry as THREE.BoxGeometry).parameters; if (!pr) return;
        const mats: THREE.Material[] = [mat, mat, mat, mat, mat, mat];
        if (pr.width >= pr.depth) mats[m.position.z > 2 ? 5 : 4] = inner;
        else { const cx = m.position.z > -3 + 0.01 || Math.abs(m.position.x) > 34 ? 0 : m.position.x < 0 ? -13.6 : 27.35; mats[cx > m.position.x ? 0 : 1] = inner; }
        m.material = mats;
      });
    }

    // Шатыр
    const roofMat = this.std(COL.roof, { roughness: 0.6, metalness: 0.3 });
    this.box(71.4, 0.5, 11.4, roofMat, 0, 0.25, 2, this.roof);
    this.box(16.2, 0.5, 6.2, roofMat, 27.35, 0.25, -5.5, this.roof);
    this.box(70.6, 0.35, 10.6, this.std(0xf4f1ea), 0, -0.12, 2, this.roof); // карниз (ақ белдеу)
    this.box(71.0, 0.32, 11.0, this.std(0xf4f1ea), 0, -0.05, 2, this.roof); // ақ карниз
    const turret = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 4), this.std(0x6b3a2a)); turret.position.set(-12.9, 2.2, 3.5); turret.rotation.y = Math.PI / 4; this.roof.add(turret);
    // шатыр: аласа, сұр металл (фото бойынша)
    const wingRoof = this.box(20.8, 0.5, 18.4, roofMat, -13.6, 0.25, -12, this.roof);
    wingRoof.name = 'wingRoof';
    this.roof.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.userData = { ...o.userData, pick: 'roof' }; this.pickables.push(o); } });
    this.scene.add(this.roof);
  }

  private buildStairs(parent: THREE.Object3D, x0: number, x1: number, z0: number, z1: number, axis: 'x' | 'z') {
    const n = 10, mat = this.std(0xcfc8b8);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const im = new THREE.InstancedMesh(geo, mat, n * 2);
    const d = this.dummy;
    for (let k = 0; k < 2; k++) {
      for (let i = 0; i < n; i++) {
        const h = ((k * n + i + 1) * FLOOR_H) / (2 * n);
        if (axis === 'x') {
          const len = (x1 - x0 - 1.4) / n;
          const xs = k === 0 ? x1 - 0.3 - (i + 0.5) * len : x0 + 1.1 + (i + 0.5) * len;
          const zc = k === 0 ? (z1 + (z0 + z1) / 2) / 2 : (z0 + (z0 + z1) / 2) / 2;
          d.position.set(xs, h / 2, zc); d.scale.set(len, h, (z1 - z0) / 2 - 0.15);
        } else {
          const len = (x1 - x0 - 1.4) / n;
          const xs = k === 0 ? x0 + 0.3 + (i + 0.5) * len : x1 - 1.1 - (i + 0.5) * len;
          const zc = k === 0 ? (z1 + (z0 + z1) / 2) / 2 : (z0 + (z0 + z1) / 2) / 2;
          d.position.set(xs, h / 2, zc); d.scale.set(len, h, (z1 - z0) / 2 - 0.15);
        }
        d.updateMatrix(); im.setMatrixAt(k * n + i, d.matrix);
      }
    }
    im.scale.y = 0.98; parent.add(im);
  }

  private instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: { p: V3; s?: V3; r?: number }[], parent: THREE.Object3D) {
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => {
      this.dummy.position.set(...it.p); this.dummy.rotation.set(0, it.r ?? 0, 0);
      this.dummy.scale.set(...(it.s ?? [1, 1, 1])); this.dummy.updateMatrix(); im.setMatrixAt(i, this.dummy.matrix);
    });
    parent.add(im); return im;
  }

  private buildInteriors(f: number, grp: THREE.Group) {
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const fronts = ROOMS.filter((r) => r.floor === f && r.z[0] === 0 && r.kind !== 'foyer');
    // Ашық тұрған ашық түсті ағаш есіктер (фото 1000302677)
    const doors: { p: V3; s: V3; r?: number }[] = fronts.map((r) => ({ p: [r.x[0] + 1.2 + 0.05, 1.03, 0.55] as V3, s: [0.05, 2.05, 1.0] as V3 }));
    this.instanced(unit, this.std(0xcdb48c, { roughness: 0.6 }), doors, grp);
    // Сынып жиһазы: ақ парталар, көк-сұр орындықтар, тақта (кабинет фотолары бойынша жалпы көрініс; нөмірге байланыстырылмаған)
    const desks: { p: V3; s: V3 }[] = [], chairs: { p: V3; s: V3 }[] = [], boards: { p: V3; s: V3 }[] = [];
    for (const r of fronts.filter((q) => q.kind === 'room' && q.x[1] - q.x[0] >= 5)) {
      const w = r.x[1] - r.x[0];
      boards.push({ p: [r.x[0] + 0.12, 1.5, 3.5], s: [0.06, 1.1, 2.6] });
      for (let row = 0; row < Math.min(4, Math.floor((w - 2.2) / 1.2)); row++) for (const z of [1.6, 3.5, 5.4]) {
        const x = r.x[0] + 2.0 + row * 1.25;
        desks.push({ p: [x, 0.74, z], s: [0.55, 0.05, 1.2] });
        chairs.push({ p: [x + 0.55, 0.45, z - 0.3], s: [0.38, 0.9, 0.38] }, { p: [x + 0.55, 0.45, z + 0.3], s: [0.38, 0.9, 0.38] });
      }
    }
    if (desks.length) {
      this.instanced(unit, this.std(0xf2f2ef), desks, grp);
      this.instanced(unit, this.std(0x5f7f9a), chairs, grp);
      this.instanced(unit, this.std(0x2f5a3c), boards, grp);
    }
    // Терезелердің ішкі көрінісі: ашық көгілдір әйнек және ақ жақтау (ішке кіргенде)
    const panes: { p: V3; s: V3 }[] = [], wframes: { p: V3; s: V3 }[] = [];
    for (let x = -33; x <= 19; x += 3.6) { if (f <= 2 && x > -24.4 && x < -2.8) continue; wframes.push({ p: [x, 1.95, -2.835], s: [1.62, 1.77, 0.02] }); panes.push({ p: [x, 1.95, -2.82], s: [1.4, 1.55, 0.02] }); }
    for (let x = -33.2; x <= 33.4; x += 3.25) { if (x > -20.1 && x < -5.7) continue; wframes.push({ p: [x, 1.95, FRONT_Z - 0.165], s: [1.67, 1.87, 0.02] }); panes.push({ p: [x, 1.95, FRONT_Z - 0.18], s: [1.45, 1.65, 0.02] }); }
    this.instanced(unit, this.std(0xffffff), wframes, grp);
    this.instanced(unit, new THREE.MeshBasicMaterial({ color: 0xcfe6f5 }), panes, grp);
    // Төбе (тек ішке кіргенде көрінеді)
    const ceil = new THREE.Group(); ceil.name = 'ceiling'; ceil.visible = false;
    const cm = new THREE.MeshBasicMaterial({ color: 0xe9e7e1, side: THREE.DoubleSide });
    const addC = (w: number, d: number, x: number, z: number) => { const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), cm); c.rotation.x = Math.PI / 2; c.position.set(x, FLOOR_H - 0.06, z); c.userData.noShadow = true; ceil.add(c); };
    addC(70, 10, 0, 2); addC(15.3, 5, 27.35, -5.5); if (f <= 2) addC(20, 18, -13.6, -12);
    // төбе шамдары
    const lamps: { p: V3; s: V3 }[] = [];
    for (let x = -26; x <= 30; x += 4) lamps.push({ p: [x, FLOOR_H - 0.1, -1.5], s: [1.2, 0.05, 0.18] });
    const li = this.instanced(unit, new THREE.MeshBasicMaterial({ color: 0xffffff }), lamps, ceil); li.userData.noShadow = true;
    grp.add(ceil); this.ceilings[f] = ceil;
    // Дәліз терезелеріндегі жасыл жалюзи
    const blinds: { p: V3; s: V3 }[] = [];
    for (let x = -33; x <= 19; x += 3.6) { if (f <= 2 && x > -24.4 && x < -2.8) continue; blinds.push({ p: [x, 2.45, -2.8], s: [1.3, 0.5, 0.02] }); }
    this.instanced(unit, this.std(0x3f9a80), blinds, grp);
    if (f === 2) {
      // Кітапхана: қабырға бойындағы сөрелер, ортада тіктөртбұрыш құрған үстелдер, көрме үстелі
      const books = new THREE.MeshStandardMaterial({ map: booksTexture(), roughness: 0.9 });
      const shelves: { p: V3; s: V3; r?: number }[] = [];
      for (let z = 0.8; z < 6.4; z += 1.05) shelves.push({ p: [-34.55, 1.0, z], s: [0.45, 2.0, 1.0] });
      for (let x = -33.6; x < -26.5; x += 1.05) if (x < -31 || x > -29.6) shelves.push({ p: [x, 1.0, 0.4], s: [1.0, 2.0, 0.45] });
      for (let z = 1.3; z < 6.0; z += 1.05) shelves.push({ p: [-25.75, 1.0, z], s: [0.45, 2.0, 1.0] });
      this.instanced(unit, books, shelves, grp);
      const wood = this.std(0xe2d2b0);
      const tables: { p: V3; s: V3 }[] = [
        { p: [-30.2, 0.75, 2.4], s: [4.2, 0.06, 0.8] }, { p: [-30.2, 0.75, 4.8], s: [4.2, 0.06, 0.8] },
        { p: [-32.0, 0.75, 3.6], s: [0.8, 0.06, 1.6] }, { p: [-28.4, 0.75, 3.6], s: [0.8, 0.06, 1.6] },
      ];
      this.instanced(unit, wood, tables, grp);
      const chairs: { p: V3; s: V3 }[] = [];
      for (let x = -31.6; x <= -28.8; x += 1.0) { chairs.push({ p: [x, 0.45, 1.75], s: [0.42, 0.9, 0.42] }); chairs.push({ p: [x, 0.45, 5.45], s: [0.42, 0.9, 0.42] }); }
      this.instanced(unit, this.std(0x2e3338), chairs, grp);
      this.box(2.0, 0.8, 0.7, this.std(0x7b1e22), -30.2, 0.4, 6.4, grp); // қызыл матамен жабылған көрме үстелі
      // Кітапхана терезелеріндегі көк-сары жолақты жалюзи (фото 1000304263)
      const stripe = document.createElement('canvas'); stripe.width = 64; stripe.height = 8; const sg = stripe.getContext('2d')!;
      for (let i = 0; i < 8; i++) { sg.fillStyle = i % 2 ? '#f2e7a8' : '#2f8fd0'; sg.fillRect(i * 8, 0, 8, 8); }
      const st = new THREE.CanvasTexture(stripe); st.colorSpace = THREE.SRGBColorSpace;
      for (const x of [-33.2, -29.95, -26.7]) { const b = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.6), new THREE.MeshStandardMaterial({ map: st, side: THREE.DoubleSide })); b.position.set(x, 2.0, FRONT_Z - 0.2); grp.add(b); }

      // Спорт залы: тор, баскетбол қалқандары, орындықтар, терезе жақтағы қорғаныс торы
      const gx = (-23.6 - 14.6) / 2;
      const net = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      net.position.set(gx, 2.2, -12); grp.add(net);
      this.box(0.08, 2.8, 0.08, this.std(0xdddddd), -23.3, 1.4, -12, grp); this.box(0.08, 2.8, 0.08, this.std(0xdddddd), -14.9, 1.4, -12, grp);
      for (const z of [-20.6, -3.4]) {
        this.box(1.8, 1.1, 0.06, this.std(0xffffff), gx, 2.9, z, grp);
        this.box(0.9, 0.6, 0.07, this.std(0xc8261c), gx, 2.75, z + (z < -10 ? 0.02 : -0.02), grp);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.025, 6, 16), this.std(0xe0571a));
        rim.rotation.x = Math.PI / 2; rim.position.set(gx, 2.45, z + (z < -10 ? 0.35 : -0.35)); grp.add(rim);
      }
      const benches: { p: V3; s: V3 }[] = [];
      for (let z = -19.5; z < -5; z += 2.6) benches.push({ p: [-15.0, 0.25, z], s: [0.4, 0.5, 2.2] });
      this.instanced(unit, this.std(0x9a6a3a), benches, grp);
      const guard = new THREE.Mesh(new THREE.PlaneGeometry(17, 3), new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
      guard.rotation.y = Math.PI / 2; guard.position.set(-23.0, 1.8, -12); grp.add(guard);
    }
    if (f === 1) {
      // Акт залы: сахна, перде, орындық қатарлары
      this.box(6.6, 0.6, 3.4, this.std(0x8a6a4a), -7.05, 0.3, -19.2, grp);
      this.box(6.6, 3.0, 0.1, this.std(0x2f8a8c), -7.05, 2.1, -20.85, grp);
      for (const x of [-10.2, -3.9]) this.box(0.6, 3.0, 0.12, this.std(0x2f8a8c), x, 1.5, -17.5, grp);
      const chairs: { p: V3; s: V3 }[] = [];
      for (let z = -16.2; z <= -4.5; z += 0.95) for (let x = -10.0; x <= -4.0; x += 0.62) if (Math.abs(x + 7.05) > 0.4) chairs.push({ p: [x, 0.45, z], s: [0.48, 0.9, 0.45] });
      this.instanced(unit, this.std(0xb84a3a), chairs, grp);
      // Акт залы терезелеріндегі көгілдір перделер (фото 1000303546)
      const cur: { p: V3; s: V3 }[] = [];
      for (let z = -19; z <= -5; z += 3.5) cur.push({ p: [-3.85, 2.0, z - 0.75], s: [0.04, 2.4, 0.45] }, { p: [-3.85, 2.0, z + 0.75], s: [0.04, 2.4, 0.45] }, { p: [-3.85, 3.0, z], s: [0.05, 0.4, 2.0] });
      this.instanced(unit, this.std(0x2b7f86), cur, grp);
      // Асхана: қара үстелдер, қызыл орындықтар
      for (const [z0, z1] of [[-13, -8], [-21, -13]] as const) {
        const tables: { p: V3; s: V3 }[] = []; const ch: { p: V3; s: V3 }[] = [];
        for (let z = z0 + 1.4; z < z1 - 0.8; z += 2.4) for (const x of [-21.6, -18.2]) {
          tables.push({ p: [x, 0.75, z], s: [2.2, 0.06, 0.9] });
          for (const dx of [-0.7, 0, 0.7]) { ch.push({ p: [x + dx, 0.45, z - 0.75], s: [0.4, 0.9, 0.4] }); ch.push({ p: [x + dx, 0.45, z + 0.75], s: [0.4, 0.9, 0.4] }); }
        }
        this.instanced(unit, this.std(0x2a2a2a), tables, grp);
        this.instanced(unit, this.std(0xb02a2a), ch, grp);
      }
      // Фойе: турникет және ақ бағаналар
      this.box(0.6, 3.4, 0.6, this.std(0xffffff), -15.4, 1.7, 3.2, grp); this.box(0.6, 3.4, 0.6, this.std(0xffffff), -10.4, 1.7, 3.2, grp);
      this.box(2.4, 1.0, 0.1, this.std(0xb0b6bb, { metalness: 0.6, roughness: 0.3 }), -12.9, 0.5, 4.6, grp);
      this.box(0.5, 1.0, 0.5, this.std(0x9aa1a6, { metalness: 0.5 }), -12.9, 0.5, 4.6, grp);
    }
  }

  // ---------------- айнала: жол, өрт бөлімі, гидрант ----------------
  private buildEnvironment() {
    // Схемалық жол (700 м — масштабсыз)
    const road = new THREE.Group();
    const rm = this.std(0x5e6266);
    const pts: V3[] = [[78, 0, -3], [78, 0, 18], [-2, 0, 18], [-6, 0, 14.5]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = new THREE.Vector3(...pts[i]), b = new THREE.Vector3(...pts[i + 1]);
      const len = a.distanceTo(b); const m = new THREE.Mesh(new THREE.BoxGeometry(len + 6, 0.05, 6), rm);
      m.position.copy(a).lerp(b, 0.5); m.position.y = 0.02; m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x); road.add(m);
    }
    // «≈» үзілу белгісі
    for (const dx of [-0.9, 0.9]) this.box(0.35, 0.08, 7.4, this.std(0xffffff), 46 + dx, 0.06, 18, road).rotation.y = 0.5;
    const rl = makeLabel('Жол ≈ 700 м\n(схема, масштабсыз)', { size: 24, scale: 1.1 }); rl.position.set(46, 3.2, 18); road.add(rl);
    this.scene.add(road);

    // Өрт бөлімі (фото 1000303538 бойынша кірпіш ғимарат)
    const st = new THREE.Group(); st.userData = { pick: 'station' };
    const bt = brickTexture(); bt.repeat.set(4, 2);
    const bm = new THREE.MeshStandardMaterial({ map: bt, roughness: 0.95 });
    const body = this.box(24, 7.4, 12, bm, 78, 3.7, -12, st); body.userData = { pick: 'station' }; this.pickables.push(body);
    for (const x of [73, 83]) this.box(4.6, 4.2, 0.2, this.std(0xd8d8d8), x, 2.1, -5.9, st);
    for (const x of [70, 76, 80, 86]) this.box(1.4, 1.4, 0.2, this.std(COL.glass), x, 5.8, -5.9, st);
    this.box(24.6, 0.4, 12.6, this.std(0x77553e), 78, 7.6, -12, st);
    const sl = makeLabel('Тұғыл өрт бөлімі\nмектепке дейін 700 м', { size: 24, scale: 1.1 }); sl.position.set(78, 10.4, -10); st.add(sl);
    this.scene.add(st);

    // Шартты гидрант («ПГ 50 м» белгісі бойынша; нақты орны белгісіз)
    const hy = new THREE.Group(); hy.userData = { pick: 'hydrant' };
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.0, 12), this.std(COL.red)); post.position.set(-46, 0.5, 24); post.userData = { pick: 'hydrant' };
    hy.add(post); this.pickables.push(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), this.std(COL.red)); cap.position.set(-46, 1.0, 24); hy.add(cap);
    const hl = makeLabel('Гидрант — су толықтыру орны\n(стадион маңы, орны схемалық)', { size: 22, scale: 1 }); hl.position.set(-46, 3.2, 24); hy.add(hl);
    this.scene.add(hy);

    // Сыртқы өрт қалқаны (фото 1000302682/683, шартты орын)
    // Сыртқы өрт қалқаны 3D-де көрсетілмейді: нақты орны жоспармен сәйкестендірілмеген (галереяда бар).

    // Эвакуация жоспарлары (фотосурет көшірмелері) — әр қабат жанында
    const loader = new THREE.TextureLoader();
    const base = import.meta.env.BASE_URL;
    const plans: Record<number, string> = { 1: '1000302672', 2: '1000302671', 3: '1000302670' };
    for (const f of [1, 2, 3]) {
      const t = loader.load(`${base}photos/web/${plans[f]}_oqu.jpg`); t.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
      m.userData = { pick: `plan-${f}`, floor: f };
      m.rotation.y = Math.PI / 2.6;
      this.plansGroup.add(m); this.pickables.push(m);
    }
    this.scene.add(this.plansGroup);
  }

  private buildTruck(kind: 'kamaz' | 'ural') {
    const g = new THREE.Group(); g.userData = { pick: kind };
    const red = this.std(0xd0261c), white = this.std(0xf4f4f4), black = this.std(0x1d1d1d), dark = this.std(0x2a3a4a, { roughness: 0.3 });
    const L = kind === 'ural' ? 8.6 : 7.6;
    const add = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => { const b = this.box(w, h, d, m, x, y, z, g); b.userData = { pick: kind }; return b; };
    add(L, 0.4, 2.0, black, 0, 0.85, 0);
    // кабина (алға +x)
    const cx = L / 2 - 1.1;
    add(2.0, 1.0, 2.45, kind === 'kamaz' ? white : red, cx, 1.5, 0);
    add(2.0, 1.2, 2.45, red, cx, 2.6, 0);
    add(0.05, 0.9, 2.1, dark, cx + 1.01, 2.65, 0);
    if (kind === 'ural') add(0.7, 0.55, 2.3, white, cx + 0.95, 1.25, 0);
    for (const s of [-1, 1]) add(1.6, 0.18, 0.04, white, cx, 2.0, s * 1.24);
    // шанақ
    const bx = -1.0 - (kind === 'ural' ? 0.3 : 0);
    const bodyL = L - 2.4;
    const shut = new THREE.MeshStandardMaterial({ map: shutterTexture(), roughness: 0.6 });
    add(bodyL, 2.3, 2.45, red, bx, 2.25, 0);
    for (const s of [-1, 1]) add(bodyL * 0.7, 1.4, 0.04, shut, bx, 2.0, s * 1.24);
    add(bodyL * 0.95, 0.06, 0.08, this.std(0x9aa1a6), bx, 3.55, 0.8); add(bodyL * 0.95, 0.06, 0.08, this.std(0x9aa1a6), bx, 3.55, -0.8);
    // доңғалақтар
    const wgeo = new THREE.CylinderGeometry(0.55, 0.55, 0.45, 16);
    const axles = kind === 'ural' ? [L / 2 - 1.3, -L / 2 + 2.4, -L / 2 + 1.1] : [L / 2 - 1.3, -L / 2 + 1.7];
    for (const ax of axles) for (const s of [-1, 1]) { const w = new THREE.Mesh(wgeo, black); w.rotation.x = Math.PI / 2; w.position.set(ax, 0.55, s * 1.05); g.add(w); }
    // белгі
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: plateTexture(kind === 'kamaz' ? 'TUGYL 16' : 'УРАЛ', '#ffffff', '#d42b1e') }));
    plate.rotation.y = Math.PI / 2; plate.position.set(cx + 1.04, 2.0, 0); g.add(plate);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.5), new THREE.MeshBasicMaterial({ map: plateTexture(kind === 'kamaz' ? 'TUGYL 16' : 'АЦ-6') }));
      side.position.set(cx, 1.5, s * 1.25); if (s < 0) side.rotation.y = Math.PI; g.add(side);
    }
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 1.2), this.std(0x2266ff, { emissive: 0x1133aa }));
    beacon.position.set(cx, 3.3, 0); g.add(beacon);
    return g;
  }

  private buildDynamic() {
    // Машиналар
    this.truckRoad = new Path([[78, 0, -3], [78, 0, 18], [-2, 0, 18], [-6, 0, 14.5]].map((p) => new THREE.Vector3(...(p as V3))));
    for (const id of ['kamaz', 'ural'] as const) {
      const g = this.buildTruck(id); this.scene.add(g); this.trucks[id] = g;
      g.traverse((o) => { if ((o as THREE.Mesh).isMesh) this.pickables.push(o); });
      const l = makeLabel(id === 'kamaz' ? 'КамАЗ АЦ-5' : 'Урал АЦ-6', { size: 24 }); this.scene.add(l); this.truckLabels[id] = l;
    }
    // Жеңдер: машинадан басты кіреберіске қарай
    const entrance = new THREE.Vector3(-12.9, 0.15, FRONT_Z + 3.4);
    for (const [id, spot] of [['kamaz', this.parkSpot('kamaz')], ['ural', this.parkSpot('ural')]] as const) {
      const a = spot.clone().add(new THREE.Vector3(-3.6, 0.3, 0));
      const curve = new THREE.CatmullRomCurve3([a, a.clone().lerp(entrance, 0.35).add(new THREE.Vector3(0, 0, 1.5)), a.clone().lerp(entrance, 0.7).add(new THREE.Vector3(0, 0, -1)), entrance]);
      const geo = new THREE.TubeGeometry(curve, 60, 0.13, 8, false);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1e6fd0 }));
      mesh.visible = false; this.scene.add(mesh);
      this.hoses[id] = { mesh, curve, count: geo.index!.count };
    }
    // Гидранттан толықтыру жеңі (КамАЗ-ға)
    const end = this.parkSpot('kamaz').add(new THREE.Vector3(-3.6, 0.3, 0.8));
    const hp = new THREE.CatmullRomCurve3([new THREE.Vector3(-46, 0.3, 24), new THREE.Vector3(-30, 0.15, 22), new THREE.Vector3((end.x - 30) / 2, 0.15, 21), end]);
    this.hydrantHose = new THREE.Mesh(new THREE.TubeGeometry(hp, 60, 0.16, 8, false), new THREE.MeshStandardMaterial({ color: 0x3d8b40 }));
    this.hydrantHose.visible = false; this.scene.add(this.hydrantHose);
    this.hydrantCurve = hp;
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.16, 6, 5), new THREE.MeshBasicMaterial({ color: 0x7fd3ff }), 60);
    this.drops.count = 0; this.drops.frustumCulled = false; this.scene.add(this.drops);

    // Цистерналардағы су деңгейі (машина үстінде)
    for (const id of ['kamaz', 'ural'] as const) {
      const g = new THREE.Group();
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 3, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
      shell.position.y = 1.5; g.add(shell);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 6, 28), this.std(0x5b6670)); rim.rotation.x = Math.PI / 2; rim.position.y = 3; g.add(rim);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.08, 28), this.std(0x5b6670)); g.add(base);
      const water = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1, 28), new THREE.MeshStandardMaterial({ color: 0x2f8fd8, roughness: 0.3 }));
      g.add(water);
      const label = makeLabel(' ', { size: 22 }); label.position.y = 4.2; g.add(label);
      g.visible = false; this.scene.add(g);
      this.tanks[id] = { g, water, label, text: '' };
    }

    // Есептік бөлме (мектептің жанында бөлек; өлшемі параметр бойынша)
    this.calcRoom = new THREE.Group(); this.calcRoom.position.set(ROOM_C.x, 0, ROOM_C.z); this.calcRoom.userData = { pick: 'calcroom' };
    this.scene.add(this.calcRoom);
    const fg = new THREE.Group(); this.fireGroup = fg; this.calcRoom.add(fg);
    this.fireDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 72), new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.78, depthWrite: false }));
    this.fireDisc.rotation.x = -Math.PI / 2; this.fireDisc.position.y = 0.09; this.fireDisc.renderOrder = 3; fg.add(this.fireDisc);
    this.fireEdge = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 72), new THREE.MeshBasicMaterial({ color: 0xb3260f, side: THREE.DoubleSide }));
    this.fireEdge.rotation.x = -Math.PI / 2; this.fireEdge.position.y = 0.1; fg.add(this.fireEdge);
    this.fireFlame = new THREE.Group();
    const flameM = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 7; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1, 10), flameM); const a = (i / 7) * Math.PI * 2;
      c.position.set(i ? Math.cos(a) * 0.45 : 0, 0.5, i ? Math.sin(a) * 0.45 : 0); c.scale.y = i ? 0.7 : 1.2; this.fireFlame.add(c);
    }
    fg.add(this.fireFlame);
    this.fireLabel = makeLabel(' ', { size: 22, bg: '#ffffff', border: '#c8261c' }); this.fireLabel.position.y = 3.4; fg.add(this.fireLabel);
    this.limitRing = new THREE.Mesh(new THREE.RingGeometry(0.985, 1, 72), new THREE.MeshBasicMaterial({ color: 0x5b6670, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    this.limitRing.rotation.x = -Math.PI / 2; this.limitRing.position.y = 0.08; fg.add(this.limitRing);

    // Адам белгілері
    const capsule = new THREE.CapsuleGeometry(0.3, 1.0, 3, 8); capsule.translate(0, 0.8, 0);
    this.evacMesh = new THREE.InstancedMesh(capsule, new THREE.MeshStandardMaterial({ color: 0xffffff }), this.evacMax);
    this.evacMesh.count = 0; this.evacMesh.frustumCulled = false; this.scene.add(this.evacMesh);
    this.staffMesh = new THREE.InstancedMesh(capsule, new THREE.MeshStandardMaterial({ color: 0xffffff }), 80);
    this.staffMesh.count = 0; this.staffMesh.frustumCulled = false; this.scene.add(this.staffMesh);
    this.ghostMesh = new THREE.InstancedMesh(capsule, new THREE.MeshStandardMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.32 }), 80);
    this.ghostMesh.count = 0; this.ghostMesh.frustumCulled = false; this.scene.add(this.ghostMesh);
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < this.evacMax; i++) this.evacMesh.setColorAt(i, white);
    for (let i = 0; i < 80; i++) this.staffMesh.setColorAt(i, white);
    for (const id of ['r1', 'r2']) { const l = makeLabel(' ', { size: 22 }); l.visible = false; this.scene.add(l); this.evacLabels[id] = { s: l, text: '' }; }
    this.scene.add(this.staffLabels);
    this.scene.add(this.routesGroup);
  }

  private buildCalcRoom(a: number, b: number) {
    const g = this.calcRoom;
    g.children.filter((c) => c !== this.fireGroup).forEach((c) => { g.remove(c); c.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); }); });
    const grid = document.createElement('canvas'); grid.width = grid.height = 64;
    const gg = grid.getContext('2d')!; gg.fillStyle = '#f4efe4'; gg.fillRect(0, 0, 64, 64); gg.strokeStyle = 'rgba(80,90,100,0.35)'; gg.lineWidth = 2; gg.strokeRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(grid); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(a, b);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(a, b), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = 0.05; floor.receiveShadow = true; floor.userData = { pick: 'calcroom' }; g.add(floor); this.pickables.push(floor);
    const wm = this.std(0xede3c2), H = 1.1, T = 0.18;
    this.box(a + T * 2, H, T, wm, 0, H / 2, -b / 2 - T / 2, g); this.box(a + T * 2, H, T, wm, 0, H / 2, b / 2 + T / 2, g);
    this.box(T, H, b, wm, -a / 2 - T / 2, H / 2, 0, g); this.box(T, H, b, wm, a / 2 + T / 2, H / 2, 0, g);
    const la = makeLabel(`a = ${fmt(a)} м`, { size: 20, scale: 0.85 }); la.position.set(0, 0.4, b / 2 + 1.1); g.add(la);
    const lb = makeLabel(`b = ${fmt(b)} м`, { size: 20, scale: 0.85 }); lb.position.set(a / 2 + 1.6, 0.4, 0); g.add(lb);
    const lt = makeLabel(`Есептік бөлме: ${fmt(a)} × ${fmt(b)} м, S = ${fmt(a * b)} м²`, { size: 22, border: '#0f8b8d' }); lt.position.set(-a / 2 - 1, 1.6, b / 2 + 2.6); g.add(lt);
    // Жең: машинадан бөлмеге (өрт пен келу көрінісі)
    if (this.roomHose) { this.scene.remove(this.roomHose.mesh); this.roomHose.mesh.geometry.dispose(); }
    const s = this.parkSpot('kamaz').add(new THREE.Vector3(-3.6, 0.3, 0.6));
    const e = new THREE.Vector3(ROOM_C.x - a / 4, 0.25, ROOM_C.z - b / 2 + 0.6);
    const curve = new THREE.CatmullRomCurve3([s, new THREE.Vector3(s.x - 1, 0.15, s.z + 4), new THREE.Vector3((s.x + e.x) / 2, 0.15, (s.z + e.z) / 2 + 2), new THREE.Vector3(e.x, 0.15, e.z - 2.5), e]);
    const geo = new THREE.TubeGeometry(curve, 80, 0.13, 8, false);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x1e6fd0 })); mesh.visible = false; this.scene.add(mesh);
    this.roomHose = { mesh, curve, count: geo.index!.count };
  }

  private parkSpot(id: 'kamaz' | 'ural') { return new THREE.Vector3(id === 'kamaz' ? -1 : 9.5, 0, 13.6); }
  private stationSpot(id: 'kamaz' | 'ural') { return new THREE.Vector3(id === 'kamaz' ? 73 : 83, 0, -3); }

  // ---------------- көрініс параметрлері ----------------
  setView(v: Partial<ViewOpts>) { this.view = { ...this.view, ...v }; this.applyView(); }

  private applyView() {
    const v = this.view;
    for (const f of [1, 2, 3]) {
      const g = this.floors[f]; if (!g) continue;
      g.visible = this.walk.on ? f === this.walk.floor : v.floor === 'all' || v.floor === f;
      if (this.ceilings[f]) this.ceilings[f].visible = this.walk.on;
      if (this.indoor) this.indoor.intensity = this.walk.on ? 1.4 : 0;
      g.position.y = this.floorY(f - 1);
      this.outer[f].visible = !v.hideWalls;
      this.labels[f].visible = !this.walk.on && v.showLabels && (v.hideWalls || v.floor !== 'all' || v.exploded);
    }
    this.roof.visible = !this.walk.on && !v.hideRoof && v.floor === 'all';
    this.roof.position.y = this.floorY(3);
    const wr = this.roof.getObjectByName('wingRoof');
    if (wr) wr.position.y = this.floorY(2) - this.floorY(3) + 0.25;
    this.plansGroup.visible = v.showPlans;
    this.plansGroup.children.forEach((m) => {
      const f = m.userData.floor as number;
      m.visible = v.floor === 'all' || v.floor === f;
      m.position.set(-52, this.floorY(f - 1) + 6.2 + (v.exploded ? 0 : (f - 1) * 9), -8 + (f - 2) * (v.exploded ? 0 : 4));
    });
    this.updateRoutes();
    this.updateSelection();
  }

  setResults(R: Results) {
    const first = !this.results;
    const prev = this.results?.params.room;
    this.results = R;
    if (first || !prev || prev.a !== R.params.room.a || prev.b !== R.params.room.b) this.buildCalcRoom(R.params.room.a, R.params.room.b);
    this.updateRoutes();
  }

  select(id: string | null) { this.selectedId = id; this.updateSelection(); }

  private updateSelection() {
    const m = this.selectedId ? this.roomMeshes.get(this.selectedId) : null;
    this.roomMeshes.forEach((mesh, id) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive?.setHex(id === this.selectedId ? 0xff8a2a : 0x000000);
      if (mat.emissive) mat.emissiveIntensity = id === this.selectedId ? 0.45 : 0;
    });
    if (!m) { this.selBox.visible = false; return; }
    const r = ROOMS.find((x) => x.id === this.selectedId)!;
    this.selBox.visible = this.floors[r.floor].visible;
    this.selBox.scale.set(r.x[1] - r.x[0], 2.4, r.z[1] - r.z[0]);
    this.selBox.position.set((r.x[0] + r.x[1]) / 2, this.floorY(r.floor - 1) + 1.2, (r.z[0] + r.z[1]) / 2);
  }

  private lv(p: V3) { return new THREE.Vector3(p[0], this.floorY(p[1]) + 0.12, p[2]); }

  /** Эвакуация көріністерінде ғана бағыттар көрсетіледі. */
  private routeIds(): ('r1' | 'r2')[] {
    const m = this.snap?.mode; const R = this.results;
    if (m === 'evac2') return R?.params.evac2.two ? ['r1', 'r2'] : ['r1'];
    if (m === 'evacAll') return ['r1', 'r2'];
    return [];
  }

  private updateRoutes() {
    const g = this.routesGroup;
    g.children.slice().forEach((c) => { g.remove(c); (c as THREE.Mesh).geometry?.dispose(); });
    const ids = this.routeIds();
    this.routeKey = ids.join(',') + '|' + this.view.exploded;
    for (const id of ['r1', 'r2'] as const) {
      const rp = ROUTE_PATHS[id];
      const pts = [...rp.corridor, ...rp.stairs.slice(1), rp.door].map((p) => this.lv(p));
      this.paths[id] = new Path(pts);
      this.paths[id + '-corr'] = new Path(rp.corridor.map((p) => this.lv(p)));
      this.paths[id + '-stair'] = new Path([...rp.stairs, rp.door].map((p) => this.lv(p)));
      if (!ids.includes(id)) continue;
      const color = id === 'r1' ? 0x0f8b8d : 0x2b6cb0;
      const path = this.paths[id];
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05), 120, 0.12, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 })));
      for (let s = 2; s < path.len; s += 4) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 8), new THREE.MeshBasicMaterial({ color }));
        const p = path.at(s); const d = path.dirAt(s);
        c.position.copy(p).add(new THREE.Vector3(0, 0.15, 0));
        c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); c.userData.arrow = true; g.add(c);
      }
      const c0 = this.lv(rp.corridor[0]), c1 = this.lv(rp.corridor[rp.corridor.length - 1]);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(c1.x - c0.x) + 1, 0.12, 3), new THREE.MeshBasicMaterial({ color: 0xbfe3e4, transparent: true, opacity: 0.55, depthWrite: false }));
      strip.position.set((c0.x + c1.x) / 2, c0.y - 0.1, -1.5); g.add(strip);
      const sl = makeLabel('2-қабат дәлізі', { size: 18, scale: 0.8, border: '#0f8b8d' }); sl.position.set((c0.x + c1.x) / 2, c0.y + 1.6, -1.5); g.add(sl);
      const door = rp.door; const m = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 1.2), new THREE.MeshBasicMaterial({ color: 0x1f9d55 }));
      m.position.set(door[0], this.floorY(0) + 0.08, door[2]); g.add(m);
    }
    g.visible = this.view.showRoutes && ids.length > 0;
  }

  // ---------------- динамика: snapshot → көрініс ----------------
  setSnapshot(s: Snapshot) {
    const modeChanged = this.snap?.mode !== s.mode;
    this.snap = s;
    if (modeChanged || this.routeIds().join(',') + '|' + this.view.exploded !== this.routeKey) this.updateRoutes();
  }

  /** Таңдалған есепке сай камера. */
  focusMode(mode: SceneMode) {
    if (this.walk.on) return;
    if (mode === 'fire' || mode === 'overview') this.setCam(ROOM_C.x + 34, 44, ROOM_C.z + 30, ROOM_C.x + 10, 0, ROOM_C.z - 14);
    else if (mode === 'evac2' || mode === 'evacAll') this.setCam(-9, 66, 52, -9, 0, -5);
    else if (mode === 'water') this.setCam(8, 16, 40, 4, 2, 14);
    else if (mode === 'refill') this.setCam(-14, 30, 52, -20, 0, 14);
    else if (mode === 'staff') this.setCam(6, 14, 40, 6, 1, 19);
  }

  private frame() {
    const now = performance.now(); const dt = Math.min(0.1, (now - this.lastT) / 1000); this.lastT = now;
    if (this.walk.on) this.stepWalk(dt); else this.controls.update();
    const s = this.snap, R = this.results;
    if (s && R) {
      this.updateTrucks(s, R);
      const flows = [...this.updateFire(s), ...this.updateTanks(s, R)];
      let n = 0; for (const c of flows) n = this.flowDrops(c, s.sec, n);
      this.drops.count = n; this.drops.instanceMatrix.needsUpdate = true;
      this.updateEvac(s);
      this.updateStaff(s, R);
    }
    if (this.walk.on) this.scene.traverse((o) => { if ((o as THREE.Sprite).isSprite && !Object.values(this.floors).includes(o.parent?.parent as THREE.Group)) o.visible = false; });
    this.renderer.render(this.scene, this.camera);
  }

  private truckPos(id: 'kamaz' | 'ural', s: Snapshot, R: Results): { pos: THREE.Vector3; dir: THREE.Vector3; text: string } {
    const st = { pos: this.stationSpot(id), dir: new THREE.Vector3(0, 0, -1) };
    const park = { pos: this.parkSpot(id), dir: new THREE.Vector3(1, 0, 0) };
    const name = id === 'kamaz' ? 'КамАЗ АЦ-5' : 'Урал АЦ-6';
    if (s.mode === 'fire' && id === 'kamaz' && s.truck) {
      const ph = s.truck.phase;
      if (ph === 'driving') { const L = this.truckRoad.len; return { pos: this.truckRoad.at(s.truck.frac * L), dir: this.truckRoad.dirAt(s.truck.frac * L), text: `${name}\nжолда` }; }
      if (ph === 'prep' || ph === 'water') return { ...park, text: `${name}\n${ph === 'prep' ? 'су беруге дайындалу' : 'су беріп жатыр'}` };
      return { ...st, text: `${name}\n${ph === 'gather' ? 'жиналу' : 'бөлімде'}` };
    }
    const at = (s.mode === 'water' && s.tanks.find((t) => t.id === id)?.present) || (s.mode === 'refill' && id === 'kamaz') || (s.mode === 'staff' && (id === 'kamaz' || R.params.staff.d >= 2));
    return at ? { ...park, text: name } : { ...st, text: `${name}\nбөлімде` };
  }

  private updateTrucks(s: Snapshot, R: Results) {
    for (const id of ['kamaz', 'ural'] as const) {
      const g = this.trucks[id]; const lab = this.truckLabels[id];
      const { pos, dir, text } = this.truckPos(id, s, R);
      g.position.copy(pos); g.rotation.y = Math.atan2(-dir.z, dir.x);
      if (lab.userData.txt !== text) { updateLabel(lab, text, { size: 22 }); lab.userData.txt = text; }
      lab.position.copy(pos).add(new THREE.Vector3(0, s.mode === 'water' || s.mode === 'refill' ? 9.4 : 5.2, 0));
      lab.visible = !this.walk.on && !((s.mode === 'water' || s.mode === 'refill') && s.tanks.find((t) => t.id === id)?.present);
      const parked = pos.distanceTo(this.parkSpot(id)) < 0.1;
      const hose = this.hoses[id];
      const tank = s.tanks.find((t) => t.id === id);
      hose.mesh.visible = parked && (s.mode === 'water' || s.mode === 'refill') && !!tank?.present;
    }
  }

  private updateFire(s: Snapshot) {
    const on = s.mode === 'fire' && !!s.fire;
    this.calcRoom.visible = s.mode === 'fire' || s.mode === 'overview';
    this.fireGroup.visible = on;
    const hose = this.roomHose;
    const out: THREE.Curve<THREE.Vector3>[] = [];
    if (hose) {
      const ph = s.truck?.phase;
      hose.mesh.visible = on && (ph === 'prep' || ph === 'water');
      if (hose.mesh.visible) hose.mesh.geometry.setDrawRange(0, Math.floor((ph === 'water' ? 1 : s.truck!.frac) * hose.count / 6) * 6);
      if (on && ph === 'water') out.push(hose.curve);
    }
    if (!on || !s.fire) return out;
    const f = s.fire; const r = Math.max(0.001, f.r);
    this.fireDisc.scale.set(r, r, 1); this.fireEdge.scale.set(r, r, 1);
    (this.fireDisc.material as THREE.MeshBasicMaterial).color.setHex(f.limited ? 0xd8431a : 0xff5a1a);
    this.limitRing.scale.set(f.rMax, f.rMax, 1);
    const k = Math.min(1.6, 0.25 + r * 0.45) * (1 + 0.08 * Math.sin(performance.now() / 160));
    this.fireFlame.scale.set(Math.min(1.8, 0.4 + r * 0.4), k, Math.min(1.8, 0.4 + r * 0.4));
    this.fireFlame.visible = f.tMin > 0;
    const txt = f.tMin <= 0 ? 'Тұтану сәті, t = 0' : f.limited
      ? `Өрт қабырғаға жетті: r = ${fmt(f.rMax)} м\nШеңбер есебі осы сәтке дейін`
      : `t = ${fmt(f.tMin, 2)} мин\nr = ${fmt(f.r, 2)} м, S = ${fmt(f.S, 2)} м²`;
    if (txt !== this.fireText) { updateLabel(this.fireLabel, txt, { size: 22, bg: '#ffffff', border: '#c8261c' }); this.fireText = txt; }
    return out;
  }

  /** Жең бойымен тамшылар (тек t-ға тәуелді). */
  private flowDrops(c: THREE.Curve<THREE.Vector3>, sec: number, start: number) {
    let n = start; const per = 18;
    for (let i = 0; i < per && n < 60; i++) {
      const u = (((sec / 10) + i / per) % 1 + 1) % 1;
      c.getPointAt(u, this.tmp); this.dummy.position.copy(this.tmp).add(new THREE.Vector3(0, 0.15, 0));
      this.dummy.scale.setScalar(1); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix(); this.drops.setMatrixAt(n++, this.dummy.matrix);
    }
    return n;
  }

  private updateTanks(s: Snapshot, R: Results) {
    const show = s.mode === 'water' || s.mode === 'refill';
    const curves: THREE.Curve<THREE.Vector3>[] = [];
    for (const id of ['kamaz', 'ural'] as const) {
      const T = this.tanks[id]; const tk = s.tanks.find((x) => x.id === id);
      T.g.visible = show && !!tk?.present;
      if (!T.g.visible || !tk) continue;
      T.g.position.copy(this.parkSpot(id)).add(new THREE.Vector3(-1, 4.1, 0));
      const h = Math.max(0.001, tk.cap > 0 ? Math.min(1, tk.V / tk.cap) : 0) * 2.9;
      T.water.scale.set(1, h, 1); T.water.position.y = 0.05 + h / 2;
      (T.water.material as THREE.MeshStandardMaterial).color.setHex(tk.V <= 0 ? 0xe67e22 : 0x2f8fd8);
      const name = id === 'kamaz' ? 'АЦ-5' : 'АЦ-6';
      const txt = `${name}: ${fmt(Math.round(tk.V), 0)} л\n${tk.flow > 0 ? `беріп жатыр ${fmt(tk.flow, 2)} л/с` : tk.V <= 0 ? 'бос' : 'күтіп тұр'}`;
      if (txt !== T.text) { updateLabel(T.label, txt, { size: 22, border: tk.V <= 0 ? '#e67e22' : '#2f8fd8' }); T.text = txt; }
      const m = this.hoses[id].mesh.material as THREE.MeshStandardMaterial; m.color.setHex(tk.flow > 0 ? 0x1e6fd0 : 0x8f99a3);
      if (tk.flow > 0) curves.push(this.hoses[id].curve);
    }
    const refillOn = s.mode === 'refill' && !!s.refill?.on;
    this.hydrantHose.visible = refillOn;
    if (refillOn && R.params.refill.qIn > 0) curves.push(this.hydrantCurve);
    return curves;
  }

  private updateEvac(s: Snapshot) {
    const d = this.dummy; let n = 0; const tint = new THREE.Color();
    const groups = s.groups;
    const total = groups.reduce((a, g) => a + g.N, 0);
    const k = Math.max(1, Math.ceil(total / (this.evacMax - 10)));
    for (const id of ['r1', 'r2']) this.evacLabels[id].s.visible = false;
    for (const g of groups) {
      const path = this.paths[g.path]; if (!path) continue;
      const corr = this.paths[g.path + '-corr'], stair = this.paths[g.path + '-stair'];
      const Lc = corr.len, L = path.len;
      let head = 0;
      if (g.phase === 'walk') head = g.part === 'corr' ? g.frac * Lc : Lc + g.frac * (L - Lc);
      else if (g.phase === 'pass' || g.phase === 'done' || (g.phase === 'blocked' && g.part === 'stair')) head = L;
      void stair;
      const figs = Math.ceil(g.N / k);
      const queueFigs = Math.ceil(g.queue / k);
      const exitedFigs = figs - queueFigs;
      const door = path.at(L); const outDir = path.dirAt(L);
      for (let i = 0; i < figs && n < this.evacMax; i++) {
        let p: THREE.Vector3;
        if (i < exitedFigs) {
          p = door.clone().addScaledVector(outDir, 2.6 + Math.floor(i / 6) * 0.8).add(new THREE.Vector3(outDir.z, 0, -outDir.x).multiplyScalar(((i % 6) - 2.5) * 0.7));
          tint.setHex(0x1f9d55);
        } else {
          const rank = i - exitedFigs; const row = Math.floor(rank / 3), col = (rank % 3) - 1;
          const sPos = head - 0.5 - row * 0.6;
          p = path.at(Math.min(sPos, L));
          const dir = path.dirAt(Math.max(0, Math.min(L, sPos)));
          p.add(new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(col * 0.6));
          tint.setHex(g.phase === 'blocked' ? 0xe67e22 : g.phase === 'wait' ? 0x8a94a0 : g.path === 'r1' ? 0x075456 : 0x1d4ed8);
        }
        d.position.copy(p); d.position.y -= 0.12; d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix();
        this.evacMesh.setMatrixAt(n, d.matrix); this.evacMesh.setColorAt(n, tint); n++;
      }
      const L0 = this.evacLabels[g.path];
      const ph = { wait: 'шығуға дайындалу', walk: 'жүріп келеді', pass: `есіктен өтіп жатыр · кезекте ${g.queue}`, done: 'барлығы шықты', blocked: 'есептелмейді (жылдамдық не қарқын 0)' }[g.phase];
      const txt = `${g.path === 'r1' ? '1' : '2'}-бағыт: ${g.N} адам\nшықты ${g.exited} · ${ph}\n1 белгі = ${k} адам`;
      if (txt !== L0.text) { updateLabel(L0.s, txt, { size: 20, border: g.path === 'r1' ? '#0f8b8d' : '#2b6cb0' }); L0.text = txt; }
      L0.s.position.copy(door).add(new THREE.Vector3(outDir.x * 4, 4.2, outDir.z * 4 + (g.path === 'r1' ? 0 : -2)));
      L0.s.visible = !this.walk.on;
    }
    this.evacMesh.count = n; this.evacMesh.instanceMatrix.needsUpdate = true; if (this.evacMesh.instanceColor) this.evacMesh.instanceColor.needsUpdate = true;
  }

  private updateStaff(s: Snapshot, R: Results) {
    const d = this.dummy; const c = new THREE.Color();
    let n = 0, gh = 0;
    const on = s.mode === 'staff' && !!s.staff;
    this.staffLabels.visible = on;
    if (on) {
      const p = R.params.staff;
      const tasks: { name: string; count: number; color: number }[] = [];
      for (let i = 0; i < p.k; i++) tasks.push({ name: `Су беру тобы ${i + 1}`, count: p.n, color: [0x2b6cb0, 0x0f8b8d, 0x6d4c8d, 0x3c6e47][i % 4] });
      if (p.d) tasks.push({ name: 'Жүргізуші', count: p.d, color: 0x8a5a2b });
      if (p.c) tasks.push({ name: 'Басқару', count: p.c, color: 0x1d2a35 });
      const key = JSON.stringify(tasks) + p.avail;
      const base = this.parkSpot('kamaz').add(new THREE.Vector3(-3.5, 0, 5.5));
      const door = this.parkSpot('kamaz').add(new THREE.Vector3(1.2, 0, 1.6));
      let left = p.avail; const fr = s.staff!.frac;
      if (key !== this.staffKey) {
        this.staffLabels.children.slice().forEach((o) => this.staffLabels.remove(o));
        tasks.forEach((t, ti) => { const l = makeLabel(`${t.name}\n${t.count} адам`, { size: 22, scale: 0.95 }); l.position.copy(base).add(new THREE.Vector3(ti * STAFF_DX, 2.6, -0.4)); this.staffLabels.add(l); });
        const filled = Math.min(p.avail, tasks.reduce((a, t) => a + t.count, 0)); const P = tasks.reduce((a, t) => a + t.count, 0);
        const sum = makeLabel(`Қажет ${P} · бар ${p.avail}${P > p.avail ? ` · ${P - p.avail} орын бос` : ''}\n(${filled} адам орнында; бір адам — бір міндет)`, { size: 22, border: P > p.avail ? '#e67e22' : '#1f9d55' });
        sum.position.copy(base).add(new THREE.Vector3(Math.max(0, tasks.length - 1) * STAFF_DX / 2, 4.6, -0.4)); this.staffLabels.add(sum);
        this.staffKey = key;
      }
      tasks.forEach((t, ti) => {
        for (let j = 0; j < t.count; j++) {
          const slot = base.clone().add(new THREE.Vector3(ti * STAFF_DX, 0, j * 0.85));
          if (left > 0) {
            left--;
            const pnt = door.clone().lerp(slot, fr);
            d.position.copy(pnt); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix();
            this.staffMesh.setMatrixAt(n, d.matrix); this.staffMesh.setColorAt(n, c.setHex(t.color)); n++;
          } else {
            d.position.copy(slot); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); this.ghostMesh.setMatrixAt(gh++, d.matrix);
          }
        }
      });
    }
    this.staffMesh.count = n; this.staffMesh.instanceMatrix.needsUpdate = true; if (this.staffMesh.instanceColor) this.staffMesh.instanceColor.needsUpdate = true;
    this.ghostMesh.count = gh; this.ghostMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------------- ішке кіру (бірінші адам көрінісі) ----------------
  /** Сыртқы түймелер (сенсорлы экран) үшін: 'f' алға, 'b' артқа, 'l'/'r' бұрылу. */
  hold(dir: 'f' | 'b' | 'l' | 'r', on: boolean) { const k = { f: 'arrowup', b: 'arrowdown', l: 'arrowleft', r: 'arrowright' }[dir]; if (on) this.keys.add(k); else this.keys.delete(k); }

  enterWalk(spot: WalkSpot) {
    this.walk = { on: true, floor: spot.floor, x: spot.x, z: spot.z, yaw: spot.yaw, pitch: -0.05 };
    this.controls.enabled = false;
    this.view = { ...this.view, exploded: false };
    this.camera.fov = 70; this.camera.near = 0.1; this.camera.updateProjectionMatrix();
    this.partitions.forEach((m) => { m.scale.y = 3.45 / 2.2; m.position.y = 3.45 / 2; });
    this.applyView();
    this.onWalkChange(true, spot.floor);
  }

  exitWalk() {
    if (!this.walk.on) return;
    this.walk.on = false; this.keys.clear();
    this.controls.enabled = true;
    this.camera.fov = 45; this.camera.near = 0.5; this.camera.updateProjectionMatrix();
    this.partitions.forEach((m) => { m.scale.y = 1; m.position.y = 1.1; });
    this.scene.traverse((o) => { if ((o as THREE.Sprite).isSprite) o.visible = true; });
    this.applyView();
    this.resetCamera();
    this.onWalkChange(false, 0);
  }

  private blocked(f: number, x: number, z: number) {
    const r = 0.28;
    return (this.colliders[f] ?? []).some((c) => x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r);
  }

  private stepWalk(dt: number) {
    const w = this.walk, k = this.keys;
    const turn = (k.has('arrowleft') || k.has('q') ? 1 : 0) - (k.has('arrowright') || k.has('e') ? 1 : 0);
    w.yaw += turn * 1.8 * dt;
    const fwd = (k.has('w') || k.has('ц') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('ы') || k.has('arrowdown') ? 1 : 0);
    const side = (k.has('d') || k.has('в') ? 1 : 0) - (k.has('a') || k.has('ф') ? 1 : 0);
    if (fwd || side) {
      const sp = 3.2 * dt;
      const fx = -Math.sin(w.yaw), fz = -Math.cos(w.yaw);
      const dx = (fx * fwd + -fz * side) * sp, dz = (fz * fwd + fx * side) * sp;
      if (!this.blocked(w.floor, w.x + dx, w.z)) w.x += dx;
      if (!this.blocked(w.floor, w.x, w.z + dz)) w.z += dz;
      w.x = Math.max(-34.7, Math.min(34.7, w.x)); w.z = Math.max(-20.7, Math.min(6.7, w.z));
    }
    const y = this.floorY(w.floor - 1) + 1.6;
    this.camera.position.set(w.x, y, w.z);
    const dir = new THREE.Vector3(-Math.sin(w.yaw) * Math.cos(w.pitch), Math.sin(w.pitch), -Math.cos(w.yaw) * Math.cos(w.pitch));
    this.camera.lookAt(this.camera.position.clone().add(dir));
  }

  // ---------------- өрт қауіпсіздігі жабдықтары ----------------
  private buildFireCabinet(grp: THREE.Group, labels: THREE.Group, x: number) {
    // Фото 1000302679 бойынша: ақ шкаф, жоғарғы бөлікте өрт сөндіргіш, төменгі бөлікте жең
    const z = -2.86, cab = new THREE.Group(); cab.userData = { pick: 'pg' };
    const white = this.std(0xf2f2f2), red = this.std(0xc8261c), glass = new THREE.MeshStandardMaterial({ color: 0x9fc3d6, transparent: true, opacity: 0.35, roughness: 0.1 });
    const parts = [
      this.box(0.8, 1.5, 0.24, white, x, 1.15, z, cab),
      this.box(0.62, 0.62, 0.02, glass, x, 1.55, z + 0.13, cab),
      this.box(0.62, 0.62, 0.02, glass, x, 0.82, z + 0.13, cab),
      this.box(0.06, 0.28, 0.02, red, x - 0.33, 1.55, z + 0.14, cab),
      this.box(0.06, 0.28, 0.02, red, x - 0.33, 0.82, z + 0.14, cab),
    ];
    const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.45, 12), red); ext.position.set(x + 0.05, 1.52, z + 0.03); cab.add(ext);
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 18), this.std(0xe9e4d4)); hose.position.set(x + 0.05, 0.82, z + 0.03); cab.add(hose);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: plateTexture('ПК', '#c8261c', '#ffffff') }));
    sign.position.set(x + 0.6, 1.7, z + 0.13); cab.add(sign);
    [...parts, ext, hose].forEach((m) => { m.userData = { pick: 'pg' }; this.pickables.push(m); });
    grp.add(cab);
    const l = makeLabel('Өрт шкафы (ПГ)', { size: 22, bg: '#c8261c', fg: '#fff', scale: 0.7 }); l.position.set(x, 2.25, -2.6); labels.add(l);
  }

  private buildCallPoint(grp: THREE.Group, x: number, y: number, z: number, rotY: number) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rotY; g.userData = { pick: 'callpoint' };
    const body = this.box(0.16, 0.16, 0.05, this.std(0xd62d20), 0, 0, 0.02, g);
    const btn = this.box(0.08, 0.08, 0.03, this.std(0xffffff), 0, 0, 0.05, g);
    [body, btn].forEach((m) => { m.userData = { pick: 'callpoint' }; this.pickables.push(m); });
    grp.add(g);
  }

  private buildExitSign(grp: THREE.Group, x: number, y: number, z: number, rotY: number) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.24), new THREE.MeshBasicMaterial({ map: plateTexture('ШЫҒУ', '#1f9d55', '#ffffff') }));
    m.position.set(x, y, z + (rotY === 0 ? 0.03 : 0)); m.rotation.y = rotY; m.userData = { pick: 'exitsign' }; this.pickables.push(m); grp.add(m);
  }

  // ---------------- камера және таңдау ----------------
  setCam(px: number, py: number, pz: number, tx: number, ty: number, tz: number) { if (this.walk.on) this.exitWalk(); this.camera.position.set(px, py, pz); this.controls.target.set(tx, ty, tz); this.controls.update(); }
  resetCamera() {
    this.camera.position.set(36, 40, 74); this.controls.target.set(8, 3, 2); this.controls.update();
  }
  topView() { this.camera.position.set(0, 88, 0.5); this.controls.target.set(0, 0, -4); this.controls.update(); }
  focusStation() { this.camera.position.set(62, 30, 40); this.controls.target.set(66, 2, 4); this.controls.update(); }

  private bindPointer() {
    const el = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    let last: { x: number; y: number } | null = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; last = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointermove', (e) => {
      if (!this.walk.on || !last || e.buttons === 0) return;
      this.walk.yaw -= (e.clientX - last.x) * 0.005;
      this.walk.pitch = Math.max(-1.2, Math.min(1.2, this.walk.pitch - (e.clientY - last.y) * 0.004));
      last = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('pointerup', () => { last = null; });
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName);
    window.addEventListener('keydown', (e) => {
      if (!this.walk.on || isField(e.target)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'ц', 'ф', 'ы', 'в', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e'].includes(k)) { this.keys.add(k); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, this.camera);
      const hits = rc.intersectObjects(this.pickables.filter((o) => this.isVisible(o)), false);
      const hit = hits.find((h) => h.object.userData.pick);
      this.onPick(hit ? (hit.object.userData.pick as string) : null);
    });
  }
  private isVisible(o: THREE.Object3D) { let x: THREE.Object3D | null = o; while (x) { if (!x.visible) return false; x = x.parent; } return true; }

  /** Панель ашық болса, көріністің ортасын бос аймаққа жылжыту (оң жақ панель немесе төменгі парақ). */
  private inset: { right: number; bottom: number } = { right: 0, bottom: 0 };
  setInset(right: number, bottom: number) { this.inset = { right, bottom }; this.resize(); }

  private resize() {
    const w = Math.max(1, this.container.clientWidth), h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const { right, bottom } = this.inset;
    if (right > 0 || bottom > 0) this.camera.setViewOffset(w, h, Math.min(right, w * 0.6) / 2, Math.min(bottom * h, h * 0.7) / 2, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }

  snapshotPNG() { return this.renderer.domElement.toDataURL('image/png'); }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.ro.disconnect(); this.controls.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      mats.forEach((mt: any) => { mt.map?.dispose?.(); mt.dispose?.(); });
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export interface WalkSpot { id: string; name: string; floor: 1 | 2 | 3; x: number; z: number; yaw: number }
export const WALK_SPOTS: WalkSpot[] = [
  { id: 'foyer', name: 'Фойе (кіреберіс)', floor: 1, x: -12.9, z: 5.2, yaw: 0 },
  { id: 'c1', name: '1-қабат дәлізі', floor: 1, x: 2, z: -1.5, yaw: Math.PI / 2 },
  { id: 'hall', name: 'Акт залы', floor: 1, x: -7, z: -5, yaw: 0 },
  { id: 'canteen', name: 'Асхана', floor: 1, x: -17.2, z: -10.5, yaw: Math.PI / 2 },
  { id: 'c2', name: '2-қабат дәлізі', floor: 2, x: 1.6, z: -1.5, yaw: Math.PI / 2 },
  { id: 'lib', name: 'Кітапхана', floor: 2, x: -26.2, z: 3.5, yaw: Math.PI / 2 },
  { id: 'gym', name: 'Спорт залы', floor: 2, x: -19, z: -4.5, yaw: 0 },
  { id: 'c3', name: '3-қабат дәлізі', floor: 3, x: 2, z: -1.5, yaw: -Math.PI / 2 },
  { id: 'r24', name: '№ 24 кабинет', floor: 3, x: 12, z: 2, yaw: Math.PI },
];

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch { return false; }
}

export type { Room };
