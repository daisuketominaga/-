"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Project, Face } from "@/lib/types";
import { levels } from "./Elevation";
import { roofRise, round } from "@/lib/geometry";

type Props = { project: Project };

const FACE_JA: Record<Face, string> = { N: "北", S: "南", E: "東", W: "西" };

export default function Exterior({ project }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const [hour, setHour] = useState(14);
  const [copied, setCopied] = useState(false);
  const b = project.building;

  // ===== 画像生成用の指示文 =====
  const prompt = useMemo(() => {
    const lv = levels(b);
    const road = project.site.edges.find((e) => e.road);
    const roadFace: Face | null = (() => {
      if (!road) return null;
      const a = project.site.points[road.index];
      const c = project.site.points[(road.index + 1) % project.site.points.length];
      const dx = (a.x + c.x) / 2 - (b.x + b.w / 2);
      const dy = (a.y + c.y) / 2 - (b.y + b.d / 2);
      return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "W" : "E") : dy < 0 ? "S" : "N";
    })();
    const byFace = (f: Face) => project.openings.filter((o) => o.face === f);
    const desc = (f: Face) => {
      const os = byFace(f);
      if (!os.length) return `${FACE_JA[f]}面: 窓なし`;
      return `${FACE_JA[f]}面: ` + os.map((o) => `${o.floor}階に${o.kind === "garage" ? "ガレージ開口" : o.kind === "door" ? "玄関ドア" : o.kind === "slit" ? "縦長スリット窓" : "窓"}(幅${o.width}m×高${o.height}m)`).join("、");
    };
    const rooms1 = project.floors.find((f) => f.level === 1)?.rooms.map((r) => r.name).join("・") ?? "";
    const rooms2 = project.floors.find((f) => f.level === 2)?.rooms.map((r) => r.name).join("・") ?? "";
    return `【建築パース生成用の指示】
写真のようにリアルな住宅の外観パース。日本の住宅街、晴天、${hour < 11 ? "朝の柔らかい光" : hour < 16 ? "昼の明るい光" : "夕方の暖かい光"}。
建物: ${b.structureLabel}、幅${b.w}m×奥行${b.d}m、最高高さ約${round(lv.max, 1)}m。
屋根: ${b.roof === "shed" ? `片流れ${b.roofPitchSun}寸、${FACE_JA[b.roofHighSide]}側が高く、道路側は軒の出なし` : b.roof === "gable" ? `切妻${b.roofPitchSun}寸` : "陸屋根（フラット）"}。
外壁: ${b.wallLabel}。アクセント: ${b.accentLabel}。基礎は濃いグレー。サッシは黒枠。
${roadFace ? `カメラは${FACE_JA[roadFace]}側の道路（幅員約${road?.roadWidth ?? 4}m）から、やや斜め（3/4アングル）で見上げる構図。` : "道路側からやや斜めに見上げる構図。"}
${(["W", "S", "E", "N"] as Face[]).map(desc).join("\n")}
1階: ${rooms1 || "玄関・水回り"}。2階: ${rooms2 || "LDK"}。
周囲: 植栽（シンボルツリー1本と低木）、コンクリート土間の駐車スペース、隣家は控えめに。人物なし。
画角24〜35mm相当、水平は保つ（垂直の線が歪まない）、高解像度、建築写真のようなライティング。
文字・看板・ロゴは入れない。
※これはイメージパースであり、実際の設計とは異なります。`;
  }, [project, b, hour]);

  // ===== 3D 表示 =====
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const width = mount.clientWidth;
    const height = Math.max(320, Math.min(560, width * 0.65));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdfeaf5);
    scene.fog = new THREE.Fog(0xdfeaf5, 40, 120);

    const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 500);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.innerHTML = "";
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 敷地（座標系: three の x=東, z=-北）
    const site = project.site;
    const shape = new THREE.Shape();
    site.points.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, -p.y) : shape.lineTo(p.x, -p.y)));
    shape.closePath();
    const siteGeo = new THREE.ShapeGeometry(shape);
    siteGeo.rotateX(-Math.PI / 2);
    const siteMesh = new THREE.Mesh(siteGeo, new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 1 }));
    siteMesh.position.y = 0.01;
    siteMesh.receiveShadow = true;
    scene.add(siteMesh);

    // 地面（周囲）
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0xb9c2a8, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 道路
    site.edges.filter((e) => e.road).forEach((e) => {
      const a = site.points[e.index];
      const c = site.points[(e.index + 1) % site.points.length];
      const w = e.roadWidth ?? 4;
      const dx = c.x - a.x, dy = c.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      // 外向き法線（敷地重心から離れる向き）
      let nx = dy / len, ny = -dx / len;
      const cx = site.points.reduce((s, p) => s + p.x, 0) / site.points.length;
      const cy = site.points.reduce((s, p) => s + p.y, 0) / site.points.length;
      const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
      if ((mx + nx - cx) ** 2 + (my + ny - cy) ** 2 < (mx - cx) ** 2 + (my - cy) ** 2) { nx = -nx; ny = -ny; }
      const road = new THREE.Mesh(new THREE.PlaneGeometry(len + 40, w), new THREE.MeshStandardMaterial({ color: 0x6f7378, roughness: 0.9 }));
      road.rotation.x = -Math.PI / 2;
      const ang = Math.atan2(dy, dx);
      road.rotation.z = ang;
      road.position.set(mx + nx * (w / 2), 0.02, -(my + ny * (w / 2)));
      road.receiveShadow = true;
      scene.add(road);
    });

    // 建物本体
    const lv = levels(b);
    const wallH = lv.eave - b.foundation;
    const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(b.wallColor), roughness: 0.75, metalness: 0.15 });
    const accentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(b.accentColor), roughness: 0.8 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9fc4de, roughness: 0.1, metalness: 0.2, transmission: 0.5, transparent: true, opacity: 0.85 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const group = new THREE.Group();
    const rot = (b.rotDeg * Math.PI) / 180;
    group.position.set(b.x, 0, -b.y);
    group.rotation.y = rot;

    const foundation = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.foundation, b.d), new THREE.MeshStandardMaterial({ color: 0x4c525b, roughness: 1 }));
    foundation.position.set(b.w / 2, b.foundation / 2, -b.d / 2);
    foundation.castShadow = foundation.receiveShadow = true;
    group.add(foundation);

    // 壁: 片流れは上面を傾けた形にする
    const rise = roofRise(b);
    const wallGeo = new THREE.BoxGeometry(b.w, wallH, b.d);
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.set(b.w / 2, b.foundation + wallH / 2, -b.d / 2);
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);

    if (b.roof !== "flat" && rise > 0.01) {
      // 屋根の三角部分（片流れ）
      let geo: THREE.BufferGeometry;
      if (b.roof === "shed") {
        const hs = b.roofHighSide;
        const along = hs === "N" || hs === "S" ? b.d : b.w;
        const s2 = new THREE.Shape();
        // 断面の三角形（高い側で rise）
        if (hs === "E" || hs === "S") { s2.moveTo(0, 0); s2.lineTo(along, 0); s2.lineTo(along, rise); }
        else { s2.moveTo(0, 0); s2.lineTo(along, 0); s2.lineTo(0, rise); }
        s2.closePath();
        const depth = hs === "N" || hs === "S" ? b.w : b.d;
        geo = new THREE.ExtrudeGeometry(s2, { depth, bevelEnabled: false });
        const m = new THREE.Mesh(geo, wallMat);
        m.castShadow = true;
        if (hs === "E" || hs === "W") { m.rotation.x = 0; m.position.set(0, b.foundation + wallH, 0); m.rotation.y = 0; m.position.z = 0; m.rotateY(0); m.position.set(0, b.foundation + wallH, 0); m.rotation.set(0, 0, 0); m.position.z = 0; m.geometry.translate(0, 0, -b.d); }
        else { m.rotation.y = Math.PI / 2; m.position.set(0, b.foundation + wallH, 0); m.geometry.translate(0, 0, 0); m.rotation.set(0, -Math.PI / 2, 0); m.position.set(0, b.foundation + wallH, 0); }
        group.add(m);
      } else {
        const s2 = new THREE.Shape();
        const along = b.roofHighSide === "N" || b.roofHighSide === "S" ? b.w : b.d;
        s2.moveTo(0, 0); s2.lineTo(along, 0); s2.lineTo(along / 2, rise); s2.closePath();
        const depth = b.roofHighSide === "N" || b.roofHighSide === "S" ? b.d : b.w;
        geo = new THREE.ExtrudeGeometry(s2, { depth, bevelEnabled: false });
        const m = new THREE.Mesh(geo, wallMat);
        m.castShadow = true;
        if (b.roofHighSide === "N" || b.roofHighSide === "S") { m.position.set(0, b.foundation + wallH, 0); m.geometry.translate(0, 0, -b.d); }
        else { m.rotation.set(0, -Math.PI / 2, 0); m.position.set(0, b.foundation + wallH, 0); }
        group.add(m);
      }
    }
    // 笠木（屋根の傾きに沿わせる）
    const capT = 0.08;
    if (b.roof === "flat" || rise < 0.01) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.1, capT, b.d + 0.1), frameMat);
      cap.position.set(b.w / 2, b.foundation + wallH + capT / 2, -b.d / 2);
      group.add(cap);
    } else if (b.roof === "shed") {
      const alongX = b.roofHighSide === "E" || b.roofHighSide === "W";
      const run = alongX ? b.w : b.d;
      const slopeLen = Math.hypot(run, rise);
      const ang = Math.atan2(rise, run);
      const cap = new THREE.Mesh(alongX ? new THREE.BoxGeometry(slopeLen + 0.1, capT, b.d + 0.1) : new THREE.BoxGeometry(b.w + 0.1, capT, slopeLen + 0.1), frameMat);
      cap.position.set(b.w / 2, b.foundation + wallH + rise / 2 + capT / 2, -b.d / 2);
      if (b.roofHighSide === "E") cap.rotation.z = ang;
      else if (b.roofHighSide === "W") cap.rotation.z = -ang;
      else if (b.roofHighSide === "N") cap.rotation.x = ang;
      else cap.rotation.x = -ang;
      group.add(cap);
    }
    // 開口
    const eps = 0.02;
    project.openings.forEach((o) => {
      const base = lv.fl[o.floor - 1] ?? lv.fl[0];
      const y0 = base + o.sill;
      const mat = o.kind === "door" ? accentMat : o.kind === "garage" ? new THREE.MeshStandardMaterial({ color: 0x1b1f26 }) : glassMat;
      const t = 0.06;
      let mesh: THREE.Mesh;
      const frame = (w: number, h: number) => {
        const f = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, t), frameMat);
        return f;
      };
      if (o.face === "W" || o.face === "E") {
        // 面の左端: W面は外から見て左=北(y=d側)。E面は左=南(y=0)
        const zStart = o.face === "W" ? -(b.d - o.offset) : -o.offset;
        const zc = o.face === "W" ? zStart + o.width / 2 : zStart - o.width / 2;
        const x = o.face === "W" ? -eps : b.w + eps;
        mesh = new THREE.Mesh(new THREE.BoxGeometry(t, o.height, o.width), mat);
        mesh.position.set(x, y0 + o.height / 2, zc);
        const f = frame(o.width, o.height);
        f.rotation.y = Math.PI / 2;
        f.position.copy(mesh.position);
        group.add(f);
      } else {
        // S面: 左=西(x=0)。N面: 左=東(x=w)
        const xc = o.face === "S" ? o.offset + o.width / 2 : b.w - o.offset - o.width / 2;
        const z = o.face === "S" ? eps : -b.d - eps;
        mesh = new THREE.Mesh(new THREE.BoxGeometry(o.width, o.height, t), mat);
        mesh.position.set(xc, y0 + o.height / 2, z);
        const f = frame(o.width, o.height);
        f.position.copy(mesh.position);
        group.add(f);
      }
      group.add(mesh);
      // 玄関・ガレージの上に木目の庇
      if (o.kind === "door" || o.kind === "garage") {
        const canopy = new THREE.Mesh(
          o.face === "W" || o.face === "E" ? new THREE.BoxGeometry(0.6, 0.12, o.width + 0.6) : new THREE.BoxGeometry(o.width + 0.6, 0.12, 0.6),
          accentMat
        );
        const p = mesh.position.clone();
        p.y = y0 + o.height + 0.1;
        if (o.face === "W") p.x -= 0.3; else if (o.face === "E") p.x += 0.3; else if (o.face === "S") p.z += 0.3; else p.z -= 0.3;
        canopy.position.copy(p);
        canopy.castShadow = true;
        group.add(canopy);
      }
    });
    scene.add(group);

    // 植栽
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x5f9a4c, roughness: 1 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2b });
    const addTree = (x: number, z: number, h = 3) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, h * 0.4), trunkMat);
      trunk.position.set(x, h * 0.2, z);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(h * 0.35, 12, 10), treeMat);
      crown.position.set(x, h * 0.65, z);
      crown.castShadow = true;
      scene.add(trunk, crown);
    };
    const bb = site.points.reduce((acc, p) => ({ minX: Math.min(acc.minX, p.x), maxX: Math.max(acc.maxX, p.x), minY: Math.min(acc.minY, p.y), maxY: Math.max(acc.maxY, p.y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    addTree(bb.minX - 3, -(bb.maxY + 2), 3.5);
    addTree(bb.maxX + 3, -(bb.minY - 2), 2.8);

    // 光
    scene.add(new THREE.HemisphereLight(0xdde9ff, 0x9a9070, 0.9));
    const sun = new THREE.DirectionalLight(0xfff2dc, 2.2);
    const az = ((hour - 6) / 12) * Math.PI; // 6時=東, 18時=西
    const el = Math.max(0.15, Math.sin(((hour - 6) / 12) * Math.PI)) * 1.2;
    sun.position.set(Math.cos(az) * 30, el * 30, Math.sin(az) * 10 + 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -25; sun.shadow.camera.right = 25; sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25;
    scene.add(sun);

    // カメラ: 道路側からやや斜め
    const cx = b.x + b.w / 2, cz = -(b.y + b.d / 2);
    const roadEdge = site.edges.find((e) => e.road);
    let camDir = new THREE.Vector3(-1, 0, 0.6);
    if (roadEdge) {
      const a = site.points[roadEdge.index];
      const c = site.points[(roadEdge.index + 1) % site.points.length];
      const mx = (a.x + c.x) / 2, my = (a.y + c.y) / 2;
      camDir = new THREE.Vector3(mx - cx, 0, -(my) - cz).normalize();
      camDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
    }
    const distC = Math.max(b.w, b.d) * 2.4 + 6;
    camera.position.set(cx + camDir.x * distC, 1.7 + lv.max * 0.25, cz + camDir.z * distC);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(cx, lv.max * 0.45, cz);
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.enableDamping = true;
    controls.update();

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();
    const onResize = () => {
      const w = mount.clientWidth;
      const h = Math.max(320, Math.min(560, w * 0.65));
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      mount.innerHTML = "";
    };
  }, [project, b, hour]);

  const shot = () => {
    const r = rendererRef.current;
    if (!r) return;
    const a = document.createElement("a");
    a.href = r.domElement.toDataURL("image/png");
    a.download = `${project.name}_外観イメージ.png`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="card p-2">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="text-sm text-slate-600"><b>{project.name}</b> 外観イメージ（3D模型風）　ドラッグで回転、ホイールで拡大</div>
          <div className="flex items-center gap-2 text-xs">
            <span>太陽</span>
            <input type="range" min={7} max={18} step={1} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
            <span>{hour}時</span>
            <button className="btn-ghost" onClick={shot}>画像を保存</button>
          </div>
        </div>
        <div ref={mountRef} className="w-full overflow-hidden rounded-md" />
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">写真のようなパースを作るための指示文</h3>
          <button
            className="btn-primary"
            onClick={() => {
              navigator.clipboard.writeText(prompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
            }}
          >
            {copied ? "コピーしました" : "コピー"}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          このアプリには写真を生み出す機能がありません。下の文をコピーして、いつも使っている画像生成の道具に貼り付けてください。
          図面の内容（階数、屋根、外壁、窓の位置、道路の向き）が全部入っています。上の3D画像を一緒に渡すと、形が正確になります。
        </p>
        <textarea className="field h-64 font-mono text-[11px]" readOnly value={prompt} />
      </div>
    </div>
  );
}
