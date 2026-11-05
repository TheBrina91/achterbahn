/* CoasterCraft 2D - Main Game Controller & User Interaction */

class CoasterGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.renderer = new CoasterRenderer(this.canvas);

    // Multi-coaster park state
    this.coasters = [];
    this.activeCoasterIndex = 0;
    this.nextCoasterId = 1;

    // Park Entrance (on the right side) & Park Visitors
    this.parkEntranceX = 2780;
    this.visitors = [];
    this.visitorSpawnTimer = 0;

    // Create initial coaster slot
    this.createCoasterInstance('Alpen-Blitz (Hyper-Coaster)');

    // Editor state
    this.editorState = {
      mode: 'build', // 'build' | 'test'
      tool: 'select', // 'select' | 'add' | 'delete' | 'lift' | 'boost' | 'brake' | 'normal' | 'freehand'
      selectedNode: null,
      hoverNode: null,
      hoverHandle: null,
      hoverSegment: null,
      isDraggingNode: false,
      draggingHandle: null, // { node, which: 'in' | 'out' }
      isPanningCamera: false,
      dragStart: { x: 0, y: 0 },
      panStart: { x: 0, y: 0 },
      cameraStart: { x: 0, y: 0 },
      showGrid: true,
      gridSnap: 0, // 0 = off, 25 = 25px
      smoothStrength: 0.45,
      freehandPoints: [],
      isDrawingFreehand: false,
      freehandCreatesNew: false,
      freehandRideType: null,
      placingCoaster: null,
      mouseWorld: { x: 0, y: 0 }
    };

    // Undo / Redo history
    this.history = [];
    this.historyIndex = -1;

    // Animation frame timing
    this.lastTime = performance.now();

    this.init();
  }

  get activeCoaster() {
    return this.coasters[this.activeCoasterIndex] || this.coasters[0];
  }

  get spline() {
    return this.activeCoaster ? this.activeCoaster.spline : null;
  }

  get physics() {
    return this.activeCoaster ? this.activeCoaster.physics : null;
  }

  createCoasterInstance(name = 'Achterbahn', rideType = 'steel') {
    const spline = new CoasterSpline(rideType);
    const physics = new CoasterPhysics(spline);
    const coasterObj = {
      id: 'coaster_' + (this.nextCoasterId++),
      name,
      spline,
      physics
    };
    physics.onPassengerDisembark = (visitor, exitX, exitY) => {
      this.handleVisitorDisembark(visitor, coasterObj, exitX, exitY);
    };
    this.coasters.push(coasterObj);
    this.activeCoasterIndex = this.coasters.length - 1;
    this.updateCoasterSelectorUI();
    return coasterObj;
  }

  updateCoasterSelectorUI() {
    const sel = document.getElementById('activeCoasterSelect');
    if (!sel) return;
    sel.innerHTML = '';
    this.coasters.forEach((c, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      const icon = c.spline.rideType === 'water' ? '💦' : '🎢';
      opt.textContent = `${icon} Bahn #${idx + 1}: ${c.name}`;
      if (idx === this.activeCoasterIndex) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  updateRideTypeUI() {
    if (!this.spline) return;
    const isWater = this.spline.rideType === 'water';

    const rideSelect = document.getElementById('rideTypeSelect');
    if (rideSelect) {
      rideSelect.value = isWater ? 'water' : 'steel';
    }

    // Water coaster only allows normal (water trough), lift (chain lift), and brake (splashing water brake)
    const restrictedTools = ['boost', 'maglev', 'gap'];
    restrictedTools.forEach(t => {
      const btn = document.querySelector(`.btn-tool[data-tool="${t}"]`);
      if (btn) btn.style.display = isWater ? 'none' : '';
    });

    // If user had a restricted tool selected while switching to water, fall back to 'select'
    if (isWater && restrictedTools.includes(this.editorState.tool)) {
      this.selectTool('select');
    }

    // Update labels & icons on 'normal' and 'brake' tool buttons
    const normalBtn = document.querySelector('.btn-tool[data-tool="normal"]');
    if (normalBtn) {
      const icon = normalBtn.querySelector('.tool-icon');
      const label = normalBtn.querySelector('.tool-label');
      if (icon) icon.textContent = isWater ? '🌊' : '🎢';
      if (label) label.textContent = isWater ? 'Rinne' : 'Normal';
      normalBtn.title = isWater ? 'Wasserrinne (Freie Fahrt im Wasserkanal)' : 'Normale Stahlschiene (Freie Fahrt)';
    }

    const brakeBtn = document.querySelector('.btn-tool[data-tool="brake"]');
    if (brakeBtn) {
      const icon = brakeBtn.querySelector('.tool-icon');
      const label = brakeBtn.querySelector('.tool-label');
      if (icon) icon.textContent = isWater ? '💦' : '🛑';
      if (label) label.textContent = isWater ? 'Wasserbremse' : 'Bremsen';
      brakeBtn.title = isWater ? 'Spritzende Wasserbremse: Bremst das Boot mit großen Wasserfontänen ab!' : 'Bremsen: Bremst den Zug sanft ab';
    }

    // Hide Loop & Jump preset elements for water rides
    const btnLoop = document.getElementById('btnInsertLoop');
    const btnJump = document.getElementById('btnInsertJump');
    if (btnLoop) btnLoop.style.display = isWater ? 'none' : '';
    if (btnJump) btnJump.style.display = isWater ? 'none' : '';

    // Update nodeTypeSelect options in the inspector
    const nodeTypeSelect = document.getElementById('nodeTypeSelect');
    if (nodeTypeSelect) {
      Array.from(nodeTypeSelect.options).forEach(opt => {
        if (restrictedTools.includes(opt.value)) {
          opt.hidden = isWater;
          opt.disabled = isWater;
        } else if (opt.value === 'normal') {
          opt.textContent = isWater ? '🌊 Wasserrinne (Kanal)' : '🎢 Normale Schiene';
        } else if (opt.value === 'brake') {
          opt.textContent = isWater ? '💦 Spritz-Wasserbremse' : '🛑 Bremsabschnitt';
        }
      });
    }
  }

  init() {
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    this.setupEventListeners();
    this.setupUI();

    // Load initial preset (Alpen-Blitz)
    this.loadPreset('alpenblitz');
    this.initParkVisitors();
    this.saveHistoryState();

    // Start render & physics loop
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  initParkVisitors() {
    this.visitors = [];
    this.updateParkEntrancePosition();
    // Spawn initial group of visitors entering from the right gate and strolling toward the coasters
    for (let i = 0; i < 16; i++) {
      const frac = i / 16;
      const startX = this.parkEntranceX - frac * (this.parkEntranceX - 280);
      this.spawnVisitor(startX);
    }
  }

  updateParkEntrancePosition() {
    let maxRight = 2500;
    for (const c of this.coasters) {
      for (const n of c.spline.nodes) {
        if (n.x > maxRight) maxRight = n.x;
      }
    }
    this.parkEntranceX = Math.max(2750, Math.round(maxRight + 240));
  }

  spawnVisitor(customX = null) {
    const shirtColors = ['#ef4444', '#3b82f6', '#10b981', '#a855f7', '#f97316', '#ec4899', '#eab308', '#06b6d4'];
    const hairColors = ['#3e2723', '#212121', '#ffb300', '#8d6e63', '#c2185b', '#d7ccc8'];
    const validCoasters = this.coasters.filter(c => c.spline.nodes.length >= 2);
    const chosenCoaster = validCoasters.length > 0
      ? validCoasters[Math.floor(Math.random() * validCoasters.length)]
      : null;

    const v = {
      x: customX !== null ? customX : (this.parkEntranceX - 10 - Math.random() * 35),
      y: 750,
      speed: 55 + Math.random() * 32,
      walkPhase: Math.random() * Math.PI * 2,
      shirtColor: shirtColors[Math.floor(Math.random() * shirtColors.length)],
      hairColor: hairColors[Math.floor(Math.random() * hairColors.length)],
      state: 'walking', // 'walking' | 'climbing_stairs' | 'queuing' | 'riding' | 'descending_stairs'
      targetCoaster: chosenCoaster,
      stairProgress: 0,
      excitedTimer: 0,
      moodIcon: '🎢',
      moodTimer: 2.5
    };
    this.visitors.push(v);
    return v;
  }

  handleVisitorDisembark(visitor, coasterObj, exitX, exitY) {
    if (!visitor) return;
    visitor.state = 'descending_stairs';
    visitor.targetCoaster = coasterObj;
    visitor.stairProgress = 0;
    visitor.x = exitX;
    visitor.y = exitY;
    visitor.excitedTimer = 5.0;
    visitor.moodIcon = Math.random() > 0.4 ? '🤩' : '🎉';
    visitor.moodTimer = 4.5;
  }

  updateVisitors(dt) {
    this.updateParkEntrancePosition();

    const validCoasters = this.coasters.filter(c => c.spline.nodes.length >= 2);
    const maxVisitors = Math.min(55, 18 + validCoasters.length * 10);

    this.visitorSpawnTimer -= dt;
    if (this.visitorSpawnTimer <= 0 && this.visitors.length < maxVisitors) {
      this.spawnVisitor();
      this.visitorSpawnTimer = 1.6 + Math.random() * 1.4;
    }

    for (const v of this.visitors) {
      if (v.excitedTimer > 0) v.excitedTimer -= dt;
      if (v.moodTimer > 0) v.moodTimer -= dt;

      if (v.state === 'riding') continue;

      // Ensure visitor has a valid target coaster
      if (!v.targetCoaster || !validCoasters.includes(v.targetCoaster)) {
        v.targetCoaster = validCoasters.length > 0
          ? validCoasters[Math.floor(Math.random() * validCoasters.length)]
          : null;
        if (v.state === 'climbing_stairs' || v.state === 'queuing') {
          v.state = 'walking';
          v.y = 750;
        }
      }

      if (v.state === 'walking') {
        v.y = 750;
        v.walkPhase += dt * (v.speed * 0.14);

        if (v.targetCoaster) {
          const st = v.targetCoaster.spline.getStationInfo(750);
          if (st) {
            const targetX = st.stairBottomX;
            const dx = targetX - v.x;
            if (Math.abs(dx) <= 10) {
              // Reached foot of station stairs! Check if station queue isn't overly full
              if (v.targetCoaster.physics.stationQueue.length < 10) {
                v.x = targetX;
                v.state = 'climbing_stairs';
                v.stairProgress = 0;
                v.moodIcon = '🎟️';
                v.moodTimer = 2.0;
              } else {
                // Pick another coaster or stroll around
                const others = validCoasters.filter(c => c !== v.targetCoaster);
                if (others.length > 0) {
                  v.targetCoaster = others[Math.floor(Math.random() * others.length)];
                } else {
                  v.x -= v.speed * dt;
                }
              }
            } else {
              v.x += Math.sign(dx) * v.speed * dt;
            }
          }
        } else {
          // Stroll between entrance and left park
          v.x -= v.speed * 0.6 * dt;
          if (v.x < 100) v.x = this.parkEntranceX - 20;
        }
      } else if (v.state === 'climbing_stairs') {
        const st = v.targetCoaster ? v.targetCoaster.spline.getStationInfo(750) : null;
        if (!st) {
          v.state = 'walking';
          v.y = 750;
          continue;
        }
        const stairLen = Math.max(20, Math.hypot(st.stairTopX - st.stairBottomX, st.stairTopY - st.stairBottomY));
        v.stairProgress += (v.speed * 0.78 * dt) / stairLen;
        v.walkPhase += dt * 8;

        if (v.stairProgress >= 1) {
          v.stairProgress = 1;
          v.x = st.stairTopX;
          v.y = st.platY;
          v.state = 'queuing';
          if (!v.targetCoaster.physics.stationQueue.includes(v)) {
            v.targetCoaster.physics.stationQueue.push(v);
          }
          // Make sure coaster is active so it boards and launches
          if (!v.targetCoaster.physics.isRunning && v.targetCoaster.spline.nodes.length >= 2) {
            v.targetCoaster.physics.isRunning = true;
            v.targetCoaster.physics.stationState = 'boarding';
            v.targetCoaster.physics.stationTimer = 2.0;
          }
        } else {
          v.x = st.stairBottomX + (st.stairTopX - st.stairBottomX) * v.stairProgress;
          v.y = st.stairBottomY + (st.stairTopY - st.stairBottomY) * v.stairProgress;
        }
      } else if (v.state === 'queuing') {
        const st = v.targetCoaster ? v.targetCoaster.spline.getStationInfo(750) : null;
        if (!st) {
          v.state = 'walking';
          v.y = 750;
          continue;
        }
        const qIdx = Math.max(0, v.targetCoaster.physics.stationQueue.indexOf(v));
        const slotX = Math.max(st.minX + 14, st.stairTopX - 14 - qIdx * 11);
        v.x += (slotX - v.x) * Math.min(1, dt * 8);
        v.y = st.platY;
      } else if (v.state === 'descending_stairs') {
        const st = v.targetCoaster ? v.targetCoaster.spline.getStationInfo(750) : null;
        if (!st) {
          v.state = 'walking';
          v.y = 750;
          continue;
        }
        const stairLen = Math.max(20, Math.hypot(st.stairBottomX - st.stairTopX, st.stairBottomY - st.stairTopY));
        v.stairProgress += (v.speed * 0.85 * dt) / stairLen;
        v.walkPhase += dt * 8.5;

        if (v.stairProgress >= 1) {
          v.stairProgress = 1;
          v.x = st.stairBottomX;
          v.y = 750;
          v.state = 'walking';
          // Choose next coaster to visit (prefer a different coaster if multiple exist!)
          if (validCoasters.length > 1) {
            const others = validCoasters.filter(c => c !== v.targetCoaster);
            v.targetCoaster = others[Math.floor(Math.random() * others.length)];
          } else {
            v.targetCoaster = validCoasters[0] || null;
          }
        } else {
          v.x = st.stairTopX + (st.stairBottomX - st.stairTopX) * v.stairProgress;
          v.y = st.stairTopY + (st.stairBottomY - st.stairTopY) * v.stairProgress;
        }
      }
    }
  }

  resizeCanvas() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  saveHistoryState() {
    // Truncate future states if we branched
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    const stateSnapshot = {
      nodes: JSON.parse(JSON.stringify(this.spline.nodes)),
      isClosed: this.spline.isClosed,
      rideType: this.spline.rideType || 'steel'
    };

    this.history.push(stateSnapshot);
    this.historyIndex++;

    // Limit history stack
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreHistoryState(this.history[this.historyIndex]);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreHistoryState(this.history[this.historyIndex]);
    }
  }

  restoreHistoryState(state) {
    this.spline.rideType = state.rideType || 'steel';
    this.spline.nodes = JSON.parse(JSON.stringify(state.nodes));
    this.spline.isClosed = state.isClosed;
    this.spline.rebuild();
    this.physics.reset();
    this.editorState.selectedNode = null;
    this.updateCircuitButton();
    this.updateRideTypeUI();
    this.updateCoasterSelectorUI();
  }

  loadPreset(key) {
    const preset = PRESET_COASTERS[key];
    if (!preset) return;

    this.activeCoaster.name = preset.name;
    this.spline.clear();
    this.spline.rideType = preset.rideType === 'water' ? 'water' : 'steel';
    this.spline.isClosed = preset.isClosed;

    for (const n of preset.nodes) {
      this.spline.addNode(n.x, n.y, n.type, n.handleIn, n.handleOut, n.customHandles);
    }

    this.physics.reset();
    this.physics.isRunning = true;
    this.editorState.selectedNode = null;
    this.updateCircuitButton();
    this.updateRideTypeUI();
    this.updateCoasterSelectorUI();

    // Center camera on track start
    if (this.spline.nodes.length > 0) {
      this.renderer.camera.x = this.spline.nodes[0].x + 200;
      this.renderer.camera.y = this.spline.nodes[0].y - 100;
      this.renderer.camera.zoom = 0.85;
    }
  }

  screenToWorld(sx, sy) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cam = this.renderer.camera;

    // Inverse of: translate(w/2, h/2) -> scale(zoom) -> translate(-cam.x, -cam.y)
    const wx = (sx - w / 2) / cam.zoom + cam.x;
    const wy = (sy - h / 2) / cam.zoom + cam.y;
    return { x: wx, y: wy };
  }

  applyGridSnap(pos) {
    if (!this.editorState.gridSnap || this.editorState.gridSnap <= 0) return pos;
    const s = this.editorState.gridSnap;
    return {
      x: Math.round(pos.x / s) * s,
      y: Math.round(pos.y / s) * s
    };
  }

  setupEventListeners() {
    const canvas = this.canvas;

    // Mouse Down
    canvas.addEventListener('mousedown', (e) => {
      if (window.coasterAudio) window.coasterAudio.ensureContext();

      const worldPos = this.screenToWorld(e.clientX, e.clientY);
      this.editorState.mouseWorld = worldPos;

      // Cancel coaster placement on right-click
      if (e.button === 2 && this.editorState.placingCoaster) {
        e.preventDefault();
        this.cancelPlacement();
        return;
      }

      // Right click or Middle click: Pan camera
      if (e.button === 1 || e.button === 2 || e.shiftKey) {
        e.preventDefault();
        this.editorState.isPanningCamera = true;
        this.editorState.panStart = { x: e.clientX, y: e.clientY };
        this.editorState.cameraStart = { x: this.renderer.camera.x, y: this.renderer.camera.y };
        return;
      }

      if (e.button !== 0) return; // Only left click from here

      if (this.editorState.mode === 'build') {
        if (this.editorState.placingCoaster) {
          this.placeCoasterAt(worldPos.x, worldPos.y);
          return;
        }
        if (this.editorState.tool === 'freehand') {
          this.editorState.isDrawingFreehand = true;
          const pts = this.editorState.freehandPoints;
          if (pts.length > 0) {
            const last = pts[pts.length - 1];
            if (Math.hypot(worldPos.x - last.x, worldPos.y - last.y) > 75) {
              this.editorState.freehandPoints = [];
            }
          }
          this.editorState.freehandPoints.push({ x: worldPos.x, y: Math.min(735, worldPos.y) });
          this.updateFreehandUI();
          return;
        }
        this.handleBuildMouseDown(worldPos);
      }
    });

    // Mouse Move
    canvas.addEventListener('mousemove', (e) => {
      const worldPos = this.screenToWorld(e.clientX, e.clientY);
      this.editorState.mouseWorld = worldPos;

      // Drawing freehand coaster line
      if (this.editorState.isDrawingFreehand) {
        const pts = this.editorState.freehandPoints;
        const last = pts[pts.length - 1];
        if (!last || Math.hypot(worldPos.x - last.x, worldPos.y - last.y) >= 8) {
          pts.push({ x: worldPos.x, y: Math.min(735, worldPos.y) });
        }
        return;
      }

      // Panning camera
      if (this.editorState.isPanningCamera) {
        const dx = (e.clientX - this.editorState.panStart.x) / this.renderer.camera.zoom;
        const dy = (e.clientY - this.editorState.panStart.y) / this.renderer.camera.zoom;
        this.renderer.camera.x = this.editorState.cameraStart.x - dx;
        this.renderer.camera.y = this.editorState.cameraStart.y - dy;
        this.renderer.camera.mode = 'free';
        document.getElementById('camModeSelect').value = 'free';
        return;
      }

      // Dragging a Bézier handle
      if (this.editorState.draggingHandle) {
        const { node, which } = this.editorState.draggingHandle;
        const dx = worldPos.x - node.x;
        const dy = worldPos.y - node.y;
        node.customHandles = true;

        if (which === 'out') {
          node.handleOut = { x: dx, y: dy };
          if (!e.altKey) {
            node.handleIn = { x: -dx, y: -dy };
          }
        } else {
          node.handleIn = { x: dx, y: dy };
          if (!e.altKey) {
            node.handleOut = { x: -dx, y: -dy };
          }
        }
        this.spline.rebuild();
        return;
      }

      // Dragging a track node
      if (this.editorState.isDraggingNode && this.editorState.selectedNode) {
        const snapped = this.applyGridSnap(worldPos);
        this.editorState.selectedNode.x = snapped.x;
        this.editorState.selectedNode.y = snapped.y;
        this.spline.rebuild();
        return;
      }

      // Hover detection in build mode
      if (this.editorState.mode === 'build') {
        this.editorState.hoverHandle = this.spline.findClosestHandle(worldPos.x, worldPos.y, 16 / this.renderer.camera.zoom);
        this.editorState.hoverNode = this.editorState.hoverHandle
          ? null
          : this.spline.findClosestNode(worldPos.x, worldPos.y, 20 / this.renderer.camera.zoom);

        if (!this.editorState.hoverHandle && !this.editorState.hoverNode && this.editorState.tool === 'add') {
          this.editorState.hoverSegment = this.spline.findClosestSegment(worldPos.x, worldPos.y, 25 / this.renderer.camera.zoom);
        } else {
          this.editorState.hoverSegment = null;
        }

        // Cursor style
        if (this.editorState.placingCoaster || this.editorState.tool === 'freehand') {
          canvas.style.cursor = 'crosshair';
        } else if (this.editorState.hoverHandle || this.editorState.hoverNode) {
          canvas.style.cursor = 'pointer';
        } else if (this.editorState.hoverSegment) {
          canvas.style.cursor = 'crosshair';
        } else {
          canvas.style.cursor = this.editorState.tool === 'add' ? 'crosshair' : 'default';
        }
      }
    });

    // Mouse Up
    window.addEventListener('mouseup', (e) => {
      if (this.editorState.isDrawingFreehand) {
        this.editorState.isDrawingFreehand = false;
        this.updateFreehandUI();
      }
      if (this.editorState.isPanningCamera) {
        this.editorState.isPanningCamera = false;
      }
      if (this.editorState.draggingHandle) {
        this.editorState.draggingHandle = null;
        this.saveHistoryState();
      }
      if (this.editorState.isDraggingNode) {
        this.editorState.isDraggingNode = false;
        this.saveHistoryState();
      }
    });

    // Prevent context menu on right click
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Mouse Wheel Zoom
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      const mouseWorldBefore = this.screenToWorld(e.clientX, e.clientY);

      this.renderer.camera.zoom = Math.max(0.25, Math.min(3.0, this.renderer.camera.zoom * zoomFactor));

      // Keep mouse pointer centered on the same world coordinate during zoom
      const mouseWorldAfter = this.screenToWorld(e.clientX, e.clientY);
      this.renderer.camera.x += (mouseWorldBefore.x - mouseWorldAfter.x);
      this.renderer.camera.y += (mouseWorldBefore.y - mouseWorldAfter.y);
    }, { passive: false });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Ignore if typing inside input fields
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlayPause();
      } else if (e.code === 'KeyR') {
        this.physics.reset();
      } else if (e.code === 'KeyB') {
        this.setMode(this.editorState.mode === 'build' ? 'test' : 'build');
      } else if (e.code === 'KeyC') {
        this.cycleCameraMode();
      } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.undo();
      } else if (e.code === 'KeyY' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.redo();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (this.editorState.selectedNode && this.editorState.mode === 'build') {
          this.spline.removeNode(this.editorState.selectedNode.id);
          this.editorState.selectedNode = null;
          this.saveHistoryState();
        }
      } else if (e.code === 'KeyM') {
        this.toggleMute();
      } else if (e.code === 'Enter') {
        if (this.editorState.freehandPoints && this.editorState.freehandPoints.length >= 2) {
          e.preventDefault();
          this.convertFreehandToCoaster();
        }
      } else if (e.code === 'Escape') {
        if (this.editorState.placingCoaster) {
          this.cancelPlacement();
        }
      }
    });
  }

  handleBuildMouseDown(worldPos) {
    const zoom = this.renderer.camera.zoom;
    let clickedHandle = this.spline.findClosestHandle(worldPos.x, worldPos.y, 16 / zoom);
    let clickedNode = this.spline.findClosestNode(worldPos.x, worldPos.y, 20 / zoom);

    // Check if user clicked on a node of ANOTHER coaster in the park -> switch active coaster to it!
    if (!clickedHandle && !clickedNode && this.coasters.length > 1) {
      for (let cIdx = 0; cIdx < this.coasters.length; cIdx++) {
        if (cIdx === this.activeCoasterIndex) continue;
        const otherNode = this.coasters[cIdx].spline.findClosestNode(worldPos.x, worldPos.y, 20 / zoom);
        if (otherNode) {
          this.activeCoasterIndex = cIdx;
          this.updateCoasterSelectorUI();
          this.updateRideTypeUI();
          this.updateCircuitButton();
          clickedNode = otherNode;
          break;
        }
      }
    }

    // If a Bézier handle was clicked (and isn't closer to the node center itself)
    if (clickedHandle && this.editorState.tool !== 'delete') {
      const distToHandle = Math.hypot(clickedHandle.x - worldPos.x, clickedHandle.y - worldPos.y);
      const distToNode = clickedNode ? Math.hypot(clickedNode.x - worldPos.x, clickedNode.y - worldPos.y) : Infinity;

      if (distToHandle <= distToNode) {
        this.editorState.selectedNode = clickedHandle.node;
        this.editorState.draggingHandle = clickedHandle;
        this.updateNodeInspector();
        if (window.coasterAudio) window.coasterAudio.playClick();
        return;
      }
    }

    if (clickedNode) {
      if (this.editorState.tool === 'delete') {
        // Delete node
        this.spline.removeNode(clickedNode.id);
        this.editorState.selectedNode = null;
        if (window.coasterAudio) window.coasterAudio.playClick();
        this.saveHistoryState();
        return;
      }

      if (['lift', 'boost', 'maglev', 'brake', 'gap', 'normal'].includes(this.editorState.tool)) {
        // Change track node type (sanitized for water coaster if needed)
        clickedNode.type = this.spline.sanitizeNodeType(this.editorState.tool);
        this.spline.rebuild();
        this.updateNodeInspector();
        if (window.coasterAudio) window.coasterAudio.playClick();
        this.saveHistoryState();
        return;
      }

      // Select and start dragging node
      this.editorState.selectedNode = clickedNode;
      this.editorState.isDraggingNode = true;
      this.updateNodeInspector();
      if (window.coasterAudio) window.coasterAudio.playClick();
      return;
    }

    // Clicked empty space or track segment
    if (this.editorState.tool === 'add') {
      const snapped = this.applyGridSnap(worldPos);

      // Check if clicking near track to insert node between existing ones
      if (this.editorState.hoverSegment) {
        const inserted = this.spline.insertNode(
          this.editorState.hoverSegment.insertIndex,
          snapped.x,
          snapped.y,
          'normal'
        );
        this.editorState.selectedNode = inserted;
      } else {
        // Append to end of track
        const added = this.spline.addNode(snapped.x, snapped.y, 'normal');
        this.editorState.selectedNode = added;
      }

      if (window.coasterAudio) window.coasterAudio.playClick();
      this.saveHistoryState();
      this.updateNodeInspector();
    } else {
      // Deselect
      this.editorState.selectedNode = null;
      this.updateNodeInspector();
    }
  }

  togglePlayPause() {
    if (this.physics.isRunning) {
      this.physics.pause();
      document.getElementById('btnPlayPause').innerHTML = '▶ Starten';
      document.getElementById('btnPlayPause').classList.remove('btn-danger');
      document.getElementById('btnPlayPause').classList.add('btn-success');
    } else {
      if (this.spline.nodes.length < 2 && this.editorState.freehandPoints && this.editorState.freehandPoints.length >= 2) {
        this.convertFreehandToCoaster();
      }
      this.setMode('test');
      this.physics.start();
      document.getElementById('btnPlayPause').innerHTML = '⏸ Anhalten';
      document.getElementById('btnPlayPause').classList.remove('btn-success');
      document.getElementById('btnPlayPause').classList.add('btn-danger');
    }
  }

  setMode(mode) {
    this.editorState.mode = mode;
    const modeBuildBtn = document.getElementById('btnModeBuild');
    const modeTestBtn = document.getElementById('btnModeTest');

    if (mode === 'build') {
      modeBuildBtn.classList.add('active');
      modeTestBtn.classList.remove('active');
      document.getElementById('buildToolbar').style.display = 'flex';
      this.renderer.camera.mode = 'free';
      document.getElementById('camModeSelect').value = 'free';
      this.updateFreehandUI();
    } else {
      this.cancelPlacement();
      modeBuildBtn.classList.remove('active');
      modeTestBtn.classList.add('active');
      document.getElementById('buildToolbar').style.display = 'none';
      this.renderer.camera.mode = 'follow';
      document.getElementById('camModeSelect').value = 'follow';
      this.updateFreehandUI();
    }
  }

  cycleCameraMode() {
    const modes = ['follow', 'ride', 'free'];
    const curIdx = modes.indexOf(this.renderer.camera.mode);
    const nextMode = modes[(curIdx + 1) % modes.length];
    this.renderer.camera.mode = nextMode;
    document.getElementById('camModeSelect').value = nextMode;
  }

  toggleMute() {
    if (!window.coasterAudio) return;
    const isMuted = window.coasterAudio.toggleMute();
    document.getElementById('btnMute').innerHTML = isMuted ? '🔇 Stumm' : '🔊 Ton';
  }

  insertPresetElement(elementType) {
    if (this.spline.nodes.length === 0) return;

    // Get last node as reference
    const lastNode = this.spline.nodes[this.spline.nodes.length - 1];
    const lx = lastNode.x;
    const ly = lastNode.y;

    if (elementType === 'loop') {
      // Insert vertical loop
      this.spline.addNode(lx + 80,  ly, 'normal');
      this.spline.addNode(lx + 160, ly - 90, 'normal');
      this.spline.addNode(lx + 175, ly - 210, 'normal');
      this.spline.addNode(lx + 120, ly - 260, 'normal');
      this.spline.addNode(lx + 65,  ly - 200, 'normal');
      this.spline.addNode(lx + 90,  ly - 80, 'normal');
      this.spline.addNode(lx + 200, ly, 'normal');
    } else if (elementType === 'camelback') {
      // Insert airtime hill
      this.spline.addNode(lx + 120, ly - 80, 'normal');
      this.spline.addNode(lx + 240, ly - 160, 'normal');
      this.spline.addNode(lx + 340, ly - 160, 'normal');
      this.spline.addNode(lx + 460, ly - 80, 'normal');
      this.spline.addNode(lx + 580, ly, 'normal');
    } else if (elementType === 'drop') {
      // Mega drop (with splashing water brake at bottom if water ride)
      const bottomType = this.spline.rideType === 'water' ? 'brake' : 'normal';
      this.spline.addNode(lx + 100, ly - 180, 'lift');
      this.spline.addNode(lx + 220, ly - 340, 'lift');
      this.spline.addNode(lx + 320, ly - 360, 'normal');
      this.spline.addNode(lx + 420, ly - 140, 'normal');
      this.spline.addNode(lx + 540, ly, bottomType);
      if (this.spline.rideType === 'water') {
        this.spline.addNode(lx + 680, ly, 'brake');
      }
    } else if (elementType === 'jump') {
      // Maglev run-up + stunt ramp jump ('gap') + catch landing rail
      this.spline.addNode(lx + 110, ly, 'maglev');
      this.spline.addNode(
        lx + 230,
        ly - 40,
        'gap',
        { x: -45, y: 22 },
        { x: 45, y: -22 },
        true
      );
      this.spline.addNode(
        lx + 610,
        ly - 85,
        'normal',
        { x: -50, y: -18 },
        { x: 50, y: 18 },
        true
      );
      this.spline.addNode(lx + 790, ly, 'normal');
    }

    this.saveHistoryState();
  }

  // Smooth point-to-point in forward (+1) or backward (-1) direction and advance node selection
  stepSmooth(direction = 1, saveHistory = true) {
    const n = this.spline.nodes.length;
    if (n < 2) return;

    let idx = this.editorState.selectedNode
      ? this.spline.nodes.indexOf(this.editorState.selectedNode)
      : -1;

    if (idx === -1) {
      idx = direction >= 0 ? 0 : n - 1;
    }

    const strength = this.editorState.smoothStrength || 0.45;
    const nextIdx = (idx + direction + n) % n;

    // Smooth current node and blend transition into the next node along the step direction
    const smoothedNode = this.spline.smoothNodeAt(idx, strength, false);
    this.spline.smoothNodeAt(nextIdx, strength * 0.35, true);

    if (smoothedNode && this.renderer) {
      this.renderer.addSparks(smoothedNode.x, smoothedNode.y, 4);
    }
    if (window.coasterAudio) {
      window.coasterAudio.playClick();
    }

    // Advance selection to next point in direction of smoothing
    this.editorState.selectedNode = this.spline.nodes[nextIdx];
    this.updateNodeInspector();

    if (saveHistory) {
      this.saveHistoryState();
    }
  }

  smoothEntireTrack() {
    if (this.spline.nodes.length < 3) return;
    const strength = this.editorState.smoothStrength || 0.45;
    this.spline.smoothAll(strength);
    if (window.coasterAudio) {
      window.coasterAudio.playClick();
    }
    this.saveHistoryState();
  }

  selectTool(toolName) {
    this.editorState.tool = toolName;
    const toolButtons = document.querySelectorAll('.btn-tool');
    toolButtons.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tool') === toolName);
    });
    this.updateFreehandUI();
  }

  updateFreehandUI() {
    const hasSketch = this.editorState.freehandPoints && this.editorState.freehandPoints.length >= 2;
    const isFreehandTool = this.editorState.tool === 'freehand';
    const banner = document.getElementById('freehandBanner');
    const convertBtn = document.getElementById('btnConvertFreehand');

    if (banner) {
      banner.style.display = (this.editorState.mode === 'build' && (isFreehandTool || hasSketch)) ? 'flex' : 'none';
    }
    if (convertBtn) {
      convertBtn.style.display = hasSketch ? 'block' : 'none';
    }
  }

  startNewFreehandCoaster(rideType = null) {
    this.setMode('build');
    this.cancelPlacement();
    this.editorState.selectedNode = null;
    this.editorState.freehandPoints = [];
    // If current coaster already has track nodes, freehand drawing will create an additional coaster in the park!
    this.editorState.freehandCreatesNew = (this.spline && this.spline.nodes.length >= 2);
    this.editorState.freehandRideType = rideType;
    if (!this.editorState.freehandCreatesNew && rideType && this.spline) {
      this.spline.setRideType(rideType);
    }
    this.selectTool('freehand');
    this.updateRideTypeUI();
    this.updateCircuitButton();
    this.updateNodeInspector();
  }

  deleteActiveCoaster() {
    if (this.coasters.length > 1) {
      // Remove any queuing visitors from this coaster
      this.physics.disembarkAllPassengers();
      this.physics.stationQueue = [];
      this.coasters.splice(this.activeCoasterIndex, 1);
      this.activeCoasterIndex = Math.max(0, this.activeCoasterIndex - 1);
      this.editorState.selectedNode = null;
      this.updateCoasterSelectorUI();
      this.updateRideTypeUI();
      this.updateCircuitButton();
      this.updateNodeInspector();
      this.saveHistoryState();
    } else {
      // Only 1 coaster left: clear its nodes so user can draw/build a fresh one
      this.physics.disembarkAllPassengers();
      this.physics.stationQueue = [];
      this.spline.clear();
      this.physics.reset();
      this.editorState.selectedNode = null;
      this.updateCircuitButton();
      this.updateNodeInspector();
      this.saveHistoryState();
    }
  }

  convertFreehandToCoaster() {
    const pts = this.editorState.freehandPoints;
    if (!pts || pts.length < 2) {
      alert('Bitte zeichne zuerst mit gedrückter linker Maustaste eine Linie auf die Karte!');
      return;
    }

    // Create a new coaster instance in the park if current coaster already has a track
    const shouldCreateNew = this.editorState.freehandCreatesNew || (this.spline && this.spline.nodes.length >= 2);
    const desiredRideType = this.editorState.freehandRideType || (this.spline ? this.spline.rideType : 'steel');
    let targetCoaster = this.activeCoaster;
    if (shouldCreateNew) {
      const label = desiredRideType === 'water' ? 'Wasserbahn' : 'Freihand-Bahn';
      targetCoaster = this.createCoasterInstance(`${label} #${this.coasters.length + 1}`, desiredRideType);
    } else if (targetCoaster && desiredRideType) {
      targetCoaster.spline.setRideType(desiredRideType);
    }

    const ok = targetCoaster.spline.buildFromFreehand(pts);
    if (!ok) {
      if (shouldCreateNew && this.coasters.length > 1) {
        this.coasters.pop();
        this.activeCoasterIndex = this.coasters.length - 1;
        this.updateCoasterSelectorUI();
      }
      alert('Die gezeichnete Linie ist zu kurz. Zeichne eine längere Achterbahn-Kurve!');
      return;
    }

    this.editorState.freehandPoints = [];
    this.editorState.freehandCreatesNew = false;
    this.editorState.freehandRideType = null;
    this.physics.reset();
    this.physics.isRunning = true;
    this.updateCoasterSelectorUI();
    this.updateRideTypeUI();
    this.updateCircuitButton();
    this.selectTool('select');
    this.updateNodeInspector();
    this.saveHistoryState();

    if (this.renderer && this.spline.nodes.length > 0) {
      for (const n of this.spline.nodes) {
        this.renderer.addSparks(n.x, n.y, 4);
      }
      this.renderer.addConfetti(this.spline.nodes[0].x, this.spline.nodes[0].y - 30, 22);
    }
    if (window.coasterAudio) {
      window.coasterAudio.playClick();
    }
  }

  getSavedCoasters() {
    try {
      const raw = localStorage.getItem('coastercraft_saved_coasters');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  saveCurrentCoaster() {
    if (this.spline.nodes.length < 2) {
      alert('Baue oder zeichne zuerst eine Achterbahn mit mindestens 2 Punkten, bevor du sie speicherst!');
      return;
    }
    const input = document.getElementById('inputCoasterName');
    const name = (input && input.value.trim()) ? input.value.trim() : `Meine Achterbahn #${this.getSavedCoasters().length + 1}`;
    const saved = this.getSavedCoasters();

    const newEntry = {
      id: 'custom_' + Date.now(),
      name,
      description: `Gespeicherte ${this.spline.rideType === 'water' ? 'Wasserbahn' : 'Bahn'} (${this.spline.nodes.length} Punkte, ${Math.round(this.spline.totalLength / PIXELS_PER_METER)}m Länge)`,
      rideType: this.spline.rideType || 'steel',
      isClosed: this.spline.isClosed,
      nodes: JSON.parse(JSON.stringify(this.spline.nodes))
    };

    saved.unshift(newEntry);
    try {
      localStorage.setItem('coastercraft_saved_coasters', JSON.stringify(saved));
    } catch (err) {
      console.error('Could not save coaster to localStorage', err);
    }

    if (input) input.value = '';
    if (window.coasterAudio) window.coasterAudio.playClick();
    this.renderCoasterBrowserGrid();
  }

  deleteSavedCoaster(id) {
    const saved = this.getSavedCoasters().filter(c => c.id !== id);
    try {
      localStorage.setItem('coastercraft_saved_coasters', JSON.stringify(saved));
    } catch (err) {}
    this.renderCoasterBrowserGrid();
  }

  loadCoasterData(coasterData) {
    if (!coasterData || !Array.isArray(coasterData.nodes)) return;
    this.cancelPlacement();
    this.editorState.freehandPoints = [];
    this.activeCoaster.name = coasterData.name || 'Achterbahn';
    this.spline.clear();
    this.spline.rideType = coasterData.rideType === 'water' ? 'water' : 'steel';
    this.spline.isClosed = !!coasterData.isClosed;

    for (const n of coasterData.nodes) {
      this.spline.addNode(n.x, n.y, n.type || 'normal', n.handleIn, n.handleOut, n.customHandles);
    }

    this.physics.reset();
    this.physics.isRunning = true;
    this.editorState.selectedNode = null;
    this.updateCoasterSelectorUI();
    this.updateRideTypeUI();
    this.updateCircuitButton();
    this.updateNodeInspector();
    this.updateFreehandUI();
    this.saveHistoryState();

    if (this.spline.nodes.length > 0) {
      this.renderer.camera.x = this.spline.nodes[0].x + 250;
      this.renderer.camera.y = this.spline.nodes[0].y - 110;
      this.renderer.camera.zoom = 0.85;
    }
  }

  startPlacingCoaster(coasterData) {
    if (!coasterData || !Array.isArray(coasterData.nodes) || coasterData.nodes.length === 0) return;
    this.setMode('build');
    this.editorState.placingCoaster = JSON.parse(JSON.stringify(coasterData));

    const banner = document.getElementById('placementBanner');
    const bannerText = document.getElementById('placementBannerText');
    if (banner) banner.style.display = 'flex';
    if (bannerText) {
      bannerText.innerHTML = `📍 <strong>Platzier-Modus:</strong> Klicke auf die Karte, um <em>„${coasterData.name}“</em> hier zu platzieren!`;
    }
  }

  cancelPlacement() {
    this.editorState.placingCoaster = null;
    const banner = document.getElementById('placementBanner');
    if (banner) banner.style.display = 'none';
  }

  placeCoasterAt(wx, wy) {
    const data = this.editorState.placingCoaster;
    if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) return;

    const anchorX = data.nodes[0].x;
    const anchorY = data.nodes[0].y;
    const dx = wx - anchorX;
    const dy = Math.min(735, wy) - anchorY;

    // If current coaster already has track nodes, create a brand-new independent coaster in the park!
    const rideType = data.rideType === 'water' ? 'water' : 'steel';
    if (this.spline.nodes.length >= 2) {
      this.createCoasterInstance(data.name || `${rideType === 'water' ? 'Wasserbahn' : 'Achterbahn'} #${this.coasters.length + 1}`, rideType);
    } else {
      this.activeCoaster.name = data.name || this.activeCoaster.name;
      this.spline.setRideType(rideType);
    }

    this.spline.isClosed = !!data.isClosed;

    for (const n of data.nodes) {
      const nx = Math.round(n.x + dx);
      const ny = Math.round(Math.min(735, n.y + dy));
      this.spline.addNode(nx, ny, n.type || 'normal', n.handleIn, n.handleOut, n.customHandles);
      if (this.renderer) {
        this.renderer.addSparks(nx, ny, 3);
      }
    }

    this.physics.reset();
    this.physics.isRunning = true;
    this.updateCoasterSelectorUI();
    this.updateRideTypeUI();
    this.updateCircuitButton();
    this.saveHistoryState();
    this.cancelPlacement();
    if (window.coasterAudio) window.coasterAudio.playClick();
  }

  renderCoasterBrowserGrid() {
    const grid = document.getElementById('coasterBrowserGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const saved = this.getSavedCoasters().map(c => ({ ...c, isCustom: true }));
    const presets = Object.entries(PRESET_COASTERS).map(([key, p]) => ({
      id: 'preset_' + key,
      name: p.name,
      description: p.description,
      rideType: p.rideType || 'steel',
      isClosed: p.isClosed,
      nodes: p.nodes,
      isCustom: false
    }));

    const allCoasters = [...saved, ...presets];
    const modal = document.getElementById('coasterBrowserModal');

    for (const item of allCoasters) {
      const card = document.createElement('div');
      card.className = 'coaster-card';

      const canvas = document.createElement('canvas');
      canvas.className = 'coaster-card-preview';
      canvas.width = 230;
      canvas.height = 92;

      const header = document.createElement('div');
      header.className = 'coaster-card-header';

      const title = document.createElement('div');
      title.className = 'coaster-card-title';
      title.textContent = item.name;
      header.appendChild(title);

      if (item.isCustom) {
        const delBtn = document.createElement('button');
        delBtn.className = 'btn-icon-danger';
        delBtn.title = 'Gespeicherte Bahn löschen';
        delBtn.textContent = '🗑️';
        delBtn.addEventListener('click', () => this.deleteSavedCoaster(item.id));
        header.appendChild(delBtn);
      }

      const meta = document.createElement('div');
      meta.className = 'coaster-card-meta';
      const typeBadge = item.rideType === 'water' ? '💦 Wasserbahn' : (item.isCustom ? '⭐ Eigene Bahn' : '🎢 Stahlbahn');
      meta.innerHTML = `<span>${typeBadge}</span> • <span>${item.isClosed ? '🔄 Rundkurs' : '↔ Offen'}</span> • <span>${item.nodes.length} Pkt.</span>`;

      const desc = document.createElement('div');
      desc.className = 'coaster-card-desc';
      desc.textContent = item.description || '';

      const actions = document.createElement('div');
      actions.className = 'coaster-card-actions';

      const btnLoad = document.createElement('button');
      btnLoad.className = 'btn btn-primary btn-compact flex-1';
      btnLoad.textContent = '🎢 Laden';
      btnLoad.title = 'Diese Achterbahn direkt laden';
      btnLoad.addEventListener('click', () => {
        this.loadCoasterData(item);
        if (modal) modal.classList.remove('open');
      });

      const btnPlace = document.createElement('button');
      btnPlace.className = 'btn btn-secondary btn-compact flex-1';
      btnPlace.textContent = '📍 Platzieren';
      btnPlace.title = 'Diese Achterbahn frei mit der Maus auf der Karte platzieren';
      btnPlace.addEventListener('click', () => {
        if (modal) modal.classList.remove('open');
        this.startPlacingCoaster(item);
      });

      actions.appendChild(btnLoad);
      actions.appendChild(btnPlace);

      card.appendChild(canvas);
      card.appendChild(header);
      card.appendChild(meta);
      card.appendChild(desc);
      card.appendChild(actions);
      grid.appendChild(card);

      CoasterRenderer.renderMiniPreview(canvas, item);
    }
  }

  updateCircuitButton() {
    const btn = document.getElementById('btnToggleCircuit');
    if (!btn) return;
    if (this.spline.isClosed) {
      btn.innerHTML = '🔄 Rundkurs: An';
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-secondary');
    } else {
      btn.innerHTML = '↔ Offene Strecke';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
    }
  }

  updateNodeInspector() {
    const inspector = document.getElementById('nodeInspector');
    if (!inspector) return;

    if (this.editorState.selectedNode && this.editorState.mode === 'build') {
      inspector.style.display = 'block';
      document.getElementById('nodeTypeSelect').value = this.editorState.selectedNode.type;
      document.getElementById('nodeIndexBadge').textContent = `Punkt #${this.spline.nodes.indexOf(this.editorState.selectedNode) + 1}`;
    } else {
      inspector.style.display = 'none';
    }
  }

  setupUI() {
    // Mode toggle buttons
    document.getElementById('btnModeBuild').addEventListener('click', () => this.setMode('build'));
    document.getElementById('btnModeTest').addEventListener('click', () => this.setMode('test'));

    // Simulation controls
    document.getElementById('btnPlayPause').addEventListener('click', () => this.togglePlayPause());
    document.getElementById('btnReset').addEventListener('click', () => {
      this.physics.reset();
      document.getElementById('btnPlayPause').innerHTML = '▶ Starten';
      document.getElementById('btnPlayPause').classList.remove('btn-danger');
      document.getElementById('btnPlayPause').classList.add('btn-success');
    });

    // Tool buttons
    const toolButtons = document.querySelectorAll('.btn-tool');
    toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        this.cancelPlacement();
        this.selectTool(btn.getAttribute('data-tool'));
      });
    });

    // Circuit toggle
    document.getElementById('btnToggleCircuit').addEventListener('click', () => {
      this.spline.setClosed(!this.spline.isClosed);
      this.updateCircuitButton();
      this.saveHistoryState();
    });

    // Element inserter
    document.getElementById('btnInsertLoop').addEventListener('click', () => this.insertPresetElement('loop'));
    document.getElementById('btnInsertHill').addEventListener('click', () => this.insertPresetElement('camelback'));
    document.getElementById('btnInsertDrop').addEventListener('click', () => this.insertPresetElement('drop'));
    const btnInsertJump = document.getElementById('btnInsertJump');
    if (btnInsertJump) {
      btnInsertJump.addEventListener('click', () => this.insertPresetElement('jump'));
    }

    // Point-to-point Track Smoothing controls (Forward / Backward + Strength Slider)
    const smoothSlider = document.getElementById('sliderSmoothStrength');
    const smoothVal = document.getElementById('valSmoothStrength');
    if (smoothSlider && smoothVal) {
      smoothSlider.addEventListener('input', (e) => {
        const pct = parseInt(e.target.value, 10);
        smoothVal.textContent = pct + '%';
        this.editorState.smoothStrength = pct / 100;
      });
    }

    const bindHoldableSmoothBtn = (btnId, direction) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      let holdInterval = null;
      let didHoldStep = false;

      const stopHold = () => {
        if (holdInterval) {
          clearInterval(holdInterval);
          holdInterval = null;
          if (didHoldStep) {
            this.saveHistoryState();
          }
          didHoldStep = false;
        }
      };

      btn.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        this.stepSmooth(direction, true);
        holdInterval = setInterval(() => {
          didHoldStep = true;
          this.stepSmooth(direction, false);
        }, 115);
      });

      window.addEventListener('mouseup', stopHold);
      btn.addEventListener('mouseleave', stopHold);
    };

    bindHoldableSmoothBtn('btnSmoothBackward', -1);
    bindHoldableSmoothBtn('btnSmoothForward', 1);

    const btnSmoothAll = document.getElementById('btnSmoothAll');
    if (btnSmoothAll) {
      btnSmoothAll.addEventListener('click', () => this.smoothEntireTrack());
    }

    // Clear track & start new freehand coaster
    document.getElementById('btnClearTrack').addEventListener('click', () => {
      this.startNewFreehandCoaster();
    });

    const btnDeleteCoaster = document.getElementById('btnDeleteCoaster');
    if (btnDeleteCoaster) {
      btnDeleteCoaster.addEventListener('click', () => this.deleteActiveCoaster());
    }

    const activeCoasterSelect = document.getElementById('activeCoasterSelect');
    if (activeCoasterSelect) {
      activeCoasterSelect.addEventListener('change', (e) => {
        const idx = parseInt(e.target.value, 10);
        if (idx >= 0 && idx < this.coasters.length) {
          this.activeCoasterIndex = idx;
          this.editorState.selectedNode = null;
          this.updateRideTypeUI();
          this.updateCircuitButton();
          this.updateNodeInspector();
          const stNode = this.spline.nodes[0];
          if (stNode) {
            this.renderer.camera.x = stNode.x + 220;
            this.renderer.camera.y = stNode.y - 100;
          }
        }
      });
    }

    const rideTypeSelect = document.getElementById('rideTypeSelect');
    if (rideTypeSelect) {
      rideTypeSelect.addEventListener('change', (e) => {
        const newType = e.target.value === 'water' ? 'water' : 'steel';
        this.spline.setRideType(newType);
        this.physics.reset();
        this.physics.isRunning = true;
        this.updateRideTypeUI();
        this.updateCoasterSelectorUI();
        this.updateNodeInspector();
        this.saveHistoryState();
      });
    }

    const btnFocusEntrance = document.getElementById('btnFocusEntrance');
    if (btnFocusEntrance) {
      btnFocusEntrance.addEventListener('click', () => {
        this.renderer.camera.mode = 'free';
        document.getElementById('camModeSelect').value = 'free';
        this.renderer.camera.x = this.parkEntranceX - 150;
        this.renderer.camera.y = 640;
      });
    }

    // Freehand conversion & clear buttons
    const btnConvertFreehand = document.getElementById('btnConvertFreehand');
    if (btnConvertFreehand) {
      btnConvertFreehand.addEventListener('click', () => this.convertFreehandToCoaster());
    }
    const btnBannerConvert = document.getElementById('btnBannerConvertFreehand');
    if (btnBannerConvert) {
      btnBannerConvert.addEventListener('click', () => this.convertFreehandToCoaster());
    }
    const btnBannerClear = document.getElementById('btnBannerClearFreehand');
    if (btnBannerClear) {
      btnBannerClear.addEventListener('click', () => {
        this.editorState.freehandPoints = [];
        this.updateFreehandUI();
      });
    }

    // Placement cancel button
    const btnCancelPlacement = document.getElementById('btnCancelPlacement');
    if (btnCancelPlacement) {
      btnCancelPlacement.addEventListener('click', () => this.cancelPlacement());
    }

    // Coaster Browser Modal controls
    const coasterModal = document.getElementById('coasterBrowserModal');
    const btnOpenBrowser = document.getElementById('btnOpenCoasterBrowser');
    const btnCloseBrowser = document.getElementById('btnCloseCoasterBrowser');
    if (btnOpenBrowser && coasterModal) {
      btnOpenBrowser.addEventListener('click', () => {
        this.renderCoasterBrowserGrid();
        coasterModal.classList.toggle('open');
        document.getElementById('settingsDrawer').classList.remove('open');
        document.getElementById('helpModal').classList.remove('open');
      });
    }
    if (btnCloseBrowser && coasterModal) {
      btnCloseBrowser.addEventListener('click', () => coasterModal.classList.remove('open'));
    }

    const btnSaveCoaster = document.getElementById('btnSaveCoaster');
    if (btnSaveCoaster) {
      btnSaveCoaster.addEventListener('click', () => this.saveCurrentCoaster());
    }

    const btnModalNewFreehand = document.getElementById('btnModalNewFreehand');
    if (btnModalNewFreehand && coasterModal) {
      btnModalNewFreehand.addEventListener('click', () => {
        coasterModal.classList.remove('open');
        this.startNewFreehandCoaster('steel');
      });
    }

    const btnModalNewWaterFreehand = document.getElementById('btnModalNewWaterFreehand');
    if (btnModalNewWaterFreehand && coasterModal) {
      btnModalNewWaterFreehand.addEventListener('click', () => {
        coasterModal.classList.remove('open');
        this.startNewFreehandCoaster('water');
      });
    }

    const btnModalNewEmpty = document.getElementById('btnModalNewEmpty');
    if (btnModalNewEmpty && coasterModal) {
      btnModalNewEmpty.addEventListener('click', () => {
        coasterModal.classList.remove('open');
        this.setMode('build');
        this.cancelPlacement();
        this.spline.clear();
        this.physics.reset();
        this.editorState.selectedNode = null;
        this.editorState.freehandPoints = [];
        this.selectTool('add');
        this.updateCircuitButton();
        this.updateNodeInspector();
        this.saveHistoryState();
      });
    }

    // Undo / Redo
    document.getElementById('btnUndo').addEventListener('click', () => this.undo());
    document.getElementById('btnRedo').addEventListener('click', () => this.redo());

    // Selected node type change
    document.getElementById('nodeTypeSelect').addEventListener('change', (e) => {
      if (this.editorState.selectedNode) {
        this.editorState.selectedNode.type = this.spline.sanitizeNodeType(e.target.value);
        this.spline.rebuild();
        this.saveHistoryState();
      }
    });

    // Delete selected node button
    document.getElementById('btnDeleteSelectedNode').addEventListener('click', () => {
      if (this.editorState.selectedNode) {
        this.spline.removeNode(this.editorState.selectedNode.id);
        this.editorState.selectedNode = null;
        this.updateNodeInspector();
        this.saveHistoryState();
      }
    });

    // Reset Bézier handles on selected node
    document.getElementById('btnResetHandles').addEventListener('click', () => {
      if (this.editorState.selectedNode) {
        this.spline.resetNodeHandles(this.editorState.selectedNode);
        this.saveHistoryState();
      }
    });

    // Presets selector
    document.getElementById('presetSelect').addEventListener('change', (e) => {
      if (e.target.value) {
        this.loadPreset(e.target.value);
        this.saveHistoryState();
      }
    });

    // Camera mode select
    document.getElementById('camModeSelect').addEventListener('change', (e) => {
      this.renderer.camera.mode = e.target.value;
    });

    // Theme selector (Day / Sunset / Night)
    document.getElementById('themeSelect').addEventListener('change', (e) => {
      this.renderer.setTheme(e.target.value);
    });

    // Grid snap select
    document.getElementById('gridSnapSelect').addEventListener('change', (e) => {
      this.editorState.gridSnap = parseInt(e.target.value, 10);
    });

    // Train cars count slider
    const carSlider = document.getElementById('sliderCars');
    const carVal = document.getElementById('valCars');
    carSlider.addEventListener('input', (e) => {
      const count = parseInt(e.target.value, 10);
      carVal.textContent = count;
      this.physics.setCarCount(count);
    });

    // Gravity slider
    const gravSlider = document.getElementById('sliderGravity');
    const gravVal = document.getElementById('valGravity');
    gravSlider.addEventListener('input', (e) => {
      const g = parseFloat(e.target.value);
      gravVal.textContent = g.toFixed(1) + ' m/s²';
      this.physics.gravity = g;
    });

    // Friction slider
    const frictSlider = document.getElementById('sliderFriction');
    const frictVal = document.getElementById('valFriction');
    frictSlider.addEventListener('input', (e) => {
      const f = parseFloat(e.target.value);
      frictVal.textContent = (f * 100).toFixed(1) + '%';
      this.physics.frictionCoeff = f;
    });

    // Derailment toggle
    document.getElementById('chkAllowDerail').addEventListener('change', (e) => {
      this.physics.allowDerail = e.target.checked;
    });

    // Mute button
    document.getElementById('btnMute').addEventListener('click', () => this.toggleMute());

    // Export track
    document.getElementById('btnExport').addEventListener('click', () => {
      const trackData = {
        name: this.activeCoaster ? this.activeCoaster.name : "Meine Achterbahn",
        rideType: this.spline.rideType || 'steel',
        isClosed: this.spline.isClosed,
        nodes: this.spline.nodes
      };
      const blob = new Blob([JSON.stringify(trackData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'achterbahn.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import track
    const fileInput = document.getElementById('importFile');
    document.getElementById('btnImport').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target.result);
          if (imported && Array.isArray(imported.nodes)) {
            this.spline.clear();
            this.spline.rideType = imported.rideType === 'water' ? 'water' : 'steel';
            this.spline.isClosed = !!imported.isClosed;
            for (const n of imported.nodes) {
              this.spline.addNode(n.x, n.y, n.type || 'normal', n.handleIn, n.handleOut, n.customHandles);
            }
            this.physics.reset();
            this.saveHistoryState();
            this.updateRideTypeUI();
            this.updateCoasterSelectorUI();
            this.updateCircuitButton();
          }
        } catch (err) {
          alert('Fehler beim Laden der Datei: Ungültiges JSON-Format.');
        }
      };
      reader.readAsText(file);
      fileInput.value = '';
    });
  }

  gameLoop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05); // clamp max dt to 50ms
    this.lastTime = currentTime;

    // Update park visitors & all roller coasters in the park
    this.updateVisitors(dt);
    for (const c of this.coasters) {
      c.physics.update(dt);
    }

    // Render scene with all coasters, stations, stairs, entrance, and visitors
    this.renderer.render(
      this.spline,
      this.physics,
      this.editorState,
      dt,
      this.coasters,
      this.visitors,
      this.parkEntranceX
    );

    // Update Telemetry HUD
    this.updateHUD();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  updateHUD() {
    const visCountEl = document.getElementById('hudVisitorCount');
    if (visCountEl) {
      visCountEl.textContent = this.visitors.length;
    }

    const speedKmH = Math.abs(this.physics.velocity) * 3.6;
    document.getElementById('hudSpeed').textContent = Math.round(speedKmH);
    document.getElementById('hudMaxSpeed').textContent =
      `${Math.round(this.physics.avgSpeedKmH)} / ${Math.round(this.physics.maxSpeedKmH)} km/h`;

    // G-Force
    const gEl = document.getElementById('hudGForce');
    const gVal = this.physics.currentG.toFixed(1);
    gEl.textContent = gVal + ' G';

    if (this.physics.currentG < 0.2) {
      gEl.className = 'telemetry-value airtime';
    } else if (this.physics.currentG > 3.2) {
      gEl.className = 'telemetry-value extreme';
    } else {
      gEl.className = 'telemetry-value normal';
    }

    // Ratings (averaged over coaster length)
    document.getElementById('hudExcitement').textContent = this.physics.excitementRating.toFixed(1);
    document.getElementById('hudIntensity').textContent = this.physics.intensityRating.toFixed(1);
    document.getElementById('hudNausea').textContent = this.physics.nauseaRating.toFixed(1);

    // Length & Length-Averaged G / Airtime Ratio
    const lengthMeters = Math.round(this.spline.totalLength / PIXELS_PER_METER);
    document.getElementById('hudTrackLength').textContent = lengthMeters + ' m';
    const airtimePct = Math.round((this.physics.airtimeRatio || 0) * 100);
    document.getElementById('hudAirtime').textContent = `${this.physics.avgG.toFixed(1)} G (${airtimePct}%)`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.coasterGame = new CoasterGame();
});

