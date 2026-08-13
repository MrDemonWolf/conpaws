"use client";

import { useEffect, useRef, useState } from "react";

import { BadgeCard } from "./badge-card";
import { BadgeFace } from "./badge-face";

/**
 * Draggable badge on a rope-physics lanyard — Rapier running HEADLESS.
 *
 * The first version used react-three-fiber with the card projected onto the
 * DOM. In practice the WebGL canvas died at mount with "THREE.WebGLRenderer:
 * Context Lost" while a probe canvas on the same page got a context fine —
 * so WebGL is gone entirely. The simulation is planar, which means
 * @dimforge/rapier2d-compat (wasm embedded as base64, zero bundler config)
 * can run it directly in requestAnimationFrame:
 *
 *   rope: fixed ─rope─ j1 ─rope─ j2 ─rope─ j3 ─revolute─ card
 *   band: SVG path through the joint positions (screen px)
 *   card: this DOM element, translate + rotateZ from the body, plus a
 *         velocity-based rotateY for pseudo-3D swing
 *
 * Nothing here can lose a GPU context, text stays crisp, and screenshots can
 * actually verify it.
 *
 * Coordinate contract: PXU px per world unit; world origin at wrapper
 * centre, +y up. DOM card is 320×470px → half-extents [0.8, 1.175].
 * Punch-slot centre (160, 17)px → card-local (0, ANCHOR_Y).
 */
const PXU = 200;
const ANCHOR_Y = 1.175 - 17 / PXU;
const SEG = 0.4;
const GRAVITY = -40;
const DT = 1 / 60;

type Vec = { x: number; y: number };

type Rapier = typeof import("@dimforge/rapier2d-compat");
type RigidBody = import("@dimforge/rapier2d-compat").RigidBody;

// RAPIER.init() is not safe to run twice concurrently — a second call
// re-initializes the wasm module state while the first world still points
// into the old memory, and every later step() throws "recursive use of an
// object" / "memory access out of bounds". React StrictMode runs mount
// effects twice in dev, so the load+init MUST be memoized at module level.
let rapierReady: Promise<Rapier> | null = null;
function loadRapier(): Promise<Rapier> {
  rapierReady ??= import("@dimforge/rapier2d-compat").then(async (mod) => {
    await mod.init();
    return mod;
  });
  return rapierReady;
}

type Sim = {
  world: import("@dimforge/rapier2d-compat").World;
  card: RigidBody;
  chain: RigidBody[]; // [fixed, j1, j2, j3]
  kinematic: boolean;
};

