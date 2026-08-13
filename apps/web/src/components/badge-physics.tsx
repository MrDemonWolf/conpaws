"use client";

import {
  Canvas,
  extend,
  type ThreeElement,
  useFrame,
} from "@react-three/fiber";
import {
  CuboidCollider,
  Physics,
  type RapierRigidBody,
  RigidBody,
  useRopeJoint,
  useSphericalJoint,
} from "@react-three/rapier";
import { MeshLineGeometry, MeshLineMaterial } from "meshline";
import { useRef, useState } from "react";
import * as THREE from "three";

import { BadgeFace } from "./badge-face";

/**
 * Draggable badge on a rope-physics lanyard, after Vercel Ship's 3D badge
 * (https://vercel.com/blog/building-an-interactive-3d-event-badge-with-react-three-fiber).
 *
 * One deliberate difference from the article: the card face stays a real DOM
 * element instead of a WebGL texture. The canvas renders only the band; each
 * frame the card rigid-body's position and rotation are projected into CSS
 * transforms on the DOM badge. That keeps text crisp, the live name fill free,
 * and the whole face identical to the static fallback.
 *
 * Coordinate contract (do not change one without the others):
 *   PXU px per world unit · canvas height H px · fov 25°
 *   camera z = (H / PXU) / (2 · tan(fov/2))
 *   DOM card is 320×470px → collider half-extents [0.8, 1.175, 0.02]
 *   punch-slot centre is (160, 17)px on the DOM card → local (0, ANCHOR_Y, 0)
 */
const PXU = 200;
const H = 780;
const FOV = 25;
const VIS_H = H / PXU; // 3.9 world units visible vertically
const CAM_Z = VIS_H / 2 / Math.tan((FOV / 2) * (Math.PI / 180)); // ≈ 8.8
const ANCHOR_Y = 1.175 - 17 / PXU; // slot centre in card-local space
const SEG = 0.4; // rope segment length
const FIXED_Y = VIS_H / 2 - 0.25;

declare module "@react-three/fiber" {
  interface ThreeElements {
    meshLineGeometry: ThreeElement<typeof MeshLineGeometry>;
    meshLineMaterial: ThreeElement<typeof MeshLineMaterial>;
  }
}

extend({ MeshLineGeometry, MeshLineMaterial });

type PointerWorld = { x: number; y: number };
type DragState = { offX: number; offY: number } | null;

type SharedRefs = {
  ptr: React.RefObject<PointerWorld>;
  drag: React.RefObject<DragState>;
  cardPos: React.RefObject<PointerWorld>;
  dom: React.RefObject<HTMLDivElement | null>;
};

