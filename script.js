// Container Yard Simulator - Phase 1

/* --- Global State --- */

// Stores all container stacks, keyed by position (e.g. "A_2_3")
let yard = {};

// Flat list of all created containers for the roster
let allContainers = [];
let containerMap = {}; // O(1) lookup by ID

// Flat list of shipped containers
let shippedContainers = [];

const sectionOffset = { 'A': 0, 'B': 12, 'C': 24 };

// Auto-increment counter for container IDs
let containerCounter = 0;

// Container staged for placement — set by modal, cleared after placement
let currentPlacementContainer = null;
let currentPlacementOrientation = 'horizontal';
let currentCreationMode = '3d'; // 'manual' or '3d'

// Drag and drop state
let draggedContainerId = null;
let isDragging = false;
let dragOccurred = false;
let dragStartX = 0;
let dragStartY = 0;
const DRAG_THRESHOLD = 5; // pixels before considering it a drag

// Maximum containers per stack
const MAX_STACK_HEIGHT = 3;

/* --- 3D Scene Global State --- */
let scene, camera, renderer, controls;
let containerMeshes = [];
let raycaster, mouse;
let hoveredMesh = null;
let expandedCell = null;

// 3D placement ghost state
let ghostMeshes = [];          // semi-transparent preview boxes
let ghost3DRow = null;         // last snapped row
let ghost3DCol = null;         // last snapped col
let ghost3DSection = 'A';      // snapped section
let ghost3DValid = false;      // whether last position was valid
// Invisible ground planes used for raycasting during placement mode
let groundPlanes = null;

// Utility Functions

/**
 * Returns the next sequential container ID (C1, C2 …)
 */
function generateContainerID() {
  containerCounter++;
  return `C${containerCounter}`;
}

/**
 * Builds a unique position key. e.g. "A_2_3"
 */
function getPositionKey(section, row, col) {
  return `${section}_${row}_${col}`;
}

/**
 * Returns an array of position keys for a container's footprint.
 * 20ft = 2 cells, 40ft/45ft = 4 cells.
 */
function getFootprint(section, size, row, col, orientation) {
  const length = (size === '40ft' || size === '45ft') ? 4 : 2;
  const footprint = [];
  for (let i = 0; i < length; i++) {
    const r = orientation === 'vertical' ? row + i : row;
    const c = orientation === 'horizontal' ? col + i : col;
    if (r >= 0 && r < 10 && c >= 0 && c < 10) {
      footprint.push({ section, row: r, col: c, key: getPositionKey(section, r, c) });
    } else {
      // Out of bounds
      return null;
    }
  }
  return footprint;
}

/**
 * Calculates priority based on departure date.
 */
function calculatePriority(departureDateStr) {
  if (!departureDateStr) return 'low';
  const depDate = new Date(departureDateStr);
  const now = new Date();
  depDate.setHours(0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffTime = depDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 2) return 'high';
  if (diffDays <= 5) return 'medium';
  return 'low';
}

/**
 * Checks if a container is buried under others.
 */
