## Vehicle Interior/Grid Implementation Plan

This plan outlines the steps to implement the vehicle interior grid system, allowing players to enter vehicles, walk around inside on a grid, and pilot them.

**Phase 1: State Management & Basic Transitions (COMPLETE)**
*   `Vehicle.js`
*   `Player.js`
*   `Game.js`
*   `NetworkManager.js`

**Phase 2: Interior Rendering & Movement (COMPLETE)**
*   `InteriorRenderer.js`
*   `Renderer.js`
*   `Game.js`
*   `Player.js`

**Phase 3: Interior Building Mode Setup (COMPLETE)**
*   `VehicleBuildingRenderer.js`
*   `VehicleBuildingManager.js`
*   `BaseBuildingUI.js`
*   `Game.js`

**Phase 4: Advanced Interior Features (In Progress)**

1.  Implement collision detection for player movement within the grid against `gridObjects` (e.g., walls). (**COMPLETE**)
2.  Add specific object types to place (walls, storage, consoles, beds) with associated data (cost, color, collision) and basic rendering in the building UI. Add UI for selecting which object to place. (**COMPLETE**)
3.  Implement interactions with interior objects (e.g., accessing storage via 'E' key). (**COMPLETE**)
4.  Refine rendering in `InteriorRenderer` to draw actual tiles/objects based on `vehicle.gridTiles` / `vehicle.gridObjects` when the player is inside (not building). (**COMPLETE**)
5.  Synchronization improvements for multi-player building inside the same vehicle. (**COMPLETE**)
6.  Refactor `BaseBuildingUI.js` into smaller modules (`BaseBuildingUI.js`, `BuildingToolPanel.js`) for better maintainability. (**COMPLETE**)
7.  Refine tile/object selection UI in `BuildingToolPanel` (e.g., better presentation, categories, tooltips showing resource costs clearly). (**COMPLETE**)
8.  Add tile placement functionality (`place_tile` tool), including defining different tile types in `GameConfig` and updating `VehicleBuildingManager`, `VehicleBuildingRenderer`, and `BuildingToolPanel`. (**COMPLETE**)
9.  Add visual locking/feedback for cell modifications in the building UI (e.g., briefly highlighting the cell being modified, showing a pending state). (**COMPLETE**)
10. **NEXT:** Implement tile/object rotation (requires changes to `VehicleBuildingManager`, `BuildingToolPanel` for selection, `VehicleBuildingRenderer`, `InteriorRenderer`, and potentially adding `angle` to `gridObjects` in `Vehicle.js` and network sync).
11. **FUTURE:** Add sprite rendering for tiles and objects in both `VehicleBuildingRenderer` and `InteriorRenderer`.








