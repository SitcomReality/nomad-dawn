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

**Phase 4: Adding Light Sources (Step 11 COMPLETE, Step 12 NEXT)**

11. Modify relevant systems (e.g., `Player` for torches) to create/destroy `LightSource` entities and add/remove them via `EntityManager`. (**COMPLETE - Added player light**)
12. Ensure `LightSource` positions are updated correctly if attached to moving entities (e.g., in `LightSource.update` or `EntityManager.update`). **(NEXT - Currently handled by `LightSource.update`)**

---

**Phase 5: Shadow Implementation (Advanced)**

13. Research and choose a shadow casting algorithm suitable for 2D (e.g., shadow mapping using an offscreen buffer, 2D raycasting).
14. Implement shadow calculation in `LightManager` or a dedicated `ShadowManager`.
15. Modify renderers (`WorldObjectRenderer`, `EntityRenderer`) to draw calculated shadows based on light source positions and occluder geometry.

---

