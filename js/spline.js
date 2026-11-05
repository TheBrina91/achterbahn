/* CoasterCraft 2D - Spline Math & Arc-Length Parameterization */

class CoasterSpline {
  constructor(rideType = 'steel') {
    this.rideType = rideType; // 'steel' | 'water'
    this.nodes = [];       // Array of { x, y, type: 'normal'|'lift'|'boost'|'brake', id }
    this.isClosed = false;  // Whether the track is a closed circuit loop
    this.samples = [];     // Uniform arc-length samples
    this.totalLength = 0;
    this.nextId = 1;
  }

  setRideType(rideType) {
    this.rideType = rideType === 'water' ? 'water' : 'steel';
    if (this.rideType === 'water') {
      for (const n of this.nodes) {
        if (!['normal', 'lift', 'brake'].includes(n.type)) {
          n.type = 'normal';
        }
      }
    }
    this.rebuild();
  }

  sanitizeNodeType(type) {
    if (this.rideType === 'water' && !['normal', 'lift', 'brake'].includes(type)) {
      return 'normal';
    }
    return type || 'normal';
  }

  clear() {
    this.nodes = [];
    this.samples = [];
    this.totalLength = 0;
  }

  addNode(x, y, type = 'normal', handleIn = null, handleOut = null, customHandles = false) {
    const node = {
      id: this.nextId++,
      x,
      y,
      type: this.sanitizeNodeType(type),
      handleIn: handleIn ? { x: handleIn.x, y: handleIn.y } : { x: -40, y: 0 },
      handleOut: handleOut ? { x: handleOut.x, y: handleOut.y } : { x: 40, y: 0 },
      customHandles: !!customHandles
    };
    this.nodes.push(node);
    this.rebuild();
    return node;
  }

  insertNode(index, x, y, type = 'normal') {
    const node = {
      id: this.nextId++,
      x,
      y,
      type: this.sanitizeNodeType(type),
      handleIn: { x: -40, y: 0 },
      handleOut: { x: 40, y: 0 },
      customHandles: false
    };
    this.nodes.splice(index, 0, node);
    this.rebuild();
    return node;
  }

  resetNodeHandles(node) {
    if (!node) return;
    node.customHandles = false;
    this.rebuild();
  }