function isBlocked(containerId) {
  const container = containerMap[containerId];
  if (!container) return false;
  for (const f of container.footprint) {
    const stack = yard[f.key];
    if (stack && stack[stack.length - 1] !== containerId) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a placement buries a high priority container.
 */
function checkBuryWarning(targetKey, insertLevel) {
  const stack = yard[targetKey];
  if (!stack || stack.length === 0) return true;

  for (let i = 0; i < insertLevel && i < stack.length; i++) {
    const containerId = stack[i];
    const actualC = containerMap[containerId];
    if (actualC && actualC.priority === 'high') {
      return confirm(`Warning: You are about to bury a High-Priority container (${actualC.id}) at ${targetKey}. Do you want to proceed?`);
    }
  }
  return true;
}

/**
 * Validates if a container can be placed at the given location.
 */
function validatePlacement(section, size, row, col, orientation = 'horizontal') {
  const footprint = getFootprint(section, size, row, col, orientation);

  if (!footprint) {
    return { valid: false, reason: 'Exceeds grid bounds.' };
  }

  // All cells in footprint must have the same height to ensure a flat base
  const heights = footprint.map(f => yard[f.key] ? yard[f.key].length : 0);
  const baseHeight = heights[0];

  if (baseHeight >= MAX_STACK_HEIGHT) {
    return { valid: false, reason: 'Stack full at this location.' };
  }

  if (!heights.every(h => h === baseHeight)) {
    return { valid: false, reason: 'Uneven stack heights across footprint.' };
  }

  // Support coverage validation: Ensure we fully cover any larger containers below
  if (baseHeight > 0) {
    const supportingIds = new Set();
    footprint.forEach(f => {
      const stack = yard[f.key];
      if (stack && stack.length >= baseHeight) {
        supportingIds.add(stack[baseHeight - 1]);
      }
    });

    for (const supId of supportingIds) {
      const supContainer = containerMap[supId];
      if (supContainer) {
        // Check if our new footprint covers the entire footprint of the supporting container
        const isFullyCovered = supContainer.footprint.every(sf =>
          footprint.some(f => f.key === sf.key)
        );
        if (!isFullyCovered) {
          return { valid: false, reason: `Invalid Stack: Footprint must fully cover the supporting container (${supId}).` };
        }
      }
    }
  }

  return { valid: true, footprint };
}

// Modal Controls

/** Opens the container creation modal */
function openModal(mode = '3d') {
  currentCreationMode = mode;
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.body.classList.add('panel-open'); // Focus mode
  
  const manualFields = document.getElementById('manual-coordinates');
  const suggestionBox = document.getElementById('suggestion-box');
  
  if (mode === 'manual') {
    manualFields.classList.remove('hidden');
    suggestionBox.classList.add('hidden');
  } else {
    manualFields.classList.add('hidden');
    suggestionBox.classList.remove('hidden');
    calculateSuggestion();
  }
}

/** Closes the container creation modal */
function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.body.classList.remove('panel-open');
  clearSuggestionHighlight();
}

/** Closes modal when user clicks the dark backdrop */
function handleOverlayClick(e) {
  if (e.target === document.getElementById('modal-overlay')) {
    closeModal();
  }
}

// Tabs & Roster Table

/** Handles switching between Tabs */
function switchTab(targetId) {
  // Update button active state
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.getAttribute('data-target') === targetId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update pane visibility
  document.querySelectorAll('.tab-pane').forEach(pane => {
    if (pane.id === targetId) {
      pane.classList.add('active');
      pane.classList.remove('hidden');
      if (targetId === 'tab-shipyard') {
        setTimeout(() => {
          if (typeof onWindowResize === 'function') onWindowResize();
          if (typeof render3DYard === 'function') render3DYard();
        }, 50);
      }
    } else {
      pane.classList.remove('active');
      pane.classList.add('hidden');
    }
  });
}

/** Renders the containers array into the roster table */
function renderTable() {
  const tbody = document.getElementById('containers-tbody');
  tbody.innerHTML = '';

  if (allContainers.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="11">No containers available.</td></tr>';
    updateAnalytics();
    return;
  }

  allContainers.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.id}</td>
      <td>${c.name}</td>
      <td>${c.type}</td>
      <td>${c.size}</td>
      <td>
        <span class="priority-badge priority-${c.priority}">
          ${c.priority.toUpperCase()}
        </span>
      </td>
      <td>${c.weight} kg</td>
      <td>${c.destination}</td>
      <td>${c.arrivalDate}</td>
      <td>${c.departureDate}</td>
      <td>${c.location}</td>
      <td>${c.level}</td>
    `;
    tbody.appendChild(tr);
  });

  updateAnalytics();
}

let charts = {};

function destroyCharts() {
  Object.values(charts).forEach(chart => {
    if (chart) chart.destroy();
  });
  charts = {};
}

function updateAnalytics() {
  destroyCharts();

  if (allContainers.length === 0) {
    document.getElementById('total-containers').innerText = `Total: 0`;
    document.getElementById('high-priority').innerText = `High Priority: 0`;
    document.getElementById('avg-stack').innerText = `Avg Stack: 0.0`;
    document.getElementById('ready-ship').innerText = `Low Priority: 0`;
    document.getElementById('insights').innerHTML = '<p style="margin: 4px 0">No data available</p>';
    return;
  }

  const total = allContainers.length;

  const high = allContainers.filter(c => c.priority === 'high').length;
  const medium = allContainers.filter(c => c.priority === 'medium').length;
  const low = allContainers.filter(c => c.priority === 'low').length;

  const sections = { A: 0, B: 0, C: 0 };
  allContainers.forEach(c => {
    if (sections[c.section] !== undefined) {
      sections[c.section]++;
    }
  });

  const types = {};
  allContainers.forEach(c => {
    types[c.type] = (types[c.type] || 0) + 1;
  });

  const stackLevels = { 0: 0, 1: 0, 2: 0, 3: 0 };
  Object.values(yard).forEach(stack => {
    stackLevels[stack.length] = (stackLevels[stack.length] || 0) + 1;
  });

  // KPI updates
  document.getElementById('total-containers').innerText = total;
  document.getElementById('high-priority').innerText = high;
  document.getElementById('avg-stack').innerText =
    (Object.values(yard).reduce((a, s) => a + s.length, 0) / (Object.keys(yard).length || 1)).toFixed(1);
  document.getElementById('ready-ship').innerText = low;

  // Insights updates
  let insights = [];
  if (high > 0) {
    insights.push("⚠️ High priority containers need attention");
  }
  if (sections.A > sections.B && sections.A > sections.C) {
    insights.push("📦 Section A is most occupied");
  } else if (sections.B > sections.C) {
    insights.push("📦 Section B is most occupied");
  }
  if (stackLevels[3] > 0) {
    insights.push("🚧 Some stacks are at maximum height");
  }
  if (insights.length === 0) insights.push("✅ Yard is operating smoothly");

  document.getElementById('insights').innerHTML = insights.map(i => `<p style="margin: 4px 0">${i}</p>`).join('');

  // Charts
  const canvasSec = document.getElementById('sectionBarChart');
  if (canvasSec) {
    const ctxSec = canvasSec.getContext('2d');
    charts.sectionBarChart = new Chart(ctxSec, {
      type: 'bar',
      data: {
        labels: ['Section A', 'Section B', 'Section C'],
        datasets: [{
          label: 'Containers',
          data: [sections.A, sections.B, sections.C],
          backgroundColor: '#3b82f6'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Sections', color: '#fff' }, legend: { display: false } }, scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } } }
    });
  }

  const typeLabels = Object.keys(types);
  const typeValues = Object.values(types);
  const canvasType = document.getElementById('typeBarChart');
  if (canvasType) {
    charts.typeBarChart = new Chart(
      canvasType,
      {
        type: 'bar',
        data: {
          labels: typeLabels,
          datasets: [{
            label: 'Container Types',
            data: typeValues,
            backgroundColor: '#3b82f6'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Container Types', color: '#fff' }, legend: { display: false } }, scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } } }
      }
    );
  }

  const canvasStack = document.getElementById('stackBarChart');
  if (canvasStack) {
    charts.stackBarChart = new Chart(
      canvasStack,
      {
        type: 'bar',
        data: {
          labels: ['0', '1', '2', '3'],
          datasets: [{
            label: 'Stack Heights',
            data: [
              stackLevels[0],
              stackLevels[1],
              stackLevels[2],
              stackLevels[3]
            ],
            backgroundColor: '#f59e0b'
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { title: { display: true, text: 'Stack Heights', color: '#fff' }, legend: { display: false } }, scales: { y: { ticks: { color: '#fff' } }, x: { ticks: { color: '#fff' } } } }
      }
    );
  }
}

// Three.js 3D Visualization

const colorMap = {
  'Dry': 0x3b82f6,      // blue
  'Reefer': 0x22c55e,   // green
  'Hazardous': 0xef4444,// red
  'Tank': 0xeab308,     // yellow
  'Open Top': 0xa855f7, // purple
  'Flat Rack': 0xa8a29e // brown
};

function init3D() {
  const container = document.getElementById('three-container');
  if (!container || !window.THREE) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0f1e);

  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight || 1, 0.1, 1000);
  camera.position.set(12, 20, 20);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth || 800, container.clientHeight || 500);
  container.appendChild(renderer.domElement);

  if (THREE.OrbitControls) {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.target.set(12, 0, 0);
    controls.update();
  } else {
    camera.lookAt(12, 0, 0);
  }

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // Ground Plane
  const planeGeo = new THREE.PlaneGeometry(50, 20);
  const planeMat = new THREE.MeshStandardMaterial({ color: 0x1e2130 });
  const plane = new THREE.Mesh(planeGeo, planeMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(12, 0, 0);
  scene.add(plane);

  // Grid Helpers
  const gridHelperA = new THREE.GridHelper(10, 10, 0xffffff, 0xffffff);
  gridHelperA.position.set(0, 0.01, 0);
  gridHelperA.material.opacity = 0.2;
  gridHelperA.material.transparent = true;
  scene.add(gridHelperA);

  const gridHelperB = new THREE.GridHelper(10, 10, 0xffffff, 0xffffff);
  gridHelperB.position.set(12, 0.01, 0);
  gridHelperB.material.opacity = 0.2;
  gridHelperB.material.transparent = true;
  scene.add(gridHelperB);

  const gridHelperC = new THREE.GridHelper(10, 10, 0xffffff, 0xffffff);
  gridHelperC.position.set(24, 0.01, 0);
  gridHelperC.material.opacity = 0.2;
  gridHelperC.material.transparent = true;
  scene.add(gridHelperC);

  // Raycaster
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  container.addEventListener('mousemove', onMouseMove, false);
  container.addEventListener('click', onMouseClick, false);

  container.addEventListener('mouseleave', () => {
    const tooltip = document.getElementById('three-tooltip');
    if (tooltip) tooltip.classList.add('hidden');
    if (hoveredMesh) {
      const childMesh = hoveredMesh.children.find(c => c.isMesh);
      if (childMesh) childMesh.material.emissive.setHex(hoveredMesh.currentHex);
      hoveredMesh = null;
    }
  });

  window.addEventListener('resize', onWindowResize, false);

  console.log("Three.js initialized");

  // Create invisible ground planes for each section — used for 3D placement raycasting
  groundPlanes = [];
  const sectionOffsets = [0, 12, 24];
  sectionOffsets.forEach(offset => {
    const geo = new THREE.PlaneGeometry(10, 10);
    const mat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const gp = new THREE.Mesh(geo, mat);
    gp.rotation.x = -Math.PI / 2;
    gp.position.set(offset, 0.001, 0);
    scene.add(gp);
    groundPlanes.push({ mesh: gp, offset });
  });

  animate3D();
}

function onWindowResize() {
  const container = document.getElementById('three-container');
  if (!container || !camera || !renderer) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width === 0 || height === 0) return;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function render3DYard() {
  if (!scene) return;

  containerMeshes.forEach(mesh => scene.remove(mesh));
  containerMeshes = [];

  allContainers.forEach(c => {
    const is40ft = c.size === '40ft' || c.size === '45ft';
    const isVertical = c.orientation === 'vertical';

    // Dimensions in units (1 unit = 1 grid cell)
    const width = isVertical ? 1 : (is40ft ? 4 : 2);
    const depth = isVertical ? (is40ft ? 4 : 2) : 1;
    const height = 1;

    const geometry = new THREE.BoxGeometry(width, height, depth);
    const hexColor = colorMap[c.type] || 0x4ade80;
    const material = new THREE.MeshStandardMaterial({ color: hexColor });

    // Create container mesh
    const mesh = new THREE.Mesh(geometry, material);

    // Create outline
    const edges = new THREE.EdgesGeometry(geometry);
    const outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000 })
    );

    // Create group
    const group = new THREE.Group();
    group.add(mesh);
    group.add(outline);

    const section = c.section;
    const offset = sectionOffset[section] || 0;

    // Calculate center of footprint
    const footprint = c.footprint;
    const minCol = Math.min(...footprint.map(f => f.col));
    const maxCol = Math.max(...footprint.map(f => f.col));
    const minRow = Math.min(...footprint.map(f => f.row));
    const maxRow = Math.max(...footprint.map(f => f.row));

    let xPos = ((minCol + maxCol) / 2) - 4.5 + offset;
    let zPos = ((minRow + maxRow) / 2) - 4.5;
    const yPos = c.level + 0.5;

    group.position.set(xPos, yPos, zPos);
    group.userData = { container: c };

    scene.add(group);
    containerMeshes.push(group);
  });
}
// 3D Ghost Preview Helpers

/**
 * Converts a 3D world X position to a section letter.
 * Sections are centred at offsets 0, 12, 24 with width 10.
 */
function worldXToSection(x) {
  if (x >= -5 && x < 5) return 'A';
  if (x >= 7 && x < 17) return 'B';
  if (x >= 19 && x < 29) return 'C';
  return null;
}

/** Removes all ghost meshes from the scene. */
function clearGhostMeshes() {
  ghostMeshes.forEach(m => scene && scene.remove(m));
  ghostMeshes = [];
}

/**
 * Builds ghost boxes for the given footprint.
 * @param {Array} footprint  - from getFootprint()
 * @param {boolean} valid    - green if true, red if false
 * @param {string} section
 */
function showGhostFootprint(footprint, valid, section) {
  clearGhostMeshes();
  const color = valid ? 0x22c55e : 0xef4444;
  const offset = sectionOffset[section] || 0;

  footprint.forEach(f => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.45,
      depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);

    // Centre each ghost box on its cell
    const xPos = f.col - 4.5 + offset;
    const zPos = f.row - 4.5;
    const yPos = (yard[f.key] ? yard[f.key].length : 0) + 0.5;
    mesh.position.set(xPos, yPos, zPos);
    mesh.userData.isGhost = true;

    scene.add(mesh);
    ghostMeshes.push(mesh);
  });
}

function onMouseMove(event) {
  const container = document.getElementById('three-container');
  const tooltip = document.getElementById('three-tooltip');
  if (!container || !tooltip || !raycaster) return;

  const rect = container.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  /* ---- 3D Placement Preview Mode ---- */
  if (currentPlacementContainer && groundPlanes) {
    tooltip.classList.add('hidden');
    // Reset any lingering hover highlight
    if (hoveredMesh) {
      const childMesh = hoveredMesh.children.find(c => c.isMesh);
      if (childMesh) childMesh.material.emissive.setHex(hoveredMesh.currentHex || 0);
      hoveredMesh = null;
    }

    // Raycast against invisible ground planes
    const gpMeshes = groundPlanes.map(g => g.mesh);
    const gpHits = raycaster.intersectObjects(gpMeshes, false);
    if (gpHits.length === 0) { clearGhostMeshes(); return; }

    const hit = gpHits[0].point;
    const section = worldXToSection(hit.x);
    if (!section) { clearGhostMeshes(); return; }

    const sectionX = hit.x - (sectionOffset[section] || 0);
    const col = Math.max(0, Math.min(9, Math.floor(sectionX + 5)));
    const row = Math.max(0, Math.min(9, Math.floor(hit.z + 5)));

    // Skip redraw if same cell
    if (row === ghost3DRow && col === ghost3DCol && section === ghost3DSection) return;
    ghost3DRow = row; ghost3DCol = col; ghost3DSection = section;

    const validation = validatePlacement(section, currentPlacementContainer.size, row, col, currentPlacementOrientation);
    ghost3DValid = validation.valid;
    const fp = validation.footprint || getFootprint(section, currentPlacementContainer.size, row, col, currentPlacementOrientation) || [];
    showGhostFootprint(fp, ghost3DValid, section);
    return;
  }

  /* ---- Normal hover mode ---- */
  clearGhostMeshes();

  const intersects = raycaster.intersectObjects(containerMeshes, true);

  if (intersects.length > 0) {
    let object = intersects[0].object;

    // climb to parent group
    while (object.parent && !object.userData.container) {
      object = object.parent;
    }

    if (hoveredMesh !== object) {
      if (hoveredMesh) {
        // Reset old hover (applying to mesh child)
        const childMesh = hoveredMesh.children.find(c => c.isMesh);
        if (childMesh) childMesh.material.emissive.setHex(hoveredMesh.currentHex);
      }
      hoveredMesh = object;
      const childMesh = hoveredMesh.children.find(c => c.isMesh);
      if (childMesh) {
        hoveredMesh.currentHex = childMesh.material.emissive.getHex();

        const priority = object.userData.container.priority;
        if (priority === 'high') {
          childMesh.material.emissive.setHex(0xff0000);
        } else if (priority === 'medium') {
          childMesh.material.emissive.setHex(0xffaa00);
        } else {
          childMesh.material.emissive.setHex(0x00ff00);
        }
      }
      container.style.cursor = 'pointer';

      const stack = yard[hoveredMesh.userData.container.footprint[0].key] || [];
      const lines = stack.map(cid => {
        const ac = containerMap[cid];
        return `[L${ac.level}] [${ac.priority.toUpperCase()}] ${ac.id} - ${ac.name} (${ac.type})`;
      }).reverse();

      tooltip.innerHTML = `<strong>Stack at ${hoveredMesh.userData.container.location}</strong>\n${lines.join('\n')}`;
      tooltip.classList.remove('hidden');
    }

    tooltip.style.left = (event.clientX + 15) + 'px';
    tooltip.style.top = (event.clientY + 15) + 'px';
  } else {
    if (hoveredMesh) {
      const childMesh = hoveredMesh.children.find(c => c.isMesh);
      if (childMesh) childMesh.material.emissive.setHex(hoveredMesh.currentHex);
      hoveredMesh = null;
      container.style.cursor = 'grab';
      tooltip.classList.add('hidden');
    }
  }
}

function onMouseClick(event) {
  if (!raycaster) return;

  // ---- 3D Placement Click ----
  if (currentPlacementContainer) {
    if (ghost3DValid && ghost3DRow !== null) {
      finalizePlacementAt(ghost3DSection, ghost3DRow, ghost3DCol);
    }
    // If invalid position, ignore the click (don't alert — ghost already shows red)
    return;
  }

  // ---- Normal inspection click ----
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(containerMeshes, true);

  if (intersects.length === 0) {
    closeInspectionPanel();
    return;
  }

  let object = intersects[0].object;
  // Climb up to the group that owns userData.container
  while (object.parent && !object.userData.container) {
    object = object.parent;
  }

  const container = object.userData.container;
  if (!container) return;

  const origin = container.origin || { row: container.row, col: container.col };
  openInspectionPanel({
    key: getPositionKey(container.section, origin.row, origin.col),
    section: container.section,
    row: origin.row,
    col: origin.col
  });
}

function animate3D() {
  requestAnimationFrame(animate3D);
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/**
 * Animates a mesh smoothly from startPos to endPos using a 3-step crane lift curve.
 */
function animateMovement(meshGroup, pathLine, startPos, endPos, liftHeight, onComplete) {
  const liftDuration = 300;
  const moveDuration = 400;
  const dropDuration = 300;
  const totalDuration = liftDuration + moveDuration + dropDuration;

  const startTime = performance.now();

  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  function loop(currentTime) {
    const elapsed = currentTime - startTime;

    if (pathLine) {
      if (elapsed < 150) pathLine.material.opacity = elapsed / 150;
      else if (elapsed > totalDuration - 150) pathLine.material.opacity = Math.max(0, (totalDuration - elapsed) / 150);
      else pathLine.material.opacity = 1;
    }

    if (elapsed < liftDuration) {
      // Phase 1: Lift
      const t = elapsed / liftDuration;
      meshGroup.position.y = startPos.y + (liftHeight - startPos.y) * easeInOutQuad(t);
      requestAnimationFrame(loop);
    } else if (elapsed < liftDuration + moveDuration) {
      // Phase 2: Move
      const t = (elapsed - liftDuration) / moveDuration;
      meshGroup.position.y = liftHeight;
      meshGroup.position.x = startPos.x + (endPos.x - startPos.x) * easeInOutQuad(t);
      meshGroup.position.z = startPos.z + (endPos.z - startPos.z) * easeInOutQuad(t);
      requestAnimationFrame(loop);
    } else if (elapsed < totalDuration) {
      // Phase 3: Drop
      const t = (elapsed - liftDuration - moveDuration) / dropDuration;
      meshGroup.position.x = endPos.x;
      meshGroup.position.z = endPos.z;
      meshGroup.position.y = liftHeight - (liftHeight - endPos.y) * easeInOutQuad(t);
      requestAnimationFrame(loop);
    } else {
      // Complete
      meshGroup.position.copy(endPos);
      if (onComplete) onComplete();
    }
  }

  requestAnimationFrame(loop);
}

// Container Status Indicator

/**
 * Updates the "Current Container" badge above Section A.
 * Shown when a container is staged; hidden after placement.
 */
function updateContainerStatus(msg) {
  const statusEl = document.getElementById('container-status');
  if (currentPlacementContainer) {
    statusEl.textContent = msg || `Ready to place ${currentPlacementContainer.id}`;
    statusEl.classList.remove('hidden');
  } else {
    statusEl.textContent = '';
    statusEl.classList.add('hidden');
  }
}

// Grid Generation

/**
 * Dynamically generates a grid of clickable cells.
 *
 * @param {string} containerId - ID of the target div (e.g. "grid-a")
 * @param {string} section     - Section letter (e.g. "A")
 * @param {number} rows        - Number of rows
 * @param {number} cols        - Number of columns
 */
function generateGrid(containerId, section, rows, cols) {
  const container = document.getElementById(containerId);

  if (!container) {
    console.warn(`Grid container "#${containerId}" not found.`);
    return;
  }

  container.innerHTML = '';

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cell = document.createElement('div');
      cell.classList.add('grid-cell');
      cell.setAttribute('data-row', row);
      cell.setAttribute('data-col', col);
      cell.setAttribute('data-section', section);

      cell.addEventListener('mousedown', function(e) {
        const s = this.getAttribute('data-section');
        const r = parseInt(this.getAttribute('data-row'), 10);
        const c = parseInt(this.getAttribute('data-col'), 10);
        const k = getPositionKey(s, r, c);
        const stk = yard[k];

        if (stk && stk.length > 0) {
          const topId = stk[stk.length - 1];
          if (!isBlocked(topId)) {
            draggedContainerId = topId;
            isDragging = true;
            dragOccurred = false;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            this.classList.add('dragging');
          }
        }
      });

      cell.addEventListener('mousemove', function(e) {
        if (isDragging && !dragOccurred) {
          const dist = Math.sqrt(Math.pow(e.clientX - dragStartX, 2) + Math.pow(e.clientY - dragStartY, 2));
          if (dist > DRAG_THRESHOLD) {
            dragOccurred = true;
          }
        }
      });

      cell.addEventListener('mouseenter', () => {
        if (isDragging && dragOccurred && draggedContainerId) {
          const s = cell.getAttribute('data-section');
          const r = parseInt(cell.getAttribute('data-row'), 10);
          const c = parseInt(cell.getAttribute('data-col'), 10);
          const container = containerMap[draggedContainerId];
          
          if (container) {
            updateDragPreview(s, r, c, container);
          }
        } else {
          updatePlacementPreview(cell);
          highlightFootprint(cell);
        }
      });

      cell.addEventListener('mouseup', function(e) {
        if (isDragging) {
          if (dragOccurred && draggedContainerId) {
            const s = this.getAttribute('data-section');
            const r = parseInt(this.getAttribute('data-row'), 10);
            const c = parseInt(this.getAttribute('data-col'), 10);
            finalizeMove(s, r, c);
          }
          
          isDragging = false;
          draggedContainerId = null;
          document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
          clearPreview();
          
          // Small delay to allow click event to see dragOccurred
          setTimeout(() => { dragOccurred = false; }, 10);
        }
      });

      cell.addEventListener('click', function (e) {
        if (dragOccurred) {
          e.stopPropagation();
          return;
        }
        
        e.stopPropagation();

        if (currentPlacementContainer) {
          finalizePlacement(this);
          return;
        }

        const s = this.getAttribute('data-section');
        const r = parseInt(this.getAttribute('data-row'), 10);
        const c = parseInt(this.getAttribute('data-col'), 10);
        const k = getPositionKey(s, r, c);
        const stk = yard[k];

        if (!stk || stk.length === 0) return;

        openInspectionPanel({ key: k, section: s, row: r, col: c });
      });

      cell.addEventListener('mouseleave', () => {
        if (!isDragging) {
          clearPreview();
          clearFootprintHighlight();
        }
      });

      container.appendChild(cell);
    }
  }
}

function updateDragPreview(section, row, col, container) {
  clearPreview();
  const validation = validatePlacement(section, container.size, row, col, container.orientation);
  
  if (validation.footprint) {
    validation.footprint.forEach(f => {
      const targetCell = document.querySelector(`[data-section="${f.section}"][data-row="${f.row}"][data-col="${f.col}"]`);
      if (targetCell) {
        targetCell.classList.add(validation.valid ? 'preview-valid' : 'preview-invalid');
      }
    });
  }
}

function finalizeMove(section, row, col) {
  if (!draggedContainerId) return;
  const container = containerMap[draggedContainerId];
  if (!container) return;

  const validation = validatePlacement(section, container.size, row, col, container.orientation);
  if (validation.valid) {
    // We need to call moveContainer which currently expects a sourceKey and targetIndex.
    // Let's find the source info.
    const sourceKey = container.footprint[0].key;
    const stack = yard[sourceKey];
    const targetIndex = stack.indexOf(draggedContainerId);
    
    if (targetIndex > -1) {
      // Create a dummy button element if needed, or refactor moveContainer
      moveContainerProgrammatic(sourceKey, targetIndex, section, row, col);
    }
  } else {
    console.warn("Invalid move destination:", validation.reason);
  }
}

function moveContainerProgrammatic(sourceKey, targetIndex, destSection, destRow, destCol) {
  const stack = yard[sourceKey];
  const actualId = stack[targetIndex];
  const container = containerMap[actualId];
  
  // Call the refactored moveContainer with forcedDest
  moveContainer(sourceKey, targetIndex, null, {
    section: destSection,
    row: destRow,
    col: destCol
  });
}


function renderExpandedStack(cell, stack) {
  cell.innerHTML = '';
  const content = document.createElement('div');
  content.className = 'expanded-stack-content';

  const colorMap = {
    'Dry': '#3b82f6',
    'Reefer': '#06b6d4',
    'Hazardous': '#ef4444',
    'Tank': '#8b5cf6',
    'Open Top': '#f59e0b',
    'Flat Rack': '#10b981'
  };

  stack.forEach((cid, idx) => {
    const actualC = containerMap[cid];
    const item = document.createElement('div');
    item.className = 'stack-item';
    item.style.borderLeftColor = colorMap[actualC.type] || '#3b82f6';

    item.innerHTML = `
      <span class="item-level">L${actualC.level}</span>
      <span class="item-id">${actualC.id}</span>
      <span class="item-type-tag">${actualC.type}</span>
    `;
    content.appendChild(item);
  });
  cell.appendChild(content);
}

function highlightFootprint(cell) {
  const section = cell.getAttribute('data-section');
  const row = parseInt(cell.getAttribute('data-row'), 10);
  const col = parseInt(cell.getAttribute('data-col'), 10);
  const key = getPositionKey(section, row, col);

  const stack = yard[key];
  if (!stack || stack.length === 0) return;

  const topId = stack[stack.length - 1];
  const container = containerMap[topId];
  if (!container) return;

  container.footprint.forEach(f => {
    const targetCell = document.querySelector(`[data-section="${container.section}"][data-row="${f.row}"][data-col="${f.col}"]`);
    if (targetCell) targetCell.classList.add('footprint-hover');
  });
}

function clearFootprintHighlight() {
  document.querySelectorAll('.footprint-hover').forEach(c => c.classList.remove('footprint-hover'));
}



// Placement Logic

function cancelPlacement() {
  currentPlacementContainer = null;
  clearPreview();
  clearGhostMeshes();
  ghost3DRow = null; ghost3DCol = null; ghost3DValid = false;
  updateContainerStatus('');
  document.getElementById('placement-banner').classList.add('hidden');
  document.body.style.cursor = 'default';
}

/**
 * Places a container programmatically at (section, row, col).
 * Called from 3D click handler — reuses all finalizePlacement logic without needing a DOM cell.
 */
function finalizePlacementAt(section, row, col) {
  if (!currentPlacementContainer) return;

  const validation = validatePlacement(section, currentPlacementContainer.size, row, col, currentPlacementOrientation);
  if (!validation.valid) return; // ghost was green, this shouldn't happen — guard only

  const footprint = validation.footprint;
  const targetHeight = yard[footprint[0].key] ? yard[footprint[0].key].length : 0;

  for (const f of footprint) {
    if (!checkBuryWarning(f.key, targetHeight)) return;
  }

  const container = {
    ...currentPlacementContainer,
    location: `Sec ${section}, Row ${row}, Col ${col}`,
    section,
    row,
    col,
    origin: { row, col },
    level: targetHeight,
    orientation: currentPlacementOrientation,
    footprint: footprint.map(f => ({ row: f.row, col: f.col, key: f.key }))
  };

  allContainers.push(container);
  containerMap[container.id] = container;

  footprint.forEach(f => {
    if (!yard[f.key]) yard[f.key] = [];
    yard[f.key].push(container.id);
    const cellDOM = document.querySelector(`[data-section="${f.section}"][data-row="${f.row}"][data-col="${f.col}"]`);
    if (cellDOM) {
      updateCell(cellDOM, yard[f.key]);
      cellDOM.classList.add('placed-pop');
      setTimeout(() => cellDOM.classList.remove('placed-pop'), 400);
    }
  });

  renderTable();
  render3DYard();
  cancelPlacement();
}

function clearPreview() {
  document.querySelectorAll('.preview-valid, .preview-invalid').forEach(c => {
    c.classList.remove('preview-valid', 'preview-invalid');
  });
}

function updatePlacementPreview(cell) {
  clearPreview();
  if (!currentPlacementContainer) return;

  const section = cell.getAttribute('data-section');
  const row = parseInt(cell.getAttribute('data-row'), 10);
  const col = parseInt(cell.getAttribute('data-col'), 10);

  const validation = validatePlacement(section, currentPlacementContainer.size, row, col, currentPlacementOrientation);

  if (validation.footprint) {
    validation.footprint.forEach(f => {
      const targetCell = document.querySelector(`[data-section="${f.section}"][data-row="${f.row}"][data-col="${f.col}"]`);
      if (targetCell) {
        targetCell.classList.add(validation.valid ? 'preview-valid' : 'preview-invalid');
      }
    });
  } else {
    cell.classList.add('preview-invalid');
  }
}

function updatePlacementBanner() {
  const banner = document.getElementById('placement-banner');
  const text = document.getElementById('banner-text');
  const modeStatus = document.getElementById('mode-status');
  const modeText = document.getElementById('mode-text');
  const tipsWidget = document.getElementById('widget-tips');

  if (currentPlacementContainer) {
    const type = currentPlacementContainer.type;
    const orient = currentPlacementOrientation.charAt(0).toUpperCase() + currentPlacementOrientation.slice(1);
    text.textContent = `Placing: ${type} | Orientation: ${orient} | Press 'R' to Rotate | ESC to Cancel`;
    banner.classList.remove('hidden');
    document.body.style.cursor = 'crosshair';
    
    if (modeStatus) modeStatus.classList.add('status-active');
    if (modeText) modeText.textContent = 'Placement Mode';
    if (tipsWidget) tipsWidget.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
    document.body.style.cursor = 'default';
    
    if (modeStatus) modeStatus.classList.remove('status-active');
    if (modeText) modeText.textContent = 'Normal View';
    if (tipsWidget) tipsWidget.classList.add('hidden');
  }
}

function finalizePlacement(cell) {
  const section = cell.getAttribute('data-section');
  const row = parseInt(cell.getAttribute('data-row'), 10);
  const col = parseInt(cell.getAttribute('data-col'), 10);

  const validation = validatePlacement(section, currentPlacementContainer.size, row, col, currentPlacementOrientation);
  if (!validation.valid) {
    alert(validation.reason);
    return;
  }

  const footprint = validation.footprint;
  const targetHeight = yard[footprint[0].key] ? yard[footprint[0].key].length : 0;

  // Check bury warning for all cells in footprint
  for (const f of footprint) {
    if (!checkBuryWarning(f.key, targetHeight)) return;
  }

  const container = {
    ...currentPlacementContainer,
    location: `Sec ${section}, Row ${row}, Col ${col}`,
    section: section,
    row: row,
    col: col,
    origin: { row, col },
    level: targetHeight,
    orientation: currentPlacementOrientation,
    footprint: footprint.map(f => ({ row: f.row, col: f.col, key: f.key }))
  };

  allContainers.push(container);
  containerMap[container.id] = container;

  // Insert ID into all footprint cells
  footprint.forEach(f => {
    if (!yard[f.key]) yard[f.key] = [];
    yard[f.key].push(container.id);

    const cellDOM = document.querySelector(`[data-section="${f.section}"][data-row="${f.row}"][data-col="${f.col}"]`);
    if (cellDOM) {
      updateCell(cellDOM, yard[f.key]);
      cellDOM.classList.add('placed-pop');
      setTimeout(() => cellDOM.classList.remove('placed-pop'), 400);
    }
  });

  renderTable();
  render3DYard();
  cancelPlacement();
}

// Placement Logic

// Stack Inspection Logic

function closeInspectionPanel() {
  document.getElementById('inspection-panel').classList.remove('active');
  document.body.classList.remove('panel-open');
  clearHighlights();
}

function clearHighlights() {
  document.querySelectorAll('.highlight-stack').forEach(cell => {
    cell.classList.remove('highlight-stack');
  });
}

function clearSuggestionHighlight() {
  document.querySelectorAll('.suggested-cell').forEach(cell => {
    cell.classList.remove('suggested-cell');
  });
}

function calculateSuggestion() {
  const size = document.getElementById('field-size').value;
  const orientation = document.getElementById('field-orientation').value;
  const is40ft = size === '40ft' || size === '45ft';

  let bestRow = 0;
  let bestCol = 0;
  let minHeight = 999;
  let bestSection = 'A';

  const sections = ['A', 'B', 'C'];

  for (const section of sections) {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 10; col++) {
        const validation = validatePlacement(section, size, row, col, orientation);
        if (validation.valid) {
          const footprint = validation.footprint;
          const h = yard[footprint[0].key] ? yard[footprint[0].key].length : 0;

          if (h < minHeight) {
            minHeight = h;
            bestRow = row;
            bestCol = col;
            bestSection = section;
          }
        }
      }
    }
  }

  const suggestionText = document.getElementById('suggestion-text');
  if (minHeight < MAX_STACK_HEIGHT) {
    suggestionText.textContent = `Suggested: Sec ${bestSection}, Row ${bestRow}, Col ${bestCol} (Level ${minHeight})`;
    clearSuggestionHighlight();
    const validation = validatePlacement(bestSection, size, bestRow, bestCol, orientation);
    if (validation.footprint) {
      validation.footprint.forEach(f => {
        const cell = document.querySelector(`[data-section="${f.section}"][data-row="${f.row}"][data-col="${f.col}"]`);
        if (cell) cell.classList.add('suggested-cell');
      });
    }
  } else {
    suggestionText.textContent = `Yard is completely full!`;
  }
}

function restoreYardVisuals() {
  document.querySelectorAll('.grid-cell').forEach(cell => {
    const section = cell.getAttribute('data-section');
    const row = cell.getAttribute('data-row');
    const col = cell.getAttribute('data-col');
    const key = getPositionKey(section, row, col);
    updateCell(cell, yard[key] || []);
  });
  renderTable();
  render3DYard();
}

function calculateRetrieval(key, targetIndex) {
  const panelContent = document.getElementById('panel-content');
  const stack = yard[key];
  if (!stack) return;

  const existingPlan = document.getElementById('retrieval-plan-container');
  if (existingPlan) existingPlan.remove();

  const cards = panelContent.querySelectorAll('.container-card');
  cards.forEach(card => card.classList.remove('card-target', 'card-blocking'));

  if (cards[targetIndex]) cards[targetIndex].classList.add('card-target');

  const planBox = document.createElement('div');
  planBox.id = 'retrieval-plan-container';
  planBox.className = 'retrieval-plan-box';

  const title = document.createElement('h4');
  title.textContent = 'Retrieval Plan';
  planBox.appendChild(title);

  const toggleGroup = document.createElement('div');
  toggleGroup.className = 'mode-toggle-group';
  toggleGroup.innerHTML = `
    <input type="radio" id="mode-sim" name="sim-mode" value="sim" checked>
    <label for="mode-sim">Simulation Mode</label>
    <input type="radio" id="mode-exec" name="sim-mode" value="exec">
    <label for="mode-exec">Execute Removal</label>
  `;
  planBox.appendChild(toggleGroup);

  const steps = [];

  for (let i = stack.length - 1; i > targetIndex; i--) {
    const containerId = stack[i];
    const actualC = containerMap[containerId];
    if (cards[i]) cards[i].classList.add('card-blocking');

    steps.push({
      type: 'move',
      index: i,
      text: `Move ${actualC.id} (Level ${actualC.level}) → Temp Yard`
    });
  }

  const targetId = stack[targetIndex];
  const actualTarget = containerMap[targetId];
  steps.push({
    type: 'retrieve',
    index: targetIndex,
    text: `Retrieve ${actualTarget.id} (Level ${actualTarget.level})`
  });

  steps.forEach((step, idx) => {
    const stepEl = document.createElement('div');
    stepEl.className = 'retrieval-step';
    stepEl.id = `retrieval-step-${idx}`;
    stepEl.innerHTML = `<span>${idx + 1}.</span> <span>${step.text}</span>`;
    planBox.appendChild(stepEl);
  });

  const btn = document.createElement('button');
  btn.className = 'btn-simulate';
  btn.textContent = 'Simulate Removal';
  btn.onclick = () => simulateRetrieval(key, steps, btn);
  planBox.appendChild(btn);

  const relocationForm = document.createElement('div');
  relocationForm.className = 'relocation-form';
  relocationForm.innerHTML = `
    <h4 style="margin:0 0 8px 0; font-size:0.95rem; color:#f1f5f9;">Relocate Target</h4>
    <div class="relocation-inputs">
      <select id="move-section" style="padding:4px; border-radius:4px; border:1px solid #334155; background:#1e293b; color:#fff;">
        <option value="A">Sec A</option>
        <option value="B">Sec B</option>
        <option value="C">Sec C</option>
      </select>
      <input type="number" id="move-row" min="0" max="9" placeholder="Row" />
      <input type="number" id="move-col" min="0" max="9" placeholder="Col" />
    </div>
  `;
  const moveBtn = document.createElement('button');
  moveBtn.className = 'btn-move';
  moveBtn.textContent = 'Move Container';
  moveBtn.onclick = () => moveContainer(key, targetIndex, moveBtn);
  relocationForm.appendChild(moveBtn);

  planBox.appendChild(relocationForm);

  // Add Remove & Move-Out Buttons
  const actualC = stack[targetIndex];
  const realId = actualC.reference ? actualC.reference : actualC.id;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn-simulate';
  removeBtn.style.backgroundColor = '#ef4444';
  removeBtn.style.marginTop = '12px';
  removeBtn.textContent = 'Remove Container';
  removeBtn.onclick = () => removeContainer(realId, false);
  planBox.appendChild(removeBtn);

  const moveOutBtn = document.createElement('button');
  moveOutBtn.className = 'btn-simulate';
  moveOutBtn.style.backgroundColor = '#f59e0b';
  moveOutBtn.style.marginTop = '8px';
  moveOutBtn.textContent = 'Move Out Container';
  moveOutBtn.onclick = () => removeContainer(realId, true);
  planBox.appendChild(moveOutBtn);

  panelContent.insertBefore(planBox, panelContent.firstChild);
}

function removeContainer(actualId, isShipped) {
  if (isBlocked(actualId)) {
    alert("Container is blocked. Use Retrieval Plan to move blocking containers first.");
    return;
  }

  if (!confirm(`Are you sure you want to ${isShipped ? 'move out' : 'remove'} this container?`)) return;

  const container = containerMap[actualId];
  if (!container) return;

  // Roster logic
  if (isShipped) shippedContainers.push({ ...container });
  allContainers = allContainers.filter(c => c.id !== actualId);
  delete containerMap[actualId];

  // Yard logic: Remove from all footprint cells
  container.footprint.forEach(f => {
    const stack = yard[f.key];
    if (stack) {
      const idx = stack.indexOf(actualId);
      if (idx > -1) {
        stack.splice(idx, 1);

        // Update levels for containers above in this specific cell
        // In the new model, we should probably update the actual container level in allContainers
        // but since one container occupies multiple cells, we just need to ensure the stack is correct.
      }
    }
  });

  // Re-calculate levels for all remaining containers to ensure consistency
  // This is safer than trying to surgically update levels
  recalculateAllLevels();

  renderTable();
  render3DYard();
  closeInspectionPanel();
  restoreYardVisuals();
}

function recalculateAllLevels() {
  // Reset all levels
  allContainers.forEach(c => c.level = -1);

  // We need to determine the level of each container based on the stacks.
  // Since a container occupies multiple cells, its level is the index in the stack.
  // All cells in its footprint should have it at the same index.

  allContainers.forEach(c => {
    const firstCellKey = c.footprint[0].key;
    const stack = yard[firstCellKey];
    if (stack) {
      c.level = stack.indexOf(c.id);
    }
  });
}

function moveContainer(sourceKey, targetIndex, btnElement, forcedDest = null) {
  let destSection, destRow, destCol;

  if (forcedDest) {
    destSection = forcedDest.section;
    destRow = forcedDest.row;
    destCol = forcedDest.col;
  } else {
    destSection = document.getElementById('move-section').value;
    const rowInput = document.getElementById('move-row').value;
    const colInput = document.getElementById('move-col').value;

    if (rowInput === '' || colInput === '') {
      alert("Please enter destination Row and Column.");
      return;
    }

    destRow = parseInt(rowInput, 10);
    destCol = parseInt(colInput, 10);
  }

  const stack = yard[sourceKey];
  if (!stack || stack.length === 0) return;

  const actualId = stack[targetIndex];
  if (isBlocked(actualId)) {
    alert("Container is blocked. Use Retrieval Plan to move blocking containers first.");
    return;
  }

  const container = containerMap[actualId];
  if (!container) return;

  // Use current orientation for movement (could be expanded to allow rotation during move)
  const validation = validatePlacement(destSection, container.size, destRow, destCol, container.orientation);
  if (!validation.valid) {
    alert(validation.reason);
    return;
  }

  const footprint = validation.footprint;
  const newHeight = yard[footprint[0].key] ? yard[footprint[0].key].length : 0;

  for (const f of footprint) {
    if (!checkBuryWarning(f.key, newHeight)) return;
  }

  if (btnElement) {
    btnElement.disabled = true;
    btnElement.textContent = "Moving...";
  }

  // ---- Animation Setup ----
  const startFootprint = container.footprint;
  const startMinCol = Math.min(...startFootprint.map(f => f.col));
  const startMaxCol = Math.max(...startFootprint.map(f => f.col));
  const startMinRow = Math.min(...startFootprint.map(f => f.row));
  const startMaxRow = Math.max(...startFootprint.map(f => f.row));
  const startSection = container.section;

  const startX = ((startMinCol + startMaxCol) / 2) - 4.5 + sectionOffset[startSection];
  const startZ = ((startMinRow + startMaxRow) / 2) - 4.5;
  const startY = container.level + 0.5;

  const destMinCol = Math.min(...footprint.map(f => f.col));
  const destMaxCol = Math.max(...footprint.map(f => f.col));
  const destMinRow = Math.min(...footprint.map(f => f.row));
  const destMaxRow = Math.max(...footprint.map(f => f.row));

  const destX = ((destMinCol + destMaxCol) / 2) - 4.5 + sectionOffset[destSection];
  const destZ = ((destMinRow + destMaxRow) / 2) - 4.5;
  const destY = newHeight + 0.5;
  const liftHeight = Math.max(startY, destY) + 3;

  // Clone Mesh for animation
  const isVertical = container.orientation === 'vertical';
  const is40ft = container.size === '40ft' || container.size === '45ft';
  const width = isVertical ? 1 : (is40ft ? 4 : 2);
  const depth = isVertical ? (is40ft ? 4 : 2) : 1;

  const geometry = new THREE.BoxGeometry(width, 1, depth);
  const hexColor = colorMap[container.type] || 0x4ade80;
  const material = new THREE.MeshStandardMaterial({ color: hexColor });
  const cloneMesh = new THREE.Mesh(geometry, material);

  // Group
  const craneGroup = new THREE.Group();
  craneGroup.add(cloneMesh);
  craneGroup.position.set(startX, startY, startZ);
  if (scene) scene.add(craneGroup);

  // Remove from old footprint
  container.footprint.forEach(f => {
    const s = yard[f.key];
    if (s) {
      const idx = s.indexOf(actualId);
      if (idx > -1) s.splice(idx, 1);
    }
  });

  // Update container properties
  container.section = destSection;
  container.row = destRow;
  container.col = destCol;
  container.level = newHeight;
  container.location = `Sec ${destSection}, Row ${destRow}, Col ${destCol}`;
  container.footprint = footprint.map(f => ({ row: f.row, col: f.col, key: f.key }));

  // Add to new footprint
  footprint.forEach(f => {
    if (!yard[f.key]) yard[f.key] = [];
    yard[f.key].push(actualId);
  });

  recalculateAllLevels();
  restoreYardVisuals();

  if (scene && typeof containerMeshes !== 'undefined') {
    const realMesh = containerMeshes.find(m => m.userData.container && m.userData.container.id === actualId);
    if (realMesh) realMesh.visible = false;

    const startPos = new THREE.Vector3(startX, startY, startZ);
    const endPos = new THREE.Vector3(destX, destY, destZ);

    animateMovement(craneGroup, null, startPos, endPos, liftHeight, () => {
      if (scene) scene.remove(craneGroup);
      if (realMesh) realMesh.visible = true;
      closeInspectionPanel();
      if (btnElement) {
        btnElement.disabled = false;
        btnElement.textContent = "Move Container";
      }
    });
  } else {
    setTimeout(() => {
      closeInspectionPanel();
    }, 300);
  }
}

function simulateRetrieval(key, steps, btnElement) {
  const isSimMode = document.getElementById('mode-sim').checked;
  let backupYard, backupContainers;

  if (isSimMode) {
    backupYard = JSON.parse(JSON.stringify(yard));
    backupContainers = JSON.parse(JSON.stringify(allContainers));
  }

  btnElement.disabled = true;
  btnElement.textContent = isSimMode ? 'Simulation Running...' : 'Executing Removal...';

  let currentStepIdx = 0;

  function nextStep() {
    if (currentStepIdx >= steps.length) {
      btnElement.textContent = isSimMode ? 'Restoring State...' : 'Removal Complete';
      setTimeout(() => {
        closeInspectionPanel();
        if (isSimMode) {
          yard = backupYard;
          allContainers = backupContainers;
          restoreYardVisuals();
        }
      }, 1500);
      return;
    }

    const step = steps[currentStepIdx];
    const stepEl = document.getElementById(`retrieval-step-${currentStepIdx}`);
    if (stepEl) stepEl.classList.add('completed');

    const stack = yard[key];
    if (stack && stack.length > 0) {
      const actualId = stack.pop();

      // Find the container and remove from all its footprint cells
      const container = containerMap[actualId];
      if (container) {
        container.footprint.forEach(f => {
          if (f.key !== key) {
            const otherStack = yard[f.key];
            if (otherStack) {
              const idx = otherStack.indexOf(actualId);
              if (idx > -1) otherStack.splice(idx, 1);
            }
          }
        });
      }

      allContainers = allContainers.filter(c => c.id !== actualId);
      delete containerMap[actualId];

      recalculateAllLevels();
      restoreYardVisuals();
      renderTable();
      render3DYard();

      const content = document.getElementById('panel-content');
      const cards = content.querySelectorAll('.container-card');
      if (cards.length > 0) {
        const topCard = cards[cards.length - 1];
        topCard.remove();
      }
    }

    currentStepIdx++;
    setTimeout(nextStep, 1000);
  }

  setTimeout(nextStep, 800);
}

/**
 * Opens the inspection panel for the stack at the given cell.
 * @param {{ key: string, section: string, row: number, col: number }} param
 */
function openInspectionPanel({ key, section, row, col }) {
  const panel = document.getElementById('inspection-panel');
  const content = document.getElementById('panel-content');
  const title = document.getElementById('panel-title');

  document.body.classList.add('panel-open'); // Focus mode
  const stack = yard[key];
  if (!stack || stack.length === 0) return;

  title.textContent = `Stack: Sec ${section}, Row ${row}, Col ${col}`;

  content.innerHTML = '';

  const heightSummary = document.createElement('div');
  heightSummary.style.color = '#94a3b8';
  heightSummary.style.fontSize = '0.85rem';
  heightSummary.style.marginBottom = '8px';
  heightSummary.textContent = `Total Containers: ${stack.length} / ${MAX_STACK_HEIGHT}`;
  content.appendChild(heightSummary);

  stack.forEach((containerId, index) => {
    const actualC = containerMap[containerId];
    if (!actualC) return;

    const card = document.createElement('div');
    card.className = 'container-card';
    card.onclick = () => calculateRetrieval(key, index);
    card.innerHTML = `
      <div class="card-header">
        <span class="card-id">${actualC.id}</span>
        <span class="card-level">Lvl ${actualC.level}</span>
      </div>
      <div class="card-row"><span class="card-label">Type</span><span class="card-value">${actualC.type}</span></div>
      <div class="card-row"><span class="card-label">Size</span><span class="card-value">${actualC.size}</span></div>
      <div class="card-row"><span class="card-label">Weight</span><span class="card-value">${actualC.weight} kg</span></div>
    `;
    content.appendChild(card);
  });

  panel.classList.add('active');

  clearHighlights();

  // Highlight all cells in the footprint of the TOP container
  const topContainerId = stack[stack.length - 1];
  const topC = containerMap[topContainerId];
  if (topC) {
    topC.footprint.forEach(f => {
      const cell = document.querySelector(`[data-section="${topC.section}"][data-row="${f.row}"][data-col="${f.col}"]`);
      if (cell) cell.classList.add('highlight-stack');
    });

    // Update Sidebar Info
    const infoDisplay = document.getElementById('selection-info-display');
    if (infoDisplay) {
      infoDisplay.innerHTML = `
        <div class="selection-info">
          <div class="info-row"><span class="info-label">ID</span><span class="info-value">${topC.id}</span></div>
          <div class="info-row"><span class="info-label">Type</span><span class="info-value">${topC.type}</span></div>
          <div class="info-row"><span class="info-label">Size</span><span class="info-value">${topC.size}</span></div>
          <div class="info-row"><span class="info-label">Level</span><span class="info-value">${topC.level}</span></div>
          <div class="info-row"><span class="info-label">Weight</span><span class="info-value">${topC.weight} kg</span></div>
        </div>
      `;
    }
  }
}

// Visual Update

/**
 * Updates a cell's appearance to reflect its current stack state.
 */
function updateCell(cell, stack) {
  const height = stack ? stack.length : 0;

  cell.classList.remove('level-1', 'level-2', 'level-3', 'occupied');
  cell.innerHTML = '';
  cell.removeAttribute('title');

  if (height > 0) {
    cell.classList.add('occupied', `level-${height}`);

    const topContainerId = stack[height - 1];
    const actualTop = containerMap[topContainerId];

    if (actualTop) {
      // Show ID label ONLY on the explicit origin cell to avoid duplicate labels
      const cellRow = parseInt(cell.getAttribute('data-row'), 10);
      const cellCol = parseInt(cell.getAttribute('data-col'), 10);
      const origin = actualTop.origin || { row: actualTop.row, col: actualTop.col };

      if (origin.row === cellRow && origin.col === cellCol) {
        const idLabel = document.createElement('div');
        idLabel.className = 'container-id-label';
        idLabel.textContent = actualTop.id;
        cell.appendChild(idLabel);
      }

      // Stack-bar indicator (shown in every cell of the footprint)
      const indicator = document.createElement('div');
      indicator.className = 'stack-indicator';
      for (let i = 0; i < height; i++) {
        const bar = document.createElement('div');
        bar.className = 'stack-bar';
        indicator.appendChild(bar);
      }
      cell.appendChild(indicator);

      cell.setAttribute(
        'title',
        `Top: ${actualTop.id}\nHeight: ${height}\nType: ${actualTop.type}`
      );
    }
  }
}

// Development & Testing Tools

/**
 * Clears the entire yard state and refreshes visuals.
 */
function clearYard() {
  yard = {};
  allContainers = [];
  containerMap = {};
  containerCounter = 0;

  renderTable();
  render3DYard();
  updateAnalytics();

  document.querySelectorAll('.grid-cell').forEach(cell => {
    updateCell(cell, []);
  });

  console.log("Yard cleared.");
}

/**
 * Automatically places 25 containers using random valid positions.
 */
function runStressTest() {
  clearYard();

  const types = ['Dry', 'Reefer', 'Hazardous', 'Tank', 'Open Top', 'Flat Rack'];
  const sizes = ['20ft', '40ft'];
  const sections = ['A', 'B', 'C'];

  let placedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < 25; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const size = sizes[Math.floor(Math.random() * sizes.length)];
    const orientation = Math.random() > 0.5 ? 'horizontal' : 'vertical';

    let placed = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const section = sections[Math.floor(Math.random() * sections.length)];
      const row = Math.floor(Math.random() * 10);
      const col = Math.floor(Math.random() * 10);

      const validation = validatePlacement(section, size, row, col, orientation);
      if (validation.valid) {
        const id = generateContainerID();
        const footprint = validation.footprint;
        const targetHeight = yard[footprint[0].key] ? yard[footprint[0].key].length : 0;

        const container = {
          id: id,
          name: `AUTO-${id}`,
          type: type,
          size: size,
          weight: Math.floor(Math.random() * 20000) + 5000,
          destination: 'Stress Test Hub',
          arrivalDate: new Date().toISOString().split('T')[0],
          departureDate: '',
          priority: 'low',
          location: `Sec ${section}, Row ${row}, Col ${col}`,
          section: section,
          row: row,
          col: col,
          level: targetHeight,
          orientation: orientation,
          footprint: footprint.map(f => ({ row: f.row, col: f.col, key: f.key }))
        };

        allContainers.push(container);
        containerMap[container.id] = container;

        footprint.forEach(f => {
          if (!yard[f.key]) yard[f.key] = [];
          yard[f.key].push(id);
        });

        placed = true;
        placedCount++;
        break;
      }
    }
    if (!placed) failedCount++;
  }

  // Refresh UI
  renderTable();
  render3DYard();
  updateAnalytics();

  // Update all grid cells visually
  sections.forEach(sec => {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const key = getPositionKey(sec, r, c);
        const cell = document.querySelector(`[data-section="${sec}"][data-row="${r}"][data-col="${c}"]`);
        if (cell) updateCell(cell, yard[key] || []);
      }
    }
  });

  console.log(`Stress Test Complete: Placed ${placedCount}, Failed ${failedCount}`);
  alert(`Stress Test Complete!\nPlaced: ${placedCount}\nFailed: ${failedCount}`);
}

// Initialise

document.addEventListener('DOMContentLoaded', function () {
  generateGrid('grid-a', 'A', 10, 10);
  generateGrid('grid-b', 'B', 10, 10);
  generateGrid('grid-c', 'C', 10, 10);

  // Initialize 3D Scene
  init3D();

  // Close modal when backdrop is clicked
  document.getElementById('modal-overlay').addEventListener('click', handleOverlayClick);

  // Form submit → start placement mode
  document.getElementById('container-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const size = document.getElementById('field-size').value;
    const departureStr = document.getElementById('field-departure').value;

    currentPlacementContainer = {
      id: generateContainerID(),
      name: document.getElementById('field-name').value.trim(),
      type: document.getElementById('field-type').value,
      size: size,
      weight: document.getElementById('field-weight').value.trim(),
      destination: document.getElementById('field-destination').value.trim(),
      arrivalDate: document.getElementById('field-arrival').value,
      departureDate: departureStr,
      priority: calculatePriority(departureStr),
    };

    currentPlacementOrientation = document.getElementById('field-orientation').value;

    if (currentCreationMode === 'manual') {
      const section = document.getElementById('field-section').value;
      const row = parseInt(document.getElementById('field-row').value, 10);
      const col = parseInt(document.getElementById('field-col').value, 10);
      
      finalizePlacementAt(section, row, col);
      closeModal();
    } else {
      closeModal();
      updatePlacementBanner();
      updateContainerStatus(`Placement Mode Active: Click on the grid to place container.`);
    }
  });

  // Global Keyboard listener
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r') {
      currentPlacementOrientation = currentPlacementOrientation === 'horizontal' ? 'vertical' : 'horizontal';
      updatePlacementBanner();
      // Trigger preview update if mouse is over a cell
      const hovered = document.querySelector('.grid-cell:hover');
      if (hovered) {
        updatePlacementPreview(hovered);
        hovered.style.transform = 'scale(1.1)';
        setTimeout(() => hovered.style.transform = '', 100);
      }
    }
    if (e.key === 'Escape') {
      cancelPlacement();
    }
  });


  // Attach tab switching logic
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.getAttribute('data-target'));
    });
  });

  // Size changes trigger new suggestion and update label
  document.getElementById('field-size').addEventListener('change', (e) => {
    calculateSuggestion();
    const colLabel = document.getElementById('label-col');
    if (e.target.value === '40ft' || e.target.value === '45ft') {
      colLabel.textContent = "Columns (e.g. 2 & 3)";
    } else {
      colLabel.textContent = "Column (0-9)";
    }
  });
});
