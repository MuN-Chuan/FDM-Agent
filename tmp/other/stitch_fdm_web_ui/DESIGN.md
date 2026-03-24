# Engineering Workbench Design System: Technical Precision & AI Rationalism

## 1. Overview & Creative North Star
**Creative North Star: "The Instrumented Laboratory"**
This design system moves away from the "SaaS Dashboard" aesthetic and toward a sophisticated engineering workbench. It is designed to feel like a high-precision instrument—rational, objective, and meticulously organized. We achieve a premium feel not through decorative flourishes, but through **hyper-intentional whitespace, typographic rigor, and tonal depth.** 

To break the "template" look, we utilize **Asymmetric Information Density**: critical diagnostic data occupies expansive, airy containers, while secondary telemetry is nested in high-density utility bars. We avoid a flat, "boxy" layout by using layered surfaces that mimic physical architectural blueprints.

---

## 2. Colors & Surface Logic
The palette is rooted in a "Tech-Light" philosophy: high-key neutrals that reduce eye strain during long-form diagnostic sessions, accented by a high-functioning "Calculated Green."

### Surface Hierarchy & The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. All structural boundaries must be achieved through background shifts.
*   **Base Layer:** `surface` (#f8f9fa) – The foundation of the workbench.
*   **Secondary Zones:** `surface_container_low` (#f3f4f5) – Used for the functional sidebar and global navigation.
*   **Active Workspaces:** `surface_container_lowest` (#ffffff) – Used for primary data cards and the main AI diagnostic feed to provide maximum contrast.
*   **Nested Metadata:** `surface_container_high` (#e7e8e9) – For "well" areas within cards, such as raw G-code snippets or log file previews.

### The "Calculated Green" & Technical Accents
*   **Primary Action:** `primary` (#0d631b) – Use for "Start Print" or "Confirm Analysis."
*   **AI Suggestions:** `primary_container` (#2e7d32) – Use as a background for AI-suggested parameter changes to signal "Safe/Optimized" status.
*   **The Signature Gradient:** For primary CTAs and the header "Status Pulse," use a subtle linear gradient from `primary` to `primary_container`. This adds a "lithographic" depth that feels more custom than a flat hex fill.

---

## 3. Typography
We use a dual-font strategy to balance high-end editorial clarity with technical precision.

*   **The Editorial Anchor (Manrope):** Used for `display` and `headline` tokens. Its geometric but open nature provides an authoritative "header" feel that grounds the data-heavy interface.
*   **The Workhorse (Inter):** Used for `title`, `body`, and `label` tokens. Inter is chosen for its exceptional x-height and legibility in technical tables and long-form AI explanations.

**Hierarchy Strategy:**
*   **Diagnostics:** Use `title-md` for AI headers to ensure they feel like "Reports" rather than "Chat."
*   **Data Points:** Use `label-md` with `on_surface_variant` (#40493d) for metadata labels (e.g., "Extruder Temp") to create a clear visual distinction from the actual values.

---

## 4. Elevation & Depth
Depth in this system is a tool for focus, not decoration. We utilize **Tonal Layering** over traditional drop shadows.

*   **The Layering Principle:** To "lift" a component, move one step down the surface scale. A card using `surface_container_lowest` sitting on a `surface_container_low` background creates a natural, soft lift.
*   **Ambient Shadows:** If a floating element (like a file-drop modal) is required, use a shadow with a 24px blur, 0% spread, and 6% opacity using the `on_surface` color.
*   **Glassmorphism:** Use for the **Functional Sidebar**. Apply `surface` at 80% opacity with a `backdrop-blur` of 12px. This allows the 3D workspace or data visualizations to bleed through subtly, maintaining the "Tech-Light" transparency.
*   **Ghost Borders:** When accessibility requires a stroke (e.g., in high-glare environments), use `outline_variant` (#bfcaba) at 20% opacity. Never use 100% opaque borders.

---

## 5. Specialized Components

### AI Diagnostic Message Bubbles (The "Report" Style)
Avoid rounded "social" chat bubbles.
*   **Structure:** Rectangular blocks with a `DEFAULT` radius (0.25rem). 
*   **Styling:** Use `surface_container_lowest` for user queries and `primary_fixed` (#a3f69c) at 15% opacity for AI answers.
*   **Header:** Every AI response must start with a `label-sm` header (e.g., "DIAGNOSTIC ARCHITECTURE - 0.4ms") to reinforce the "Calculated" brand.

### Functional Sidebar
*   **Width:** `20` (4.5rem) collapsed, `16` (3.5rem) spacing units expanded.
*   **Visuals:** No border on the right. Use a background shift to `surface_container_low`.
*   **Active State:** Use a 3px vertical pill of `primary` on the far left of the active icon; do not highlight the entire icon box.

### Parameter Input Toolbars
*   **Layout:** Horizontal "Bar" layout using `surface_container_highest`.
*   **Inputs:** `None` border-radius on internal segments to create a "connected tool" feel. Use `2.5` (0.5rem) padding between units.

### Data Cards & Dashboard
*   **Constraint:** Zero divider lines.
*   **Separation:** Use `4` (0.9rem) vertical whitespace from the Spacing Scale. Use `surface_container_low` as a "trough" between `surface_container_lowest` cards.

---

## 6. Do's and Don'ts

### Do:
*   **Do** use `letter-spacing: -0.01em` on `headline-lg` to create a tighter, more "engineered" look.
*   **Do** utilize the `tertiary` (#006156) tokens for "Stable" telemetry data to differentiate from the "Active/Actionable" `primary` green.
*   **Do** use `2` (0.4rem) padding for dense data tables, but `8` (1.75rem) for AI diagnostic summaries to allow for "reading room."

### Don't:
*   **Don't** use pure black (#000000) for text. Always use `on_surface` (#191c1d) to maintain the "Tech-Light" softness.
*   **Don't** use `xl` (0.75rem) border radius on primary workbench elements; keep it to `sm` (0.125rem) or `DEFAULT` (0.25rem) to maintain a "Precision Instrument" feel.
*   **Don't** use purple, blue, or saturated red for anything other than critical "Stop" errors (`error` #ba1a1a).