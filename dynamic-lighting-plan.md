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

---

**Phase 5 - NEXT STEPS:**

16. ~~Implement actual 2D raycasting algorithm in `ShadowManager.calculatePolygonForCaster` to generate geometrically correct shadow polygons based on light position and caster vertices. This will involve:~~
    *   ~~Identifying silhouette edges of the caster relative to the light.~~
    *   ~~Projecting rays from the light through the silhouette vertices.~~
    *   ~~Calculating intersection points with a maximum shadow range or viewport bounds.~~
    *   ~~Constructing the final shadow polygon vertices in the correct order.~~ **(Partially Complete - Basic raycasting implemented, needs silhouette finding and proper polygon construction)**
17. Refine shadow polygon generation in `ShadowManager.calculateShadowPolygonRaycast`:
    *   Implement silhouette edge detection for convex polygons (start with rectangles).
    *   Correctly order vertices to form the final shadow polygon using the light source, silhouette vertices, and projected ray endpoints.
    *   Clip the generated shadow polygon against the light's range or a maximum shadow distance.
18. Refine shadow rendering in `Renderer.renderShadows`:
    *   Consider using an offscreen shadow mask buffer for better blending and performance (e.g., draw all shadows to a mask, then draw the mask over the world).
    *   Ensure correct drawing order (shadows should typically be drawn after the main world/entities but before certain effects or UI).
19. Optimize shadow calculation:
    *   Cache caster geometry.
    *   Optimize caster finding (spatial partitioning?).
    *   Potentially skip calculations for lights/casters far off-screen.

---



