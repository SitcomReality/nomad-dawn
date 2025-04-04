# Dynamic Lighting System Plan

This plan outlines the steps to implement a dynamic lighting system, allowing objects like torches and headlights to cast light and potentially shadows.

**Constraints:** Minimize changes to existing files per step, especially those identified as being at maximum length. Prefer creating new files over complex modifications to long files.

---

**Phase 1: Basic Light Source Data (COMPLETE)**

1.  **`LightSource.js`:** Define the `LightSource` class. **(COMPLETE)**
2.  **`EntityManager.js`:** Update to track `lightSources`. Add `getLightsInRadius`. **(COMPLETE)**
3.  **`Player.js` / `Vehicle.js`:** Add properties to track light source IDs. **(COMPLETE)**

---

**Phase 2: Light Calculation (COMPLETE)**

4.  **`Game.js`:** Instantiate `LightManager`. **(COMPLETE)**
5.  **`LightManager.js`:** Create `LightManager` class. Implement `calculateLightAt`, `setGlobalAmbientLight`. **(COMPLETE)**

---

**Phase 3: Applying Light to Rendering (COMPLETE)**

6.  **`Renderer.js`:** Remove old `lightingSystem`. **(COMPLETE)**
7.  **`WorldRenderer.js`:** Modify `renderChunkTerrain` and `adjustColorForLighting` to use `LightManager`. **(COMPLETE)**
8.  **`WorldObjectRenderer.js`:** Modify `render` and `drawFallbackObject`. Remove old shadow logic. Update `adjustColorForLighting`. **(COMPLETE)**
9.  **`EntityRenderer.js`:** Modify `renderEntity` and `renderEntityOverlays`. Remove old shadow logic. **(COMPLETE)**
10. **`SpriteManager.js`:** Update `getTintedSprite` signature, logic, and cache key. **(COMPLETE)**

---

**Phase 4: Adding Light Sources (COMPLETE)**

11. Modify relevant systems (e.g., `Player` for torches) to create/destroy `LightSource` entities and add/remove them via `EntityManager`. (**COMPLETE**)
12. Ensure `LightSource` positions are updated correctly if attached to moving entities (e.g., in `LightSource.update` or `EntityManager.update`). Added offset calculation based on owner angle. Added light creation to `Vehicle`. (**COMPLETE**)

---

**Phase 5: Shadow Implementation (In Progress)**

13. Research and choose a shadow casting algorithm suitable for 2D (e.g., shadow mapping using an offscreen buffer, 2D raycasting with polygon clipping). (**COMPLETE** - Chose 2D raycasting approach)
14. Implement shadow calculation in `LightManager` or a dedicated `ShadowManager`. (**COMPLETE** - Created `ShadowManager.js`, added basic raycasting calculation logic in `calculateShadowPolygonRaycast`, integrated into Game update loop)
15. Modify renderers (`WorldObjectRenderer`, `EntityRenderer`, `WorldRenderer` for terrain) to draw calculated shadows. (**COMPLETE** - Added `renderShadows` to `Renderer.js` with basic polygon drawing).
16. Refine shadow polygon generation in `ShadowManager.calculateShadowPolygonRaycast`:
    *   Implement silhouette edge detection for convex polygons (start with rectangles). (**COMPLETE**)
    *   Correctly order vertices to form the final shadow polygon using the silhouette vertices and projected ray endpoints. (**COMPLETE**)
    *   Clip the generated shadow polygon against the light's range or a maximum shadow distance. (**Partially Complete** - Uses max distance projection, but explicit clipping step might be needed).

---

**Phase 5 - NEXT STEPS:**

1.  **Refine Shadow Rendering:**
    *   **Experiment with Shadow Mask:** Implement shadow rendering using an offscreen shadow mask buffer in `Renderer.renderShadows`. This involves:
        *   Creating an offscreen canvas (e.g., `this.shadowMaskCanvas`).
        *   Clearing the mask (e.g., fill with white or transparent).
        *   Drawing all calculated `shadowPolygons` onto the mask canvas (e.g., with solid black).
        *   Drawing the `shadowMaskCanvas` onto the main game canvas using a suitable `globalCompositeOperation` (e.g., 'multiply' or 'destination-in') after drawing the world and entities but before UI/effects.
    *   Ensure correct drawing order.
2.  **Optimize Shadow Calculation:**
    *   Cache caster geometry in `ShadowManager` (e.g., using `casterCache`).
    *   Optimize caster finding (use viewport culling more effectively).
    *   Potentially skip calculations for lights/casters far off-screen or lights with very low intensity.
3.  **Handle Complex Shapes:** Extend `getCasterGeometry` and silhouette finding to handle non-rectangular or rotated shapes if necessary.
4.  **Improve Edge Cases:** Refine silhouette detection for edge cases (light very close to caster, light on an edge/vertex).

---





