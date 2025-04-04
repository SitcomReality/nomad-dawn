# Dynamic Lighting & Shadow Refactoring Plan

**Goal:** Rework the lighting and shadow system to support shadows cast by dynamic light sources (e.g., player torches, vehicle headlights) instead of relying solely on the global time-of-day cycle.

**Constraints:**
*   Prioritize incremental updates, modifying as few files as possible per step.
*   Avoid large simultaneous modifications to multiple files, especially identified long files (`js/ui/InventoryUI.js`, `js/entities/VehicleBuildingManager.js`, `js/core/Game.js`, `js/ui/BuildingToolPanel.js`, `js/entities/Player.js`, `js/core/NetworkManager.js`).
*   Prefer creating new files over significantly expanding long files. If a long file *must* be modified, consider refactoring it first or adding minimal changes.
*   Clearly document code removal with comments.

---

## Proposed Phases

### Phase 1: Light Source Representation & Management

**Goal:** Establish a way to define and track light sources within the game world.

1.  **Create `LightSource` Class (`js/lighting/LightSource.js` - New File):**
    *   Define a basic `LightSource` class.
    *   Properties: `id`, `x`, `y`, `color` (e.g., `{r, g, b}`), `intensity` (0-1), `range` (world units).
    *   May include `type` (e.g., 'ambient', 'point', 'spot' - start with 'point').
    *   Potentially add `ownerId` if attached to an entity.
    *   Basic `update(deltaTime)` method (might be empty initially).

2.  **Integrate with `EntityManager` (`js/entities/EntityManager.js`):**
    *   Add a new collection (e.g., `this.lightSources = {}`) to track `LightSource` instances separately or add a generic `getByComponent` capability.
    *   Modify `add` and `remove` methods to handle `LightSource` types appropriately.
    *   Add a method like `getLightsInRadius(x, y, radius)` for efficient querying.

3.  **Add Light Source Component (Minimal Change):**
    *   **`js/entities/Player.js` (Long File):** Add a simple `lightSourceId` property (initially `null`). Create a light source instance *in Game.js or a new LightManager system* when the player activates a 'torch' (placeholder for now) and store its ID here. Avoid adding complex light management logic directly into `Player.js`.
    *   **`js/entities/Vehicle.js`:** Add `headlightSourceIds` array property (initially empty). Similar to Player, manage instance creation elsewhere.

**Files Touched:**
*   `js/lighting/LightSource.js` (New)
*   `js/entities/EntityManager.js` (Modify: add collection, update add/remove, add query method)
*   `js/entities/Player.js` (Modify: add `lightSourceId` property - minimal change)
*   `js/entities/Vehicle.js` (Modify: add `headlightSourceIds` property - minimal change)

---

### Phase 2: Light Calculation Refactor (Tinting Only)

**Goal:** Modify entity/object rendering to calculate tinting based on nearby light sources instead of global ambient light. Shadows remain disabled/removed in this phase.

1.  **Create `LightManager` (`js/lighting/LightManager.js` - New File):**
    *   Responsible for calculating the effective light color and intensity at a given world position (`calculateLightAt(x, y)`).
    *   This method will query `EntityManager.getLightsInRadius` and aggregate light contributions based on distance, intensity, and range.
    *   Start with a simple calculation (e.g., use the brightest light within range).

2.  **Integrate `LightManager`:**
    *   Instantiate `LightManager` in `Game.js`.
    *   Pass `LightManager` reference to `Renderer.js`.

3.  **Update Tinting Logic:**
    *   **`js/rendering/Renderer.js`:** Remove `timeOfDay`, `ambientLight`, `lightColor` properties and `updateLightingSystem` method from the main `lightingSystem` object (or repurpose `lightingSystem` to hold the `LightManager`). Remove calls to `setTimeOfDay`.
    *   **`js/rendering/WorldObjectRenderer.js`:** Modify `adjustColorForLighting` (or replace it). Call `game.lightManager.calculateLightAt(obj.x, obj.y)` to get the effective light `color` and `intensity` for tinting. Update the `spriteOptions.tint` object passed to `SpriteManager`.
    *   **`js/rendering/EntityRenderer.js`:** Modify the tinting logic similarly. Call `game.lightManager.calculateLightAt(entity.x, entity.y)` for tinting calculations.
    *   **`js/rendering/SpriteManager.js`:** Ensure `getTintedSprite` accepts the calculated `effectiveLightColor` and `effectiveIntensity` (instead of global ambient light) to apply the correct tint. The `ambient` parameter in the cache key should now reflect the calculated effective intensity.

