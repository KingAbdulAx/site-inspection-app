# Kano–Maradi–Dutse Railway Project (Section 03: KZDR)
## Drainage Field Inspector & Spatial Alignment PWA

An offline-first, mobile Progressive Web Application (PWA) engineered for civil and drainage inspection engineers on the **Kano–Maradi–Dutse Railway Project (Section 03: Kazaure to Daura, PK 82+902 to PK 124+521)**.

---

## 0. The app: "The line is the map" (visual redesign)

`index.html` is the redesigned app from *Drainage Inspector – Visual Redesign* ("Survey signage"). The previous map-and-list app is still available as `legacy.html`, and is linked from **Section → Switch → Classic app**.

| Screen | What it does |
|---|---|
| **Walk · Strip** | Chainage runs up the screen, and offset becomes five fixed lanes a side (OFF, CREST, TOE, FACE, PLAT). You get a ±20 m band and a reading line, and the strip turns with you when you face decreasing chainage. Outline = the drawing, hatched = part-built, solid = complete. Exact, ±4 m and LABEL positions are drawn differently. Drag to look ahead; tap a mark for the drawer. |
| **Walk · Map / Section** | The same position on imagery under a wash (Leaflet, bundled in `lib/`), or a cross-section at your chainage with numbered features. |
| **At-you bar** | Names the structure you are standing at. Tap it to record a stage (two taps, saved instantly, 8 s undo). The right end opens everything within 20 m, left to right as you face. Poor GPS turns the bar yellow and offers "I'm on the culvert" to fix position on an exact structure. |
| **Feature** | What is built (seen by you vs. contractor claims from the IR register), open defects with photos, the read-only drawing panel, the IR history with gaps, never-overwritten records, and "Copy with provenance". |
| **Section** | A sub-section summary: part-built / stalled > 6 months, every structure as one mark on 2 km rows or a north-up ribbon map, and the ones stalled longest. **Switch** opens the Project list (2 lines, 9 sub-sections). |
| **Day** | Records safe on the phone vs. sent, unfinished drafts, what you covered, differences from the contractor, and an offline export (CSV plus an HTML report with photos). |
| **Editing, two doors** | *The ground differs* makes a query (the design is untouched), for example built in a different place, measured against the GPS error. *The drawing changed* makes a pending design change, which must name its drawing and revision. Nothing is deleted; removed features stay struck through. |

**On a computer** the same screens get more room, and the strip stays the main view:

- **960 px and wider:** the bottom tabs become a rail on the left (with Go to, Project and the Sun/Office switch). The position header is one row. The list of everything within 20 m stays open on the right, and tapping a mark on the strip points the list at it. The record sheet and other forms dock into that column instead of rising from the bottom. Feature, Project and the other full pages open as a centred page. Section and Day read as one centred column.
- **1360 px and wider:** the section cut (or the map) sits beside the strip rather than replacing it, and follows the chainage picked in the list.
- **Keyboard:** Esc closes; digits, +, Backspace and Enter work the chainage keypad; G opens Go to; ↑ ↓ PgUp PgDn scroll the strip, like the mouse wheel.

Code: `ui/model.js` (data, append-only records, position/projection), `ui/strip.js` (strip and section-cut renderer), `ui/app.js` (shell, Walk, record sheet, layout switching), `ui/screens.js` (other screens), and `ui/desk.css` (the computer layouts). Records are appended to `KMD_WALK_RECORDS_V1` and never edited; undo appends a void. The latest stage per asset is mirrored into the existing inspection store, so `sync.js` still sends it to the office. Photos go in IndexedDB.

### Correcting the base data (extraction errors)

The drawings were extracted automatically, and some features are misplaced, mistyped, missing or duplicated. That is a third kind of change, beside a field finding and a design revision: *the drawing was read wrong*. It fixes the base, needs no revision number, and raises no query.

