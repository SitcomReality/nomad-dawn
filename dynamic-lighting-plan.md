# Dynamic Lighting System Plan

This plan outlines the steps to implement a dynamic lighting system, allowing objects like torches and headlights to cast light and potentially shadows.

**Constraints:** Minimize changes to existing files per step, especially those identified as being at maximum length. Prefer creating new files over complex modifications to long files.

---

**Phase 1: Basic Light Source Data (COMPLETE)**

*   `LightSource.js`
*   `EntityManager.js`
*   `Player.js` / `Vehicle.js`

**Phase 2: Light Calculation (COMPLETE)**

*   `Game.js`
*   `LightManager.js`

**Phase 3: Applying Light to Rendering (COMPLETE)**

*   `Renderer.js`
*   `WorldRenderer.js`
*   `WorldObjectRenderer.js`
*   `EntityRenderer.js`
*   `SpriteManager.js`

**Phase 4: Adding Light Sources (COMPLETE)**

*   Modified relevant systems (`Player`, `Vehicle`) to create/destroy `LightSource` entities via `EntityManager`.
*   Ensured `LightSource` positions update correctly if attached.

**Phase 5: Shadow Implementation (In Progress)**

*   Research and choose algorithm (**COMPLETE** - 2D Raycasting).
*   Implement shadow calculation in `ShadowManager.js` (`calculateShadowPolygonRaycast`). (**COMPLETE**)
*   Refine polygon generation (`getCasterGeometry`, silhouette edge detection, vertex ordering). (**COMPLETE**)
*   Implement shadow rendering using an offscreen shadow mask buffer in `Renderer.js`. (**COMPLETE**)
    *   Added `shadowMaskCanvas` and `shadowMaskCtx` to `Renderer`.
    *   Modified `Renderer.renderShadows` to draw polygons onto the mask.
    *   Modified `Renderer.renderShadows` to apply the mask to the main canvas using `'multiply'` blend mode after world/entities are drawn.

---

**Phase 5 - NEXT STEPS:**

1.  **Optimize Shadow Calculation:**
    *   Cache caster geometry in `ShadowManager` (e.g., using `casterCache`).
    *   Optimize caster finding (use viewport culling more effectively).
    *   Potentially skip calculations for lights/casters far off-screen or lights with very low intensity.
2.  **Handle Complex Shapes:** Extend `getCasterGeometry` and silhouette finding to handle non-rectangular or rotated shapes if necessary.
3.  **Improve Edge Cases:** Refine silhouette detection for edge cases (light very close to caster, light on an edge/vertex).
4.  **Visual Refinements:**
    *   Experiment with softer shadow edges (e.g., using blur on the mask or gradient fills).
    *   Adjust shadow color/opacity (`rgba(0, 0, 0, 0.3)` in `Renderer.renderShadows` is currently used).

---

