## Vehicle Interior/Grid Implementation Plan

This plan outlines the steps to implement the vehicle interior grid system, allowing players to enter vehicles, walk around inside on a grid, and pilot them.

**Phase 1: State Management & Basic Transitions (COMPLETE)**

1.  **`Vehicle.js` (COMPLETE):**
    *   Add properties: `gridWidth`, `gridHeight`, `gridTiles`, `gridObjects`, `doorLocation`, `pilotSeatLocation`.
    *   Update `getFullNetworkState` to include these.
    *   Pull defaults from config in constructor.
2.  **`Player.js` (COMPLETE):**
    *   Add properties: `playerState` ('Overworld' | 'Building' | 'Interior' | 'Piloting'), `currentVehicleId`, `gridX`, `gridY`, `interiorMoveSpeed`.
    *   Modify `update` to handle movement based on `playerState`.
    *   Modify `getNetworkState` and `hasStateChanged` to include new properties.
3.  **`Game.js` (COMPLETE):**
    *   Add logic to `update` to call the correct entity updates based on `playerState`.
    *   Add `handleInputInteractions` to manage state transitions ('E' key) between Overworld, Interior, and Piloting based on proximity to vehicle/door/seat.
    *   Modify `render` to switch rendering logic based on `playerState`.
4.  **`NetworkManager.js` (COMPLETE):**
    *   Update `syncVehiclesFromNetwork` to handle new vehicle grid properties.
    *   Ensure `syncFromNetworkPresence` handles the new `playerState` properties for remote players.

**Phase 2: Interior Rendering & Movement (Current)**

1.  **`InteriorRenderer.js` (COMPLETE):**
    *   Create this new file.
    *   Implement basic rendering of the vehicle grid (background, lines).
    *   Render the player character at `gridX`, `gridY`.
    *   Render markers for `doorLocation` and `pilotSeatLocation`.
    *   Add basic UI text overlay for context.
2.  **`Renderer.js` (COMPLETE):**
    *   Import and instantiate `InteriorRenderer`.
3.  **`Game.js` (COMPLETE):**
    *   Modify `render` method to call `interiorRenderer.render(vehicle, player)` when `playerState` is 'Interior'.
4.  **`Player.js` (COMPLETE):**
    *   Refine `update` logic for 'Interior' state movement. Add basic collision detection against grid boundaries (`gridWidth`, `gridHeight`). (Collision added previously).

**Phase 3: Interior Building Mode (Next Steps)**

1.  **`VehicleBuildingRenderer.js` (TODO):**
    *   Create this new file.
    *   Responsible for rendering the vehicle grid *specifically for the building UI*.
    *   Render grid cells, existing tiles/objects.
    *   Add visual cues for placing/removing objects (hover effects, placement previews).
    *   Needs methods like `show()`, `hide()`, `update(vehicle)`.
2.  **`VehicleBuildingManager.js` (TODO):**
    *   Create this new file.
    *   Handles the logic for the building UI.
    *   Manages tool selection (place tile, place object, remove).
    *   Handles clicks on the `VehicleBuildingRenderer`'s grid.
    *   Generates `updateRoomState` calls to modify `vehicle.gridTiles` and `vehicle.gridObjects` based on player actions.
3.  **`BaseBuildingUI.js` (TODO):**
    *   Modify `show`/`hide` to potentially instantiate/destroy or show/hide the `VehicleBuildingRenderer` and `VehicleBuildingManager`.
    *   Connect UI elements (tool selection buttons) to the `VehicleBuildingManager`.
    *   Change the `playerState` to 'Building' when this UI is opened.
4.  **`Game.js` (TODO):**
    *   Handle the 'Building' `playerState` in the `update` and `render` loops (prevent player movement, potentially call `vehicleBuildingManager.update`).
    *   Ensure 'E'/'Esc' interactions correctly exit the 'Building' state.

**Phase 4: Advanced Interior Features (Future)**

*   Implement collision detection for player movement within the grid against `gridObjects` (e.g., walls).
*   Add specific object types to place (beds, storage, consoles).
*   Implement interactions with interior objects.
*   Refine rendering in `InteriorRenderer` to draw actual tiles/objects based on `vehicle.gridTiles` / `vehicle.gridObjects`.
*   Synchronization improvements for multi-player building inside the same vehicle.

