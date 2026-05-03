import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { getPositionKey } from '../utils/yardLogic';

const ThreeView = ({ yard, containerMap, onCellClick, placementMode }) => {
  const containerRef = useRef();
  const sceneRef = useRef();
  const rendererRef = useRef();
  const cameraRef = useRef();
  const meshesRef = useRef({});

  useEffect(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05070a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, containerRef.current.clientWidth / containerRef.current.clientHeight, 0.1, 1000);
    camera.position.set(25, 25, 25);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    // Grid Helper - 3 sections
    const gridHelper = new THREE.GridHelper(60, 30, 0x3b82f6, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Click handling via Raycaster
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseDown = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      
      // Raycast against a virtual plane at y=0 for grid placement
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const intersectionPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, intersectionPoint)) {
        // Map intersectionPoint to section, row, col
        let x = intersectionPoint.x;
        let z = intersectionPoint.z;

        let section = 'B';
        if (x < -10) { section = 'A'; x += 20; }
        else if (x > 10) { section = 'C'; x -= 20; }

        const col = Math.round((x / 2) + 4.5);
        const row = Math.round((z / 2) + 4.5);

        if (col >= 0 && col < 10 && row >= 0 && row < 10) {
          onCellClick(getPositionKey(section, row, col));
        }
      }
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.dispose();
      if (containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };
  }, [onCellClick]);

  // Update Meshes
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;

    Object.values(meshesRef.current).forEach(m => scene.remove(m));
    meshesRef.current = {};

    Object.values(containerMap).forEach(c => {
      const isLarge = c.size === '40ft' || c.size === '45ft';
      const geometry = new THREE.BoxGeometry(
        isLarge && c.orientation === 'horizontal' ? 3.8 : 1.8, 
        1.8, 
        isLarge && c.orientation === 'vertical' ? 3.8 : 1.8
      );
      
      const color = c.section === 'A' ? 0x10b981 : c.section === 'B' ? 0x3b82f6 : 0xf59e0b;
      const material = new THREE.MeshPhongMaterial({ 
        color, 
        transparent: true, 
        opacity: 0.9,
        shininess: 100
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      
      const f0 = c.footprint[0];
      const sectionOffset = c.section === 'A' ? -20 : c.section === 'B' ? 0 : 20;
      
      let x = (f0.col - 4.5) * 2 + sectionOffset;
      let z = (f0.row - 4.5) * 2;
      let y = c.level * 2 + 1;

      if (isLarge) {
        if (c.orientation === 'horizontal') x += 1;
        else z += 1;
      }

      mesh.position.set(x, y, z);
      scene.add(mesh);
      meshesRef.current[c.id] = mesh;
    });
  }, [containerMap, yard]);

  return <div ref={containerRef} id="three-container" />;
};

export default ThreeView;