  // Smooth a single node's position and Bézier handles relative to its neighboring track points
  smoothNodeAt(index, strength = 0.45, shouldRebuild = true) {
    const n = this.nodes.length;
    if (n < 2 || index < 0 || index >= n) return null;

    const s = Math.max(0.05, Math.min(1.0, strength));
    const node = this.nodes[index];

    // Open track endpoints: keep endpoint anchored, smooth its handle orientation toward neighbor
    if (!this.isClosed && (index === 0 || index === n - 1)) {
      const neighbor = index === 0 ? this.nodes[1] : this.nodes[n - 2];
      const sign = index === 0 ? 1 : -1;
      const dx = (neighbor.x - node.x) * sign;
      const dy = (neighbor.y - node.y) * sign;
      const dist = Math.hypot(dx, dy) || 1;
      const hLen = Math.max(28, dist * 0.34);
      const targetOut = { x: (dx / dist) * hLen, y: (dy / dist) * hLen };
      const targetIn = { x: -targetOut.x, y: -targetOut.y };

      node.handleOut = {
        x: node.handleOut.x + (targetOut.x - node.handleOut.x) * s,
        y: node.handleOut.y + (targetOut.y - node.handleOut.y) * s
      };
      node.handleIn = {
        x: node.handleIn.x + (targetIn.x - node.handleIn.x) * s,
        y: node.handleIn.y + (targetIn.y - node.handleIn.y) * s
      };
      node.customHandles = true;
      if (shouldRebuild) this.rebuild();
      return node;
    }

    if (n < 3) return node;

    const pPrev = this.nodes[(index - 1 + n) % n];
    const pNext = this.nodes[(index + 1 + n) % n];

    // 1. Position relaxation toward neighbor midpoint (skip moving ramp takeoff lips to preserve jump gaps)
    if (node.type !== 'gap' && pPrev.type !== 'gap') {
      const midX = (pPrev.x + pNext.x) * 0.5;
      const midY = (pPrev.y + pNext.y) * 0.5;
      const posBlend = s * 0.65;
      node.x += (midX - node.x) * posBlend;
      node.y = Math.min(735, node.y + (targetYClamp(midY) - node.y) * posBlend);
    }

    function targetYClamp(yVal) {
      return Math.min(735, yVal);
    }

    // 2. Smooth Bézier tangent handles using unit-bisector tangent & proportional chord lengths
    const dxPrev = node.x - pPrev.x;
    const dyPrev = node.y - pPrev.y;
    const distPrev = Math.hypot(dxPrev, dyPrev) || 1;

    const dxNext = pNext.x - node.x;
    const dyNext = pNext.y - node.y;
    const distNext = Math.hypot(dxNext, dyNext) || 1;

    let bx = (dxPrev / distPrev) + (dxNext / distNext);
    let by = (dyPrev / distPrev) + (dyNext / distNext);
    let bLen = Math.hypot(bx, by);
    if (bLen < 0.001) {
      bx = pNext.x - pPrev.x;
      by = pNext.y - pPrev.y;
      bLen = Math.hypot(bx, by) || 1;
    }
    const tx = bx / bLen;
    const ty = by / bLen;

    const lenIn = Math.max(28, distPrev * 0.35);
    const lenOut = Math.max(28, distNext * 0.35);

    let targetIn = { x: -tx * lenIn, y: -ty * lenIn };
    let targetOut = { x: tx * lenOut, y: ty * lenOut };

    if (node.type === 'gap') {
      const upY = -Math.max(22, Math.abs(targetOut.x) * 0.45);
      targetOut = { x: targetOut.x, y: Math.min(targetOut.y, upY) };
      targetIn = { x: -targetOut.x, y: -targetOut.y };
    }

    node.handleIn = {
      x: node.handleIn.x + (targetIn.x - node.handleIn.x) * s,
      y: node.handleIn.y + (targetIn.y - node.handleIn.y) * s
    };
    node.handleOut = {
      x: node.handleOut.x + (targetOut.x - node.handleOut.x) * s,
      y: node.handleOut.y + (targetOut.y - node.handleOut.y) * s
    };
    node.customHandles = true;

    if (shouldRebuild) {
      this.rebuild();
    }
    return node;
  }

  // Smooth the entire coaster forward and backward
  smoothAll(strength = 0.45) {
    const n = this.nodes.length;
    if (n < 3) return;
    const passStrength = Math.max(0.05, Math.min(1.0, strength)) * 0.55;
    // Forward pass (point to point)
    for (let i = 0; i < n; i++) {
      this.smoothNodeAt(i, passStrength, false);
    }
    // Backward pass (point to point)
    for (let i = n - 1; i >= 0; i--) {
      this.smoothNodeAt(i, passStrength, false);
    }
    this.rebuild();
  }

  // Convert a freehand drawn polyline [{x, y}, ...] into a smooth roller coaster spline
  buildFromFreehand(rawPoints) {
    if (!rawPoints || rawPoints.length < 2) return false;

    // 1. Filter dense points & clamp above ground
    const filtered = [{ x: rawPoints[0].x, y: Math.min(735, rawPoints[0].y) }];
    for (let i = 1; i < rawPoints.length; i++) {
      const p = rawPoints[i];
      const prev = filtered[filtered.length - 1];
      if (Math.hypot(p.x - prev.x, p.y - prev.y) >= 8 || i === rawPoints.length - 1) {
        filtered.push({ x: p.x, y: Math.min(735, p.y) });
      }
    }
    if (filtered.length < 2) return false;

    // 2. Two passes of 3-point moving average to remove hand tremor
    let pts = filtered.map(p => ({ x: p.x, y: p.y }));
    for (let pass = 0; pass < 2; pass++) {
      if (pts.length < 3) break;
      const nextPts = [pts[0]];
      for (let i = 1; i < pts.length - 1; i++) {
        nextPts.push({
          x: pts[i - 1].x * 0.25 + pts[i].x * 0.5 + pts[i + 1].x * 0.25,
          y: Math.min(735, pts[i - 1].y * 0.25 + pts[i].y * 0.5 + pts[i + 1].y * 0.25)
        });
      }
      nextPts.push(pts[pts.length - 1]);
      pts = nextPts;
    }

    // 3. Compute cumulative arc length
    const cumDist = [0];
    let totalLen = 0;
    for (let i = 1; i < pts.length; i++) {
      totalLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      cumDist.push(totalLen);
    }
    if (totalLen < 50) return false;

    // 4. Detect closed circuit if end is drawn close to start
    const endToStartDist = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);
    const shouldClose = (totalLen > 320 && endToStartDist < 125);
    const effectiveLen = shouldClose ? Math.max(100, totalLen - endToStartDist * 0.5) : totalLen;

