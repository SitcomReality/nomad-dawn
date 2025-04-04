## Vehicle Interior/Grid Implementation Plan

This plan outlines the steps to implement the vehicle interior grid system, allowing players to enter vehicles, walk around inside on a grid, and pilot them.

**Phase 1: State Management & Basic Transitions (COMPLETE)**

*   **`Vehicle.js` (COMPLETE)**
*   **`Player.js` (COMPLETE)**
*   **`Game.js` (COMPLETE)**
*   **`NetworkManager.js` (COMPLETE)**

**Phase 2: Interior Rendering & Movement (COMPLETE)**

*   **`InteriorRenderer.js` (COMPLETE)**
*   **`Renderer.js` (COMPLETE)**
*   **`Game.js` (COMPLETE)**
*   **`Player.js` (COMPLETE)**

**Phase 3: Interior Building Mode (COMPLETE)**

1.  **`VehicleBuildingRenderer.js` (COMPLETE):** Renders the grid for the building UI.
2.  **`VehicleBuildingManager.js` (COMPLETE):** Handles building logic and tool selection.
3.  **`BaseBuildingUI.js` (COMPLETE):** Integrates the renderer and manager, handles UI interaction, and manages the 'Building' player state.
4.  **`Game.js` (COMPLETE):** Handled the 'Building' `playerState` in `update` and `render`. Ensured interaction logic considers the state.

**Phase 4: Advanced Interior Features (TODO - Next Step)**

1.  Implement collision detection for player movement within the grid against `gridObjects` (e.g., walls). (Modify `Player.update` in 'Interior' state).
2.  Add specific object types to place (beds, storage, consoles) with associated data and rendering. (Update `VehicleBuildingManager`, `VehicleBuildingRenderer`, `BaseBuildingUI`).
3.  Implement interactions with interior objects (e.g., accessing storage). (Modify `Game.handleInputInteractions` or add new input handlers).
4.  Refine rendering in `InteriorRenderer` to draw actual tiles/objects based on `vehicle.gridTiles` / `vehicle.gridObjects`.
5.  Synchronization improvements for multi-player building inside the same vehicle.
6.  Add tile/object selection UI to the `BaseBuildingUI`'s `tool-info-area`.

