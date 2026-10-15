import * as THREE from 'three';

const FONT = '"Noto Sans", "Segoe UI", Arial, sans-serif';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return { c, g: c.getContext('2d')! };
}
function tex(c: HTMLCanvasElement, repeat?: [number, number]) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

/** Ашық түсті горизонталь қаптама (фотосурет бойынша). */
export function sidingTexture() {
  const { c, g } = canvas(256, 256);
  g.fillStyle = '#ede3c2'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    g.fillStyle = 'rgba(120,96,50,0.18)'; g.fillRect(0, y, 256, 2);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y + 2, 256, 2);
  }
  return tex(c, [1, 1]);
}

export function brickTexture() {
  const { c, g } = canvas(256, 256);
  g.fillStyle = '#c9b8a8'; g.fillRect(0, 0, 256, 256);
  const bw = 32, bh = 14;
  for (let r = 0; r < 256 / bh + 1; r++) {
    for (let k = -1; k < 256 / bw + 1; k++) {
      const x = k * bw + (r % 2 ? bw / 2 : 0);
      const v = 120 + ((r * 7 + k * 13) % 5) * 9;
      g.fillStyle = `rgb(${v + 40},${v - 50},${v - 70})`;
      g.fillRect(x + 1, r * bh + 1, bw - 2, bh - 2);
    }
  }
  return tex(c, [1, 1]);
}

/** Кітап түбіршіктері (кітапхана фотосуреттері бойынша түрлі түсті). */
export function booksTexture() {
  const { c, g } = canvas(256, 256);
  g.fillStyle = '#d9dde2'; g.fillRect(0, 0, 256, 256);
  const cols = ['#1f5f9a', '#2e7d6b', '#c0392b', '#e0b13a', '#6d4c8d', '#3c8dbc', '#8a5a2b', '#e67e22', '#16a085', '#2c3e50'];
  for (let shelf = 0; shelf < 5; shelf++) {
    const y0 = shelf * 51 + 6;
    let x = 4; let i = shelf * 3;
    while (x < 250) {
      const w = 5 + ((i * 37) % 7);
      g.fillStyle = cols[i % cols.length];
      g.fillRect(x, y0 + ((i * 11) % 8), w, 40 - ((i * 11) % 8));
      x += w + 1; i++;
    }
    g.fillStyle = '#b8bec6'; g.fillRect(0, y0 + 40, 256, 5);
  }
  return tex(c);
}

/** Спорт залының едені: сызықтар мен шеңберлер. */
export function courtTexture() {
  const { c, g } = canvas(512, 1024);
  g.fillStyle = '#7f9c9a'; g.fillRect(0, 0, 512, 1024);
  g.strokeStyle = '#b5332b'; g.lineWidth = 6;
  g.strokeRect(30, 30, 452, 964);
  g.beginPath(); g.moveTo(30, 512); g.lineTo(482, 512); g.stroke();
  g.beginPath(); g.arc(256, 512, 90, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(256, 30, 160, 0, Math.PI); g.stroke();
  g.beginPath(); g.arc(256, 994, 160, Math.PI, Math.PI * 2); g.stroke();
  g.strokeStyle = '#e1c35a'; g.lineWidth = 4;
  g.strokeRect(70, 80, 372, 864);
  return tex(c);
}

export function netTexture() {
  const { c, g } = canvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(250,250,245,0.95)'; g.lineWidth = 2;
  for (let i = 0; i <= 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 128); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
  return tex(c, [8, 2]);
}

export function shutterTexture() {
  const { c, g } = canvas(128, 128);
  g.fillStyle = '#b9bec4'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) { g.fillStyle = '#8f959c'; g.fillRect(0, y, 128, 2); }
  return tex(c);
}

/** Мәтіндік белгі (sprite). */
export function makeLabel(text: string, opts: { size?: number; bg?: string; fg?: string; border?: string; scale?: number } = {}) {
  const size = opts.size ?? 30;
  const lines = text.split('\n');
  const pad = 14;
  const { c: m, g: mg } = canvas(8, 8);
  void m;
  mg.font = `600 ${size}px ${FONT}`;
  const w = Math.ceil(Math.max(...lines.map((l) => mg.measureText(l).width)) + pad * 2);
  const lh = size * 1.25;
  const h = Math.ceil(lh * lines.length + pad * 1.2);
  const { c, g } = canvas(w, h);
  g.font = `600 ${size}px ${FONT}`;
  g.fillStyle = opts.bg ?? 'rgba(255,255,255,0.92)';
  const r = 12;
  g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.closePath(); g.fill();
  if (opts.border) { g.strokeStyle = opts.border; g.lineWidth = 4; g.stroke(); }
  g.fillStyle = opts.fg ?? '#14222e';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, pad, pad * 0.6 + lh * (i + 0.5)));
  const t = tex(c);
  const mat = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false });
  const s = new THREE.Sprite(mat);
  // sizeAttenuation=false: экрандағы өлшемі тұрақты (≈ биіктігі 0,6 × канвас пикселі)
  const k = (opts.scale ?? 1) * 0.0006;
  s.scale.set(w * k, h * k, 1);
  s.renderOrder = 10;
  return s;
}

export function updateLabel(s: THREE.Sprite, text: string, opts: Parameters<typeof makeLabel>[1] = {}) {
  const n = makeLabel(text, opts);
  const old = s.material.map; s.material.map = n.material.map; s.material.needsUpdate = true; old?.dispose();
  s.scale.copy(n.scale);
  n.material.dispose();
}

/** «TUGYL 16» жазуы (фотосуреттегі КАМАЗ белгісі). */
export function plateTexture(text: string, bg = '#ffffff', fg = '#d42b1e') {
  const { c, g } = canvas(256, 96);
  g.fillStyle = bg; g.fillRect(0, 0, 256, 96);
  g.fillStyle = fg; g.font = `800 52px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 50);
  return tex(c);
}