    // 5. Resample evenly every ~125px (between 4 and 34 nodes)
    const numNodes = Math.max(4, Math.min(34, Math.round(effectiveLen / 125) + 1));
    const sampled = [];
    const spanStep = effectiveLen / (shouldClose ? numNodes : Math.max(1, numNodes - 1));

    let segIdx = 0;
    for (let k = 0; k < numNodes; k++) {
      const targetD = Math.min(totalLen, k * spanStep);
      while (segIdx < cumDist.length - 2 && cumDist[segIdx + 1] < targetD) {
        segIdx++;
      }
      const d0 = cumDist[segIdx];
      const d1 = cumDist[segIdx + 1];
      const t = (d1 - d0) > 0.0001 ? (targetD - d0) / (d1 - d0) : 0;
      sampled.push({
        x: Math.round(pts[segIdx].x + (pts[segIdx + 1].x - pts[segIdx].x) * t),
        y: Math.round(Math.min(735, pts[segIdx].y + (pts[segIdx + 1].y - pts[segIdx].y) * t)),
        type: 'normal'
      });
    }

    // 6. Auto-assign chain lift ('lift') to initial uphill climb so the train can reach the first peak
    const searchLimit = Math.max(2, Math.floor(sampled.length * 0.6));
    let peakIdx = 0;
    let minY = sampled[0].y;
    for (let i = 1; i <= searchLimit && i < sampled.length; i++) {
      if (sampled[i].y < minY - 15) {
        minY = sampled[i].y;
        peakIdx = i;
      }
    }
    if (peakIdx > 0) {
      for (let i = 0; i < peakIdx; i++) {
        if (sampled[i + 1].y <= sampled[i].y + 12) {
          sampled[i].type = 'lift';
        }
      }
      sampled[0].type = 'lift';
      // For water rides, automatically place a splashing water brake ('brake') in the valley after the drop!
      if (this.rideType === 'water' && peakIdx + 2 < sampled.length) {
        let valleyIdx = peakIdx + 1;
        let maxY = sampled[valleyIdx].y;
        for (let i = peakIdx + 1; i < Math.min(sampled.length - 1, peakIdx + 5); i++) {
          if (sampled[i].y >= maxY) {
            maxY = sampled[i].y;
            valleyIdx = i;
          }
        }
        sampled[valleyIdx].type = 'brake';
      }
    }
    if (shouldClose && sampled.length >= 4) {
      sampled[sampled.length - 1].type = 'brake';
    }

