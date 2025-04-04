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

**Phase 5: Shadow Implementation (NEXT)**

13. Research and choose a shadow casting algorithm suitable for 2D (e.g., shadow mapping using an offscreen buffer, 2D raycasting with polygon clipping).
14. Implement shadow calculation in `LightManager` or a dedicated `ShadowManager`. This will likely involve:
    *   Identifying potential shadow casters (entities, world objects) near each light source.
    *   Calculating shadow polygons based on light position and caster geometry.
    *   Storing shadow data efficiently.
15. Modify renderers (`WorldObjectRenderer`, `EntityRenderer`, `WorldRenderer` for terrain) to draw calculated shadows. This might involve:
    *   Rendering to an offscreen shadow mask buffer.
    *   Applying the shadow mask during the main rendering pass.
    *   OR directly drawing shadow polygons with appropriate blending.

---

