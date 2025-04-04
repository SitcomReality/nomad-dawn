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
*   **`VehicleBuildingRenderer.js` (COMPLETE):** Renders the grid for the building UI.
*   **`VehicleBuildingManager.js` (COMPLETE):** Handles building logic and tool selection.
*   **`BaseBuildingUI.js` (COMPLETE):** Integrates the renderer and manager, handles UI interaction, and manages the 'Building' player state.
*   **`Game.js` (COMPLETE):** Handled the 'Building' `playerState` in `update` and `render`. Ensured interaction logic considers the state.

**Phase 4: Advanced Interior Features (In Progress)**

1.  Implement collision detection for player movement within the grid against `gridObjects` (e.g., walls). (**COMPLETE**) (Modified `Player.update` in 'Interior' state).
2.  Add specific object types to place (walls, storage, consoles, beds) with associated data (cost, color, collision) and basic rendering in the building UI. Add UI for selecting which object to place. (**COMPLETE**) (Updated `GameConfig`, `VehicleBuildingManager`, `BaseBuildingUI`, `VehicleBuildingRenderer`).
3.  **NEXT:** Implement interactions with interior objects (e.g., accessing storage via 'E' key). (Modify `Game.handleInputInteractions`, potentially add interaction logic to `Player.js` or specific object classes if created).
4.  Refine rendering in `InteriorRenderer` to draw actual tiles/objects based on `vehicle.gridTiles` / `vehicle.gridObjects` when the player is inside (not building).
5.  Synchronization improvements for multi-player building inside the same vehicle (e.g., visual locking of cells being modified).
6.  Refine tile/object selection UI in `BaseBuildingUI` (e.g., better presentation, categories).
7.  Add tile placement functionality (`place_tile` tool).


