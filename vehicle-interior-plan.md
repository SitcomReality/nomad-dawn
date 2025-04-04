# Plan for Implementing Vehicle Interiors and Building

**Phase 1: Basic Interior State & Transitions (COMPLETE)**

1.  **Vehicle.js:** Add grid properties (`gridWidth`, `gridHeight`, `gridTiles`, `gridObjects`, `doorLocation`, `pilotSeatLocation`). Include these in `getFullNetworkState`. (COMPLETE)
2.  **Player.js:** Add player state properties (`playerState`, `currentVehicleId`, `gridX`, `gridY`). Include in `getNetworkState` and `hasStateChanged`. Modify `update` to skip overworld movement when not in 'Overworld' state. (COMPLETE)
3.  **PlayerController.js:** Implement `handleInteractionKeyPress` to manage transitions between 'Overworld', 'Interior', and 'Piloting' states based on player position and 'E' key presses. (COMPLETE)
4.  **NetworkManager.js:** Ensure vehicle grid properties are synced correctly in `syncVehiclesFromNetwork` and included in `updateRoomState` payloads when vehicles are modified/created. (COMPLETE)
5.  **Renderer.js:** Add `InteriorRenderer`. Modify `render` to conditionally call `interiorRenderer.render` when player state is 'Interior', skipping world/entity rendering. (COMPLETE)
6.  **InteriorRenderer.js:** Create basic `InteriorRenderer` to draw a placeholder grid, tiles (Floor, Wall, Door, PilotSeat), and the player character at their grid position. (COMPLETE)

**Phase 2: Player Movement Inside Vehicle (COMPLETE)**

7.  **PlayerController.js - `handleInteriorGridMovement`:** Implement grid-based movement using WASD input. Check for valid moves (bounds, walkable tiles like 'Floor'). Update `player.gridX`, `player.gridY`, and set `player._stateChanged = true`. Add a movement cooldown. (COMPLETE)

**Phase 3: Building UI & Grid Modification (NEXT)**

8.  **UIManager.js / BaseBuildingUI.js:** Update the 'B' key handler in `UIManager` (or potentially move it to `PlayerController`) to transition the player to a 'Building' state when near their owned vehicle. The `BaseBuildingUI` needs to be triggered in this state.
9.  **BaseBuildingUI.js:** Refactor `BaseBuildingUI` to display the *vehicle's interior grid* instead of the module list/preview canvas when active. This might involve creating a new component/renderer (`VehicleGridEditorRenderer`?) or embedding grid rendering logic within `BaseBuildingUI`.
10. **VehicleGridEditorRenderer (New File/Component):** Create a component responsible for rendering the vehicle grid within the `BaseBuildingUI`. It should display tiles and objects visually. It needs to handle clicks on grid cells.
11. **BaseBuildingUI.js / PlayerController.js:** Implement click handling for the grid editor. When a cell is clicked:
    *   Determine the clicked `gridX`, `gridY`.
    *   Based on a selected tool/tile type (e.g., 'Place Floor', 'Place Wall'), prepare an update payload for the vehicle's `gridTiles` or `gridObjects`.
    *   Use `NetworkManager.updateRoomState` to send the updated `gridTiles`/`gridObjects` for the specific vehicle.
12. **InteriorRenderer.js:** Enhance to render different `gridTiles` (e.g., 'Wall' looks different from 'Floor') and basic `gridObjects` (e.g., simple shapes/colors for storage, crafting stations).

**Phase 4: Refining Interactions & Polish**

13. **PlayerController.js:** Add collision checks against `gridObjects` during `handleInteriorGridMovement`.
14. **PlayerController.js:** Implement interactions with `gridObjects` when pressing 'E' inside the vehicle (e.g., open storage, use crafting station).
15. **UI:** Add tool selection to `BaseBuildingUI` for placing different tiles/objects. Provide visual feedback during building.
16. **Sound/Effects:** Add sound effects for entering/exiting, moving, building actions.

