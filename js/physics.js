/* CoasterCraft 2D - Physics Simulation & Train Dynamics */

const PIXELS_PER_METER = 14.0; // 14px = 1 meter

class CoasterCar {
  constructor(index) {
    this.index = index;
    this.lengthMeters = 2.4; // car length
    this.lengthPx = this.lengthMeters * PIXELS_PER_METER;

    // Track state
    this.trackDistance = 0; // meters
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.normalX = 0;
    this.normalY = -1;

    // Free flight state (if derailed)
    this.isDerailed = false;
    this.vx = 0;
    this.vy = 0;
    this.angularVelocity = 0;

    // Passengers (2 seats per car; can be occupied by actual ParkVisitors)
    this.passengers = [
      {
        hairColor: ['#3e2723', '#d7ccc8', '#ffb300', '#c2185b', '#e65100'][index % 5],
        shirtColor: ['#e53935', '#1e88e5', '#43a047', '#8e24aa', '#f4511e'][(index + 1) % 5],
        handsUp: false,
        headOffset: { x: -8, y: -16 },
        lookAngle: 0,
        occupied: true,
        visitor: null
      },
      {
        hairColor: ['#212121', '#ffb74d', '#8d6e63', '#424242', '#ffd54f'][(index + 2) % 5],
        shirtColor: ['#00897b', '#fdd835', '#3949ab', '#d81b60', '#546e7a'][(index + 3) % 5],
        handsUp: false,
        headOffset: { x: 8, y: -16 },
        lookAngle: 0,
        occupied: true,
        visitor: null
      }
    ];
  }
}

class CoasterPhysics {
  constructor(spline) {
    this.spline = spline;

    // Train configuration
    this.numCars = 3;
    this.carSpacing = 2.7; // meters between car centers
    this.cars = [];
    this.initCars();

    // Motion parameters
    this.leadDistance = 0; // meters along track
    this.velocity = 0;     // m/s
    this.acceleration = 0; // m/s^2
    this.currentG = 1.0;   // Vertical G-force (averaged over train length)
    this.prevG = 1.0;
    this.maxG = 1.0;
    this.minG = 1.0;
    this.maxSpeedKmH = 0;
    this.avgSpeedKmH = 0;
    this.avgG = 1.0;
    this.airtimeSeconds = 0;
    this.airtimeRatio = 0; // Fraction of track length in airtime
    this.lapCount = 0;

    // Spatial telemetry bins (1 bin per meter of coaster track length)
    this.trackBins = [];

    // Simulation settings
    this.gravity = 9.81;       // m/s^2
    this.frictionCoeff = 0.007; // rolling friction
    this.airDragCoeff = 0.0018; // aerodynamic drag
    this.liftSpeed = 4.8;      // m/s (~17 km/h)
    this.boostAccel = 22.0;    // m/s^2
    this.boostMaxSpeed = 28.0; // m/s (~100 km/h)
    this.maglevPauseDuration = 1.3; // seconds pause before launch
    this.maglevAccel = 48.0;   // m/s^2 full-throttle launch
    this.maglevMaxSpeed = 40.0; // m/s (~144 km/h)
    this.maglevState = 'idle'; // 'idle' | 'charging' | 'launching'
    this.maglevTimer = 0;
    this.brakeDecel = 9.0;     // m/s^2
    this.brakeTargetSpeed = 2.0; // m/s (~7 km/h)

    // State flags
    this.isRunning = false;
    this.isDerailed = false;
    this.isAirborne = false;   // mid-air ramp jump (can re-rail!)
    this.airX = 0;
    this.airY = 0;
    this.airVx = 0;
    this.airVy = 0;
    this.airDistPx = 0;
    this.takeoffDistM = 0;
    this.takeoffDistPx = 0;
    this.airPath = [];
    this.lastLanding = null;
    this.isStationary = true;
    this.allowDerail = true; // whether train can fly off open tracks

    // Station boarding & visitor integration
    this.stationState = 'riding'; // 'boarding' | 'riding'
    this.stationTimer = 0;
    this.boardStepTimer = 0;
    this.stationStopLap = 0;
    this.stationQueue = []; // ParkVisitor instances waiting on this coaster's platform
    this.onPassengerDisembark = null; // callback(visitor, exitX, exitY) when ride finishes

    // Ratings (averaged over track length)
    this.excitementRating = 0;
    this.intensityRating = 0;
    this.nauseaRating = 0;
  }

  initCars() {
    this.cars = [];
    for (let i = 0; i < this.numCars; i++) {
      this.cars.push(new CoasterCar(i));
    }
  }

