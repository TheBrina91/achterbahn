/* CoasterCraft 2D - Canvas Renderer & Visual Effects */

class CoasterRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Camera
    this.camera = {
      x: 350,
      y: 450,
      zoom: 1.0,
      targetZoom: 1.0,
      mode: 'follow' // 'follow' | 'free' | 'ride'
    };

    // Environment theme: 'day' | 'sunset' | 'night'
    this.theme = 'day';

    // Particle system
    this.particles = [];

    // Background clouds
    this.clouds = [
      { x: 100, y: 120, scale: 1.2, speed: 8 },
      { x: 500, y: 160, scale: 0.8, speed: 6 },
      { x: 900, y: 100, scale: 1.5, speed: 11 },
      { x: 1400, y: 140, scale: 1.0, speed: 7 },
      { x: 1900, y: 110, scale: 1.3, speed: 9 }
    ];

    // Colors
    this.trackColor = '#e53935';       // vibrant coaster red
    this.railColor = '#b71c1c';        // dark rail outline
    this.supportColor = '#37474f';     // steel grey
    this.liftColor = '#fbc02d';        // yellow
    this.boostColor = '#00e676';       // neon green
    this.brakeColor = '#d50000';       // stop red

    this.groundY = 750; // ground level in world coordinates
    this.time = 0;
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  setTheme(theme) {
    this.theme = theme;
  }

  addSparks(x, y, count = 4, vx = 0, vy = 0) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: vx + (Math.random() - 0.5) * 120,
        vy: vy + (Math.random() - 0.5) * 80 - 40,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.6,
        color: Math.random() > 0.3 ? '#fff176' : '#ff9800',
        size: 2 + Math.random() * 2,
        gravity: 300
      });
    }
  }

  addWaterSplash(x, y, speed = 15, count = 8) {
    const colors = ['#ffffff', '#e1f5fe', '#81d4fa', '#29b6f6', '#0288d1'];
    const power = Math.min(Math.max(speed * 6, 65), 260);
    for (let i = 0; i < count; i++) {
      const spreadAngle = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.45;
      const spd = power * (0.45 + Math.random() * 0.75);
      this.particles.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(spreadAngle) * spd,
        vy: Math.sin(spreadAngle) * spd - 35,
        life: 0.45 + Math.random() * 0.45,
        maxLife: 0.9,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2.5 + Math.random() * 3.5,
        gravity: 340
      });
    }
  }

  addConfetti(x, y, count = 35) {
    const colors = ['#e91e63', '#9c27b0', '#2196f3', '#4caf50', '#ffeb3b', '#ff9800'];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 260,
        vy: -150 - Math.random() * 220,
        life: 1.5 + Math.random() * 1.0,
        maxLife: 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 4,
        gravity: 180,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 10
      });
    }
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      if (p.rotSpeed) p.rotation += p.rotSpeed * dt;
    }
  }

  updateCamera(physics, dt) {
    if (this.camera.mode === 'follow' || this.camera.mode === 'ride') {
      const leadCar = physics.cars[0];
      if (leadCar) {
        let targetX = leadCar.x;
        let targetY = leadCar.y;

        if (this.camera.mode === 'ride') {
          // Look slightly ahead of train in travel direction
          const forwardDist = 120;
          const travelAngle = leadCar.isReverse ? (leadCar.angle + Math.PI) : leadCar.angle;
          targetX += Math.cos(travelAngle) * forwardDist;
          targetY += Math.sin(travelAngle) * forwardDist;
          this.camera.targetZoom = 1.35;
        } else {
          // Dynamic zoom based on speed
          const speed = Math.abs(physics.velocity);
          this.camera.targetZoom = Math.max(0.7, 1.05 - (speed / 70));
        }

        const lerpFactor = this.camera.mode === 'ride' ? 0.14 : 0.08;
        this.camera.x += (targetX - this.camera.x) * lerpFactor;
        this.camera.y += (targetY - this.camera.y) * lerpFactor;
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * 0.05;
      }
    }
  }

  render(spline, physics, editorState, dt, allCoasters = null, visitors = null, entranceX = 2650) {
    this.time += dt;
    this.updateParticles(dt);
    this.updateCamera(physics, dt);

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Draw Sky & Parallax Scenery (Screen Space)
    this.renderSkyAndMountains(ctx, w, h);

    // 2. World Space Transformation
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    if (this.camera.mode === 'ride') {
      // Slight camera tilt following track banking
      const leadCar = physics.cars[0];
      if (leadCar) {
        const tilt = Math.sin(leadCar.angle) * 0.15;
        ctx.rotate(-tilt);
      }
    }

    ctx.translate(-this.camera.x, -this.camera.y);

    // Grid (in build mode)
    if (editorState.showGrid && editorState.mode === 'build') {
      this.renderGrid(ctx);
    }

    // 3. Ground & Environment in World Space
    this.renderGround(ctx);

    const coasterList = (Array.isArray(allCoasters) && allCoasters.length > 0)
      ? allCoasters
      : [{ name: 'Achterbahn', spline, physics }];

    // 4. Track Supports & Station Stairs/Platforms (Behind the track)
    for (const c of coasterList) {
      this.renderSupports(ctx, c.spline);
      this.renderStationAndStairs(ctx, c.spline, c.name, c.spline === spline);
    }

    // 5. Track Rails & Ties for all coasters
    for (const c of coasterList) {
      this.renderTrack(ctx, c.spline);
    }

    // 6. Right-side Park Entrance & Walking/Queuing Visitors
    if (entranceX) {
      this.renderParkEntrance(ctx, entranceX);
    }
    if (Array.isArray(visitors) && visitors.length > 0) {
      this.renderVisitors(ctx, visitors);
    }

    // 7. Trains & Passengers for all coasters
    for (const c of coasterList) {
      this.renderTrain(ctx, c.physics);
      this.renderStationRoof(ctx, c.spline, c.name, c.spline === spline);
    }

    // 8. Particles
    this.renderParticles(ctx);

    // 9. Editor Handles & Helpers (when in build mode)
    if (editorState.mode === 'build') {
      this.renderEditorOverlay(ctx, spline, editorState, coasterList);
    }

    ctx.restore();

    // 10. Speed Vignette & High-Speed FX
    this.renderSpeedEffects(ctx, physics, w, h);
  }

  renderSkyAndMountains(ctx, w, h) {
    let grad = ctx.createLinearGradient(0, 0, 0, h);
    if (this.theme === 'day') {
      grad.addColorStop(0, '#53a0fd');
      grad.addColorStop(0.65, '#92c5fc');
      grad.addColorStop(1, '#d8eaff');
    } else if (this.theme === 'sunset') {
      grad.addColorStop(0, '#2e1c4e');
      grad.addColorStop(0.4, '#a23982');
      grad.addColorStop(0.7, '#e65c00');
      grad.addColorStop(1, '#f9d423');
    } else { // night
      grad.addColorStop(0, '#060a17');
      grad.addColorStop(0.6, '#0f172a');
      grad.addColorStop(1, '#1e293b');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Sun / Moon
    ctx.save();
    if (this.theme === 'day') {
      ctx.fillStyle = '#fff59d';
      ctx.shadowColor = '#fff59d';
      ctx.shadowBlur = 40;
      ctx.beginPath();
      ctx.arc(w * 0.75, 120, 48, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.theme === 'sunset') {
      ctx.fillStyle = '#ff7043';
      ctx.shadowColor = '#ff5722';
      ctx.shadowBlur = 50;
      ctx.beginPath();
      ctx.arc(w * 0.8, h * 0.55, 65, 0, Math.PI * 2);
      ctx.fill();
    } else { // night moon
      ctx.fillStyle = '#e2e8f0';
      ctx.shadowColor = '#cbd5e1';
      ctx.shadowBlur = 25;
      ctx.beginPath();
      ctx.arc(w * 0.82, 100, 36, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Clouds with parallax
    ctx.fillStyle = this.theme === 'night' ? 'rgba(255, 255, 255, 0.08)' : (this.theme === 'sunset' ? 'rgba(255, 200, 200, 0.35)' : 'rgba(255, 255, 255, 0.75)');
    for (const cloud of this.clouds) {
      const cx = ((cloud.x + this.time * cloud.speed - this.camera.x * 0.08) % (w + 400)) - 200;
      const cy = cloud.y;
      this.drawPuffyCloud(ctx, cx, cy, cloud.scale);
    }

    // Parallax Mountains (Distant Layer)
    ctx.fillStyle = this.theme === 'night' ? '#111827' : (this.theme === 'sunset' ? '#4a154b' : '#7ba2c7');
    ctx.beginPath();
    ctx.moveTo(0, h);
    const mtnOffset = -this.camera.x * 0.12;
    for (let x = 0; x <= w + 100; x += 120) {
      const my = h * 0.62 + Math.sin((x + mtnOffset) * 0.003) * 60 + Math.cos((x + mtnOffset) * 0.006) * 40;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Middleground Hills
    ctx.fillStyle = this.theme === 'night' ? '#162238' : (this.theme === 'sunset' ? '#32103c' : '#5b8a68');
    ctx.beginPath();
    ctx.moveTo(0, h);
    const hillOffset = -this.camera.x * 0.25;
    for (let x = 0; x <= w + 80; x += 80) {
      const hy = h * 0.76 + Math.sin((x + hillOffset) * 0.005) * 45;
      ctx.lineTo(x, hy);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  drawPuffyCloud(ctx, x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.arc(0, 0, 25, 0, Math.PI * 2);
    ctx.arc(22, -10, 20, 0, Math.PI * 2);
    ctx.arc(44, 0, 24, 0, Math.PI * 2);
    ctx.arc(22, 12, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  renderGrid(ctx) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;

    const gridSize = 50;
    const left = this.camera.x - (this.canvas.width / this.camera.zoom) * 0.6;
    const right = this.camera.x + (this.canvas.width / this.camera.zoom) * 0.6;
    const top = this.camera.y - (this.canvas.height / this.camera.zoom) * 0.6;
    const bottom = this.camera.y + (this.canvas.height / this.camera.zoom) * 0.6;

    const startX = Math.floor(left / gridSize) * gridSize;
    const endX = Math.ceil(right / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;
    const endY = Math.ceil(bottom / gridSize) * gridSize;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();
  }

  renderGround(ctx) {
    const groundY = this.groundY;
    const left = this.camera.x - 3000;
    const right = this.camera.x + 3000;

    // Grass terrain
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, groundY + 800);
    if (this.theme === 'night') {
      groundGrad.addColorStop(0, '#1a3320');
      groundGrad.addColorStop(0.1, '#0f1f14');
      groundGrad.addColorStop(1, '#080f0a');
    } else {
      groundGrad.addColorStop(0, '#43a047');
      groundGrad.addColorStop(0.06, '#2e7d32');
      groundGrad.addColorStop(0.2, '#1b5e20');
      groundGrad.addColorStop(1, '#3e2723');
    }

    ctx.fillStyle = groundGrad;
    ctx.fillRect(left, groundY, right - left, 1200);

    // Decorative grass blade fringe
    ctx.fillStyle = this.theme === 'night' ? '#2e4c34' : '#66bb6a';
    ctx.beginPath();
    ctx.moveTo(left, groundY);
    for (let x = left; x <= right; x += 15) {
      ctx.lineTo(x + 7, groundY - 5);
      ctx.lineTo(x + 15, groundY);
    }
    ctx.fill();
  }

  renderSupports(ctx, spline) {
    if (spline.samples.length < 2) return;

    const isWater = spline.rideType === 'water';
    ctx.save();
    ctx.strokeStyle = isWater ? '#5d4037' : this.supportColor;
    ctx.lineWidth = isWater ? 5 : 4;
    ctx.fillStyle = isWater ? '#4e342e' : '#78909c';

    // Place a support pillar every ~80 pixels along the track
    const supportSpacing = 85;
    let distCounter = 0;

    for (let i = 0; i < spline.samples.length; i++) {
      const s = spline.samples[i];
      if (s.type === 'gap') {
        distCounter = 0;
        continue;
      }
      if (i > 0) {
        distCounter += Math.hypot(s.x - spline.samples[i-1].x, s.y - spline.samples[i-1].y);
      }

      if (distCounter >= supportSpacing || i === 0 || i === spline.samples.length - 1) {
        distCounter = 0;

        // Skip support if track is too close to ground or below ground
        if (s.y < this.groundY - 15) {
          // Main vertical column down to ground
          ctx.beginPath();
          ctx.moveTo(s.x, s.y + 10);
          ctx.lineTo(s.x, this.groundY);
          ctx.stroke();

          // Cross diagonal braces for taller supports
          const height = this.groundY - s.y;
          if (height > 120) {
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(s.x - 12, s.y + 35);
            ctx.lineTo(s.x + 12, this.groundY - 10);
            ctx.moveTo(s.x + 12, s.y + 35);
            ctx.lineTo(s.x - 12, this.groundY - 10);
            ctx.stroke();
            ctx.lineWidth = 4;
          }

          // Concrete footer at ground level
          ctx.fillRect(s.x - 9, this.groundY - 8, 18, 10);
          ctx.strokeRect(s.x - 9, this.groundY - 8, 18, 10);
        }
      }
    }

    ctx.restore();
  }

  renderStationAndStairs(ctx, spline, coasterName = 'Achterbahn', isActive = false) {
    if (!spline || spline.nodes.length < 2) return;
    const st = spline.getStationInfo(this.groundY);
    if (!st) return;

    ctx.save();

    // 1. If station is elevated above ground, draw steel support columns & staircase down to groundY
    if (st.isElevated) {
      ctx.strokeStyle = '#455a64';
      ctx.lineWidth = 6;
      const leftColX = st.minX + 16;
      const rightColX = st.maxX - 16;

      // Vertical station pillars
      ctx.beginPath();
      ctx.moveTo(leftColX, st.platY + 8);
      ctx.lineTo(leftColX, this.groundY);
      ctx.moveTo(rightColX, st.platY + 8);
      ctx.lineTo(rightColX, this.groundY);
      ctx.stroke();

      // Diagonal staircase stringer from (stairTopX, stairTopY) to (stairBottomX, stairBottomY)
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(st.stairTopX, st.stairTopY + 4);
      ctx.lineTo(st.stairBottomX, st.stairBottomY);
      ctx.stroke();

      // Individual stair steps
      const numSteps = Math.max(4, Math.floor(st.heightDiff / 9));
      ctx.strokeStyle = '#cfd8dc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const sx = st.stairTopX + (st.stairBottomX - st.stairTopX) * t;
        const sy = st.stairTopY + (st.stairBottomY - st.stairTopY) * t;
        ctx.moveTo(sx - 5, sy);
        ctx.lineTo(sx + 5, sy);
      }
      ctx.stroke();

      // Staircase safety handrail & posts
      ctx.strokeStyle = '#ffca28';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(st.stairTopX, st.stairTopY - 18);
      ctx.lineTo(st.stairBottomX, st.stairBottomY - 18);
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        const px = st.stairTopX + (st.stairBottomX - st.stairTopX) * t;
        const py = st.stairTopY + (st.stairBottomY - st.stairTopY) * t;
        ctx.moveTo(px, py);
        ctx.lineTo(px, py - 18);
      }
      ctx.stroke();
    }

    // 2. Station Platform deck (behind/under track)
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = isActive ? '#38bdf8' : '#1e293b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(st.minX, st.platY, st.platW, 12, 4);
    ctx.fill();
    ctx.stroke();

    // Yellow safety line along platform edge
    ctx.fillStyle = '#facc15';
    ctx.fillRect(st.minX + 4, st.platY + 1, st.platW - 8, 3);

    // Back wall / canopy support posts
    const roofY = st.platY - 56;
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(st.minX + 12, st.platY);
    ctx.lineTo(st.minX + 12, roofY);
    ctx.moveTo(st.maxX - 12, st.platY);
    ctx.lineTo(st.maxX - 12, roofY);
    ctx.stroke();

    ctx.restore();
  }

  renderStationRoof(ctx, spline, coasterName = 'Achterbahn', isActive = false) {
    if (!spline || spline.nodes.length < 2) return;
    const st = spline.getStationInfo(this.groundY);
    if (!st) return;

    ctx.save();
    const roofY = st.platY - 56;

    // Platform safety gates in front
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(st.minX + 6, st.platY - 12);
    ctx.lineTo(st.maxX - 6, st.platY - 12);
    for (let gx = st.minX + 10; gx <= st.maxX - 10; gx += 18) {
      ctx.moveTo(gx, st.platY);
      ctx.lineTo(gx, st.platY - 12);
    }
    ctx.stroke();

    // Station canopy roof
    const roofGrad = ctx.createLinearGradient(st.minX, roofY - 16, st.minX, roofY + 6);
    roofGrad.addColorStop(0, isActive ? '#0284c7' : '#334155');
    roofGrad.addColorStop(1, isActive ? '#0369a1' : '#1e293b');
    ctx.fillStyle = roofGrad;
    ctx.strokeStyle = isActive ? '#38bdf8' : '#475569';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(st.minX - 10, roofY + 4);
    ctx.lineTo(st.minX + 8, roofY - 14);
    ctx.lineTo(st.maxX - 8, roofY - 14);
    ctx.lineTo(st.maxX + 10, roofY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Coaster Name Sign on Station Roof
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = (coasterName || 'Station').slice(0, 24);
    ctx.fillText('🚉 ' + label, st.platX, roofY - 5);

    ctx.restore();
  }

  renderParkEntrance(ctx, entranceX) {
    const gy = this.groundY;
    ctx.save();

    // Paved cobblestone park walkway from entrance leftward
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.fillRect(-400, gy - 4, entranceX + 520, 6);

    ctx.translate(entranceX, gy);

    // Left & Right Entrance Towers
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.fillRect(-62, -120, 24, 120);
    ctx.strokeRect(-62, -120, 24, 120);
    ctx.fillRect(38, -120, 24, 120);
    ctx.strokeRect(38, -120, 24, 120);

    // Conical tower roofs
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.moveTo(-68, -120);
    ctx.lineTo(-50, -155);
    ctx.lineTo(-32, -120);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(32, -120);
    ctx.lineTo(50, -155);
    ctx.lineTo(68, -120);
    ctx.closePath();
    ctx.fill();

    // Ticket booth next to gate
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.fillRect(66, -65, 46, 65);
    ctx.strokeRect(66, -65, 46, 65);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(74, -50, 30, 22);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 8px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KASSE', 89, -56);

    // Overhead Arch Banner
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-72, -128, 144, 34, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 12px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎡 PARK-EINGANG 🎢', 0, -111);

    // Direction arrow pointing left into the park
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px Outfit, sans-serif';
    ctx.fillText('⬅ BESUCHER', 0, -82);

    ctx.restore();
  }

  renderVisitors(ctx, visitors) {
    for (const v of visitors) {
      if (v.state === 'riding') continue; // Rendered inside the coaster car!

      ctx.save();
      const bob = (v.state === 'walking' || v.state === 'climbing_stairs' || v.state === 'descending_stairs')
        ? Math.abs(Math.sin(v.walkPhase)) * 2.5
        : 0;
      ctx.translate(v.x, v.y - bob);

      // Shadow on ground/platform
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, bob, 5, 2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Legs
      const legSwing = (v.state === 'walking' || v.state === 'climbing_stairs' || v.state === 'descending_stairs')
        ? Math.sin(v.walkPhase) * 4
        : 0;
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-2, -8);
      ctx.lineTo(-2 - legSwing, 0);
      ctx.moveTo(2, -8);
      ctx.lineTo(2 + legSwing, 0);
      ctx.stroke();

      // Torso / Shirt
      ctx.fillStyle = v.shirtColor;
      ctx.beginPath();
      ctx.roundRect(-4.5, -18, 9, 10, 3);
      ctx.fill();

      // Arms (raised if cheering after a ride!)
      ctx.strokeStyle = v.shirtColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      if (v.excitedTimer > 0) {
        ctx.moveTo(-4, -15);
        ctx.lineTo(-8, -24);
        ctx.moveTo(4, -15);
        ctx.lineTo(8, -24);
      } else {
        ctx.moveTo(-4, -15);
        ctx.lineTo(-6, -9);
        ctx.moveTo(4, -15);
        ctx.lineTo(6, -9);
      }
      ctx.stroke();

      // Head
      ctx.fillStyle = '#ffe0b2';
      ctx.beginPath();
      ctx.arc(0, -22, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Hair
      ctx.fillStyle = v.hairColor;
      ctx.beginPath();
      ctx.arc(0, -23.5, 4.6, Math.PI, Math.PI * 2);
      ctx.fill();

      // Thought / Excitement bubble
      if (v.moodIcon && v.moodTimer > 0) {
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(v.moodIcon, 0, -32);
      }

      ctx.restore();
    }
  }

  renderTrack(ctx, spline) {
    if (spline.samples.length < 2) return;

    if (spline.rideType === 'water') {
      this.renderWaterTrack(ctx, spline);
      return;
    }

    const samples = spline.samples;
    const railOffset = 9.0; // half track width in px

    // 0. Draw dashed jump guide across 'gap' sections (stunt ramps)
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 171, 0, 0.55)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    let inGap = false;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (s.type === 'gap') {
        if (!inGap) {
          ctx.moveTo(s.x, s.y);
          inGap = true;
        } else {
          ctx.lineTo(s.x, s.y);
        }
      } else if (inGap) {
        ctx.lineTo(s.x, s.y);
        inGap = false;
      }
    }
    ctx.stroke();
    ctx.restore();

    // 1. Draw Spine Beam (thick lower beam, skipping 'gap' spans)
    ctx.save();
    ctx.beginPath();
    let penDown = false;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (s.type === 'gap') {
        penDown = false;
        continue;
      }
      if (!penDown) {
        ctx.moveTo(s.x, s.y + 4);
        penDown = true;
      } else {
        ctx.lineTo(s.x, s.y + 4);
      }
    }
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    ctx.beginPath();
    penDown = false;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (s.type === 'gap') {
        penDown = false;
        continue;
      }
      if (!penDown) {
        ctx.moveTo(s.x, s.y + 3);
        penDown = true;
      } else {
        ctx.lineTo(s.x, s.y + 3);
      }
    }
    ctx.strokeStyle = '#455a64';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // 2. Cross-ties (sleepers connecting spine to rails)
    ctx.save();
    const tieSpacing = 16; // px between cross-ties
    let distCounter = 0;

    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      if (s.type === 'gap') {
        distCounter = 0;
        continue;
      }
      if (i > 0) {
        distCounter += Math.hypot(s.x - samples[i-1].x, s.y - samples[i-1].y);
      }

      if (distCounter >= tieSpacing || i === 0) {
        distCounter = 0;

        const leftX = s.x + s.normalX * railOffset;
        const leftY = s.y + s.normalY * railOffset;
        const rightX = s.x - s.normalX * railOffset;
        const rightY = s.y - s.normalY * railOffset;

        // Color sleeper based on track segment type
        if (s.type === 'lift') {
          ctx.strokeStyle = '#fbc02d'; // yellow chain ties
          ctx.lineWidth = 3.5;
        } else if (s.type === 'boost') {
          ctx.strokeStyle = '#00e676'; // neon green launch stator
          ctx.lineWidth = 4;
        } else if (s.type === 'maglev') {
          ctx.strokeStyle = '#d500f9'; // glowing purple maglev coils
          ctx.lineWidth = 4.5;
        } else if (s.type === 'brake') {
          ctx.strokeStyle = '#d50000'; // red brake fin
          ctx.lineWidth = 4;
        } else {
          ctx.strokeStyle = '#263238';
          ctx.lineWidth = 3;
        }

        ctx.beginPath();
        ctx.moveTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.stroke();

        // Chain lift gear teeth or Maglev stator core in center
        if (s.type === 'lift') {
          ctx.fillStyle = '#37474f';
          ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
        } else if (s.type === 'maglev') {
          ctx.fillStyle = '#00e5ff';
          ctx.beginPath();
          ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    // 3. Dual Tubular Rails (Left rail & Right rail)
    this.drawSingleRail(ctx, samples, spline.isClosed, railOffset, this.trackColor);
    this.drawSingleRail(ctx, samples, spline.isClosed, -railOffset, this.trackColor);
  }

  renderWaterTrack(ctx, spline) {
    const samples = spline.samples;
    if (samples.length < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 1. Outer fiberglass/wooden flume shell
    ctx.beginPath();
    ctx.moveTo(samples[0].x, samples[0].y + 2);
    for (let i = 1; i < samples.length; i++) {
      ctx.lineTo(samples[i].x, samples[i].y + 2);
    }
    ctx.strokeStyle = '#01579b';
    ctx.lineWidth = 22;
    ctx.stroke();

    // Rim highlight (upper lip of trough)
    ctx.strokeStyle = '#4fc3f7';
    ctx.lineWidth = 18;
    ctx.stroke();

    // 2. Flowing water channel inside trough
    ctx.beginPath();
    ctx.moveTo(samples[0].x, samples[0].y + 1);
    for (let i = 1; i < samples.length; i++) {
      ctx.lineTo(samples[i].x, samples[i].y + 1);
    }
    ctx.strokeStyle = '#0288d1';
    ctx.lineWidth = 13;
    ctx.stroke();

    // 3. Segment-specific features: Chain Lift ('lift') vs Water Brake Splash Basin ('brake')
    let distCounter = 0;
    for (let i = 1; i < samples.length; i++) {
      const s0 = samples[i - 1];
      const s = samples[i];
      const segLen = Math.hypot(s.x - s0.x, s.y - s0.y);
      distCounter += segLen;

      if (s.type === 'brake') {
        // Wide Splashdown Water Brake Basin with white foam & high splash guards
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(s0.x, s0.y + 1);
        ctx.lineTo(s.x, s.y + 1);
        ctx.strokeStyle = '#00b0ff';
        ctx.lineWidth = 26;
        ctx.stroke();

        ctx.strokeStyle = 'rgba(225, 245, 254, 0.85)';
        ctx.lineWidth = 14;
        ctx.stroke();
        ctx.restore();
      }

      if (distCounter >= 16) {
        distCounter = 0;
        if (s.type === 'lift') {
          // Yellow chain lift conveyor cleats inside the flume
          const leftX = s.x + s.normalX * 7;
          const leftY = s.y + s.normalY * 7;
          const rightX = s.x - s.normalX * 7;
          const rightY = s.y - s.normalY * 7;
          ctx.strokeStyle = '#fbc02d';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(leftX, leftY);
          ctx.lineTo(rightX, rightY);
          ctx.stroke();
        } else if (s.type === 'brake') {
          // Animated white water brake nozzles / foam ripples
          const wave = Math.sin(this.animTime * 8 + i * 0.7) * 4;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          ctx.beginPath();
          ctx.arc(s.x + s.normalX * wave, s.y + s.normalY * wave, 3.2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Subtle flowing water current streaks
          const flowOffset = ((this.animTime * 40 + i * 6) % 14) - 7;
          ctx.strokeStyle = 'rgba(225, 245, 254, 0.55)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(s.x - s.tangentX * 4 + s.normalX * (flowOffset * 0.4), s.y - s.tangentY * 4 + s.normalY * (flowOffset * 0.4));
          ctx.lineTo(s.x + s.tangentX * 4 + s.normalX * (flowOffset * 0.4), s.y + s.tangentY * 4 + s.normalY * (flowOffset * 0.4));
          ctx.stroke();
        }
      }
    }

    ctx.restore();
  }

  drawSingleRail(ctx, samples, isClosed, offset, color) {
    ctx.save();
    ctx.beginPath();
    let penDown = false;

    for (let i = 0; i < samples.length; i++) {
      const p = samples[i];
      if (p.type === 'gap') {
        penDown = false;
        continue;
      }
      const rx = p.x + p.normalX * offset;
      const ry = p.y + p.normalY * offset;
      if (!penDown) {
        ctx.moveTo(rx, ry);
        penDown = true;
      } else {
        ctx.lineTo(rx, ry);
      }
    }

    // Rail outline
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Rail core highlight
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.restore();
  }

  renderTrain(ctx, physics) {
    if (physics.cars.length === 0) return;

    // Draw couplers connecting adjacent cars
    if (!physics.isDerailed && physics.cars.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#37474f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let i = 0; i < physics.cars.length - 1; i++) {
        ctx.moveTo(physics.cars[i].x, physics.cars[i].y - 4);
        ctx.lineTo(physics.cars[i + 1].x, physics.cars[i + 1].y - 4);
      }
      ctx.stroke();
      ctx.restore();
    }

    for (let i = physics.cars.length - 1; i >= 0; i--) {
      const car = physics.cars[i];
      // When driving backwards (isReverse), the rightmost car has the front nose
      const isLead = car.isReverse ? (i === physics.cars.length - 1) : (i === 0);
      this.renderCar(ctx, car, isLead, physics);
    }
  }

  renderCar(ctx, car, isLead, physics) {
    const isWater = physics && physics.spline && physics.spline.rideType === 'water';

    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    const halfW = car.lengthPx * 0.48;
    const carH = 16;

    if (isWater) {
      // Wooden Log Flume Boat (Baumstamm-Boot)
      const logGrad = ctx.createLinearGradient(0, -carH, 0, 7);
      logGrad.addColorStop(0, '#8d6e63');
      logGrad.addColorStop(0.45, '#5d4037');
      logGrad.addColorStop(1, '#3e2723');

      ctx.fillStyle = logGrad;
      ctx.strokeStyle = '#271c19';
      ctx.lineWidth = 2;

      // Boat hull with rounded log front nose
      ctx.beginPath();
      ctx.moveTo(-halfW * 1.05, -carH * 0.65);
      ctx.lineTo(halfW * 0.75, -carH * 0.75);
      ctx.quadraticCurveTo(halfW * 1.28, -carH * 0.15, halfW * 0.95, 6);
      ctx.lineTo(-halfW * 0.98, 6);
      ctx.quadraticCurveTo(-halfW * 1.15, 0, -halfW * 1.05, -carH * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner hollowed-out light wood rim
      ctx.strokeStyle = '#d7ccc8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-halfW * 0.88, -carH * 0.65);
      ctx.lineTo(halfW * 0.65, -carH * 0.7);
      ctx.stroke();

      // Bark grain lines
      ctx.strokeStyle = 'rgba(39, 28, 25, 0.55)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-halfW * 0.85, -3);
      ctx.lineTo(halfW * 0.75, -3);
      ctx.moveTo(-halfW * 0.7, 2);
      ctx.lineTo(halfW * 0.6, 2);
      ctx.stroke();

      // Waterline foam ripple along the hull bottom
      ctx.strokeStyle = 'rgba(225, 245, 254, 0.85)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-halfW * 0.95, 5);
      ctx.quadraticCurveTo(0, 3 + Math.sin(this.animTime * 10) * 1.5, halfW * 1.02, 5);
      ctx.stroke();

      if (!car.isDerailed) {
        this.renderPassengers(ctx, car, physics);
      }

      ctx.restore();
      return;
    }

    // 1. Wheel Bogies (under car)
    ctx.fillStyle = '#212121';
    ctx.strokeStyle = '#757575';
    ctx.lineWidth = 1.5;

    // Front & rear wheels
    [-halfW * 0.75, halfW * 0.75].forEach(wx => {
      // Top rail wheels
      ctx.beginPath();
      ctx.arc(wx, 5, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Side friction wheel
      ctx.beginPath();
      ctx.arc(wx, 9, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Car Chassis Body
    const carGrad = ctx.createLinearGradient(0, -carH, 0, 4);
    if (isLead) {
      carGrad.addColorStop(0, '#f57c00');
      carGrad.addColorStop(0.4, '#e65100');
      carGrad.addColorStop(1, '#bf360c');
    } else {
      carGrad.addColorStop(0, '#1976d2');
      carGrad.addColorStop(0.4, '#0d47a1');
      carGrad.addColorStop(1, '#0a2756');
    }

    ctx.fillStyle = carGrad;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    ctx.beginPath();
    if (isLead) {
      // Aerodynamic bullet nose on lead car
      ctx.moveTo(-halfW, -carH * 0.7);
      ctx.lineTo(halfW * 0.5, -carH * 0.9);
      ctx.quadraticCurveTo(halfW * 1.15, -carH * 0.3, halfW * 0.9, 3);
      ctx.lineTo(-halfW, 3);
      ctx.closePath();
    } else {
      // Boxy passenger coach
      ctx.roundRect(-halfW, -carH * 0.8, halfW * 2, carH * 0.95, [4, 4, 2, 2]);
    }
    ctx.fill();
    ctx.stroke();

    // Metallic side highlight & chrome bar
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-halfW * 0.9, -carH * 0.35);
    ctx.lineTo(halfW * 0.8, -carH * 0.35);
    ctx.stroke();

    // Headlight on lead car
    if (isLead) {
      ctx.fillStyle = '#fff9c4';
      ctx.shadowColor = '#fff59d';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(halfW * 0.85, -carH * 0.3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 3. Passenger Figures
    if (!car.isDerailed) {
      this.renderPassengers(ctx, car, physics);
    }

    ctx.restore();
  }

  renderPassengers(ctx, car, physics) {
    const p1 = car.passengers[0];
    const p2 = car.passengers[1];

    // Determine travel direction in local car space (+1 = facing right, -1 = facing left)
    const baseDir = car.isReverse ? -1 : 1;
    const velDir = physics.velocity < -0.1 ? -1 : 1;
    const travelDir = baseDir * velDir;

    [ { p: p1, x: -8 }, { p: p2, x: 8 } ].forEach(({ p, x }) => {
      if (!p || p.occupied === false) return;
      ctx.save();
      ctx.translate(x, -16);
      // Turn passenger to face the travel direction of the roller coaster
      ctx.scale(travelDir, 1);

      // Shirt / Body
      ctx.fillStyle = p.shirtColor;
      ctx.beginPath();
      ctx.roundRect(-5, 0, 10, 8, [3, 3, 0, 0]);
      ctx.fill();

      // Arms (Up in air or holding lap bar in front)
      ctx.strokeStyle = p.shirtColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (p.handsUp) {
        // Hands waving high!
        ctx.moveTo(-3, 4);
        ctx.lineTo(-6, -9);
        ctx.moveTo(3, 4);
        ctx.lineTo(8, -9);
      } else {
        // Hands holding safety lap bar in front (+x)
        ctx.moveTo(2, 4);
        ctx.lineTo(6, 7);
      }
      ctx.stroke();

      // Head
      ctx.fillStyle = '#ffe0b2'; // skin tone
      ctx.beginPath();
      ctx.arc(0, -6, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Small nose pointing in travel direction (+x)
      ctx.beginPath();
      ctx.arc(5.5, -5.5, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Hair (swept back towards -x)
      ctx.fillStyle = p.hairColor;
      ctx.beginPath();
      ctx.arc(-0.5, -7.8, 5.6, Math.PI * 0.85, Math.PI * 1.95);
      ctx.fill();

      // Eyes & Expressions facing travel direction (+x)
      ctx.fillStyle = '#212121';
      const speedKmH = Math.abs(physics.velocity) * 3.6;

      if (physics.currentG < 0.2 || speedKmH > 75) {
        // Thrilled open mouth "O" / Screaming
        ctx.beginPath();
        ctx.arc(2.2, -6.3, 1.3, 0, Math.PI * 2); // eye
        ctx.fill();
        ctx.fillStyle = '#d32f2f';
        ctx.beginPath();
        ctx.arc(2.8, -3.5, 1.9, 0, Math.PI * 2); // scream mouth
        ctx.fill();
      } else if (physics.currentG > 3.2) {
        // Squished G-force eyes
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(1.2, -6.3);
        ctx.lineTo(3.5, -5.2);
        ctx.stroke();
      } else {
        // Normal happy smile looking forward
        ctx.beginPath();
        ctx.arc(2.2, -6.3, 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.arc(2.0, -4.2, 2.0, 0.15, Math.PI * 0.85);
        ctx.stroke();
      }

      ctx.restore();
    });

    // Safety Lap Bar over legs
    ctx.strokeStyle = '#ffeb3b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-16, -6);
    ctx.lineTo(16, -6);
    ctx.stroke();
  }

  renderParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rotation) ctx.rotate(p.rotation);

      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      ctx.beginPath();
      ctx.arc(0, 0, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1.0;
  }

  renderEditorOverlay(ctx, spline, editorState, coasterList = null) {
    // Draw clickable nodes of other non-active coasters in the park so clicking them selects that coaster
    if (Array.isArray(coasterList) && coasterList.length > 1) {
      for (const c of coasterList) {
        if (!c.spline || c.spline === spline) continue;
        for (let i = 0; i < c.spline.nodes.length; i++) {
          const n = c.spline.nodes[i];
          ctx.save();
          ctx.translate(n.x, n.y);
          ctx.fillStyle = 'rgba(100, 116, 139, 0.75)';
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 0a. Draw Freehand Sketch Path if present
    if (editorState.freehandPoints && editorState.freehandPoints.length > 0) {
      const pts = editorState.freehandPoints;
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.92)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();

      // Inner dashed core
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw preview sample dots along the sketch every ~125px
      let accum = 0;
      for (let i = 0; i < pts.length; i++) {
        if (i > 0) {
          accum += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        if (i === 0 || i === pts.length - 1 || accum >= 120) {
          if (accum >= 120) accum = 0;
          ctx.fillStyle = i === 0 ? '#00e676' : (i === pts.length - 1 ? '#ffab00' : '#38bdf8');
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pts[i].x, pts[i].y, i === 0 || i === pts.length - 1 ? 8 : 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 0b. Draw Ghost Preview when placing a coaster onto the map
    if (editorState.placingCoaster && editorState.mouseWorld) {
      const cNodes = editorState.placingCoaster.nodes;
      if (cNodes && cNodes.length > 0) {
        const anchorX = cNodes[0].x;
        const anchorY = cNodes[0].y;
        const dx = editorState.mouseWorld.x - anchorX;
        const dy = Math.min(735, editorState.mouseWorld.y) - anchorY;

        ctx.save();
        ctx.strokeStyle = 'rgba(0, 230, 118, 0.85)';
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
        ctx.shadowColor = '#00e676';
        ctx.shadowBlur = 14;

        ctx.beginPath();
        for (let i = 0; i < cNodes.length; i++) {
          const nx = cNodes[i].x + dx;
          const ny = Math.min(735, cNodes[i].y + dy);
          if (i === 0) ctx.moveTo(nx, ny);
          else ctx.lineTo(nx, ny);
        }
        if (editorState.placingCoaster.isClosed && cNodes.length > 2) {
          ctx.closePath();
        }
        ctx.stroke();
        ctx.setLineDash([]);

        for (let i = 0; i < cNodes.length; i++) {
          const nx = cNodes[i].x + dx;
          const ny = Math.min(735, cNodes[i].y + dy);
          ctx.fillStyle = i === 0 ? '#00e676' : '#38bdf8';
          ctx.beginPath();
          ctx.arc(nx, ny, i === 0 ? 8 : 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    // 1. Draw segment insertion preview if hovering near track
    if (editorState.hoverSegment && editorState.tool === 'add') {
      ctx.save();
      ctx.strokeStyle = '#29b6f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(editorState.hoverSegment.x, editorState.hoverSegment.y, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Draw Bézier Handles & Track Nodes
    for (let i = 0; i < spline.nodes.length; i++) {
      const node = spline.nodes[i];
      const isSelected = (editorState.selectedNode && editorState.selectedNode.id === node.id);
      const isHovered = (editorState.hoverNode && editorState.hoverNode.id === node.id);
      const isHandleHovered = (editorState.hoverHandle && editorState.hoverHandle.node.id === node.id);

      // Draw Bézier handle stems and grips
      if (node.handleIn && node.handleOut) {
        ctx.save();
        ctx.translate(node.x, node.y);

        const activeHandle = isSelected || isHovered || isHandleHovered;
        ctx.strokeStyle = activeHandle ? 'rgba(0, 229, 255, 0.9)' : 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = activeHandle ? 2 : 1.2;

        // Stem line from handleIn through node to handleOut
        ctx.beginPath();
        ctx.moveTo(node.handleIn.x, node.handleIn.y);
        ctx.lineTo(0, 0);
        ctx.lineTo(node.handleOut.x, node.handleOut.y);
        ctx.stroke();

        // Draw handleIn knob
        const inHover = isHandleHovered && editorState.hoverHandle.which === 'in';
        const rIn = inHover ? 7 : (activeHandle ? 5.5 : 4);
        ctx.fillStyle = inHover ? '#ffffff' : '#ffab00';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(node.handleIn.x, node.handleIn.y, rIn, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Draw handleOut knob
        const outHover = isHandleHovered && editorState.hoverHandle.which === 'out';
        const rOut = outHover ? 7 : (activeHandle ? 5.5 : 4);
        ctx.fillStyle = outHover ? '#ffffff' : '#00e5ff';
        ctx.beginPath();
        ctx.arc(node.handleOut.x, node.handleOut.y, rOut, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      }

      ctx.save();
      ctx.translate(node.x, node.y);

      // Node ring color by type
      let fillColor = '#0288d1';
      let symbol = '';

      if (node.type === 'lift') {
        fillColor = '#fbc02d';
        symbol = '⛓';
      } else if (node.type === 'boost') {
        fillColor = '#00e676';
        symbol = '⚡';
      } else if (node.type === 'maglev') {
        fillColor = '#aa00ff';
        symbol = '🧲';
      } else if (node.type === 'gap') {
        fillColor = '#ff6d00';
        symbol = '🚀';
      } else if (node.type === 'brake') {
        if (spline.rideType === 'water') {
          fillColor = '#00b0ff';
          symbol = '💦';
        } else {
          fillColor = '#e53935';
          symbol = '🛑';
        }
      }

      // Outer glow & ring if selected
      if (isSelected) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 18;
      }

      // Node circle
      const radius = isSelected ? 12 : (isHovered ? 11 : 9);
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(0,0,0,0.6)';
      ctx.lineWidth = isSelected ? 3 : 2;

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Node index number or symbol
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (symbol) {
        ctx.fillText(symbol, 0, 0);
      } else {
        ctx.fillText(i + 1, 0, 0);
      }

      ctx.restore();
    }
  }

  renderSpeedEffects(ctx, physics, w, h) {
    const speedKmH = Math.abs(physics.velocity) * 3.6;
    if (speedKmH > 65) {
      // Speed lines & vignette
      const intensity = Math.min((speedKmH - 65) / 60, 1.0);
      const radGrad = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, Math.hypot(w, h) / 2);
      radGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      radGrad.addColorStop(1, `rgba(0, 0, 0, ${0.45 * intensity})`);
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // Render a 2D miniature preview of a coaster onto a thumbnail canvas inside the Coaster Browser
  static renderMiniPreview(canvas, coasterData) {
    if (!canvas || !coasterData || !Array.isArray(coasterData.nodes) || coasterData.nodes.length === 0) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background sky + ground strip
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.85, '#1e293b');
    bg.addColorStop(0.86, '#1b5e20');
    bg.addColorStop(1, '#14532d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Build a temporary spline for accurate curve preview
    const isWater = coasterData.rideType === 'water';
    const tempSpline = new CoasterSpline(isWater ? 'water' : 'steel');
    tempSpline.isClosed = !!coasterData.isClosed;
    for (const n of coasterData.nodes) {
      tempSpline.addNode(n.x, n.y, n.type || 'normal', n.handleIn, n.handleOut, n.customHandles);
    }

    const pts = tempSpline.samples.length > 2 ? tempSpline.samples : coasterData.nodes;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const pad = 12;
    const spanX = Math.max(100, maxX - minX);
    const spanY = Math.max(80, maxY - minY);
    const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
    const offX = (w - spanX * scale) * 0.5 - minX * scale;
    const offY = (h - spanY * scale) * 0.5 - minY * scale;

    // Draw subtle support lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
    ctx.lineWidth = 1;
    const groundPy = maxY * scale + offY + 4;
    const step = Math.max(1, Math.floor(pts.length / 18));
    for (let i = 0; i < pts.length; i += step) {
      if (pts[i].type === 'gap') continue;
      const px = pts[i].x * scale + offX;
      const py = pts[i].y * scale + offY;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, groundPy);
      ctx.stroke();
    }

    // Draw track segments colored by type
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const x0 = p0.x * scale + offX;
      const y0 = p0.y * scale + offY;
      const x1 = p1.x * scale + offX;
      const y1 = p1.y * scale + offY;

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);

      if (p0.type === 'gap') {
        ctx.strokeStyle = 'rgba(255, 109, 0, 0.6)';
        ctx.setLineDash([3, 3]);
      } else {
        ctx.setLineDash([]);
        if (p0.type === 'lift') ctx.strokeStyle = '#fbc02d';
        else if (p0.type === 'boost') ctx.strokeStyle = '#00e676';
        else if (p0.type === 'maglev') ctx.strokeStyle = '#d500f9';
        else if (p0.type === 'brake') ctx.strokeStyle = isWater ? '#00e5ff' : '#ef4444';
        else ctx.strokeStyle = isWater ? '#0288d1' : '#38bdf8';
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }
}

window.CoasterRenderer = CoasterRenderer;

