import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { getPositionKey, validatePlacement, sectionOffset, getFootprint } from '../utils/yardLogic';
import gsap from 'gsap';

const COLOR_MAP = {
  'Dry': 0x3b82f6,
  'Reefer': 0x22c55e,
  'Hazardous': 0xef4444,
  'Tank': 0xeab308,
  'Open Top': 0xa855f7,
  'Flat Rack': 0xa8a29e
};

function worldXToSection(x) {
  if (x >= -5 && x < 5) return 'A';
  if (x >= 7 && x < 17) return 'B';
  if (x >= 19 && x < 29) return 'C';
  return null;
}

export default function ThreeView({
  yard,
  containerMap,
  currentPlacementContainer,
  currentPlacementOrientation,
  onPlaceContainer,
  onContainerClick
}) {
  const mountRef = useRef(null);
  const tooltipRef = useRef(null);

  const yardRef = useRef(yard);
  const containerMapRef = useRef(containerMap);
  const placementContainerRef = useRef(currentPlacementContainer);
  const placementOrientationRef = useRef(currentPlacementOrientation);
  const onPlaceRef = useRef(onPlaceContainer);
  const onClickRef = useRef(onContainerClick);

  useEffect(() => { yardRef.current = yard; }, [yard]);
  useEffect(() => { containerMapRef.current = containerMap; }, [containerMap]);
  useEffect(() => { placementContainerRef.current = currentPlacementContainer; }, [currentPlacementContainer]);
  useEffect(() => { placementOrientationRef.current = currentPlacementOrientation; }, [currentPlacementOrientation]);
  useEffect(() => { onPlaceRef.current = onPlaceContainer; }, [onPlaceContainer]);
  useEffect(() => { onClickRef.current = onContainerClick; }, [onContainerClick]);

  const sceneRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const containerMeshesRef = useRef([]);
  const ghostMeshesRef = useRef([]);
  const groundPlanesRef = useRef([]);
  const raycasterRef = useRef(null);
  const mouseRef = useRef(new THREE.Vector2());
  const hoveredMeshRef = useRef(null);
  const ghost3DRowRef = useRef(null);
  const ghost3DColRef = useRef(null);
  const ghost3DSectionRef = useRef('A');

  const [isSceneReady, setIsSceneReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f1e);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, mount.clientWidth / mount.clientHeight || 1, 0.1, 1000);
    camera.position.set(12, 20, 20);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth || 800, mount.clientHeight || 500);
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(12, 0, 0);
    controls.enableDamping = true;
    controls.update();
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    const planeMat = new THREE.MeshStandardMaterial({ color: 0x1e2130 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(50, 20), planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(12, 0, 0);
    scene.add(plane);

    [0, 12, 24].forEach(offset => {
      const gh = new THREE.GridHelper(10, 10, 0xffffff, 0xffffff);
      gh.position.set(offset, 0.01, 0);
      gh.material.opacity = 0.2;
      gh.material.transparent = true;
      scene.add(gh);
    });

    const gps = [];
    [0, 12, 24].forEach(offset => {
      const gp = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
      );
      gp.rotation.x = -Math.PI / 2;
      gp.position.set(offset, 0.001, 0);
      scene.add(gp);
      gps.push({ mesh: gp, offset });
    });
    groundPlanesRef.current = gps;

    raycasterRef.current = new THREE.Raycaster();

    function clearGhosts() {
      ghostMeshesRef.current.forEach(m => scene.remove(m));
      ghostMeshesRef.current = [];
    }

    function showGhost(footprint, valid, section) {
      clearGhosts();
      const color = valid ? 0x22c55e : 0xef4444;
      const offset = sectionOffset[section] || 0;
      footprint.forEach(f => {
        const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
        const yStack = (yardRef.current[f.key] ? yardRef.current[f.key].length : 0);
        mesh.position.set(f.col - 4.5 + offset, yStack + 0.5, f.row - 4.5);
        mesh.userData.isGhost = true;
        scene.add(mesh);
        ghostMeshesRef.current.push(mesh);
      });
    }

    function onMouseMove(event) {
      const tooltip = tooltipRef.current;
      const rect = mount.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / mount.clientWidth) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / mount.clientHeight) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);

      if (placementContainerRef.current) {
        if (tooltip) tooltip.classList.add('hidden');
        if (hoveredMeshRef.current) {
          const child = hoveredMeshRef.current.children.find(c => c.isMesh);
          if (child) child.material.emissive.setHex(hoveredMeshRef.current._savedEmissive || 0);
          hoveredMeshRef.current = null;
        }
        const gpMeshes = groundPlanesRef.current.map(g => g.mesh);
        const hits = raycasterRef.current.intersectObjects(gpMeshes, false);
        if (!hits.length) { clearGhosts(); return; }

        const hit = hits[0].point;
        const section = worldXToSection(hit.x);
        if (!section) { clearGhosts(); return; }

        const offset = sectionOffset[section] || 0;
        const col = Math.max(0, Math.min(9, Math.floor(hit.x - offset + 5)));
        const row = Math.max(0, Math.min(9, Math.floor(hit.z + 5)));

        if (row === ghost3DRowRef.current && col === ghost3DColRef.current && section === ghost3DSectionRef.current) return;
        ghost3DRowRef.current = row;
        ghost3DColRef.current = col;
        ghost3DSectionRef.current = section;

        const pc = placementContainerRef.current;
        const orient = placementOrientationRef.current;
        const validation = validatePlacement(yardRef.current, containerMapRef.current, section, pc.size, row, col, orient);
        const fp = validation.footprint || getFootprint(section, pc.size, row, col, orient) || [];
        showGhost(fp, validation.valid, section);
        return;
      }

      clearGhosts();
      const intersects = raycasterRef.current.intersectObjects(containerMeshesRef.current, true);

      if (intersects.length > 0) {
        let obj = intersects[0].object;
        while (obj.parent && !obj.userData.container) obj = obj.parent;

        if (hoveredMeshRef.current !== obj) {
          if (hoveredMeshRef.current) {
            const child = hoveredMeshRef.current.children.find(c => c.isMesh);
            if (child) child.material.emissive.setHex(hoveredMeshRef.current._savedEmissive || 0);
          }
          hoveredMeshRef.current = obj;
          const child = obj.children.find(c => c.isMesh);
          if (child) {
            obj._savedEmissive = child.material.emissive.getHex();
            const priority = obj.userData.container?.priority;
            child.material.emissive.setHex(
              priority === 'high' ? 0xff0000 : priority === 'medium' ? 0xffaa00 : 0x00ff00
            );
          }
          mount.style.cursor = 'pointer';
        }

        if (tooltip && obj.userData.container) {
          const c = obj.userData.container;
          const stack = yardRef.current[c.footprint[0].key] || [];
          const lines = stack.map(cid => {
            const ac = containerMapRef.current[cid];
            return ac ? `[L${ac.level}] [${ac.priority.toUpperCase()}] ${ac.id} - ${ac.name} (${ac.type})` : '';
          }).reverse().join('\n');
          tooltip.textContent = `Stack at ${c.location}\n${lines}`;
          tooltip.classList.remove('hidden');
          tooltip.style.left = (event.clientX + 15) + 'px';
          tooltip.style.top = (event.clientY + 15) + 'px';
        }
      } else {
        if (hoveredMeshRef.current) {
          const child = hoveredMeshRef.current.children.find(c => c.isMesh);
          if (child) child.material.emissive.setHex(hoveredMeshRef.current._savedEmissive || 0);
          hoveredMeshRef.current = null;
          mount.style.cursor = 'grab';
        }
        if (tooltip) tooltip.classList.add('hidden');
      }
    }

    function onMouseClick() {
      if (placementContainerRef.current) {
        if (ghost3DRowRef.current !== null) {
          const validation = validatePlacement(
            yardRef.current,
            containerMapRef.current,
            ghost3DSectionRef.current,
            placementContainerRef.current.size,
            ghost3DRowRef.current,
            ghost3DColRef.current,
            placementOrientationRef.current
          );
          if (validation.valid) {
            onPlaceRef.current(ghost3DSectionRef.current, ghost3DRowRef.current, ghost3DColRef.current);
          }
        }
        return;
      }

      const intersects = raycasterRef.current.intersectObjects(containerMeshesRef.current, true);
      if (!intersects.length) return;

      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.container) obj = obj.parent;
      const c = obj.userData.container;
      if (!c) return;

      const origin = c.origin || { row: c.row, col: c.col };
      onClickRef.current({
        key: getPositionKey(c.section, origin.row, origin.col),
        section: c.section,
        row: origin.row,
        col: origin.col
      });
    }

    function onMouseLeave() {
      if (tooltipRef.current) tooltipRef.current.classList.add('hidden');
      if (hoveredMeshRef.current) {
        const child = hoveredMeshRef.current.children.find(c => c.isMesh);
        if (child) child.material.emissive.setHex(hoveredMeshRef.current._savedEmissive || 0);
        hoveredMeshRef.current = null;
      }
    }

    mount.addEventListener('mousemove', onMouseMove);
    mount.addEventListener('click', onMouseClick);
    mount.addEventListener('mouseleave', onMouseLeave);

    const handleResize = () => {
      if (!mount || !cameraRef.current || !rendererRef.current) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    function animate() {
      requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      renderer.render(scene, cameraRef.current);
    }
    animate();
    
    setIsSceneReady(true);

    return () => {
      window.removeEventListener('resize', handleResize);
      mount.removeEventListener('mousemove', onMouseMove);
      mount.removeEventListener('click', onMouseClick);
      mount.removeEventListener('mouseleave', onMouseLeave);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      
      // CRITICAL: Clear mesh cache when scene is destroyed
      meshMapRef.current = {};
      setIsSceneReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update container meshes when containerMap changes
  const meshMapRef = useRef({}); // id -> THREE.Group

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const currentIds = new Set(Object.keys(containerMap));

    // 1. Remove meshes that are no longer in the map
    Object.keys(meshMapRef.current).forEach(id => {
      if (!currentIds.has(id)) {
        scene.remove(meshMapRef.current[id]);
        delete meshMapRef.current[id];
      }
    });

    // 2. Update or Create meshes
    Object.values(containerMap).forEach(c => {
      const is40ft = c.size === '40ft' || c.size === '45ft';
      const isVertical = c.orientation === 'vertical';
      const width = isVertical ? 1 : (is40ft ? 4 : 2);
      const depth = isVertical ? (is40ft ? 4 : 2) : 1;

      const fp = c.footprint;
      const minCol = Math.min(...fp.map(f => f.col));
      const maxCol = Math.max(...fp.map(f => f.col));
      const minRow = Math.min(...fp.map(f => f.row));
      const maxRow = Math.max(...fp.map(f => f.row));
      const offset = sectionOffset[c.section] || 0;

      const targetX = ((minCol + maxCol) / 2) - 4.5 + offset;
      const targetY = c.level + 0.5;
      const targetZ = ((minRow + maxRow) / 2) - 4.5;

      if (meshMapRef.current[c.id]) {
        // ANIMATE EXISTING MESH
        const group = meshMapRef.current[c.id];
        group.userData.container = c; // keep ref fresh

        // Only animate if position changed
        if (Math.abs(group.position.x - targetX) > 0.01 || 
            Math.abs(group.position.y - targetY) > 0.01 || 
            Math.abs(group.position.z - targetZ) > 0.01) {
          gsap.to(group.position, {
            x: targetX,
            y: targetY,
            z: targetZ,
            duration: 0.6,
            ease: "power2.inOut"
          });
        }
      } else {
        // CREATE NEW MESH
        const geo = new THREE.BoxGeometry(width, 1, depth);
        const color = COLOR_MAP[c.type] || 0x4ade80;
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
        const outline = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3 })
        );

        const group = new THREE.Group();
        group.add(mesh);
        group.add(outline);
        group.position.set(targetX, targetY, targetZ);
        group.userData = { container: c };

        scene.add(group);
        meshMapRef.current[c.id] = group;

        // Entry animation
        gsap.from(group.scale, { x: 0, y: 0, z: 0, duration: 0.4, ease: "back.out(1.7)" });
      }
    });

    // Sync raycasting array
    containerMeshesRef.current = Object.values(meshMapRef.current);
  }, [containerMap, isSceneReady]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} id="three-container" />
      <div
        ref={tooltipRef}
        id="three-tooltip"
        className="hidden"
        style={{
          position: 'fixed',
          background: 'rgba(10,15,28,0.92)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px',
          padding: '10px 14px',
          color: '#f8fafc',
          fontSize: '0.78rem',
          fontFamily: 'monospace',
          whiteSpace: 'pre',
          pointerEvents: 'none',
          zIndex: 500,
          maxWidth: '320px'
        }}
      />
    </div>
  );
}