  setCarCount(count) {
    this.numCars = Math.max(1, Math.min(6, count));
    this.initCars();
    this.updateCarPositions();
  }

  getStationStopDistM() {
    const totalLengthM = (this.spline && this.spline.totalLength > 0) ? (this.spline.totalLength / PIXELS_PER_METER) : 100;
    const trainLengthM = (this.numCars - 1) * this.carSpacing;
    return Math.max(trainLengthM + 1.0, Math.min(totalLengthM * 0.5, trainLengthM + 4.0));
  }

  disembarkAllPassengers() {
    const st = this.spline ? this.spline.getStationInfo() : null;
    const exitX = st ? st.platX : (this.cars[0] ? this.cars[0].x : 150);
    const exitY = st ? st.platY : (this.cars[0] ? this.cars[0].y : 700);

    for (const car of this.cars) {
      for (const seat of car.passengers) {
        if (seat.visitor && this.onPassengerDisembark) {
          this.onPassengerDisembark(seat.visitor, exitX + (Math.random() - 0.5) * 24, exitY);
        }
        seat.visitor = null;
        seat.occupied = !this.onPassengerDisembark;
        seat.handsUp = false;
      }
    }
  }

  dispatchFromStation() {
    this.stationState = 'riding';
    this.stationStopLap = this.lapCount;
    this.maglevState = 'idle';
    if (Math.abs(this.velocity) < 0.1) {
      this.velocity = 4.5;
    }
  }

  reset() {
    this.isRunning = false;
    this.isDerailed = false;
    this.isAirborne = false;
    this.airPath = [];
    this.lastLanding = null;
    this.maglevState = 'idle';
    this.maglevTimer = 0;

    // Return any riding visitors before resetting
    this.disembarkAllPassengers();

    const totalLengthM = (this.spline && this.spline.totalLength > 0) ? (this.spline.totalLength / PIXELS_PER_METER) : 100;
    this.leadDistance = this.getStationStopDistM();
    this.stationState = this.onPassengerDisembark ? 'boarding' : 'riding';
    this.stationTimer = 2.4;
    this.boardStepTimer = 0.15;
    this.stationStopLap = 0;

    this.velocity = 0;
    this.acceleration = 0;
    this.currentG = 1.0;
    this.prevG = 1.0;
    this.maxG = 1.0;
    this.minG = 1.0;
    this.maxSpeedKmH = 0;
    this.avgSpeedKmH = 0;
    this.avgG = 1.0;
    this.airtimeSeconds = 0;
    this.airtimeRatio = 0;
    this.lapCount = 0;

    // Initialize 1-meter bins for spatial averaging along the coaster length
    const numBins = Math.max(1, Math.ceil(totalLengthM));
    this.trackBins = new Array(numBins).fill(null);

    for (const car of this.cars) {
      car.isDerailed = false;
      car.vx = 0;
      car.vy = 0;
      car.angularVelocity = 0;
    }

    this.updateCarPositions();
    if (window.coasterAudio) {
      window.coasterAudio.updateRumble(0, false);
    }
  }

  start() {
    if (this.spline.nodes.length < 2) return;
    this.isRunning = true;
    if (window.coasterAudio) {
      window.coasterAudio.ensureContext();
    }
    // Board any immediately waiting visitors from the station queue on manual start
    if (this.stationQueue && this.stationQueue.length > 0) {
      for (const car of this.cars) {
        for (const seat of car.passengers) {
          if (!seat.occupied && this.stationQueue.length > 0) {
            const v = this.stationQueue.shift();
            seat.occupied = true;
            seat.visitor = v;
            seat.shirtColor = v.shirtColor;
            seat.hairColor = v.hairColor;
            v.state = 'riding';
          }
        }
      }
    }
    this.dispatchFromStation();
  }

  pause() {
    this.isRunning = false;
    if (window.coasterAudio) {
      window.coasterAudio.updateRumble(0, false);
    }
  }

