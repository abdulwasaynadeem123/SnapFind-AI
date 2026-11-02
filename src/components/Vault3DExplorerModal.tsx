import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { X, RotateCcw, Play, Pause, Sparkles, Layers, Search, Eye, Maximize2 } from "lucide-react";
import { ScreenshotItem } from "../types";

interface Vault3DExplorerModalProps {
  isOpen: boolean;
  onClose: () => void;
  screenshots: ScreenshotItem[];
  onSelectScreenshot: (item: ScreenshotItem) => void;
}

/**
 * Procedural PBR Cyber-Grid Canvas Texture Generator
 */
function createGridTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#0B0F19";
    ctx.fillRect(0, 0, 512, 512);

    ctx.strokeStyle = "rgba(17, 100, 102, 0.35)";
    ctx.lineWidth = 1.5;
    const step = 32;
    for (let x = 0; x <= 512; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Concentric cyber circles
    ctx.strokeStyle = "rgba(209, 232, 226, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(256, 256, 128, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(256, 256, 220, 0, Math.PI * 2);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export const Vault3DExplorerModal: React.FC<Vault3DExplorerModalProps> = ({
  isOpen,
  onClose,
  screenshots,
  onSelectScreenshot,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [hoveredItem, setHoveredItem] = useState<ScreenshotItem | null>(null);
  const [activeItem, setActiveItem] = useState<ScreenshotItem | null>(null);

  const autoRotateRef = useRef(autoRotate);
  useEffect(() => {
    autoRotateRef.current = autoRotate;
  }, [autoRotate]);

  useEffect(() => {
    if (!isOpen) return;

    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0B0F19");
    scene.fog = new THREE.FogExp2("#0B0F19", 0.035);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 4.5, 13);
    camera.lookAt(0, 0.5, 0);

    // 2. High-Fidelity Studio PBR Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      container.appendChild(renderer.domElement);
    } catch (err) {
      console.warn("[Vault3DExplorer] WebGL initialization failed:", err);
      return;
    }

    // 3. Studio PBR Lighting System
    const hemisphereLight = new THREE.HemisphereLight("#D1E8E2", "#0B0F19", 1.2);
    scene.add(hemisphereLight);

    const keyLight = new THREE.DirectionalLight("#116466", 3.2);
    keyLight.position.set(6, 10, 8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#D1E8E2", 1.0);
    fillLight.position.set(-6, -4, -6);
    scene.add(fillLight);

    const coreLight = new THREE.PointLight("#116466", 4.0, 15);
    coreLight.position.set(0, 1.2, 0);
    scene.add(coreLight);

    // 4. Procedural Vault Master Group (3-12 parts)
    const vaultGroup = new THREE.Group();
    scene.add(vaultGroup);

    // Part 1: Ground Pedestal with Cyber-Grid Texture
    const gridTexture = createGridTexture();
    const pedestalGeo = new THREE.CylinderGeometry(5.2, 5.6, 0.35, 64);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: "#1E293B",
      metalness: 0.85,
      roughness: 0.25,
      map: gridTexture,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -1.6;
    vaultGroup.add(pedestal);

    // Part 2: Outer Beveled Base Ring
    const outerRingGeo = new THREE.TorusGeometry(5.3, 0.12, 16, 64);
    const chromeMat = new THREE.MeshStandardMaterial({
      color: "#D1E8E2",
      metalness: 0.95,
      roughness: 0.1,
    });
    const baseRing = new THREE.Mesh(outerRingGeo, chromeMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = -1.4;
    vaultGroup.add(baseRing);

    // Part 3: Dual Gyroscopic Gimbal Rings (Outer)
    const gimbalOuterGeo = new THREE.TorusGeometry(3.6, 0.08, 16, 80);
    const tealAnodizedMat = new THREE.MeshStandardMaterial({
      color: "#116466",
      metalness: 0.9,
      roughness: 0.18,
      emissive: "#116466",
      emissiveIntensity: 0.25,
    });
    const gimbalOuter = new THREE.Mesh(gimbalOuterGeo, tealAnodizedMat);
    gimbalOuter.position.y = 1.2;
    vaultGroup.add(gimbalOuter);

    // Part 4: Dual Gyroscopic Gimbal Rings (Inner)
    const gimbalInnerGeo = new THREE.TorusGeometry(2.7, 0.06, 16, 80);
    const softMintMat = new THREE.MeshStandardMaterial({
      color: "#D1E8E2",
      metalness: 0.8,
      roughness: 0.2,
      emissive: "#D1E8E2",
      emissiveIntensity: 0.2,
    });
    const gimbalInner = new THREE.Mesh(gimbalInnerGeo, softMintMat);
    gimbalInner.position.y = 1.2;
    vaultGroup.add(gimbalInner);

    // Part 5: Optical Scanner Core (Faceted Octahedron)
    const coreGeo = new THREE.OctahedronGeometry(1.15, 0);
    const coreMat = new THREE.MeshPhysicalMaterial({
      color: "#116466",
      metalness: 0.5,
      roughness: 0.1,
      transmission: 0.7,
      transparent: true,
      opacity: 0.85,
      ior: 1.5,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 1.2;
    vaultGroup.add(coreMesh);

    // Part 6: Luminous Inner Energy Orb
    const orbGeo = new THREE.SphereGeometry(0.55, 32, 32);
    const orbMat = new THREE.MeshBasicMaterial({
      color: "#D1E8E2",
    });
    const orbMesh = new THREE.Mesh(orbGeo, orbMat);
    orbMesh.position.y = 1.2;
    vaultGroup.add(orbMesh);

    // Part 7: Scanner Beam / Disc
    const laserDiscGeo = new THREE.RingGeometry(0.3, 3.2, 48);
    const laserDiscMat = new THREE.MeshBasicMaterial({
      color: "#116466",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const laserDisc = new THREE.Mesh(laserDiscGeo, laserDiscMat);
    laserDisc.rotation.x = Math.PI / 2;
    laserDisc.position.y = 1.2;
    vaultGroup.add(laserDisc);

    // Part 8: Particle Energy Dust
    const particleCount = 200;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.5 + Math.random() * 3.5;
      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = 0.2 + (Math.random() - 0.5) * 2.8;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: "#D1E8E2",
      size: 0.08,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particleCloud = new THREE.Points(particleGeo, particleMat);
    vaultGroup.add(particleCloud);

    // 5. Radial Holographic Screenshot Cards
    const cardsGroup = new THREE.Group();
    vaultGroup.add(cardsGroup);

    const displayScreenshots = screenshots.slice(0, 12);
    const cardMeshes: THREE.Mesh[] = [];
    const cardRadius = 4.2;

    displayScreenshots.forEach((item, index) => {
      const angle = (index / (displayScreenshots.length || 1)) * Math.PI * 2;
      const x = Math.cos(angle) * cardRadius;
      const z = Math.sin(angle) * cardRadius;

      // Card Canvas Texture with Screenshot Info
      const cardCanvas = document.createElement("canvas");
      cardCanvas.width = 256;
      cardCanvas.height = 360;
      const cCtx = cardCanvas.getContext("2d");
      if (cCtx) {
        cCtx.fillStyle = "#1E293B";
        cCtx.fillRect(0, 0, 256, 360);

        // Border
        cCtx.strokeStyle = "#116466";
        cCtx.lineWidth = 6;
        cCtx.strokeRect(0, 0, 256, 360);

        // Header
        cCtx.fillStyle = "#116466";
        cCtx.fillRect(6, 6, 244, 44);
        cCtx.fillStyle = "#F1F5F9";
        cCtx.font = "bold 16px sans-serif";
        cCtx.fillText(item.category || "Screenshot", 18, 34);

        // Title
        cCtx.fillStyle = "#F1F5F9";
        cCtx.font = "bold 18px sans-serif";
        const shortTitle = (item.title || "Untitled").slice(0, 22);
        cCtx.fillText(shortTitle, 18, 90);

        // Snippet / Summary
        cCtx.fillStyle = "#D1E8E2";
        cCtx.font = "14px sans-serif";
        const summary = (item.summary || item.fullText || "Visual Snapshot").slice(0, 75);
        cCtx.fillText(summary.slice(0, 25), 18, 140);
        cCtx.fillText(summary.slice(25, 50), 18, 165);
        cCtx.fillText(summary.slice(50, 75), 18, 190);

        // Footer Tag
        cCtx.fillStyle = "rgba(17, 100, 102, 0.4)";
        cCtx.fillRect(18, 300, 220, 36);
        cCtx.fillStyle = "#F1F5F9";
        cCtx.font = "13px sans-serif";
        cCtx.fillText("🔒 Vault Node Verified", 32, 324);
      }

      const cardTex = new THREE.CanvasTexture(cardCanvas);
      const cardGeo = new THREE.PlaneGeometry(1.3, 1.8);
      const cardMat = new THREE.MeshStandardMaterial({
        map: cardTex,
        roughness: 0.3,
        metalness: 0.4,
        side: THREE.DoubleSide,
      });

      const cardMesh = new THREE.Mesh(cardGeo, cardMat);
      cardMesh.position.set(x, 1.2, z);
      cardMesh.lookAt(0, 1.2, 0);
      (cardMesh as any).userData = { item, index };
      cardsGroup.add(cardMesh);
      cardMeshes.push(cardMesh);
    });

    // 6. Damped Pointer Interaction & Raycasting
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationY = 0;
    let targetRotationX = 0;
    let isDragging = false;
    let previousPointerX = 0;
    let previousPointerY = 0;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      previousPointerX = e.clientX;
      previousPointerY = e.clientY;
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const deltaX = e.clientX - previousPointerX;
        const deltaY = e.clientY - previousPointerY;
        targetRotationY += deltaX * 0.005;
        targetRotationX += deltaY * 0.003;
        targetRotationX = Math.max(-0.4, Math.min(0.6, targetRotationX));
        previousPointerX = e.clientX;
        previousPointerY = e.clientY;
      }

      // Check card hover
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(cardMeshes);
      if (intersects.length > 0) {
        const hit = intersects[0].object as any;
        if (hit.userData?.item) {
          setHoveredItem(hit.userData.item);
          container.style.cursor = "pointer";
        }
      } else {
        setHoveredItem(null);
        container.style.cursor = isDragging ? "grabbing" : "grab";
      }
    };

    const handlePointerUp = () => {
      isDragging = false;
      container.style.cursor = "grab";
    };

    const handleClick = () => {
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(cardMeshes);
      if (intersects.length > 0) {
        const hit = intersects[0].object as any;
        if (hit.userData?.item) {
          setActiveItem(hit.userData.item);
          onSelectScreenshot(hit.userData.item);
        }
      }
    };

    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    container.addEventListener("click", handleClick);

    // 7. Animation Loop with Clock Delta
    const clock = new THREE.Clock();
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Gyroscopic gimbal spins
      gimbalOuter.rotation.x += delta * 0.65;
      gimbalOuter.rotation.y += delta * 0.45;
      gimbalInner.rotation.x -= delta * 0.85;
      gimbalInner.rotation.z += delta * 0.55;

      // Core pulsation & spin
      coreMesh.rotation.y += delta * 0.75;
      coreMesh.rotation.x += delta * 0.35;
      const pulseScale = 1.0 + Math.sin(elapsed * 2.5) * 0.08;
      coreMesh.scale.set(pulseScale, pulseScale, pulseScale);
      laserDisc.rotation.z += delta * 0.4;

      // Soft vertical card hover bobbing
      cardMeshes.forEach((mesh, idx) => {
        mesh.position.y = 1.2 + Math.sin(elapsed * 2 + idx * 0.5) * 0.12;
      });

      // Auto-rotation when not dragging
      if (autoRotateRef.current && !isDragging) {
        targetRotationY += delta * 0.22;
      }

      // Smooth camera / vault damping
      vaultGroup.rotation.y += (targetRotationY - vaultGroup.rotation.y) * 0.08;
      vaultGroup.rotation.x += (targetRotationX - vaultGroup.rotation.x) * 0.08;

      renderer.render(scene, camera);
    };

    animate();

    // 8. Resize Handler
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener("resize", handleResize);

    // 9. Clean Disposal on Unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      container.removeEventListener("click", handleClick);
      window.removeEventListener("resize", handleResize);

      // Dispose Three.js objects
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose());
            } else {
              mesh.material.dispose();
            }
          }
        }
      });
      gridTexture.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isOpen, screenshots, onSelectScreenshot]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B0F19]/90 backdrop-blur-md">
      {/* 3D Viewport Canvas Container */}
      <div ref={mountRef} className="relative w-full h-full cursor-grab overflow-hidden">
        {/* Top Header Overlay */}
        <div className="absolute top-4 left-6 right-6 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#116466]/30 border border-[#116466] flex items-center justify-center text-[#D1E8E2] shadow-lg shadow-[#116466]/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#F1F5F9] tracking-wide flex items-center gap-2">
                SnapFind 3D Vault Explorer
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#116466]/40 text-[#D1E8E2] border border-[#116466]/60">
                  PBR Spatial Core
                </span>
              </h2>
              <p className="text-xs text-[#D1E8E2]/70">
                Rotating optical scanner core with {screenshots.length} indexed screenshot nodes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="pointer-events-auto p-2.5 rounded-xl bg-[#1E293B]/80 hover:bg-[#1E293B] text-[#F1F5F9] border border-[#334155] hover:border-[#116466] transition-colors shadow-lg"
            title="Exit 3D Vault"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hovered Node Tooltip (Floating overlay) */}
        {hoveredItem && (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-none z-10 bg-[#1E293B]/95 border border-[#116466] rounded-xl px-5 py-3 shadow-2xl backdrop-blur-md max-w-md text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="text-xs font-semibold text-[#116466] uppercase tracking-wider mb-0.5">
              {hoveredItem.category || "Screenshot Node"}
            </div>
            <div className="text-sm font-bold text-[#F1F5F9] truncate">
              {hoveredItem.title || "Untitled Screenshot"}
            </div>
            <div className="text-xs text-[#D1E8E2]/80 mt-1 line-clamp-1">
              {hoveredItem.summary || hoveredItem.fullText || "Click node to open full inspection"}
            </div>
          </div>
        )}

        {/* Floating Control Dock (<=15% viewport footprint) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#1E293B]/90 border border-[#334155] rounded-2xl p-2 shadow-2xl backdrop-blur-md z-10 pointer-events-auto">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
              autoRotate
                ? "bg-[#116466] text-[#F1F5F9] shadow-md shadow-[#116466]/40"
                : "bg-[#0B0F19]/60 text-[#D1E8E2] hover:bg-[#0B0F19]"
            }`}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {autoRotate ? "Auto-Spin On" : "Auto-Spin Off"}
          </button>

          <div className="w-[1px] h-5 bg-[#334155]" />

          <div className="text-xs text-[#D1E8E2]/70 px-2 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-[#116466]" />
            <span>Drag to rotate • Click node to view</span>
          </div>

          <div className="w-[1px] h-5 bg-[#334155]" />

          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#0B0F19]/60 text-[#D1E8E2] hover:bg-[#116466]/30 hover:text-[#F1F5F9] border border-[#334155] transition-colors"
          >
            Close Vault
          </button>
        </div>
      </div>
    </div>
  );
};
