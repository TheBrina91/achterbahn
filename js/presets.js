/* CoasterCraft 2D - Predefined Roller Coaster Tracks */

const PRESET_COASTERS = {
  alpenblitz: {
    name: "Alpen-Blitz (Hyper-Coaster)",
    description: "Klassischer Riesen-Coaster mit 50m Lifthill, steilem Mega-Drop und Airtime-Hügeln!",
    isClosed: true,
    nodes: [
      { x: 100, y: 700, type: 'lift' },
      { x: 260, y: 700, type: 'lift' },
      { x: 420, y: 640, type: 'lift' },
      { x: 580, y: 500, type: 'lift' },
      { x: 740, y: 340, type: 'lift' },
      { x: 880, y: 220, type: 'lift' },
      { x: 980, y: 170, type: 'normal' }, // Peak of lift hill
      { x: 1080, y: 210, type: 'normal' },
      { x: 1200, y: 440, type: 'normal' }, // Mega Drop plunge
      { x: 1350, y: 690, type: 'normal' }, // Valley (max G-force)
      { x: 1550, y: 420, type: 'normal' }, // Airtime Camelback
      { x: 1720, y: 390, type: 'normal' }, // Crest of hill
      { x: 1890, y: 520, type: 'normal' },
      { x: 2050, y: 680, type: 'normal' }, // Second valley
      { x: 2220, y: 490, type: 'normal' }, // Bunny hop
      { x: 2360, y: 470, type: 'normal' },
      { x: 2500, y: 620, type: 'normal' },
      { x: 2650, y: 700, type: 'normal' },
      { x: 2400, y: 730, type: 'normal' }, // Return curve
      { x: 1800, y: 730, type: 'normal' },
      { x: 1000, y: 730, type: 'normal' },
      { x: 300,  y: 730, type: 'brake' }
    ]
  },

  loopingmonster: {
    name: "Looping-Monster",
    description: "Extremer Nervenkitzel mit gewaltigem Looping, Speed-Drop und Doppel-Camelback!",
    isClosed: true,
    nodes: [
      { x: 120, y: 700, type: 'lift' },
      { x: 260, y: 700, type: 'lift' },
      { x: 420, y: 560, type: 'lift' },
      { x: 580, y: 380, type: 'lift' },
      { x: 720, y: 230, type: 'lift' },
      { x: 840, y: 180, type: 'normal' }, // Top of lift hill
      { x: 960, y: 240, type: 'normal' },
      { x: 1080, y: 480, type: 'normal' }, // Drop
      { x: 1220, y: 690, type: 'normal' }, // Enter Looping base
      // Vertical Looping
      { x: 1340, y: 560, type: 'normal' }, // Loop up
      { x: 1360, y: 410, type: 'normal' }, // Loop apex
      { x: 1310, y: 370, type: 'normal' }, // Top inversion
      { x: 1250, y: 420, type: 'normal' }, // Loop down
      { x: 1280, y: 570, type: 'normal' },
      { x: 1420, y: 700, type: 'normal' }, // Exit loop
      // Speed hill
      { x: 1620, y: 460, type: 'normal' },
      { x: 1780, y: 430, type: 'normal' },
      { x: 1940, y: 560, type: 'normal' },
      { x: 2120, y: 700, type: 'normal' },
      { x: 1800, y: 730, type: 'normal' },
      { x: 900,  y: 730, type: 'normal' },
      { x: 300,  y: 730, type: 'brake' }
    ]
  },

  hypersonic: {
    name: "Hypersonic (Maglev-Katapult)",
    description: "Maglev-Start mit Auflade-Pause, Vollgas-Abschuss, senkrechtem Top-Hat Turm und High-Speed Airtime!",
    isClosed: true,
    nodes: [
      { x: 100, y: 700, type: 'maglev' },
      { x: 240, y: 700, type: 'maglev' },
      // Launch Track
      { x: 400, y: 700, type: 'maglev' },
      { x: 580, y: 700, type: 'maglev' },
      { x: 760, y: 700, type: 'maglev' },
      // Top-Hat Vertical Tower
      { x: 920,  y: 620, type: 'normal' },
      { x: 980,  y: 430, type: 'normal' },
      { x: 1020, y: 220, type: 'normal' },
      { x: 1080, y: 160, type: 'normal' }, // Tower crest
      { x: 1140, y: 220, type: 'normal' },
      { x: 1180, y: 430, type: 'normal' },
      { x: 1240, y: 620, type: 'normal' },
      { x: 1360, y: 690, type: 'normal' }, // Pullout
      // Speed wave
      { x: 1560, y: 490, type: 'normal' },
      { x: 1740, y: 470, type: 'normal' },
      { x: 1920, y: 620, type: 'normal' },
      { x: 2100, y: 700, type: 'normal' },
      { x: 2260, y: 700, type: 'normal' },
      { x: 1600, y: 730, type: 'normal' },
      { x: 400,  y: 730, type: 'brake' }
    ]
  },

  stuntjump: {
    name: "Maglev Stunt-Jumper (Schanze)",
    description: "Maglev-Vollgasstart mit riesiger Sprung-Schanze: Der Zug fliegt frei durch die Luft und gleist wieder ein!",
    isClosed: true,
    nodes: [
      { x: 100, y: 700, type: 'maglev' },
      { x: 260, y: 700, type: 'maglev' },
      { x: 440, y: 700, type: 'maglev' },
      { x: 620, y: 690, type: 'maglev' },
      // Takeoff ramp lip ('gap' creates trackless air gap to next node)
      {
        x: 780,
        y: 635,
        type: 'gap',
        handleIn: { x: -55, y: 26 },
        handleOut: { x: 55, y: -26 },
        customHandles: true
      },
      // Catch rail after airborne jump
      {
        x: 1180,
        y: 590,
        type: 'normal',
        handleIn: { x: -55, y: -18 },
        handleOut: { x: 55, y: 18 },
        customHandles: true
      },
      { x: 1380, y: 695, type: 'normal' },
      // Post-jump celebratory camelback hill
      { x: 1580, y: 480, type: 'normal' },
      { x: 1740, y: 460, type: 'normal' },
      { x: 1920, y: 620, type: 'normal' },
      { x: 2100, y: 700, type: 'normal' },
      { x: 1450, y: 730, type: 'normal' },
      { x: 420,  y: 730, type: 'brake' }
    ]
  },

  kinderbahn: {
    name: "Familien-Raupe (Sanfter Einstieg)",
    description: "Gemütliche Familienachterbahn mit sanften Wellen und kleiner Abfahrt. Ideal zum Ausprobieren!",
    isClosed: true,
    nodes: [
      { x: 120, y: 680, type: 'lift' },
      { x: 260, y: 680, type: 'lift' },
      { x: 420, y: 620, type: 'lift' },
      { x: 580, y: 520, type: 'lift' },
      { x: 720, y: 460, type: 'normal' }, // gentle crest
      { x: 880, y: 550, type: 'normal' }, // small drop
      { x: 1040, y: 660, type: 'normal' },
      { x: 1200, y: 570, type: 'normal' }, // mini bunny hop
      { x: 1360, y: 670, type: 'normal' },
      { x: 1500, y: 680, type: 'normal' },
      { x: 1200, y: 710, type: 'normal' },
      { x: 350,  y: 710, type: 'normal' }
    ]
  },

  wildwasser: {
    name: "Wildwasser-Klamm (Wasserbahn)",
    description: "Baumstamm-Wasserbahn mit Kettenlift, zwei steilen Schussfahrten und riesigen Spritz-Wasserbremsen!",
    rideType: 'water',
    isClosed: true,
    nodes: [
      { x: 110, y: 700, type: 'lift' },
      { x: 250, y: 700, type: 'lift' },
      { x: 420, y: 580, type: 'lift' },
      { x: 580, y: 430, type: 'lift' },
      { x: 720, y: 310, type: 'normal' }, // First log flume peak
      { x: 850, y: 340, type: 'normal' },
      { x: 980, y: 540, type: 'normal' }, // Steep chute drop
      { x: 1120, y: 695, type: 'brake' }, // Splashdown water brake #1
      { x: 1280, y: 695, type: 'brake' },
      { x: 1440, y: 560, type: 'lift' },  // Second chain lift
      { x: 1620, y: 390, type: 'lift' },
      { x: 1760, y: 240, type: 'normal' }, // High waterfall crest
      { x: 1900, y: 280, type: 'normal' },
      { x: 2040, y: 520, type: 'normal' }, // Main splash plunge
      { x: 2180, y: 700, type: 'brake' }, // Giant splashdown water brake #2
      { x: 2360, y: 700, type: 'brake' },
      { x: 2500, y: 705, type: 'normal' },
      { x: 1900, y: 730, type: 'normal' }, // Floating return channel
      { x: 1100, y: 730, type: 'normal' },
      { x: 360,  y: 730, type: 'brake' }
    ]
  }
};

window.PRESET_COASTERS = PRESET_COASTERS;