  update(dt) {
    if (!this.isRunning || this.spline.samples.length < 2) return;

    // Handle station boarding phase when park visitor system is active
    if (this.stationState === 'boarding' && this.onPassengerDisembark) {
      this.velocity = 0;
      this.acceleration = 0;
      this.currentG = 1.0;
      this.leadDistance = this.getStationStopDistM();
      this.updateCarPositions();

      // Board waiting visitors one by one into empty car seats
      this.boardStepTimer -= dt;
      if (this.boardStepTimer <= 0 && this.stationQueue.length > 0) {
        let boardedOne = false;
        for (const car of this.cars) {
          for (const seat of car.passengers) {
            if (!seat.occupied) {
              const v = this.stationQueue.shift();
              seat.occupied = true;
              seat.visitor = v;
              seat.shirtColor = v.shirtColor;
              seat.hairColor = v.hairColor;
              v.state = 'riding';
              boardedOne = true;
              break;
            }
          }
          if (boardedOne) break;
        }
        this.boardStepTimer = 0.25;
      }

      let occupiedCount = 0;
      const totalSeats = this.cars.length * 2;
      for (const car of this.cars) {
        for (const seat of car.passengers) {
          if (seat.occupied) occupiedCount++;
        }
      }

      this.stationTimer -= dt;
      // Dispatch when full, or after boarding timer when visitors are aboard
      if (
        (occupiedCount >= totalSeats && this.stationTimer <= 1.2) ||
        (occupiedCount > 0 && this.stationTimer <= 0 && this.stationQueue.length === 0) ||
        (occupiedCount > 0 && this.stationTimer <= -1.2)
      ) {
        this.dispatchFromStation();
      }
      return;
    }

    // Sub-stepping for rock-solid numerical stability
    const subSteps = 4;
    const subDt = dt / subSteps;

    for (let step = 0; step < subSteps; step++) {
      if (this.isDerailed) {
        this.updateDerailedPhysics(subDt);
      } else if (this.isAirborne) {
        this.updateAirbornePhysics(subDt);
      } else {
        this.updateTrackPhysics(subDt);
      }
    }

    // Audio and telemetry updates
    const speedKmH = Math.abs(this.velocity) * 3.6;
    if (speedKmH > this.maxSpeedKmH) this.maxSpeedKmH = speedKmH;

    if (window.coasterAudio) {
      window.coasterAudio.updateRumble(speedKmH, this.isRunning && !this.isDerailed);
    }

    // Update ratings periodically
    this.calculateRatings();
  }

  updateTrackPhysics(dt) {
    const totalLengthM = this.spline.totalLength / PIXELS_PER_METER;
    if (totalLengthM <= 0) return;

    // Average forces across all cars
    let totalForce = 0;
    let totalMass = 0;
    let onLiftCount = 0;
    let onBoostCount = 0;
    let onMaglevCount = 0;
    let onBrakeCount = 0;

    const carMass = 650; // kg per car + passengers

    const leadPx = this.leadDistance * PIXELS_PER_METER;
    const leadTp = this.spline.getTrackPoint(leadPx);

    // Check if train hits a ramp gap ('gap' track section) -> jump into air!
    if (leadTp && leadTp.type === 'gap' && Math.abs(this.velocity) > 0.5) {
      this.enterAirborneJump(leadTp);
      return;
    }

    // Check open track limits
    if (!this.spline.isClosed) {
      const trainLengthM = (this.cars.length - 1) * this.carSpacing;
      const frontDistPx = this.leadDistance * PIXELS_PER_METER;
      const rearDistPx = (this.leadDistance - trainLengthM) * PIXELS_PER_METER;

      if (this.allowDerail) {
        // Flying off the forward end -> launch into airborne jump so it can re-rail if another rail is ahead!
        if (this.velocity > 0 && frontDistPx > this.spline.totalLength) {
          const endSample = this.spline.samples[this.spline.samples.length - 1];
          if (endSample) {
            this.enterAirborneJump(endSample);
          } else {
            this.triggerDerailment();
          }
          return;
        }
        // Rolling off backwards from the start
        if (this.velocity < 0 && rearDistPx < 0) {
          this.triggerDerailment();
          return;
        }
      } else {
        // Shuttle bounce: reverse direction at track ends when derailment is disabled
        if (this.velocity > 0 && frontDistPx >= this.spline.totalLength) {
          this.leadDistance = this.spline.totalLength / PIXELS_PER_METER;
          this.velocity = -Math.abs(this.velocity) * 0.85;
        } else if (this.velocity < 0 && rearDistPx <= 0) {
          this.leadDistance = trainLengthM;
          this.velocity = Math.abs(this.velocity) * 0.85;
        }
      }
    }

    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const carDistM = this.leadDistance - (i * this.carSpacing);
      const carDistPx = carDistM * PIXELS_PER_METER;

      const tp = this.spline.getTrackPoint(carDistPx);
      if (!tp) continue;

      totalMass += carMass;

      // Gravity force along track: dy/ds * g
      // Since screen Y goes down: if tangentY > 0, we slope downwards -> positive acceleration!
      const gravityForce = carMass * this.gravity * tp.tangentY;
      totalForce += gravityForce;

      // Track sections
      if (tp.type === 'lift') onLiftCount++;
      if (tp.type === 'boost') onBoostCount++;
      if (tp.type === 'maglev') onMaglevCount++;
      if (tp.type === 'brake') onBrakeCount++;
    }