function Band({ refs }: { refs: SharedRefs }) {
  const band = useRef<THREE.Mesh>(null);
  const fixed = useRef<RapierRigidBody>(
    null,
  ) as React.RefObject<RapierRigidBody>;
  const j1 = useRef<RapierRigidBody>(null) as React.RefObject<RapierRigidBody>;
  const j2 = useRef<RapierRigidBody>(null) as React.RefObject<RapierRigidBody>;
  const j3 = useRef<RapierRigidBody>(null) as React.RefObject<RapierRigidBody>;
  const card = useRef<RapierRigidBody>(
    null,
  ) as React.RefObject<RapierRigidBody>;

  const [curve] = useState(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]),
  );
  const scratch = useRef({
    vec: new THREE.Vector3(),
    ang: new THREE.Vector3(),
    rot: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    euler: new THREE.Euler(),
    anchorLocal: new THREE.Vector3(0, ANCHOR_Y, 0),
    anchorWorld: new THREE.Vector3(),
    lerp1: null as THREE.Vector3 | null,
    lerp2: null as THREE.Vector3 | null,
  });

  useRopeJoint(fixed, j1, [[0, 0, 0], [0, 0, 0], SEG]);
  useRopeJoint(j1, j2, [[0, 0, 0], [0, 0, 0], SEG]);
  useRopeJoint(j2, j3, [[0, 0, 0], [0, 0, 0], SEG]);
  useSphericalJoint(j3, card, [
    [0, 0, 0],
    [0, ANCHOR_Y, 0],
  ]);

  useFrame((state, delta) => {
    const s = scratch.current;
    if (!card.current || !fixed.current) return;

    // ---- drag: card follows the pointer kinematically ----
    // Body type is switched imperatively rather than via the `type` prop:
    // a prop flip depends on a React re-render reaching Rapier, which the
    // React Compiler is free to memo away. bodyType 0=dynamic, 2=kinematic.
    const drag = refs.drag.current;
    const wantType = drag ? 2 : 0;
    if (card.current.bodyType() !== wantType) {
      card.current.setBodyType(wantType, true);
    }
    if (drag) {
      for (const ref of [fixed, j1, j2, j3, card]) ref.current?.wakeUp();
      card.current.setNextKinematicTranslation({
        x: refs.ptr.current.x - drag.offX,
        y: refs.ptr.current.y - drag.offY,
        z: 0,
      });
    }

    // ---- band: smooth the middle joints, then rebuild the curve ----
    // (jitter smoothing from the article: lerp speed scales with distance)
    for (const [ref, key] of [
      [j1, "lerp1"],
      [j2, "lerp2"],
    ] as const) {
      const t = ref.current?.translation();
      if (!t) continue;
      if (!s[key]) s[key] = new THREE.Vector3(t.x, t.y, t.z);
      const lerped = s[key] as THREE.Vector3;
      const dist = Math.max(
        0.1,
        Math.min(1, lerped.distanceTo(s.vec.set(t.x, t.y, t.z))),
      );
      lerped.lerp(s.vec, delta * (10 + dist * 40));
    }

    const j3t = j3.current?.translation();
    const fx = fixed.current.translation();
    if (j3t && s.lerp1 && s.lerp2 && band.current) {
      curve.points[0]?.set(j3t.x, j3t.y, j3t.z);
      curve.points[1]?.copy(s.lerp2);
      curve.points[2]?.copy(s.lerp1);
      curve.points[3]?.set(fx.x, fx.y, fx.z);
      (band.current.geometry as MeshLineGeometry).setPoints(
        curve.getPoints(32),
      );
    }

    // ---- keep the card facing the camera (article's angvel trick) ----
    if (!drag) {
      const av = card.current.angvel();
      const r = card.current.rotation();
      s.ang.set(av.x, av.y, av.z);
      s.rot.set(r.x, r.y, r.z);
      card.current.setAngvel(
        { x: s.ang.x, y: s.ang.y - s.rot.y * 0.25, z: s.ang.z },
        true,
      );
    }

    // ---- project the card body onto the DOM badge ----
    const dom = refs.dom.current;
    if (dom) {
      const t = card.current.translation();
      const r = card.current.rotation();
      refs.cardPos.current.x = t.x;
      refs.cardPos.current.y = t.y;

      s.quat.set(r.x, r.y, r.z, r.w);
      s.anchorWorld.copy(s.anchorLocal).applyQuaternion(s.quat);
      const ax = t.x + s.anchorWorld.x;
      const ay = t.y + s.anchorWorld.y;

      const rect = state.gl.domElement;
      const w = rect.clientWidth;
      const h = rect.clientHeight;
      const px = w / 2 + ax * PXU;
      const py = h / 2 - ay * PXU;

      // three is +y-up right-handed, CSS is +y-down: conjugating by that
      // mirror negates rotations about X and Z, keeps Y.
      s.euler.setFromQuaternion(s.quat, "XYZ");
      dom.style.transform =
        `translate3d(${px - 160}px, ${py - 17}px, 0) ` +
        `rotateX(${-s.euler.x}rad) rotateY(${s.euler.y}rad) rotateZ(${-s.euler.z}rad)`;
    }
  });

  return (
    <>
      <RigidBody
        ref={fixed}
        type="fixed"
        position={[0, FIXED_Y, 0]}
        canSleep={false}
      />
      <RigidBody
        ref={j1}
        position={[0.4, FIXED_Y - SEG, 0]}
        angularDamping={3}
        linearDamping={3}
        canSleep={false}
      />
      <RigidBody
        ref={j2}
        position={[0.7, FIXED_Y - SEG * 2, 0]}
        angularDamping={3}
        linearDamping={3}
        canSleep={false}
      />
      <RigidBody
        ref={j3}
        position={[1.0, FIXED_Y - SEG * 3, 0]}
        angularDamping={3}
        linearDamping={3}
        canSleep={false}
      />
      <RigidBody
        ref={card}
        position={[1.2, FIXED_Y - SEG * 3 - ANCHOR_Y, 0]}
        angularDamping={4}
        linearDamping={4}
        canSleep={false}
      >
        <CuboidCollider args={[0.8, 1.175, 0.02]} />
      </RigidBody>
      <mesh ref={band}>
        <meshLineGeometry />
        <meshLineMaterial
          args={[{ resolution: new THREE.Vector2(680, 780) }]}
          color="#16305e"
          lineWidth={0.1}
        />
      </mesh>
    </>
  );
}

export default function BadgePhysics({ name }: { name: string }) {
  const ptr = useRef<PointerWorld>({ x: 0, y: 0 });
  const drag = useRef<DragState>(null);
  const cardPos = useRef<PointerWorld>({ x: 0, y: 0 });
  const dom = useRef<HTMLDivElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [grabbing, setGrabbing] = useState(false);

  function toWorld(clientX: number, clientY: number): PointerWorld {
    const el = wrapper.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = 1 - ((clientY - rect.top) / rect.height) * 2;
    const visW = VIS_H * (rect.width / rect.height);
    return { x: (ndcX * visW) / 2, y: (ndcY * VIS_H) / 2 };
  }

  function onPointerMove(event: React.PointerEvent) {
    ptr.current = toWorld(event.clientX, event.clientY);
  }

  function onGrab(event: React.PointerEvent) {
    event.preventDefault();
    (event.target as Element).setPointerCapture(event.pointerId);
    ptr.current = toWorld(event.clientX, event.clientY);
    drag.current = {
      offX: ptr.current.x - cardPos.current.x,
      offY: ptr.current.y - cardPos.current.y,
    };
    setGrabbing(true);
  }

  function onRelease() {
    drag.current = null;
    setGrabbing(false);
  }

  return (
    <div
      ref={wrapper}
      className="relative h-[780px] w-full select-none"
      onPointerMove={onPointerMove}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
    >
      <Canvas
        className="pointer-events-none absolute inset-0"
        camera={{ position: [0, 0, CAM_Z], fov: FOV }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <Physics gravity={[0, -40, 0]}>
          <Band refs={{ ptr, drag, cardPos, dom }} />
        </Physics>
      </Canvas>

      {/* The DOM badge, driven by the physics body every frame. */}
      <div
        ref={dom}
        onPointerDown={onGrab}
        className={`absolute top-0 left-0 w-[320px] [transform-origin:160px_17px] will-change-transform ${
          grabbing ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ perspective: "1760px" }}
      >
        <BadgeFace name={name} />
      </div>
    </div>
  );
}