**Files Touched:**
*   `js/lighting/LightManager.js` (New)
*   `js/core/Game.js` (Modify: instantiate `LightManager`)
*   `js/rendering/Renderer.js` (Modify: remove old lighting system properties/methods, add `LightManager` reference)
*   `js/rendering/WorldObjectRenderer.js` (Modify: update tinting logic)
*   `js/rendering/EntityRenderer.js` (Modify: update tinting logic)
*   `js/rendering/SpriteManager.js` (Modify: adapt `getTintedSprite` parameters/cache key)

---

### Phase 3: Remove Old Shadow System

**Goal:** Completely remove the existing time-of-day based shadow rendering logic.

1.  **Remove Shadow Properties (`js/rendering/Renderer.js`):**
    *   Delete `shadowVisibility`, `shadowHorizontalOffsetFactor`, `shadowVerticalOffsetFactor`, `shadowWidthFactor`, `shadowHeightFactor` from the (now mostly defunct) `lightingSystem` object or the `Renderer` itself.

2.  **Remove Shadow Rendering Code:**
    *   **`js/rendering/EntityRenderer.js`:** Delete the entire "Shadow Rendering" block within `renderEntity`.
    *   **`js/rendering/WorldObjectRenderer.js`:** Delete the entire "Shadow Rendering" block within `render`.

**Files Touched:**
*   `js/rendering/Renderer.js` (Modify: remove shadow properties)
*   `js/rendering/EntityRenderer.js` (Modify: remove shadow rendering code)
*   `js/rendering/WorldObjectRenderer.js` (Modify: remove shadow rendering code)

*(Result: No shadows are drawn at all)*

---

### Phase 4: Basic Dynamic Vector Shadows

**Goal:** Implement simple shadows cast away from the *strongest* nearby light source.

1.  **Shadow Calculation Logic (`js/lighting/LightManager.js`):**
    *   Add a method `calculateDominantLightVector(x, y)` that finds the strongest light source affecting point (x, y) and returns a normalized vector pointing *away* from that light source, along with its intensity (0-1). If no significant light, return null or zero vector/intensity.

2.  **Implement Shadow Rendering:**
    *   **`js/rendering/EntityRenderer.js`:** In `renderEntity`, call `game.lightManager.calculateDominantLightVector(entity.x, entity.y)`. If a vector and intensity > 0 are returned:
        *   Calculate shadow position based on entity position + vector * displacement_factor * intensity.
        *   Calculate shadow size/shape (e.g., simple ellipse) potentially scaled by intensity.
        *   Draw the shadow with alpha based on intensity.
    *   **`js/rendering/WorldObjectRenderer.js`:** Implement the same logic within its `render` method for world objects.

**Files Touched:**
*   `js/lighting/LightManager.js` (Modify: add `calculateDominantLightVector`)
*   `js/rendering/EntityRenderer.js` (Modify: add new shadow rendering code)
*   `js/rendering/WorldObjectRenderer.js` (Modify: add new shadow rendering code)

---

### Phase 5: Refinements & Future Enhancements

*   **Multiple Shadows:** Modify `LightManager` and renderers to handle multiple light sources potentially casting multiple faint shadows, or blending light vectors.
*   **Shadow Shapes:** Improve shadow shapes beyond simple ellipses (e.g., based on sprite bounds, simple geometry).
*   **Shadow Casting:** Implement basic shadow casting where objects block light, preventing shadows from appearing *on top* of the object casting them (requires more scene depth awareness).
*   **Performance Optimization:** Optimize light source querying (spatial partitioning in `EntityManager`) and shadow rendering.
*   **Network Sync:** Add network synchronization for dynamic `LightSource` properties if they change (e.g., torches turning on/off).
*   **Spotlights:** Implement cone-shaped spotlights (requires changes to `LightSource` and light calculation logic).
*   **WebGL/Advanced Rendering:** For realistic shadows (shadow mapping), a shift to WebGL rendering would likely be necessary.

---

This phased approach introduces light sources first, then refactors tinting, removes the old system cleanly, and finally adds back a new, basic dynamic shadow system. Each phase touches a limited number of files, addressing the constraints.