    if (totalMass === 0) totalMass = carMass;

    // Base acceleration from gravity
    let netAccel = totalForce / totalMass;

    // Rolling friction
    const frictionAccel = this.frictionCoeff * this.gravity * Math.sign(this.velocity);
    netAccel -= frictionAccel;

    // Aerodynamic drag: -c * v * |v|
    const dragAccel = (this.airDragCoeff * this.velocity * Math.abs(this.velocity));
    netAccel -= dragAccel;

    // Special track sections behaviors (averaged over train length / cars)
    const numCars = Math.max(1, this.cars.length);
    const liftFraction = onLiftCount / numCars;
    const boostFraction = onBoostCount / numCars;
    const maglevFraction = onMaglevCount / numCars;
    const brakeFraction = onBrakeCount / numCars;

    // Maglev Launch Track: pauses briefly at the beginning, then launches at full throttle!
    if (onMaglevCount > 0) {
      if (this.maglevState === 'idle' && (maglevFraction >= 0.5 || (leadTp && leadTp.type === 'maglev'))) {
        this.maglevState = 'charging';
        this.maglevTimer = this.maglevPauseDuration;
        if (window.coasterAudio) {
          window.coasterAudio.playMaglevCharge(this.maglevPauseDuration);
        }
      }

      if (this.maglevState === 'charging') {
        // Hold train stationary while magnetic coils charge up
        this.velocity *= Math.max(0, 1 - 18 * dt);
        if (Math.abs(this.velocity) < 0.6) this.velocity = 0;
        netAccel = 0;
        this.maglevTimer -= dt;

        // Spawn charging sparks
        if (window.coasterGame && window.coasterGame.renderer && Math.random() < 0.35) {
          const c0 = this.cars[0];
          if (c0) window.coasterGame.renderer.addSparks(c0.x, c0.y, 2);
        }

        if (this.maglevTimer <= 0) {
          this.maglevState = 'launching';
          this.velocity = Math.max(this.velocity, 14.0); // instant magnetic release kick
          if (window.coasterAudio) {
            window.coasterAudio.playMaglevLaunch();
          }
          if (window.coasterGame && window.coasterGame.renderer && this.cars[0]) {
            window.coasterGame.renderer.addSparks(this.cars[0].x, this.cars[0].y, 16);
          }
        }
      } else if (this.maglevState === 'launching') {
        // Full-throttle Maglev acceleration!
        if (this.velocity < this.maglevMaxSpeed) {
          netAccel += this.maglevAccel * Math.max(0.6, maglevFraction);
        }
        if (window.coasterGame && window.coasterGame.renderer && Math.random() < 0.25 && this.cars[0]) {
          window.coasterGame.renderer.addSparks(this.cars[0].x, this.cars[0].y, 2);
        }
      }
    } else {
      this.maglevState = 'idle';
    }

    if (liftFraction > 0) {
      // Chain lift grabs train proportionally and prevents rollback
      if (this.velocity < this.liftSpeed) {
        const pullAccel = 12.0 * liftFraction;
        netAccel = Math.max(netAccel, pullAccel);
        if (this.velocity + netAccel * dt > this.liftSpeed) {
          this.velocity = this.liftSpeed;
          netAccel = 0;
        }
      }
      if (this.velocity < 0) this.velocity = 0;

      if (window.coasterAudio) {
        window.coasterAudio.playChainClick(this.velocity / 3.0);
      }
    }

    if (boostFraction > 0) {
      // Linear Synchronous Motor (LSM) Launch averaged over cars on boost
      if (this.velocity < this.boostMaxSpeed) {
        netAccel += this.boostAccel * boostFraction;
        if (window.coasterAudio && Math.random() < 0.15) {
          window.coasterAudio.playBoostSound();
        }
      }
    }

    const isWaterRide = (this.spline && this.spline.rideType === 'water');

    // Gentle flowing water current in the flume trough keeps boats floating smoothly along flat channels
    if (isWaterRide && this.velocity >= 0 && this.velocity < 3.5 && onLiftCount === 0) {
      netAccel = Math.max(netAccel, 4.5);
    }
    // High-speed water spray wake on normal flume sections
    if (isWaterRide && Math.abs(this.velocity) > 10 && brakeFraction === 0 && window.coasterGame && window.coasterGame.renderer) {
      if (Math.random() < 0.35 && this.cars[0]) {
        window.coasterGame.renderer.addWaterSplash(this.cars[0].x, this.cars[0].y + 4, Math.abs(this.velocity) * 0.45, 2);
      }
    }

