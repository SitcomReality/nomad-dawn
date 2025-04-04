# Dynamic Lighting System Plan

This plan outlines the steps to implement a dynamic lighting system, allowing objects like torches and headlights to cast light and potentially shadows.

**Constraints:** Minimize changes to existing files per step, especially those identified as being at maximum length. Prefer creating new files over complex modifications to long files.

---

**Phase 1: Basic Light Source Data (COMPLETE)**

1.  **`LightSource.js`:** Define the `LightSource` class with properties like `id`, `x`, `y`, `color`, `intensity`, `range`, `type`, `ownerId`. **(COMPLETE)**
2.  **`EntityManager.js`:** Update to track `lightSources` separately. Add `getLightsInRadius(x, y, radius)` method. **(COMPLETE)**
3.  **`Player.js` / `Vehicle.js`:** Add properties to track attached light source IDs (e.g., `player.lightSourceId`, `vehicle.headlightSourceIds`). **(COMPLETE)**

---

**Phase 2: Light Calculation (COMPLETE)**

4.  **`Game.js`:** Instantiate a new `LightManager` class. **(COMPLETE)**
5.  **`LightManager.js`:** Create the `LightManager` class. Implement `calculateLightAt(x, y)` method that finds nearby lights via `EntityManager` and calculates the combined light color/intensity at that point (considering range and falloff). Include a concept of global ambient light. **(COMPLETE)**

---

**Phase 3: Applying Light to Rendering (NEXT)**

6.  **`Renderer.js`:**
    *   Remove the old `lightingSystem` properties and methods (`setTimeOfDay`, `updateLightingSystem`).
    *   Potentially keep a reference to `game.lightManager` if needed directly, but ideally, sub-renderers get it from `game`.
7.  **`WorldRenderer.js`:**
    *   Modify `renderChunkTerrain` to use `game.lightManager.calculateLightAt(chunk.x, chunk.y)` (or a representative point) to determine the light affecting the terrain color.
    *   Remove direct usage of the old `renderer.lightingSystem`.
    *   Modify `adjustColorForLighting` to take the calculated light color/intensity instead of the old properties.
8.  **`WorldObjectRenderer.js`:**
    *   Modify `render` to get light color/intensity using `game.lightManager.calculateLightAt(obj.x, obj.y)`.
    *   Pass the calculated light color/intensity to `adjustColorForLighting`.
    *   Remove direct usage of the old `renderer.lightingSystem` for tinting/shadows. (Shadows will be removed/reworked later).
9.  **`EntityRenderer.js`:**
    *   Modify `renderEntity` to get light color/intensity using `game.lightManager.calculateLightAt(entity.x, entity.y)`.
    *   Modify `renderEntityOverlays` (if necessary, e.g., for health bars) or base entity rendering to use the calculated light.
    *   Remove direct usage of the old `renderer.lightingSystem`. (Shadows will be removed/reworked later).
10. **`SpriteManager.js`:**
    *   Update `getTintedSprite` method signature to accept the calculated light color object `{r, g, b}` and potentially an intensity value (instead of `ambientLight`). Adjust the tinting logic and cache key accordingly.

---

**Phase 4: Adding Light Sources**

11. Modify relevant systems (e.g., `Player` for torches, `Vehicle` for headlights, `VehicleBuildingManager` for placeable lights) to create/destroy `LightSource` entities and add/remove them via `EntityManager`.
12. Ensure `LightSource` positions are updated correctly if attached to moving entities (e.g., in `LightSource.update` or `EntityManager.update`).

---

**Phase 5: Shadow Implementation (Advanced)**

13. Research and choose a shadow casting algorithm suitable for 2D (e.g., shadow mapping using an offscreen buffer, 2D raycasting).
14. Implement shadow calculation in `LightManager` or a dedicated `ShadowManager`.
15. Modify renderers (`WorldObjectRenderer`, `EntityRenderer`) to draw calculated shadows based on light source positions and occluder geometry.

---