    // 7. Build spline and apply smooth Bézier tangents
    this.clear();
    this.isClosed = shouldClose;
    for (const n of sampled) {
      this.addNode(n.x, n.y, n.type);
    }
    this.smoothAll(0.35);
    return true;
  }

  // Compute smooth default Bézier handles (Catmull-Rom equivalent) for nodes without custom handles
  updateAutoHandles() {
    const n = this.nodes.length;
    if (n === 0) return;
    if (n === 1) {
      if (!this.nodes[0].customHandles) {
        this.nodes[0].handleIn = { x: -45, y: 0 };
        this.nodes[0].handleOut = { x: 45, y: 0 };
      }
      return;
    }

    for (let i = 0; i < n; i++) {
      const node = this.nodes[i];
      if (node.customHandles && node.handleIn && node.handleOut) continue;

      let pPrev, pNext;
      if (this.isClosed) {
        pPrev = this.nodes[(i - 1 + n) % n];
        pNext = this.nodes[(i + 1) % n];
      } else {
        pPrev = (i === 0)
          ? { x: node.x - (this.nodes[1].x - node.x), y: node.y - (this.nodes[1].y - node.y) }
          : this.nodes[i - 1];
        pNext = (i === n - 1)
          ? { x: node.x + (node.x - this.nodes[n - 2].x), y: node.y + (node.y - this.nodes[n - 2].y) }
          : this.nodes[i + 1];
      }

      let hx = (pNext.x - pPrev.x) / 6;
      let hy = (pNext.y - pPrev.y) / 6;
      const len = Math.hypot(hx, hy);
      const minLen = 28;
      if (len < minLen) {
        const dirX = (pNext.x - node.x) || 1;
        const dirY = (pNext.y - node.y) || 0;
        const dLen = Math.hypot(dirX, dirY) || 1;
        hx = (dirX / dLen) * minLen;
        hy = (dirY / dLen) * minLen;
      }
      node.handleOut = { x: hx, y: hy };
      node.handleIn = { x: -hx, y: -hy };

      // Auto-angle jump ramp lip ('gap') upward and landing ramp after a gap to catch the train
      if (node.type === 'gap') {
        const upY = -Math.max(22, Math.abs(hx) * 0.45);
        node.handleOut = { x: hx, y: Math.min(hy, upY) };
        node.handleIn = { x: -hx, y: -Math.min(hy, upY) };
      } else if (pPrev && pPrev.type === 'gap') {
        const catchY = Math.max(18, Math.abs(hx) * 0.35);
        node.handleIn = { x: -hx, y: -catchY };
        node.handleOut = { x: hx, y: catchY };
      }

      node.customHandles = false;
    }
  }

  removeNode(id) {
    const idx = this.nodes.findIndex(n => n.id === id);
    if (idx !== -1) {
      this.nodes.splice(idx, 1);
      this.rebuild();
    }
  }

  setClosed(closed) {
    this.isClosed = closed;
    this.rebuild();
  }

  // Evaluate Cubic Bézier spline at parameter t in [0, 1] between P1 and P2 using their Bézier handles
  static evalCubicBezier(p1, p2, t) {
    const b0x = p1.x;
    const b0y = p1.y;
    const b1x = p1.x + (p1.handleOut ? p1.handleOut.x : 0);
    const b1y = p1.y + (p1.handleOut ? p1.handleOut.y : 0);
    const b2x = p2.x + (p2.handleIn ? p2.handleIn.x : 0);
    const b2y = p2.y + (p2.handleIn ? p2.handleIn.y : 0);
    const b3x = p2.x;
    const b3y = p2.y;

    const u = 1 - t;
    const u2 = u * u;
    const u3 = u2 * u;
    const t2 = t * t;
    const t3 = t2 * t;

    const x = u3 * b0x + 3 * u2 * t * b1x + 3 * u * t2 * b2x + t3 * b3x;
    const y = u3 * b0y + 3 * u2 * t * b1y + 3 * u * t2 * b2y + t3 * b3y;

    // First derivative B'(t)
    const dx = 3 * u2 * (b1x - b0x) + 6 * u * t * (b2x - b1x) + 3 * t2 * (b3x - b2x);
    const dy = 3 * u2 * (b1y - b0y) + 6 * u * t * (b2y - b1y) + 3 * t2 * (b3y - b2y);

    // Second derivative B''(t) (for curvature)
    const ddx = 6 * u * (b2x - 2 * b1x + b0x) + 6 * t * (b3x - 2 * b2x + b1x);
    const ddy = 6 * u * (b2y - 2 * b1y + b0y) + 6 * t * (b3y - 2 * b2y + b1y);

    return { x, y, dx, dy, ddx, ddy };
  }

  // Recompute discretized arc-length sample table
  rebuild() {
    this.samples = [];
    this.totalLength = 0;

    this.updateAutoHandles();

    const n = this.nodes.length;
    if (n < 2) return;

    // Number of spline spans
    const spans = this.isClosed ? n : n - 1;
    const stepsPerSpan = 35; // high fidelity curve

    let currentDistance = 0;
    let prevPoint = null;

    for (let i = 0; i < spans; i++) {
      const p1 = this.nodes[i];
      const p2 = this.nodes[(i + 1) % n];
      const segmentType = p1.type || 'normal';

      for (let s = 0; s < stepsPerSpan; s++) {
        // Skip s = 0 on subsequent spans to avoid duplicate sample
        if (i > 0 && s === 0) continue;

        const t = s / stepsPerSpan;
        const pt = CoasterSpline.evalCubicBezier(p1, p2, t);

        const speed = Math.hypot(pt.dx, pt.dy) || 0.0001;
        const tx = pt.dx / speed;
        const ty = pt.dy / speed;
        // Normal vector (perpendicular to track tangent)
        const nx = -ty;
        const ny = tx;

        // Curvature kappa = (dx * ddy - dy * ddx) / speed^3
        const curvature = (pt.dx * pt.ddy - pt.dy * pt.ddx) / Math.pow(speed, 3);

        if (prevPoint) {
          const stepDist = Math.hypot(pt.x - prevPoint.x, pt.y - prevPoint.y);
          currentDistance += stepDist;
        }

        const sample = {
          x: pt.x,
          y: pt.y,
          distance: currentDistance,
          tangentX: tx,
          tangentY: ty,
          normalX: nx,
          normalY: ny,
          angle: Math.atan2(ty, tx),
          curvature: curvature,
          type: segmentType,
          nodeIndex: i
        };

        this.samples.push(sample);
        prevPoint = pt;
      }
    }

    // Add final endpoint for open track
    if (!this.isClosed && n >= 2) {
      const p1 = this.nodes[n - 2];
      const p2 = this.nodes[n - 1];
      const pt = CoasterSpline.evalCubicBezier(p1, p2, 1.0);
      const speed = Math.hypot(pt.dx, pt.dy) || 0.0001;
      const tx = pt.dx / speed;
      const ty = pt.dy / speed;

      if (prevPoint) {
        currentDistance += Math.hypot(pt.x - prevPoint.x, pt.y - prevPoint.y);
      }

      this.samples.push({
        x: pt.x,
        y: pt.y,
        distance: currentDistance,
        tangentX: tx,
        tangentY: ty,
        normalX: -ty,
        normalY: tx,
        angle: Math.atan2(ty, tx),
        curvature: 0,
        type: p2.type || 'normal',
        nodeIndex: n - 1
      });
    }

    this.totalLength = currentDistance;
    this.computeReverseAndCarAngles();
  }

  // Identify vertical loops vs reverse/return sections (tangentX < 0)
  // so cars drive backwards upright instead of flipping upside down
  computeReverseAndCarAngles() {
    const samples = this.samples;
    const n = samples.length;
    if (n === 0) return;

    for (let i = 0; i < n; i++) {
      samples[i].isReverse = false;
      samples[i].isLoop = false;
      samples[i].carAngle = samples[i].angle;
    }

    // Find contiguous runs where tangentX < 0 (moving right-to-left)
    const runs = [];
    let inRun = false;
    let start = 0;

    for (let i = 0; i < n; i++) {
      if (samples[i].tangentX < 0) {
        if (!inRun) {
          inRun = true;
          start = i;
        }
      } else {
        if (inRun) {
          runs.push({ start, end: i - 1 });
          inRun = false;
        }
      }
    }
    if (inRun) {
      runs.push({ start, end: n - 1 });
    }

    // Merge wrapped run across index 0 / n-1 on closed circuits
    if (
      this.isClosed &&
      runs.length >= 2 &&
      runs[0].start === 0 &&
      runs[runs.length - 1].end === n - 1
    ) {
      const first = runs.shift();
      const last = runs.pop();
      runs.push({ start: last.start, end: first.end, wrapped: true });
    }

    for (const run of runs) {
      const sPt = samples[run.start];
      const ePt = samples[run.end];
      let len = 0;
      let midIdx = 0;

      if (run.wrapped) {
        len = (this.totalLength - sPt.distance) + ePt.distance;
        const count = (n - run.start) + (run.end + 1);
        midIdx = (run.start + Math.floor(count / 2)) % n;
      } else {
        len = ePt.distance - sPt.distance;
        midIdx = Math.floor((run.start + run.end) / 2);
      }

      const midPt = samples[midIdx];

      // A vertical loop enters climbing steeply up, exits diving steeply down,
      // is compact in arc length, and its apex is higher than its entry/exit
      const isLoop = (
        sPt.tangentY < -0.35 &&
        ePt.tangentY > 0.35 &&
        len < 750 &&
        midPt.y < sPt.y &&
        midPt.y < ePt.y
      );

      if (run.wrapped) {
        for (let i = run.start; i < n; i++) {
          samples[i].isLoop = isLoop;
          samples[i].isReverse = !isLoop;
        }
        for (let i = 0; i <= run.end; i++) {
          samples[i].isLoop = isLoop;
          samples[i].isReverse = !isLoop;
        }
      } else {
        for (let i = run.start; i <= run.end; i++) {
          samples[i].isLoop = isLoop;
          samples[i].isReverse = !isLoop;
        }
      }
    }

    // Find turnaround transition points where isReverse switches
    const turnaroundIndices = [];
    for (let i = 0; i < n; i++) {
      if (!this.isClosed && i === 0) continue;
      const prev = samples[(i - 1 + n) % n];
      if (samples[i].isReverse !== prev.isReverse) {
        turnaroundIndices.push(i);
      }
    }

    const blendDist = 100; // smooth level-out distance around horizontal switchbacks
    for (let i = 0; i < n; i++) {
      const s = samples[i];
      if (s.isLoop) {
        s.carAngle = s.angle;
        continue;
      }

      // Upright car orientation (facing right, driving backwards when isReverse is true)
      const sign = s.isReverse ? -1 : 1;
      let ux = s.tangentX * sign;
      let uy = s.tangentY * sign;

      let minTurnDist = Infinity;
      for (const tIdx of turnaroundIndices) {
        let d = Math.abs(s.distance - samples[tIdx].distance);
        if (this.isClosed) {
          d = Math.min(d, this.totalLength - d);
        }
        if (d < minTurnDist) minTurnDist = d;
      }

      if (minTurnDist < blendDist) {
        const factor = minTurnDist / blendDist;
        const smooth = factor * factor * (3 - 2 * factor);
        uy *= smooth;
        ux = Math.max(ux, 0.25);
      }

      s.carAngle = Math.atan2(uy, Math.max(0.001, ux));
    }
  }

  // Query track properties by distance s
  getTrackPoint(s) {
    if (this.samples.length === 0) return null;
    if (this.samples.length === 1) return this.samples[0];

    // Handle wrapping for closed loops
    if (this.isClosed && this.totalLength > 0) {
      s = ((s % this.totalLength) + this.totalLength) % this.totalLength;
    } else {
      if (s <= 0) return this.samples[0];
      if (s >= this.totalLength) return this.samples[this.samples.length - 1];
    }

    // Binary search for interval
    let low = 0;
    let high = this.samples.length - 1;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (this.samples[mid].distance < s) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const idx1 = Math.max(0, low - 1);
    const idx2 = Math.min(this.samples.length - 1, low);

    if (idx1 === idx2) return this.samples[idx1];

    const s1 = this.samples[idx1];
    const s2 = this.samples[idx2];
    const segDist = s2.distance - s1.distance;
    const factor = segDist > 0.0001 ? (s - s1.distance) / segDist : 0;

    // Linear interpolation between the two adjacent high-density samples
    return {
      x: s1.x + (s2.x - s1.x) * factor,
      y: s1.y + (s2.y - s1.y) * factor,
      tangentX: s1.tangentX + (s2.tangentX - s1.tangentX) * factor,
      tangentY: s1.tangentY + (s2.tangentY - s1.tangentY) * factor,
      normalX: s1.normalX + (s2.normalX - s1.normalX) * factor,
      normalY: s1.normalY + (s2.normalY - s1.normalY) * factor,
      angle: s1.angle + this.angleDiff(s2.angle, s1.angle) * factor,
      carAngle: s1.carAngle + this.angleDiff(s2.carAngle, s1.carAngle) * factor,
      isReverse: factor < 0.5 ? s1.isReverse : s2.isReverse,
      isLoop: factor < 0.5 ? s1.isLoop : s2.isLoop,
      curvature: s1.curvature + (s2.curvature - s1.curvature) * factor,
      type: factor < 0.5 ? s1.type : s2.type,
      nodeIndex: factor < 0.5 ? s1.nodeIndex : s2.nodeIndex,
      distance: s
    };
  }

  angleDiff(a, b) {
    let diff = a - b;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }

  // Find closest node to (x, y) within a threshold radius
  findClosestNode(x, y, maxDistance = 25) {
    let closest = null;
    let minDist = maxDistance;

    for (const node of this.nodes) {
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist < minDist) {
        minDist = dist;
        closest = node;
      }
    }
    return closest;
  }

  // Find closest Bézier handle (handleIn or handleOut) to (x, y)
  findClosestHandle(x, y, maxDistance = 18) {
    let closest = null;
    let minDist = maxDistance;

    for (const node of this.nodes) {
      if (node.handleOut) {
        const ox = node.x + node.handleOut.x;
        const oy = node.y + node.handleOut.y;
        const dOut = Math.hypot(ox - x, oy - y);
        if (dOut < minDist) {
          minDist = dOut;
          closest = { node, which: 'out', x: ox, y: oy };
        }
      }
      if (node.handleIn) {
        const ix = node.x + node.handleIn.x;
        const iy = node.y + node.handleIn.y;
        const dIn = Math.hypot(ix - x, iy - y);
        if (dIn < minDist) {
          minDist = dIn;
          closest = { node, which: 'in', x: ix, y: iy };
        }
      }
    }
    return closest;
  }

  // Find closest track segment projection to insert a point in between
  findClosestSegment(x, y, maxDistance = 30) {
    if (this.samples.length < 2) return null;

    let bestDist = maxDistance;
    let bestSample = null;

    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i];
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bestDist) {
        bestDist = d;
        bestSample = s;
      }
    }

    if (!bestSample) return null;

    return {
      insertIndex: bestSample.nodeIndex + 1,
      x: bestSample.x,
      y: bestSample.y,
      distance: bestDist
    };
  }

  // Compute station platform geometry and staircase coordinates down to groundY
  getStationInfo(groundY = 750) {
    if (this.nodes.length < 2 || this.samples.length < 2) return null;

    const pStart = this.getTrackPoint(8) || this.samples[0];
    const pEnd = this.getTrackPoint(Math.min(this.totalLength * 0.35, 130)) || this.samples[Math.min(this.samples.length - 1, 10)];

    const minX = Math.min(pStart.x, pEnd.x) - 24;
    const maxX = Math.max(pStart.x, pEnd.x) + 24;
    const platW = Math.max(135, maxX - minX);
    const platX = (minX + maxX) * 0.5;
    const platY = Math.min(groundY, Math.max(pStart.y, pEnd.y) + 12);
    const isElevated = (groundY - platY) > 10;

    // Staircase attaches on the right side of the station platform and reaches down to groundY
    const stairTopX = platX + platW * 0.38;
    const stairTopY = platY;
    const heightDiff = Math.max(0, groundY - platY);
    const stairRun = isElevated ? Math.max(36, Math.min(240, heightDiff * 0.72)) : 0;
    const stairBottomX = stairTopX + stairRun;
    const stairBottomY = groundY;

    return {
      platX,
      platY,
      platW,
      minX: platX - platW * 0.5,
      maxX: platX + platW * 0.5,
      isElevated,
      stairTopX,
      stairTopY,
      stairBottomX,
      stairBottomY,
      heightDiff
    };
  }
}

window.CoasterSpline = CoasterSpline;

