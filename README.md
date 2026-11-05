# 🎢 CoasterCraft 2D - Achterbahn-Konstrukteur

Ein interaktives, physikbasiertes 2D-Spiel zum Bauen und Fahren von eigenen Achterbahnen direkt im Browser – komplett ohne Installation spielbar!

---

## 🚀 Spiel starten

Du hast zwei einfache Möglichkeiten, das Spiel zu starten:

1. **Direkt im Browser öffnen (Empfohlen):**
   - Mache einen Doppelklick auf die Datei [`start.bat`](file:///c:/Users/sabri/Test%20Projekte/Achterbahn/start.bat) oder öffne [`index.html`](file:///c:/Users/sabri/Test%20Projekte/Achterbahn/index.html) direkt in Chrome, Firefox oder Edge.
2. **Über lokalen Server (optional):**
   ```bash
   npm start
   # oder
   node server.js
   ```
   Öffne anschließend `http://localhost:3000` im Browser.

---

## ✨ Features

- **Freies & Intuitives Bauen:**
  - Klicke, um Schienenpunkte frei im 2D-Raum zu platzieren oder bestehende Abschnitte durch Anklicken aufzuteilen.
  - Mathematisch exakte, butterweiche **Catmull-Rom Kurven-Splines** (keine harten Kanten oder Knicke).
  - Vorgefertigte Baukasten-Elemente wie **Loopings**, **Camelback-Airtime-Hügel** und **Mega-Drops** mit einem Klick einfügen.
  - Raster-Ausrichtung (Grid Snap: 15px, 25px, 50px oder frei).
  - Volle Undo- & Redo-Unterstützung (<kbd>Strg + Z</kbd> / <kbd>Strg + Y</kbd>).

- **Spezielle Schienen-Typen:**
  - 🎢 **Normale Schiene:** Reibungsarmer Stahl für freies Rollen und rasante Abfahrten.
  - ⛓️ **Kettenlift (Lift Hill):** Mechanischer Aufzug, der den Zug mit authentischem Rattern bergauf befördert und vor dem Zurückrollen sichert.
  - ⚡ **Booster (LSM Katapult):** Magnetischer Schnellstart katapultiert den Zug in Sekundenbruchteilen auf über 100 km/h.
  - 🛑 **Bremsen:** Wirbelstrom- und Reibungsbremsen zum kontrollierten Abbremsen vor der Station.
  - 🔄 **Rundkurs-Schalter:** Schließe die Strecke zu einem endlosen Rundkurs oder baue offene Strecken mit Stunt-Rampen.

- **Echte Physik & G-Kraft-Simulation:**
  - Berechnung von Schwerkraft, Rollreibung, Luftwiderstand und Zentrifugalkräften.
  - **Vertikale G-Kräfte ($G_z$):**
    - Hohe positive G-Kräfte (bis 4.5 G) im Tal drücken Passagiere in den Sitz.
    - Negative G-Kräfte (< 0 G) erzeugen **echte Airtime**, bei der die Fahrgäste abheben und die Arme in die Luft werfen!
  - **Entgleisungs-Physik:** Fliegt der Zug mit 120 km/h über das offene Streckenende, stürzt er im freien Fall mit Ballistik und Funkenflug zu Boden!

- **Fahrgäste mit Emotionen:**
  - Züge mit 1 bis 6 Wagen und animierten Passagieren.
  - Reaktive Gesichtsausdrücke: Lächeln, begeistertes Jubeln ("Hands up!"), offener Schrei bei schnellen Abfahrten und verzogene Gesichter bei extremen G-Kräften.

- **Theme Park Bewertung (RCT-Style):**
  - 🤩 **Spaß-Wert:** Steigt mit Drops, Airtime-Momenten und Höchstgeschwindigkeit.
  - ⚡ **Intensität:** Abhängig von G-Kräften und Beschleunigungen.
  - 🤢 **Übelkeit:** Steigt bei übertriebenen Richtungswechseln und G-Kräften.

- **Prozeduraler Sound (Web Audio API):**
  - Rollgeräusch der Schienenräder (dynamisch skaliert mit Geschwindigkeit).
  - Rhythmisches Klick-Klack-Kettenlift-Rattern.
  - Booster-Zischen und Bremsluft-Pneumatik.
  - Schreie und Jubel der Passagiere in Drops und Loopings.

- **Kamera & Atmosphäre:**
  - 🎥 **Zug verfolgen:** Folgt dem Zug dynamisch mit Geschwindigkeits-Zoom.
  - 🚴 **Mitfahr-Kamera (POV):** Hautnah direkt hinter der Zugspitze mit Neigung in den Kurven!
  - 🌐 **Freie Kamera:** Frei bewegen mit rechter Maustaste und stufenlos zoomen mit dem Mausrad.
  - ☀️ Tag, 🌅 Sonnenuntergang und 🌙 Nachtmodus mit Sternenhimmel.

- **4 Fertige Vorlagen zum sofortigen Testen:**
  1. *Alpen-Blitz:* Monumentaler Hyper-Coaster mit 50m Lifthill, 75° Steilabsturz und Camelback-Hügeln.
  2. *Looping-Monster:* Spektakulärer Inversions-Coaster mit Riesen-Looping.
  3. *Hypersonic:* LSM-Katapult-Coaster mit senkrechtem Top-Hat-Turm.
  4. *Familien-Raupe:* Sanfte Einsteigerbahn mit gemütlichen Wellen.

- **Export & Import:**
  - Eigene Bahnen als `.json`-Datei exportieren, sichern und mit Freunden teilen!

---

## 🎮 Steuerung & Tastaturkürzel

| Taste | Aktion |
| :--- | :--- |
| <kbd>Leertaste</kbd> | Testfahrt Starten / Anhalten |
| <kbd>R</kbd> | Zug an den Start zurücksetzen (Reset) |
| <kbd>B</kbd> | Zwischen Bau- und Fahrmodus wechseln |
| <kbd>C</kbd> | Kameramodus wechseln (Verfolgen ➔ Mitfahren ➔ Frei) |
| <kbd>Strg + Z</kbd> | Letzten Bauschritt rückgängig machen (Undo) |
| <kbd>Strg + Y</kbd> | Schritt wiederholen (Redo) |
| <kbd>Entf</kbd> / <kbd>Backspace</kbd> | Ausgewählten Schienenpunkt löschen |
| <kbd>M</kbd> | Sound stummschalten / aktivieren |
| **Rechte Maustaste / Umschalt** | Kamera verschieben (Pan) |
| **Mausrad** | Hinein- / Herauszoomen |

---

## 🔒 Lizenz / License (All Rights Reserved)

**Proprietäre Lizenz – Alle Rechte vorbehalten (Copyright © 2026 TheBrina91).**

- **Exklusive Berechtigung:** Ausschließlich der GitHub-Nutzer **[dvrkstvr](https://github.com/dvrkstvr)** (sowie der Eigentümer **[TheBrina91](https://github.com/TheBrina91)**) ist berechtigt, dieses Projekt herunterzuladen, zu klonen, zu bearbeiten oder weiterzuentwickeln.
- **Verbot für Dritte:** Allen anderen Personen ist das Herunterladen, Klonen, Forken, Kopieren, Bearbeiten oder Weiterverbreiten des Quellcodes und der Inhalte ausdrücklich untersagt.
- Siehe [LICENSE](file:///c:/Users/sabri/Test%20Projekte/Achterbahn/LICENSE) für die vollständigen Lizenzbestimmungen.