    if (brakeFraction > 0) {
      if (isWaterRide) {
        // Water Brake (Splashdown Pool): hydrodynamic drag + big water splash fountains!
        const waterTargetSpeed = 3.6;
        const speedAbs = Math.abs(this.velocity);
        if (speedAbs > waterTargetSpeed) {
          const hydroDrag = (this.brakeDecel * 1.35 + 0.065 * speedAbs * speedAbs) * brakeFraction;
          netAccel -= hydroDrag * Math.sign(this.velocity);
        }
        if (window.coasterGame && window.coasterGame.renderer && this.cars[0] && speedAbs > 2.2) {
          if (Math.random() < 0.75) {
            const splashCount = Math.max(2, Math.min(12, Math.round(speedAbs * 0.45)));
            window.coasterGame.renderer.addWaterSplash(this.cars[0].x, this.cars[0].y + 2, speedAbs, splashCount);
          }
        }
        if (window.coasterAudio && speedAbs > 5.0 && Math.random() < 0.25) {
          window.coasterAudio.playWaterSplash(speedAbs / 14.0);
        }
      } else {
        // Trim & station brakes averaged over cars on brake
        if (this.velocity > this.brakeTargetSpeed) {
          netAccel -= this.brakeDecel * brakeFraction;
          if (window.coasterAudio && Math.random() < 0.2) {
            window.coasterAudio.playBrakeHiss();
          }
        }
      }
    }

    // Integrate velocity & position (Verlet / Euler)
    this.acceleration = netAccel;
    if (this.maglevState !== 'charging') {
      this.velocity += netAccel * dt;
    }

    // Very low speed clamp to prevent jittering when stopped
    if (Math.abs(this.velocity) < 0.05 && onLiftCount === 0 && onMaglevCount === 0 && Math.abs(netAccel) < 0.2) {
      this.velocity = 0;
    }

    this.leadDistance += this.velocity * dt;

    // Handle closed loop wrap-around & station arrival stop
    if (this.spline.isClosed && totalLengthM > 0) {
      if (this.leadDistance >= totalLengthM) {
        this.leadDistance %= totalLengthM;
        this.lapCount++;
      } else if (this.leadDistance < 0) {
        this.leadDistance = (this.leadDistance % totalLengthM) + totalLengthM;
      }

      const stopDistM = this.getStationStopDistM();
      if (
        this.onPassengerDisembark &&
        this.lapCount > this.stationStopLap &&
        this.leadDistance >= stopDistM
      ) {
        this.leadDistance = stopDistM;
        this.velocity = 0;
        this.acceleration = 0;
        this.maglevState = 'idle';
        this.stationStopLap = this.lapCount;
        this.stationState = 'boarding';
        this.stationTimer = 2.8;
        this.boardStepTimer = 0.3;
        this.disembarkAllPassengers();
      }
    }