export default function BadgePhysics({
  name,
  onFailed,
}: {
  name: string;
  onFailed?: () => void;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const dom = useRef<HTMLDivElement>(null);
  const bandPath = useRef<SVGPathElement>(null);
  const bandGlow = useRef<SVGPathElement>(null);
  const sim = useRef<Sim | null>(null);
  const ptr = useRef<Vec>({ x: 0, y: 0 });
  const drag = useRef<Vec | null>(null); // grab offset, world units
  const raf = useRef(0);
  const [grabbing, setGrabbing] = useState(false);
  const [failed, setFailed] = useState(false);
  // Ref, not dep: the parent passes an inline arrow, and putting it in the
  // effect deps would tear down and rebuild the physics world every render.
  const onFailedRef = useRef(onFailed);
  onFailedRef.current = onFailed;

  useEffect(() => {
    let disposed = false;

    (async () => {
      try {
        const RAPIER: Rapier = await loadRapier();
        if (disposed || !wrapper.current) return;

        const rect = wrapper.current.getBoundingClientRect();
        const visH = rect.height / PXU;
        const fixedY = visH / 2 - 0.25;

        const world = new RAPIER.World({ x: 0, y: GRAVITY });

        const fixed = world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed().setTranslation(0, fixedY),
        );
        const mkLink = (x: number, y: number) =>
          world.createRigidBody(
            RAPIER.RigidBodyDesc.dynamic()
              .setTranslation(x, y)
              .setLinearDamping(3)
              .setAngularDamping(3)
              .setCanSleep(false),
          );
        const j1 = mkLink(0.25, fixedY - SEG);
        const j2 = mkLink(0.45, fixedY - SEG * 2);
        const j3 = mkLink(0.6, fixedY - SEG * 3);

        // Chain links need some mass or the rope has no swing weight.
        // Collision group 0 = collides with nothing.
        for (const j of [j1, j2, j3]) {
          world.createCollider(
            RAPIER.ColliderDesc.ball(0.05).setDensity(40).setCollisionGroups(0),
            j,
          );
        }

        const card = world.createRigidBody(
          RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(0.7, fixedY - SEG * 3 - ANCHOR_Y)
            .setLinearDamping(4)
            .setAngularDamping(4)
            .setCanSleep(false)
            .setCcdEnabled(true),
        );
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(0.8, 1.175)
            // Near-1:1 with the chain links. The card at density 1 outweighed
            // them ~240:1 and the impulse solver could not converge — the rope
            // stretched into a noodle and the card jittered at its end.
            .setDensity(0.15)
            .setCollisionGroups(0),
          card,
        );

        const rope = (a: RigidBody, b: RigidBody) =>
          world.createImpulseJoint(
            RAPIER.JointData.rope(SEG, { x: 0, y: 0 }, { x: 0, y: 0 }),
            a,
            b,
            true,
          );
        rope(fixed, j1);
        rope(j1, j2);
        rope(j2, j3);
        world.createImpulseJoint(
          RAPIER.JointData.revolute({ x: 0, y: 0 }, { x: 0, y: ANCHOR_Y }),
          j3,
          card,
          true,
        );

        world.timestep = DT;
        world.numSolverIterations = 8;
        if (sim.current) {
          // A concurrent effect (StrictMode) already built a live sim.
          world.free();
          return;
        }
        sim.current = {
          world,
          card,
          chain: [fixed, j1, j2, j3],
          kinematic: false,
        };

        const KinematicType = RAPIER.RigidBodyType.KinematicPositionBased;
        const DynamicType = RAPIER.RigidBodyType.Dynamic;
        let acc = 0;
        let last = performance.now();

        const frame = (now: number) => {
          if (disposed) return;
          raf.current = requestAnimationFrame(frame);
          const s = sim.current;
          const el = wrapper.current;
          if (!s || !el || !dom.current) return;

          // ---- kinematic switch + pointer follow while dragging ----
          const wantKinematic = drag.current !== null;
          if (wantKinematic !== s.kinematic) {
            s.card.setBodyType(
              wantKinematic ? KinematicType : DynamicType,
              true,
            );
            s.kinematic = wantKinematic;
          }
          if (drag.current) {
            s.card.setNextKinematicTranslation({
              x: ptr.current.x - drag.current.x,
              y: ptr.current.y - drag.current.y,
            });
          }

          // ---- fixed-timestep stepping (clamped so tab-switch can't spiral) ----
          acc += Math.min(now - last, 100);
          last = now;
          try {
            while (acc >= DT * 1000) {
              s.world.step();
              acc -= DT * 1000;
            }
          } catch {
            // wasm blew up — stop the loop and degrade to the static badge
            // instead of throwing once per frame forever.
            disposed = true;
            cancelAnimationFrame(raf.current);
            sim.current = null;
            setFailed(true);
            onFailedRef.current?.();
            return;
          }

          const r = el.getBoundingClientRect();
          const toPx = (p: Vec) => ({
            x: r.width / 2 + p.x * PXU,
            y: r.height / 2 - p.y * PXU,
          });

          const t = s.card.translation();
          const angle = s.card.rotation(); // 2D: one angle, +ccw
          const slotWorld = {
            x: t.x - Math.sin(angle) * ANCHOR_Y,
            y: t.y + Math.cos(angle) * ANCHOR_Y,
          };

          // ---- band: quadratic-smoothed path through the chain ----
          if (bandPath.current) {
            const pts = s.chain.map((j) => toPx(j.translation()));
            pts.push(toPx(slotWorld));
            const first = pts[0] as Vec;
            let d = `M ${first.x.toFixed(1)} ${first.y.toFixed(1)}`;
            for (let i = 1; i < pts.length - 1; i++) {
              const p = pts[i] as Vec;
              const n = pts[i + 1] as Vec;
              d += ` Q ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${((p.x + n.x) / 2).toFixed(1)} ${((p.y + n.y) / 2).toFixed(1)}`;
            }
            const end = pts[pts.length - 1] as Vec;
            d += ` L ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
            bandPath.current.setAttribute("d", d);
            bandGlow.current?.setAttribute("d", d);
          }

          // ---- card DOM transform, hinged at the punch slot ----
          const slot = toPx(slotWorld);
          const vel = s.card.linvel();
          const leanY = Math.max(-0.35, Math.min(0.35, vel.x * 0.06));
          dom.current.style.transform =
            `translate3d(${(slot.x - 160).toFixed(1)}px, ${(slot.y - 17).toFixed(1)}px, 0) ` +
            `rotateZ(${(-angle).toFixed(4)}rad) rotateY(${leanY.toFixed(4)}rad)`;
        };

        raf.current = requestAnimationFrame(frame);
      } catch {
        // Rapier failed to init — fall back to the static badge.
        if (!disposed) {
          setFailed(true);
          onFailedRef.current?.();
        }
      }
    })();

    return () => {
      // Cancel the loop but do NOT world.free(): React StrictMode runs this
      // cleanup between its dev double-mount, and freeing here hands the
      // surviving frame loop a dangling wasm pointer ("memory access out of
      // bounds" / "recursive use of an object" from every step()). One world
      // leaks per full unmount; for a landing page that is the right trade.
      disposed = true;
      cancelAnimationFrame(raf.current);
      sim.current = null;
    };
  }, []);

  function toWorld(clientX: number, clientY: number): Vec {
    const el = wrapper.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return {
      x: (clientX - r.left - r.width / 2) / PXU,
      y: (r.height / 2 - (clientY - r.top)) / PXU,
    };
  }

  function onPointerMove(event: React.PointerEvent) {
    ptr.current = toWorld(event.clientX, event.clientY);
  }

  function onGrab(event: React.PointerEvent) {
    if (!sim.current) return;
    event.preventDefault();
    (event.target as Element).setPointerCapture(event.pointerId);
    ptr.current = toWorld(event.clientX, event.clientY);
    const t = sim.current.card.translation();
    drag.current = { x: ptr.current.x - t.x, y: ptr.current.y - t.y };
    setGrabbing(true);
  }

  function onRelease() {
    drag.current = null;
    setGrabbing(false);
  }

  if (failed) return <BadgeCard name={name} />;

  return (
    <div
      ref={wrapper}
      className="relative h-[720px] w-full select-none [perspective:1400px]"
      onPointerMove={onPointerMove}
      onPointerUp={onRelease}
      onPointerCancel={onRelease}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        role="presentation"
      >
        <title>Lanyard</title>
        <path
          ref={bandPath}
          fill="none"
          stroke="#16305e"
          strokeWidth="18"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          ref={bandGlow}
          fill="none"
          stroke="#0faced"
          strokeOpacity="0.25"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      {/* The DOM badge, driven by the physics body every frame. */}
      <div
        ref={dom}
        onPointerDown={onGrab}
        className={`absolute top-0 left-0 w-[320px] [transform-origin:160px_17px] will-change-transform ${
          grabbing ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <BadgeFace name={name} />
      </div>
    </div>
  );
}
