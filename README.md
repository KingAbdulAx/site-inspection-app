# Kano–Maradi–Dutse Railway Project (Section 03: KZDR)
## Drainage Field Inspector & Spatial Alignment PWA

An offline-first, mobile Progressive Web Application (PWA) engineered for civil and drainage inspection engineers on the **Kano–Maradi–Dutse Railway Project (Section 03: Kazaure to Daura, PK 82+902 to PK 124+521)**.

---

## 1. Spatial Orientation & Railway Chainage Conventions

### 1.1 The Universal Railway Rule for "Left" vs. "Right"
In all civil, highway, and railway engineering documentation, schedules, drawings, and field reports:

> **The Rule:**  
> **"Left"** and **"Right"** are **strictly defined when facing in the direction of increasing chainage** (i.e. looking ahead from lower chainage towards higher chainage).

```
                             ▲ Facing PK 89+000 (North-West)
                             │ (Direction of Increasing Chainage)
                             │
          LEFT SIDE          │          RIGHT SIDE
      (South-West / 225°)    │     (North-East / 045°)
                             │
   • Deep Cut Crest Channel  │ • Standard Type 1 Cut Ditch
     (PK 83+715 – 84+406)    │   (b=0.75m, h=0.75m, 1:1)
   • Type 11 Crest Ditch     │ • Platform Access Road Drains
     (PK 84+406 – 84+620)    │ • Embankment Toe Drains to Culverts
   • Type 1 Larger Ditch     │
     (B=4.0–4.5m, H=0.60m)   │
                             │
                             │ Standing at PK 84+000
```

### 1.2 Geographical Translation on Section 03 (KZDR)
* **Alignment Heading:** As chainage increases from PK 82+902 towards PK 124+521 (heading away from Kano/Kazaure towards Daura), the track corridor runs **North-West** (nominal azimuth $\approx 314.5^\circ$ to $324.0^\circ$).
* **Left Hand Side (South-West / $\approx 225^\circ$):** 
  * Features situated on the engineer's physical left when walking forward.
  * Major structures: Deep Cut Crest Rectangular Channel Zone I (`DW-03001`), Concrete Lined Crest Ditch Type 11 (`MDDTDW220010001`), Type 1 Larger Variant track ditch ($B=4.0\text{--}4.5\text{m}$), and Type B stream diversion channel.
* **Right Hand Side (North-East / $\approx 045^\circ$):**
  * Features situated on the engineer's physical right when walking forward.
  * Major structures: Continuous Standard Type 1 trapezoidal ditch ($b=0.75\text{m}, h=0.75\text{m}$), platform access road drainage, and embankment toe ditches.

---

## 2. Mathematical Specification & Geodetic Algorithms

### 2.1 Orthogonal Alignment Projection (`projectGpsToAlignment`)
When the site engineer's GPS coordinates $(\text{lat}, \text{lon})$ are received, the engine projects the point onto the nearest Catmull-Rom centerline spline segment between station points $\mathbf{P}_1$ and $\mathbf{P}_2$:

$$\mathbf{v} = \mathbf{P}_2 - \mathbf{P}_1 = (v_x, v_y)$$
$$\mathbf{u} = \mathbf{GPS} - \mathbf{P}_1 = (u_x, u_y)$$

Where $x$ and $y$ are metric coordinates projected on the WGS-84 ellipsoid:
$$v_x = (\text{lon}_2 - \text{lon}_1) \cdot \frac{\pi R}{180} \cdot \cos(\text{lat}_{\text{avg}})$$
$$v_y = (\text{lat}_2 - \text{lat}_1) \cdot \frac{\pi R}{180}$$

The scalar projection parameter $t \in [0, 1]$ is:
$$t = \text{clamp}\left(\frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{v}\|^2}, 0, 1\right)$$

The orthogonal perpendicular distance is:
$$\text{dist}_{\perp} = \|\mathbf{u} - t\mathbf{v}\|$$

### 2.2 2D Cross-Product Transverse Offset Sign Rule
To determine whether the engineer is physically to the **Left** or **Right** of the railway track in Cartesian space ($x$ East, $y$ North):

$$\text{cross} = v_y u_x - v_x u_y$$

* **If $\text{cross} \ge 0$:** The point is clockwise/rightward of the forward vector $\mathbf{v} \implies$ **`Right of alignment (+)`**.
* **If $\text{cross} < 0$:** The point is counter-clockwise/leftward of the forward vector $\mathbf{v} \implies$ **`Left of alignment (-)`**.

### 2.3 Spherical Offset Generation (`asset_compiler.py`)
Drainage polyline features are offset from the surveyed centerline using spherical geodesics ($R = 6,371,000\text{m}$):
$$\theta_{\text{offset}} = (\theta_{\text{track}} + 90^\circ) \pmod{360^\circ} \quad \text{for Right (+)}$$
$$\theta_{\text{offset}} = (\theta_{\text{track}} - 90^\circ) \pmod{360^\circ} \quad \text{for Left (-)}$$

---

## 3. Core Capabilities & User Interface

