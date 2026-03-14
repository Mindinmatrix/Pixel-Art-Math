import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const DEFAULT_BOARD_COLOR = 0x334155;
const DEFAULT_GRID_COLOR = 0xe2e8f0;

function makeColor(value, fallback) {
  try {
    return new THREE.Color(value ?? fallback);
  } catch (error) {
    return new THREE.Color(fallback);
  }
}

class PixelBoard3D {
  constructor(container, options = {}) {
    this.container = container;
    this.gridSize = options.gridSize || 16;
    this.blankCount = this.gridSize * this.gridSize;
    this.tileSpacing = 0.8;
    this.tileSize = 0.62;
    this.tileDepth = 0.16;
    this.pixelHeight = 0.22;
    this.boardWidth = (this.gridSize * this.tileSpacing) + 1.8;
    this.activeEntries = [];
    this.animationFrame = null;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = "board-canvas";
    this.container.innerHTML = "";
    this.container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 12;
    this.controls.maxDistance = 28;
    this.controls.minPolarAngle = Math.PI / 7;
    this.controls.maxPolarAngle = Math.PI / 2.7;
    this.controls.rotateSpeed = 0.9;
    this.controls.zoomSpeed = 0.85;
    this.controls.target.set(0, 0.5, 0);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.board = this.createBoardBase();
    this.root.add(this.board);

    this.blankMesh = this.createBlankTiles();
    this.root.add(this.blankMesh);

    this.guideMesh = null;
    this.pixelMesh = null;

    this.addLights();
    this.attachEvents();
    this.resize();
    this.resetView();
    this.renderLoop();
  }