    this.updateCarPositions();
    this.calculateGForces(dt);
  }

  enterAirborneJump(takeoffSample) {
    this.isAirborne = true;
    const dirSign = this.velocity >= 0 ? 1 : -1;
    const speedPx = Math.abs(this.velocity) * PIXELS_PER_METER;

    let lipX = takeoffSample.x;
    let lipY = takeoffSample.y;
    let tx = takeoffSample.tangentX * dirSign;
    let ty = takeoffSample.tangentY * dirSign;
    let lipDistPx = takeoffSample.distance;

    if (takeoffSample.type === 'gap' && takeoffSample.segmentIndex !== undefined) {
      const gapNode = this.spline.nodes[takeoffSample.segmentIndex];
      if (gapNode) {
        lipX = gapNode.x;
        lipY = gapNode.y;
        const h = dirSign >= 0 ? gapNode.handleOut : gapNode.handleIn;
        if (h && (h.x !== 0 || h.y !== 0)) {
          const hLen = Math.hypot(h.x, h.y);
          tx = h.x / hLen;
          ty = h.y / hLen;
        }
      }
      for (let i = 0; i < this.spline.samples.length; i++) {
        const s = this.spline.samples[i];
        if (s.segmentIndex === takeoffSample.segmentIndex) {
          lipDistPx = s.distance;
          break;
        }
      }
    }

    this.takeoffDistM = lipDistPx / PIXELS_PER_METER;
    this.takeoffDistPx = lipDistPx;
    this.airX = lipX;
    this.airY = lipY;
    this.airVx = tx * speedPx;
    this.airVy = ty * speedPx;
    this.airDistPx = 0;

    const isRev = this.airVx < 0;
    const startAngle = isRev ? Math.atan2(-this.airVy, -this.airVx) : Math.atan2(this.airVy, this.airVx);
    this.airPath = [{
      x: this.airX,
      y: this.airY,
      angle: startAngle,
      isReverse: isRev,
      distPx: 0
    }];

    if (window.coasterAudio) {
      window.coasterAudio.playScream(1.2);
    }
    if (window.coasterGame && window.coasterGame.renderer) {
      window.coasterGame.renderer.addSparks(this.airX, this.airY, 8);
    }
  }

  sampleAirPath(airPath, targetDistPx) {
    if (!airPath || airPath.length === 0) return null;
    if (targetDistPx <= 0) return airPath[0];
    const last = airPath[airPath.length - 1];
    if (targetDistPx >= last.distPx) return last;

    // Binary search along airPath
    let low = 0;
    let high = airPath.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (airPath[mid].distPx < targetDistPx) low = mid + 1;
      else high = mid - 1;
    }
    const i1 = Math.max(0, low - 1);
    const i2 = Math.min(airPath.length - 1, low);
    if (i1 === i2) return airPath[i1];

    const p1 = airPath[i1];
    const p2 = airPath[i2];
    const span = p2.distPx - p1.distPx;
    const t = span > 0.0001 ? (targetDistPx - p1.distPx) / span : 0;

    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t,
      angle: p1.angle + this.spline.angleDiff(p2.angle, p1.angle) * t,
      isReverse: p2.isReverse
    };
  }

  updateAirbornePhysics(dt) {
    const airGravityPx = this.gravity * PIXELS_PER_METER * 3.0;
    const prevX = this.airX;
    const prevY = this.airY;

    this.airVy += airGravityPx * dt;
    this.airX += this.airVx * dt;
    this.airY += this.airVy * dt;

    const stepPx = Math.hypot(this.airX - prevX, this.airY - prevY);
    this.airDistPx += stepPx;

    const flightSpeedM = Math.hypot(this.airVx, this.airVy) / PIXELS_PER_METER;
    this.velocity = (this.velocity >= 0 ? 1 : -1) * flightSpeedM;
    this.currentG = 0.0; // 0G weightless free-flight!
    this.airtimeSeconds += dt;

    const isRev = this.airVx < 0;
    const airAngle = isRev ? Math.atan2(-this.airVy, -this.airVx) : Math.atan2(this.airVy, this.airVx);

    this.airPath.push({
      x: this.airX,
      y: this.airY,
      angle: airAngle,
      isReverse: isRev,
      distPx: this.airDistPx
    });

    // Position all cars: cars that passed the lip follow airPath; rear cars still on ramp follow spline
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const offsetPx = i * this.carSpacing * PIXELS_PER_METER;

      if (offsetPx <= this.airDistPx) {
        const pt = this.sampleAirPath(this.airPath, this.airDistPx - offsetPx);
        if (pt) {
          car.x = pt.x;
          car.y = pt.y;
          car.angle = pt.angle;
          car.isReverse = pt.isReverse;
        }
      } else {
        const rampDistPx = this.takeoffDistPx - (offsetPx - this.airDistPx);
        const tp = this.spline.getTrackPoint(rampDistPx);
        if (tp) {
          car.x = tp.x;
          car.y = tp.y;
          car.angle = tp.carAngle !== undefined ? tp.carAngle : tp.angle;
          car.isReverse = !!tp.isReverse;
        }
      }

      for (const passenger of car.passengers) {
        passenger.handsUp = true;
      }
    }

    // Check if the flying lead car lands back onto a track segment (Re-Rail!)
    if (this.airDistPx > 32) {
      const samples = this.spline.samples;
      let bestSample = null;
      let bestDist = 42; // generous 42px landing catch-funnel

      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        if (s.type === 'gap') continue;

        // Avoid re-latching onto the takeoff lip we just left
        let splineDiff = Math.abs(s.distance - this.takeoffDistPx);
        if (this.spline.isClosed && this.spline.totalLength > 0) {
          splineDiff = Math.min(splineDiff, this.spline.totalLength - splineDiff);
        }
        if (splineDiff < 45) continue;

        const d = Math.hypot(s.x - this.airX, s.y - this.airY);
        if (d < bestDist) {
          bestDist = d;
          bestSample = s;
        }
      }

      if (bestSample) {
        // Successfully re-railed onto the track!
        this.isAirborne = false;
        this.leadDistance = bestSample.distance / PIXELS_PER_METER;
        this.lastLanding = {
          trackDistPx: bestSample.distance,
          airPath: this.airPath,
          totalAirDistPx: this.airDistPx
        };

        const dot = this.airVx * bestSample.tangentX + this.airVy * bestSample.tangentY;
        const landDir = dot >= 0 ? 1 : -1;
        this.velocity = landDir * flightSpeedM * 0.94;

        if (window.coasterGame && window.coasterGame.renderer) {
          window.coasterGame.renderer.addSparks(bestSample.x, bestSample.y, 16);
          window.coasterGame.renderer.addConfetti(bestSample.x, bestSample.y - 25, 18);
        }
        if (window.coasterAudio) {
          window.coasterAudio.playChainClick(3.0);
        }
        return;
      }
    }

    // Check ground impact if jump missed the landing rail
    if (this.airY >= 750) {
      this.isAirborne = false;
      this.triggerDerailment();
    }
  }

  updateCarPositions() {
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (car.isDerailed) continue;

      const distM = this.leadDistance - (i * this.carSpacing);
      const distPx = distM * PIXELS_PER_METER;

      // If this rear car is still finishing an airborne jump before touching down at lastLanding
      if (
        this.lastLanding &&
        distPx < this.lastLanding.trackDistPx &&
        (this.lastLanding.trackDistPx - distPx) <= this.lastLanding.totalAirDistPx
      ) {
        const airTarget = this.lastLanding.totalAirDistPx - (this.lastLanding.trackDistPx - distPx);
        const pt = this.sampleAirPath(this.lastLanding.airPath, airTarget);
        if (pt) {
          car.trackDistance = distM;
          car.x = pt.x;
          car.y = pt.y;
          car.angle = pt.angle;
          car.isReverse = pt.isReverse;
          continue;
        }
      }

      const tp = this.spline.getTrackPoint(distPx);

      if (tp) {
        car.trackDistance = distM;
        car.x = tp.x;
        car.y = tp.y;
        car.angle = tp.carAngle !== undefined ? tp.carAngle : tp.angle;
        car.isReverse = !!tp.isReverse;
        car.normalX = tp.normalX;
        car.normalY = tp.normalY;

        // Reactive passenger animation based on G-force & speed
        const speedKmH = Math.abs(this.velocity) * 3.6;
        for (const passenger of car.passengers) {
          // Put hands up on high speed drops or airtime
          passenger.handsUp = (this.currentG < 0.5 || (speedKmH > 50 && this.acceleration > 2));
        }
      }
    }
  }

  calculateGForces(dt) {
    if (this.cars.length === 0) return;

    // Average vertical G-force across all cars (over the length of the train)
    let sumG = 0;
    let validCars = 0;

    for (let i = 0; i < this.cars.length; i++) {
      const distM = this.leadDistance - (i * this.carSpacing);
      const distPx = distM * PIXELS_PER_METER;
      const tp = this.spline.getTrackPoint(distPx);
      if (!tp) continue;

      const kappaM = tp.curvature * PIXELS_PER_METER;
      const orientSign = tp.isReverse ? -1 : 1;

      const centripetalG = -orientSign * (this.velocity * this.velocity * kappaM) / this.gravity;
      const gravityG = orientSign * tp.normalY;

      sumG += (gravityG + centripetalG);
      validCars++;
    }

    if (validCars === 0) return;
    this.currentG = sumG / validCars;

    if (this.currentG > this.maxG) this.maxG = this.currentG;
    if (this.currentG < this.minG) this.minG = this.currentG;

    // Record spatial telemetry into 1-meter track bins along the coaster length
    const totalLengthM = Math.max(1, Math.ceil(this.spline.totalLength / PIXELS_PER_METER));
    if (this.trackBins.length !== totalLengthM) {
      this.trackBins = new Array(totalLengthM).fill(null);
    }

    const speedKmH = Math.abs(this.velocity) * 3.6;
    const ds = Math.max(0.05, Math.abs(this.velocity) * dt);
    const dGds = Math.min(5.0, Math.abs(this.currentG - this.prevG) / ds);
    this.prevG = this.currentG;

    // Update the bin at the train's center of mass
    const centerDistM = this.leadDistance - ((this.cars.length - 1) * this.carSpacing) * 0.5;
    const binIdx = Math.floor(((centerDistM % totalLengthM) + totalLengthM) % totalLengthM);

    if (binIdx >= 0 && binIdx < this.trackBins.length) {
      this.trackBins[binIdx] = {
        speedKmH,
        g: this.currentG,
        gDev: Math.abs(this.currentG - 1.0),
        posG: Math.max(0, Math.min(4.0, this.currentG - 1.0)),
        extremeG: Math.max(0, this.currentG - 3.5) + Math.max(0, -1.2 - this.currentG),
        airtime: (this.currentG < 0.35 && speedKmH > 12) ? 1 : 0,
        dGds
      };
    }

    // Airtime accumulator
    if (this.currentG < 0.3) {
      this.airtimeSeconds += dt;
      if (this.currentG < 0.0 && window.coasterAudio) {
        window.coasterAudio.playScream(1.2);
      }
    }

    // Scream on intense drops or high speed loops
    if (speedKmH > 75 && (this.currentG > 2.8 || this.currentG < 0.2)) {
      if (window.coasterAudio) {
        window.coasterAudio.playScream(1.0);
      }
    }
  }

  triggerDerailment() {
    if (this.isDerailed) return;
    this.isDerailed = true;

    if (window.coasterAudio) {
      window.coasterAudio.playCrash();
    }

    // Convert cars to free-flying physics objects
    for (const car of this.cars) {
      car.isDerailed = true;
      const speedPx = this.velocity * PIXELS_PER_METER;
      car.vx = Math.cos(car.angle) * speedPx + (Math.random() - 0.5) * 80;
      car.vy = Math.sin(car.angle) * speedPx - Math.random() * 50;
      car.angularVelocity = (Math.random() - 0.5) * 12;
    }
  }

  updateDerailedPhysics(dt) {
    const gravityPx = this.gravity * PIXELS_PER_METER * 2.2;
    const groundY = 850; // virtual ground

    for (const car of this.cars) {
      car.vy += gravityPx * dt;
      car.x += car.vx * dt;
      car.y += car.vy * dt;
      car.angle += car.angularVelocity * dt;

      // Ground bounce & friction
      if (car.y >= groundY) {
        car.y = groundY;
        car.vy = -car.vy * 0.35; // bounce restitution
        car.vx *= 0.85;          // ground friction
        car.angularVelocity *= 0.6;
      }
    }
  }

  calculateRatings() {
    // Calculate coaster values averaged over the length of the coaster (spatial meter bins)
    const visited = this.trackBins.filter(Boolean);
    const numVisited = visited.length;
    if (numVisited === 0) return;

    const totalLengthM = Math.max(1, this.trackBins.length);

    let sumSpeed = 0;
    let sumG = 0;
    let sumGDev = 0;
    let sumPosG = 0;
    let sumExtremeG = 0;
    let sumAirtime = 0;
    let sumDGds = 0;

    for (let i = 0; i < numVisited; i++) {
      const b = visited[i];
      sumSpeed += b.speedKmH;
      sumG += b.g;
      sumGDev += b.gDev;
      sumPosG += b.posG;
      sumExtremeG += b.extremeG;
      sumAirtime += b.airtime;
      sumDGds += b.dGds;
    }

    this.avgSpeedKmH = sumSpeed / numVisited;
    this.avgG = sumG / numVisited;
    const avgGDev = sumGDev / numVisited;
    const avgPosG = sumPosG / numVisited;
    const avgExtremeG = sumExtremeG / numVisited;
    this.airtimeRatio = sumAirtime / numVisited;
    const avgDGds = sumDGds / numVisited;

    // Length factor: rewards well-proportioned coaster length
    const lengthFactor = Math.min(1.15, Math.max(0.5, totalLengthM / 250));

    const excitement = ((this.avgSpeedKmH / 7.5) * 0.45 + (avgPosG * 4.5) * 0.30 + (this.airtimeRatio * 18) * 0.25 + 2.0) * lengthFactor;
    const intensity = (avgGDev * 2.4 + (this.avgSpeedKmH / 15) + avgExtremeG * 1.4);
    const nausea = (avgDGds * 1.8 + avgExtremeG * 1.4 + intensity * 0.30);

    this.excitementRating = +(Math.min(9.9, excitement)).toFixed(1);
    this.intensityRating = +(Math.min(10.0, intensity)).toFixed(1);
    this.nauseaRating = +(Math.min(9.8, nausea)).toFixed(1);
  }
}

window.CoasterPhysics = CoasterPhysics;
window.PIXELS_PER_METER = PIXELS_PER_METER;