- **Feature → Correct the data** (also the third door in "What doesn't match?"). This changes the type, name, side, lane, start/end chainage, offset from CL (from a cross-section or measured on site), how exact the position is, and the sheet and level. "Where I stand" fills chainage or offset from GPS. **Not a real feature — remove** takes a reason and is undoable.
- **Drawer → Missing from the data** adds a feature the extraction skipped.
- **Section → Check against drawings** (or Project → Base data) works sheet by sheet. Open the PDF beside the phone, tick what is right, and tap a row to correct it. Progress shows as "N of M checked".
- **Project → Base data** exports corrections (a small JSON file), exports corrected GeoJSON for QGIS, imports corrections, and lists them all with undo.

To bake the corrections into the app's bundled data, so they become the base for everyone:

```
node scripts/apply_base_corrections.js kmd-base-corrections-YYYYMMDDHHMM.json --dry-run
node scripts/apply_base_corrections.js kmd-base-corrections-YYYYMMDDHHMM.json
```

This rewrites `data/bundle.js` / `data/section02_bundle.js` (and the `*_assets.json`) with the same code the app uses, so the result matches what you saw on the phone. Untouched features pass through unchanged, and sub-sections without corrections are not rewritten. Corrections are absolute values, so baking twice or leaving them on the phone afterwards changes nothing.

Try it without GPS: `index.html?sim=KZDR:111020:14:4` (sub-section : chainage : offset, left + : accuracy m). Use `…:38` for poor GPS or `…:none` for set-by-hand. Tests: `node scripts/test_ui_model.js`, `node scripts/test_ui_e2e.js`, `node scripts/test_ui_base_e2e.js` and `node scripts/test_ui_desk_e2e.js` (the last three use Playwright).

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

### 2.4 Phase 3 Master Linear Referencing Position Engine (`position_engine.js`)
Implements the Master Specification §5 & §10 offline position engine:
* **Piecewise-Linear Calibration:** Ground-truth surveyed 500m station labels from `KMD.kml` (570 stations for Kano–Maradi `line_km`, 216 stations for Kano–Dutse `line_kd`). Computes geodesic segment chord lengths, design spans, and segment residuals, exposing `maxResidualM` and `worstStation` for Layers inspection.
* **Side Sign Convention:** Signed perpendicular distance from the centreline: **Left = positive (> 0), Right = negative (< 0)** when facing in the direction of increasing chainage. Snapped to Center (`side: 'C'`) within 5cm.
* **Master Output Schema:** `{ line, subsection, ch, chFormatted, side, offset_m, accuracy_m, source, heading, facing, status, tier }`.
* **Dual-Line Disambiguation & Line-Stickiness Hysteresis:** Kano–Maradi mainline vs Kano–Dutse branch line both originate at Kano (PK 0+000). Resolves line by lateral distance with a 25m hysteresis threshold to prevent erratic toggling near junctions. Never resolves by chainage alone.
* **GPS Accuracy Tiers:**
  * **Good ($\le 10\text{m}$):** Normal display (`tier: 'good'`).
  * **Poor ($> 10\text{m}$):** Chainage prefixed with `≈`, side withheld as `'?'`, `tier: 'poor'`.
  * **None:** Manual keypad entry (`source: 'hand'`, `tier: 'none'`).
* **Anchor Fix ("I'm on it"):** Locks position to an exact structure's chainage with offset snapped to 0 (`source: 'anchor'`), preserves feature side, and auto-releases when GPS accuracy returns to $\le 5\text{m}$. Persists through GPS signal dropouts via `getCurrentPosition()` / `projectGps(null)`.
* **Facing & Heading Detection:** Compares GPS heading to track tangent bearing ($\le 90^\circ \implies \text{'increasing'}$, $> 90^\circ \implies \text{'decreasing'}$). Features stationary GPS jitter hysteresis ($\ge 1\text{m}$ threshold) and cross-line partition safety to prevent erratic 180° flip-flopping.
* **Inverse Coordinate Projection:** `projectChainageOffsetToGps(line, ch, offsetM)` provides sub-millimeter (< 10mm) round-trip precision with deterministic forward segment selection at station boundaries.
* **Robust Civil Station Parsing & Formatting:**
  * `formatPk` uses boundary-aware rounding (e.g. 999.8m yields `PK 1+000`, not `PK 0+1000`).
  * `parsePk` supports Portuguese / Continental European decimal comma notation (`PK 82+902,439` $\to 82902.439$).