  createBoardBase() {
    const geometry = new THREE.BoxGeometry(this.boardWidth, 0.75, this.boardWidth);
    const material = new THREE.MeshStandardMaterial({
      color: DEFAULT_BOARD_COLOR,
      roughness: 0.42,
      metalness: 0.14
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = -0.55;
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }

  createBlankTiles() {
    const geometry = new THREE.BoxGeometry(this.tileSize, this.tileDepth, this.tileSize);
    const material = new THREE.MeshStandardMaterial({
      color: DEFAULT_GRID_COLOR,
      roughness: 0.2,
      metalness: 0.05
    });
    const mesh = new THREE.InstancedMesh(geometry, material, this.blankCount);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    let pointer = 0;
    for (let row = 0; row < this.gridSize; row += 1) {
      for (let col = 0; col < this.gridSize; col += 1) {
        const { x, z } = this.getBoardPosition(row, col);
        dummy.position.set(x, 0, z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        mesh.setMatrixAt(pointer, dummy.matrix);
        pointer += 1;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  createGuideMesh(count) {
    const geometry = new THREE.BoxGeometry(this.tileSize * 0.78, 0.06, this.tileSize * 0.78);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(count, 1));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    return mesh;
  }

  addLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.4);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(6, 10, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 30;
    key.shadow.normalBias = 0.02;
    this.scene.add(key);

    const rim = new THREE.DirectionalLight(0xcbd5e1, 0.8);
    rim.position.set(-7, 5, -5);
    this.scene.add(rim);
  }

  attachEvents() {
    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    } else {
      window.addEventListener("resize", this.handleWindowResize);
    }

    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
    this.renderer.domElement.addEventListener("dblclick", this.handleDoubleClick);
  }

  handleWindowResize = () => {
    this.resize();
  };

  handlePointerDown = () => {
    this.renderer.domElement.classList.add("dragging");
  };

  handlePointerUp = () => {
    this.renderer.domElement.classList.remove("dragging");
  };

  handleDoubleClick = (event) => {
    event.preventDefault();
    this.resetView();
  };

  resize() {
    const bounds = this.container.getBoundingClientRect();
    const width = Math.max(320, Math.floor(bounds.width || 0));
    const height = Math.max(320, Math.floor(bounds.height || width));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  renderLoop = () => {
    this.animationFrame = window.requestAnimationFrame(this.renderLoop);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  resetView() {
    const target = new THREE.Vector3(0, 0.35, 0);
    const halfBoard = this.boardWidth * 0.5;
    const fitHeight = (halfBoard * 1.35) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const direction = new THREE.Vector3(0.82, 1.18, 0.94).normalize();
    const distance = fitHeight * 0.9;

    this.camera.position.copy(target).add(direction.multiplyScalar(distance));
    this.controls.minDistance = distance * 0.72;
    this.controls.maxDistance = distance * 1.7;
    this.controls.target.copy(target);
    this.controls.update();
    this.controls.saveState();
  }

  getBoardPosition(row, col) {
    const half = (this.gridSize - 1) / 2;
    return {
      x: (col - half) * this.tileSpacing,
      z: (row - half) * this.tileSpacing
    };
  }

  createPixelMesh(count) {
    const geometry = new THREE.BoxGeometry(this.tileSize * 0.92, this.pixelHeight, this.tileSize * 0.92);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true
    });
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(count, 1));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    return mesh;
  }

  setSprite(renderedShape, colors) {
    const pattern = renderedShape?.pattern || [];
    const toneMap = renderedShape?.toneMap || {};

    if (this.guideMesh) {
      this.root.remove(this.guideMesh);
      this.guideMesh.geometry.dispose();
      this.guideMesh.material.dispose();
      this.guideMesh = null;
    }

    if (this.pixelMesh) {
      this.root.remove(this.pixelMesh);
      this.pixelMesh.geometry.dispose();
      this.pixelMesh.material.dispose();
      this.pixelMesh = null;
    }

    this.activeEntries = [];
    for (let row = 0; row < this.gridSize; row += 1) {
      const rowText = pattern[row] || ".".repeat(this.gridSize);
      for (let col = 0; col < this.gridSize; col += 1) {
        const symbol = rowText[col];
        if (!symbol || symbol === ".") {
          continue;
        }

        const tone = toneMap[symbol] || "fill";
        const color = this.getToneColor(tone, colors);
        this.activeEntries.push({
          cellIndex: (row * this.gridSize) + col,
          row,
          col,
          tone,
          color
        });
      }
    }

    this.guideMesh = this.createGuideMesh(this.activeEntries.length);
    this.root.add(this.guideMesh);

    const guideDummy = new THREE.Object3D();
    this.activeEntries.forEach((entry, index) => {
      const { x, z } = this.getBoardPosition(entry.row, entry.col);
      guideDummy.position.set(x, this.tileDepth + 0.04, z);
      guideDummy.rotation.set(0, 0, 0);
      guideDummy.scale.setScalar(1);
      guideDummy.updateMatrix();
      this.guideMesh.setMatrixAt(index, guideDummy.matrix);
      this.guideMesh.setColorAt(index, this.getGuideColor(entry.tone, colors));
    });

    this.guideMesh.instanceMatrix.needsUpdate = true;
    if (this.guideMesh.instanceColor) {
      this.guideMesh.instanceColor.needsUpdate = true;
    }
    this.guideMesh.material.needsUpdate = true;

    this.pixelMesh = this.createPixelMesh(this.activeEntries.length);
    this.root.add(this.pixelMesh);

    const hiddenDummy = new THREE.Object3D();
    hiddenDummy.position.set(0, -20, 0);
    hiddenDummy.scale.setScalar(0.001);
    hiddenDummy.updateMatrix();

    this.activeEntries.forEach((entry, index) => {
      this.pixelMesh.setMatrixAt(index, hiddenDummy.matrix);
      this.pixelMesh.setColorAt(index, entry.color);
    });

    this.pixelMesh.instanceMatrix.needsUpdate = true;
    if (this.pixelMesh.instanceColor) {
      this.pixelMesh.instanceColor.needsUpdate = true;
    }
    this.pixelMesh.material.needsUpdate = true;
  }

  getToneColor(tone, colors) {
    if (tone === "outline") {
      return makeColor(colors.outline, "#111111");
    }
    if (tone === "highlight") {
      return makeColor(colors.highlight, "#ffffff");
    }
    if (tone === "shadow") {
      return makeColor(colors.shadow, colors.pixel);
    }
    return makeColor(colors.pixel, "#ef4444");
  }

  getGuideColor(tone, colors) {
    const baseColor = makeColor(colors.pixel, "#ef4444");

    if (tone === "highlight") {
      return baseColor.clone().lerp(new THREE.Color(0xffffff), 0.28);
    }

    if (tone === "shadow") {
      return baseColor.clone().lerp(new THREE.Color(0x000000), 0.18);
    }

    if (tone === "outline") {
      return baseColor.clone().lerp(new THREE.Color(0x000000), 0.26);
    }

    return baseColor;
  }

  setRevealedCellIndexes(revealedIndexes) {
    if (!this.pixelMesh) {
      return;
    }

    const revealSet = revealedIndexes instanceof Set ? revealedIndexes : new Set(revealedIndexes || []);
    const visibleDummy = new THREE.Object3D();
    const hiddenDummy = new THREE.Object3D();
    hiddenDummy.position.set(0, -20, 0);
    hiddenDummy.scale.setScalar(0.001);
    hiddenDummy.updateMatrix();

    this.activeEntries.forEach((entry, index) => {
      if (!revealSet.has(entry.cellIndex)) {
        this.pixelMesh.setMatrixAt(index, hiddenDummy.matrix);
        return;
      }

      const { x, z } = this.getBoardPosition(entry.row, entry.col);
      visibleDummy.position.set(x, (this.pixelHeight * 0.5) + (this.tileDepth * 0.4), z);
      visibleDummy.rotation.set(0, 0, 0);
      visibleDummy.scale.setScalar(1);
      visibleDummy.updateMatrix();
      this.pixelMesh.setMatrixAt(index, visibleDummy.matrix);
    });

    this.pixelMesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    if (this.animationFrame) {
      window.cancelAnimationFrame(this.animationFrame);
    }
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.handleWindowResize);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.renderer.domElement.removeEventListener("dblclick", this.handleDoubleClick);
    if (this.guideMesh) {
      this.guideMesh.geometry.dispose();
      this.guideMesh.material.dispose();
    }
    if (this.pixelMesh) {
      this.pixelMesh.geometry.dispose();
      this.pixelMesh.material.dispose();
    }
    this.controls.dispose();
    this.renderer.dispose();
    this.container.innerHTML = "";
  }
}

window.PixelBoard3D = PixelBoard3D;