### 3.1 Dual Map Operating Modes
* **🎨 Typology Mode (Design View):** Features are color-coded by standard detail drawing typologies:
  * **Deep Red (`#DC2626`):** Concrete Rectangular Channels Zone I ($B=2.5\text{m}, H=1.5\text{m}$).
  * **Royal Blue (`#1D4ED8`):** Type 1 Larger Variant Cutting Ditches ($B=4.0\text{--}4.5\text{m}$).
  * **Sky Blue (`#38BDF8`):** Type 1 Standard Cutting Ditches ($b=0.75\text{m}$).
  * **Amber / Orange (`#F97316`):** Type 11 Concrete Lined Crest Ditches.
  * **Emerald Green (`#059669`):** Type 12 Concrete Embankment Toe Ditches.
  * **Violet / Slate:** Cascades, Underpasses, and Box Culverts.
* **📊 Birds-Eye Progress Mode (Construction View):** Dynamic status visualization updated in real-time from site records:
  * **Alert Crimson (`#EF4444`, 6px pulse):** Logged punchlist snags, QA/QC non-conformances, or defects.
  * **Emerald Green (`#10B981`, 5px solid):** Completed & Approved structures.
  * **Construction Amber (`#F59E0B`, 6px glow):** In-progress works (`Excavation`, `Blinding`, `Rebar / Shuttering`, `Concreted`).
  * **Slate Grey (`#64748B`, 3.5px dashed 5,5):** Not Started works.

### 3.2 Dynamic Map Rotation & Compass Widget
* **Interactive Compass Button (`#btnCompass`):** Displays current map bearing and cardinal direction (e.g. `0° N`, `315° NW`).
* **True North Indicator:** Rotating SVG needle continuously indicates True North regardless of map angle.
* **One-Tap Alignment Toggle:**
  * Tap when rotated $\to$ Animates smoothly back to True North ($0^\circ$).
  * Tap when North-up $\to$ Snaps to the Section 03 nominal corridor alignment ($314.5^\circ$), orienting the tracks vertically along the phone display.
* **Two-Finger Touch Rotate:** Pinch and rotate with two fingers on mobile screens (`touchRotate: true`).
* **Desktop Rotate:** Hold **Shift** while scrolling or dragging.

### 3.3 Touch-Swipable Bottom Inspection Sheet
* **4-Snap Height System:**
  * `expanded` (80vh / 520px): Full inspection sheet for milestone recording, defect logging, and notes.
  * `mid` (~280px): Compact half-sheet leaving ~60% of the screen displaying the map.
  * `collapsed` (64px): Peek bar showing asset code, side badge, chainage, and status.
  * `hidden` (100% off-screen): Swiped down completely away to clear the viewport.
* **Native Touch Physics:** Uses native `touchstart`, `touchmove` (with `e.preventDefault()`), and `touchend` with directional flick velocity ($v = \Delta y / \Delta t$) for instant snapping.
* **Scroll-Aware Drag:** Pulling down on the sheet content when at the top (`scrollTop <= 0`) seamlessly drags the drawer down.

### 3.4 Non-Intrusive GPS "Locate Me"
* Shows user live position dot, GPS accuracy circle, and real-time HUD station readout ($PK\text{ XX+XXX} \pm \text{Offset}$).
* Operates non-intrusively: does **not** steal map focus or auto-open structure drawers unprompted while walking on site.

### 3.5 Excel Progress Export
* Exports current milestone status, defect flags, notes, and inspection timestamps to formatted Excel spreadsheet (`.xlsx`) via SheetJS.

---

## 4. Architecture & Technical Stack

```
TEAM/app/
├── index.html              # PWA shell, SVG icons, HUD banner, and drawer layout
├── styles.css              # Mobile-first slate design system, responsive drawer snaps
├── app.js                  # Core Leaflet engine, touch physics, GPS projection, rotation
├── manifest.json           # PWA standalone manifest with vector train icon
├── nginx.conf              # Production Nginx reverse proxy configuration
├── Dockerfile              # Lightweight alpine container definition
├── lib/
│   └── leaflet-rotate.js   # Offline map rotation engine (0 CDN dependencies)
├── data/
│   ├── section03_centerline.json   # 1,669 Catmull-Rom spline points (PK 82+902 to 124+521)
│   ├── section03_assets.json       # 177 georeferenced Section 03 drainage structures
│   └── bundle.js                   # Static offline bundle of centerline & assets
└── scripts/
    ├── alignment_processor.py      # Centerline splining from AutoCAD Civil 3D KMZ
    └── asset_compiler.py           # Asset projection and GeoJSON compiler
```

---

## 5. Deployment & Cloud VPS Hosting (Coolify)

### 5.1 Coolify Setup Guide
1. **Repository:** Connect your GitHub repository (`https://github.com/KingAbdulAx/site-inspection-app`) on branch `main`.
2. **Build Pack:** Select **Dockerfile**.
3. **CRITICAL Port Setting:** In Coolify application settings $\to$ **General** $\to$ **"Ports Exposes"**, set the value to **`80`** (do not leave Coolify's default `3000`, as Nginx listens on port `80`).
4. **Deploy:** Click **Deploy**. Coolify provisions an SSL certificate via Traefik automatically.

### 5.2 Zero-Stale Browser Cache Invalidation
To ensure mobile devices never execute outdated cached JavaScript when updates are pushed:
* `nginx.conf` sets `Cache-Control: no-cache, must-revalidate` on `.js`, `.css`, and `.json`, and `no-cache, no-store` on `index.html`.
* `index.html` appends version query parameters (`?v=20260907_4`) to all scripts and styles.

---

## 6. Local Development

To run locally without Docker:
```bash
cd app
python -m http.server 8080
```
Open `http://localhost:8080` in Chrome or Edge. Use DevTools device emulation (iPhone / Pixel) to test touch gestures and rotation.