* **Lifecycle & State APIs:** `getCurrentPosition()`, `setManualPosition()`, `clearManualPosition()`, `setAnchor()`, `clearAnchor()`, and `loadKml()`.

### 2.5 Phase 4 Master Walk Strip UI, At-You Bar, Drawer & Identify (§6.1, §6.2 & §10)
Implements the core inspection experience:
* **The Walk Strip Engine (`walk_strip.js`):**
  * **7 Offset Lanes Mirrored (11 Columns, 390px Total):** OFF (33px), CREST (33px), TOE (33px), FACE (33px), PLAT (33px), SPINE (60px), PLAT (33px), FACE (33px), TOE (33px), CREST (33px), OFF (33px).
  * **Scale & Reading Line:** 1.9 px/m when walking. Reading line sits at 80% of strip height (~225m ahead, ~60m behind). High-visibility 14px band with 2px ink edges. Current user position is a 24px hi-vis dot with 4px ink ring in the lane matching user lateral offset.
  * **Near Band:** +/-20m around reading line tinted hi-vis at 16% (`rgba(255, 209, 0, 0.16)`) with dashed edges labelled "+20 m" / "-20 m".
  * **Spine:** 4px ink centerline, ticks at 10m (5px), 50m (10px), 100m (14px, 2px thick), bold chainage labels every 50m ("111+100", "+050").
  * **Facing Flip Transformation:** When facing decreasing, the strip rotates 180° so the engineer always walks forward into the screen; lanes retain their left/right designations (Left is on engineer's right hand), and header displays "FACING ▼ decreasing".
  * **Feature Rendering:**
    * Linear features: 11px wide bar in feature's lane with outline/hatch/solid fills.
    * Derived extent ends: bar stops 4m short with 3px dotted cap exactly 4m long.
    * Type chips: 28x17px chips near top of bar (`T12`, `T1L`, etc.).
    * Crossing structures: 12px band across corridor from Left TOE to Right TOE with black exact-chainage chip on right ("+017.229").
    * Point features: 16px squares.
    * Clusters: 3+ points within 10m in one lane form a 24px count chip.
    * Label positions: 20px dashed circle with italic text ("L=28m").
    * Off-alignment features: 18x28px mark in OFF lane, dashed leader to spine, distance text.
    * Buried T6 collector: 3px dashed line inside spine.
    * Absence: none-by-design pattern with vertical text "NONE · BY DESIGN".
    * Defects: 18px red warning triangle beside mark.
  * **Power & Motion:** Zero continuous RAF looping; redraws only when position changes by >= 2m or on touch scroll/drag.
* **At-You Bar Logic & Selection Rule (`walk_view.js`):**
  * 72px touch target.
  * Prioritizes crossing and point structures nearest first, then nearest linear feature by lateral offset, then fallback to designed absence or "NEXT ▲ N m: {feature}".
  * 4 Master Variants: Normal, Poor GPS (with "I'm on Culvert EXACT" anchor button), Revision view (rev-bg with Compare button), and Empty by design.
* **WalkDrawer (`walk_drawer.js`):**
  * Slides up to cover 50% of screen; strip re-scrolls to keep reading line visible above drawer.
  * 44px category filter chips at top.
  * 72px rows sorted strictly from left to right as faced: side badge (40px), type icon + name, position certainty chip, offset & relative distance, 6-segment stage meter.
* **Identify View — Cross-Section at You (`identify_view.js`):**
  * In-plane cross-section diagram at reading chainage: embankment, ballast, rails, culvert barrel with headwalls, ditches.
  * Features within +/-20m carry numbered bubbles (① to ⑤) matching a 3x2 grid of 60px buttons, with 6th button "As a list ▲" opening the drawer.
* **Automated Verification:** 181 automated assertions in `scripts/test_walk_strip.js` verifying all 12 layout, sorting, clustering, and transformation subsystems.

### 2.6 Phase 5 Record Flow, Feature Detail & Defect Workflow (§6.3, §6.4, §6.5 & §10)
Implements the fast 2-tap field recording and defect lifecycle:
* **The Record Sheet (`record_view.js`):**
  * **2-Tap Write Flow (< 2 seconds):** Tap 1 opens the sheet; Tap 2 on any 72px smart suggestion button or 56px ladder row appends the `FieldRecord` and dismisses the sheet immediately.
  * **Presentation Header:** Side badge, cross-section icon (`TypeIcons`), chainage extent, certainty chip, and contractor claim banner.
  * **Evidence Boxes:** Side-by-side comparison of "Seen by you" (active observed stage) vs "Contractor IR" (claimed stage and IR reference).
  * **Smart Suggestion Buttons (72px):** Up to three de-duplicated quick options: Contractor claimed stage (primary), next sequential stage (`last seen + 1`), or current stage (`no change`).
  * **Dynamic Stage Ladder Adaptation:** Adapts dynamically: 7 stages for concrete-lined structures (`['Not started', 'Excavation', 'Blinding', 'Rebar', 'Shuttered', 'Concreted', 'Completed']`) vs. 3 stages for unlined earth ditches (`['Not started', 'Excavated', 'Completed']`).
  * **Auto-Discrepancy Query:** If inspector records a stage differing from the latest contractor IR, an open office query of reason `'claim_ahead'` is automatically created in `DataStore`.
  * **Secondary Actions:** "Report defect", "Flag design revision", "Add note / photo", "Cancel".
* **Toast Notification & 8-Second Undo Manager (`toast_manager.js`):**
  * Displays a non-intrusive floating toast: `Saved on this phone · {stage} · {time} · {author}`.
  * Active depleting progress bar with a high-visibility yellow "UNDO" button.
  * Tapping UNDO calls `DataStore.voidObservation()` to non-destructively void the record and rolls back the feature stage in memory.
* **Defect Reporting Workflow (`defect_view.js`):**
  * 10 standard defect type chips (44px): Scour / erosion, Cracking, Honeycombing, Blocked / silted, Alignment error, Joint failure, Exposed rebar, Outfall scour, Standing water, Other.
  * 3 severity levels: Minor (monitor), Major (rework required), Critical (safety / structural risk).
  * Snapped chainage input, field notes textarea, and GPS-stamped photo attachment support.
  * 72px red "LOG DEFECT" primary action: generates a monotonic `DEF-YYYY-NNNN` identifier, appends a `FieldRecord` of kind `'defect'`, raises an open office `Query` of reason `'defect'`, sets `has_defect = true` on the feature, and triggers an 18px red warning triangle beside the feature on the `WalkStrip`.
* **Feature Detail View (`feature_detail_view.js`):**
  * Read-only comprehensive audit sheet opened by a 500ms long-press on any `WalkStrip` feature or `WalkDrawer` row.
  * Header with side badge, full asset name, type code, sub-section, lane, and certainty chip.
  * "What is built on site" card with verdict vs contractor claim.
  * Open defects card listing all active defects.
  * "Position & Geometry" card with chainage extent, lateral offset, lane category, and tolerance.
  * "From the Drawing" card with drawing reference, revision, approval level, and cross-section dimensions.
  * Contractor IR list with outcome badges and automatic hazard warning when no contractor activity has been submitted for > 6 months.
  * Complete audit history ("never overwritten") listing all historical observations with strike-through styling on non-destructively voided records.
* **Automated Verification Suite:** 267 automated assertions in `scripts/test_record_flow.js` verifying all 9 record flow, voiding, defect, ladder, and active query subsystems.

---

## 3. Core Capabilities & User Interface

### 3.1 Dual Map Operating Modes
* **Typology Mode (Design View):** Features are color-coded by standard detail drawing typologies:
  * **Deep Red (`#DC2626`):** Concrete Rectangular Channels Zone I ($B=2.5\text{m}, H=1.5\text{m}$).
  * **Royal Blue (`#1D4ED8`):** Type 1 Larger Variant Cutting Ditches ($B=4.0\text{--}4.5\text{m}$).
  * **Sky Blue (`#38BDF8`):** Type 1 Standard Cutting Ditches ($b=0.75\text{m}$).
  * **Amber / Orange (`#F97316`):** Type 11 Concrete Lined Crest Ditches.
  * **Emerald Green (`#059669`):** Type 12 Concrete Embankment Toe Ditches.
  * **Violet / Slate:** Cascades, Underpasses, and Box Culverts.
* **Birds-Eye Progress Mode (Construction View):** Dynamic status visualization updated in real-time from site records:
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

### 3.6 Offline-First Cloud Synchronization & Multi-Device Access (Supabase)
* **100% Offline Priority:** Field records save instantly to browser `localStorage` (`KMD_DRAINAGE_INSPECTIONS_SEC03_V1`) with 0ms network latency.
* **Automatic Cloud Backup:** Queued changes (`KMD_SYNC_PENDING_QUEUE_V1`) auto-sync to Supabase PostgreSQL when internet connectivity is detected.
* **Multi-Device Synchronization:** Changes logged on a field smartphone seamlessly pull down to desktop browsers in the site office.
* **Bi-Directional LWW Conflict Resolution:** Merges edits using Last-Write-Wins timestamps (`updated_at`), protecting local field edits from being overwritten by stale cloud records.
* **Header Status Pill & Modal:** Interactive status indicator in header shows `Offline`, `Syncing...`, `Synced <time>`, or `Error`, with a cloud configuration modal for inspection team settings.

### 3.7 In-App Structure Authoring & Live Edit Mode (`edit_manager.js`)
* **Global Edit Mode Switch (`#btnToggleEditMode`):** Toggles between Read-Only Inspection Mode and Live Structure Authoring Mode with high-visibility amber status indicators.
* **Direct Structure Creation (`+ Add Structure`):**
  * Insert new drainage structures at any chainage via the SLD floating controls, Scrubber (`+ Add at PK`), or top banner.
  * Point structures (Culverts, Dissipators, Cascades, Manholes) or linear channels/ditches.
  * Accurate spatial geometry automatically calculated along the active corridor centerline spline (`computeGeometryForPk`).
* **Complete KMD Master Typology Catalog:** Pre-configured with 25 standard typologies matching drawings `MDDT-2200-DW-10001` through `10023` (Ditches Types 1–16, Cascades, Dissipators, Riprap, Box Culverts 1x/2x, Pipe Culverts Ø1000, Manholes).
* **Modify Anything & Everything:** Change typology, side (Left/Right/Cross), lane (Shoulder/Bench/Toe/Crest/Channel), start/end PK, dimensions, drawing references, and notes directly from the bottom drawer.
* **Revert & Delete Support:** Revert modified base structures back to design intent or delete structures with full synchronization.
* **Seamless PWA Offline Replication:** Structure edits queue into `localStorage` (`KMD_DRAINAGE_STRUCTURE_EDITS_V1`) and auto-push to Supabase `/rest/v1/inspections` when internet returns, with Last-Write-Wins conflict resolution.

### 3.8 Progressive Web App & Offline Caching (`sw.js`)
* **Service Worker Caching:** Automatically caches core shell assets, CSS, data bundles, and scripts for 100% offline field operation in remote railway corridors.
* **Network-Only API Pass-Through:** Supabase REST sync endpoints bypass service worker caching to ensure live data exchange is never stale.

---

## 4. Architecture & Technical Stack

```
TEAM/app/
├── index.html              # PWA shell, SVG icons, HUD banner, sync pill, drawer layout, edit modals
├── tokens.css              # Design tokens (colors, typography, dimensions, contrast)
├── fonts.css               # Self-hosted typography (Space Grotesk, JetBrains Mono, Inter)
├── components.css          # Base mobile-first components (meters, chips, badges, buttons, sheets)
├── type_catalogue.js       # Master drainage typology catalogue (25 standard details)
├── type_icons.js           # Lightweight SVG typology icons
├── data_model.js           # Decoupled entities, UUIDv7 monotonicity, revisions & conflict detection
├── data_store.js           # Append-only local storage engine, anti-LWW sync, migration backups
├── position_engine.js      # Linear referencing position engine, surveyed 500m station calibration, hysteresis
├── walk_strip.js           # Phase 4 Walk Strip 7-lane canvas & proportional layout engine (§6.1)
├── walk_drawer.js          # Phase 4 Walk Drawer 50% slide-up sheet with TypeIcons & auto-scroll (§6.1)
├── identify_view.js        # Phase 4 Identify cross-section SVG view with facing adaptation (§6.2)
├── walk_view.js            # Phase 4 Walk View shell, position header & At-You bar coordinator (§6.1, §10)
├── preview.html            # Component and Phase 4 live interactive preview mockup
├── styles.css              # Mobile-first slate design system, responsive drawer snaps, edit mode styles
├── config.js               # Supabase credentials, cloud settings, inspector device profile
├── sync.js                 # Offline-first sync engine, queue management, LWW conflict resolution
├── edit_manager.js         # Master typology catalog, structure authoring, geometric projection, edit store
├── sld_viewer.js           # Straight-Line Diagram (SLD) 6-lane linear track viewer
├── cad_viewer.js           # CAD alignment strip viewer
├── scrubber.js             # Dual-direction alignment chainage scrubber with Wagwan strip
├── dashboard.js            # Executive project KPI dashboard
├── reports.js              # Automated daily site report generator (TEAM standard markdown)
├── data_exchange.js        # Data portability engine (GeoJSON, CSV, XLSX, SQLite SQL)
├── app.js                  # Core Leaflet engine, touch physics, GPS projection, event coordination
├── sw.js                   # PWA Service Worker for offline shell and bundle caching
├── manifest.json           # PWA standalone manifest with vector train icon
├── nginx.conf              # Production Nginx reverse proxy configuration
├── Dockerfile              # Lightweight alpine container definition
├── lib/
│   └── leaflet-rotate.js   # Offline map rotation engine (0 CDN dependencies)
├── data/
│   ├── kmd_alignment_stations.json # Complete surveyed 500m station database (786 stations)
│   ├── kmd_alignment_stations_bundle.js # Offline window bundle for station datasets
│   ├── section02_centerline.json   # Section 02 Catmull-Rom spline points (PK 19+800 to 82+902)
│   ├── section02_bundle.js         # Offline bundle of Section 02 assets (1,710 features)
│   ├── bundle.js                   # Offline bundle of Section 03 assets (837 features)
│   └── section03_centerline.json   # Section 03 Catmull-Rom spline points (PK 82+902 to 124+521)
└── scripts/
    ├── test_walk_strip.js          # 12 automated test suites for Phase 4 Walk Strip & Identify (181 assertions)
    ├── test_position_engine.js     # 11 automated test suites for Phase 3 Position Engine (171 assertions)
    ├── test_phase2_model.js        # 10 automated test suites for Phase 2 Data Model (150 assertions)
    ├── test_pwa_integration.js     # Multi-section PWA integration & storage partition tests
    ├── test_sld_viewer.js          # Automated verification for SLD linear track viewer
    ├── test_new_views.js           # Automated verification for CAD/GIS, Scrubber, Dashboard, Reports
    └── test_edit_mode.js           # Automated verification for Edit Mode and offline replication
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
