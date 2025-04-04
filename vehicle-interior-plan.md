# Vehicle Interior & Building Refactor - Incremental Plan

This document outlines the steps to implement the new vehicle interior system, focusing on incremental changes to minimize disruption and allow for testing at each stage.

**Core Concepts:**

*   **Vehicle Grid:** A 2D grid representing the internal layout of a vehicle.
*   **Grid Objects:** Items placed on the grid (Floor, Wall, Door, Pilot Seat, Storage, etc.).
*   **Player States:**
    *   `Overworld`: Standard gameplay, character moves on the world map.
    *   `Building`: UI overlay for editing the vehicle grid (top-down view).
    *   `Interior`: Player character exists and moves *on the vehicle grid*. Overworld is not visible/interactive.
    *   `Piloting`: Player is controlling the vehicle's movement in the `Overworld`. Interior grid is not visible.
*   **Transitions:** Specific actions (key presses near specific grid tiles or vehicles) trigger state changes.

**Data Structures:**

*   **Vehicle Data (`Vehicle.js` or new `VehicleInteriorData.js`):**
    *   `gridWidth`, `gridHeight`: Dimensions of the interior grid.
    *   `gridTiles`: An object/map storing the type of tile at each `{x},{y}` coordinate (e.g., `Floor`, `Wall`, `Door`, `PilotSeat`).
    *   `gridObjects`: An object/map storing placed objects `{objectId: {type, x, y, ...}}`.
    *   `doorLocation`: `{x, y}` of the designated entrance/exit tile.
    *   `pilotSeatLocation`: `{x, y}` of the designated pilot seat tile.
*   **Player Data (`Player.js`):**
    *   `playerState`: `'Overworld' | 'Building' | 'Interior' | 'Piloting'`.
    *   `currentVehicleId`: ID of the vehicle the player is interacting with/inside.
    *   `gridX`, `gridY`: Player's position on the vehicle grid when in `Interior` state.

---

## Implementation Steps

**Phase 1: Data Structures & Basic State Management**

1.  **Define Data & Player State:**
    *   **Modify `Vehicle.js`:** Add `gridWidth`, `gridHeight`, `gridTiles` (initially empty object), `gridObjects` (empty object), `doorLocation`, `pilotSeatLocation` properties. Initialize defaults (e.g., small grid, one door, one pilot seat for testing).
    *   **Modify `Player.js`:** Add `playerState` (default: `'Overworld'`), `currentVehicleId` (default: `null`), `gridX`, `gridY` (default: `0`).
    *   **Modify `Player.js` (`getNetworkState`, `syncFromNetworkPresence`):** Include `playerState`, `currentVehicleId`, `gridX`, `gridY` in presence updates.
    *   **Modify `Vehicle.js` (`getFullNetworkState`):** Ensure grid data (`gridWidth`, `gridHeight`, `gridTiles`, `gridObjects`, `doorLocation`, `pilotSeatLocation`) is included.
    *   *(Self-contained: Modifies `Player.js`, `Vehicle.js`)*

2.  **Basic Network Sync for Vehicle Grid:**
    *   **Modify `NetworkManager.js` (`syncVehiclesFromNetwork`):** When creating/updating vehicles from `roomState`, ensure the new grid properties are synced from `data` to the local `vehicle` entity.
    *   **Modify `NetworkManager.js` (`updateRoomState` calls):** When vehicle state needs updating (e.g., placing objects later), ensure the relevant grid properties are included in the payload.
    *   *(Self-contained: Modifies `NetworkManager.js`)*

3.  **Core State Transitions (No Rendering Yet):**
    *   **Modify `Game.js` (`update` or Input Handling):**
        *   Detect 'E' key press.
        *   If `player.playerState === 'Overworld'` and near a `vehicle`:
            *   Set `player.playerState = 'Interior'`.
            *   Set `player.currentVehicleId = vehicle.id`.
            *   Set `player.gridX, player.gridY` to `vehicle.doorLocation`.
            *   Mark player state changed for presence update.
            *   Log transition: `console.log("Transitioning to Interior")`
        *   If `player.playerState === 'Interior'`:
            *   Get current `vehicle` using `player.currentVehicleId`.
            *   If `player.gridX, player.gridY` matches `vehicle.doorLocation` and 'E' pressed:
                *   Set `player.playerState = 'Overworld'`.
                *   Set player world `x, y` to slightly outside the vehicle's position.
                *   Set `player.currentVehicleId = null`.
                *   Mark player state changed for presence update.
                *   Log transition: `console.log("Transitioning to Overworld")`
            *   If `player.gridX, player.gridY` matches `vehicle.pilotSeatLocation` and 'E' pressed:
                *   Set `player.playerState = 'Piloting'`.
                *   Call `vehicle.setDriver(player.id)`.
                *   Send `roomState` update for vehicle driver change.
                *   Mark player state changed for presence update.
                *   Log transition: `console.log("Transitioning to Piloting")`
        *   If `player.playerState === 'Piloting'` and 'E' pressed:
            *   Get current `vehicle`.
            *   Set `player.playerState = 'Interior'`.
            *   Set `player.gridX, player.gridY` to `vehicle.pilotSeatLocation`.
            *   Call `vehicle.removeDriver()`.
            *   Send `roomState` update for vehicle driver change.
            *   Mark player state changed for presence update.
            *   Log transition: `console.log("Transitioning back to Interior")`
    *   **Modify `Player.js` (`update`):** Add check: `if (this.playerState === 'Piloting' || this.playerState === 'Interior') return;` to prevent overworld movement while inside/piloting.
    *   **Modify `Vehicle.js` (`update`):** Ensure vehicle only moves if `driver` is set (already partially implemented).
    *   *(Self-contained: Modifies `Game.js`, `Player.js`, `Vehicle.js`)*

**Phase 2: Interior Rendering & Movement**

4.  **Interior Renderer:**
    *   **Create `js/rendering/InteriorRenderer.js`:**
        *   Takes `renderer`, `game` in constructor.
        *   `render(vehicle, player)` method:
            *   Gets `vehicle.gridTiles`, `vehicle.gridObjects`.
            *   Calculates grid cell size based on canvas dimensions / grid size.
            *   Clears background.
            *   Draws grid lines.
            *   Draws tiles (`Floor`, `Wall`, `Door`, `PilotSeat`) with basic colors/shapes.
            *   Draws placed objects (basic shapes for now).
            *   Draws the `player` character at `player.gridX, player.gridY`.
    *   **Modify `Renderer.js` (`render` method):**
        *   Add instance: `this.interiorRenderer = new InteriorRenderer(this, game);`
        *   Inside `render()`: Add a check for `game.player.playerState === 'Interior'`.
        *   If `'Interior'`, call `this.interiorRenderer.render(currentVehicle, game.player)` and *skip* `renderWorld` and `renderEntities`.
    *   *(Self-contained: Creates `InteriorRenderer.js`, modifies `Renderer.js`)*

5.  **Interior Player Movement:**
    *   **Modify `Player.js` (`update`):**
        *   Remove the early return added in Step 3.
        *   Add `else if (this.playerState === 'Interior') { ... }` block.
        *   Inside this block:
            *   Get WASD input using `input.getMovementDirection()`.
            *   Calculate `nextGridX`, `nextGridY`.
            *   Check for collisions on the grid (walls, objects) using `vehicle.gridTiles` and `vehicle.gridObjects`.
            *   If no collision, update `this.gridX = nextGridX`, `this.gridY = nextGridY`.
            *   Mark player state changed for presence update.
    *   *(Self-contained: Modifies `Player.js`)*

**Phase 3: Building Mode UI & Grid Editing**

6.  **Refactor BaseBuildingUI:**
    *   **Rename `js/ui/BaseBuildingUI.js` -> `js/ui/VehicleBuildingRenderer.js`:** This file will now *only* handle DOM updates, displaying the grid, and rendering UI elements based on data provided.
    *   **Create `js/ui/VehicleBuildingManager.js`:** This class will handle the logic:
        *   Detecting 'B' key press.
        *   Finding nearby vehicle.
        *   Entering/exiting the `Building` state (`player.playerState`).
        *   Managing the selected tool/object to place.
        *   Handling clicks on the rendered grid (via `VehicleBuildingRenderer`).
        *   Calculating placement validity.
        *   Calling `NetworkManager` to update `roomState` when grid changes occur.
        *   Instantiating and calling methods on `VehicleBuildingRenderer`.
    *   **Modify `UIManager.js`:** Replace `BaseBuildingUI` with `VehicleBuildingManager`. Update instantiation and references.
    *   *(Self-contained: Renames `BaseBuildingUI.js`, creates `VehicleBuildingManager.js`, modifies `UIManager.js`)*

7.  **Implement Building Mode Grid Display:**
    *   **Modify `VehicleBuildingRenderer.js`:**
        *   Remove old preview canvas and stats display logic/elements.
        *   Add a container element (e.g., `<div id="building-grid-display"></div>`).
        *   Implement a `renderGrid(vehicle)` method:
            *   Generates HTML/SVG/Canvas elements to represent the `vehicle.gridTiles` and `vehicle.gridObjects`.
            *   Adds click listeners to grid cells/elements, calling back to `VehicleBuildingManager`.
        *   Implement methods like `show()`, `hide()`, `update()`, called by `VehicleBuildingManager`.
    *   **Modify `VehicleBuildingManager.js`:** Call `renderer.renderGrid(activeVehicle)` when entering `Building` state and when grid data changes.
    *   *(Self-contained: Modifies `VehicleBuildingRenderer.js`, `VehicleBuildingManager.js`)*

8.  **Implement Basic Grid Editing (Place/Remove Floor/Wall):**
    *   **Modify `VehicleBuildingRenderer.js`:** Add UI elements (buttons) for selecting "Place Floor", "Place Wall", "Remove".
    *   **Modify `VehicleBuildingManager.js`:**
        *   Track the `selectedTool` ('place_floor', 'place_wall', 'remove').
        *   Handle UI button clicks to set `selectedTool`.
        *   Handle grid click callbacks:
            *   Determine clicked `gridX`, `gridY`.
            *   Based on `selectedTool`, prepare the grid update data (modify `gridTiles`).
            *   Send `roomState` update via `NetworkManager`: `updateRoomState({ vehicles: { [vehicleId]: { gridTiles: { [`${gridX},${gridY}`]: newTileType / null } } } })`.
    *   **Modify `NetworkManager.js` (`syncVehiclesFromNetwork`):** Ensure `gridTiles` updates are merged correctly into the local vehicle data.
    *   *(Self-contained: Modifies `VehicleBuildingRenderer.js`, `VehicleBuildingManager.js`, `NetworkManager.js`)*

**Phase 4: Object Placement & Interaction**

9.  **Define & Place Grid Objects:**
    *   **Modify `GameConfig.js`:** Define `GRID_OBJECT_TYPES` (e.g., `StorageContainer`, `CraftingBench`, including size, cost, sprite).
    *   **Modify `VehicleBuildingRenderer.js`:** Add UI for selecting placeable objects from `GRID_OBJECT_TYPES`.
    *   **Modify `VehicleBuildingManager.js`:**
        *   Handle object selection from UI.
        *   Handle grid clicks for placement:
            *   Check cost against player resources.
            *   Check placement validity (space available, not overlapping).
            *   If valid, deduct resources, generate object ID, prepare update data (add to `gridObjects`).
            *   Send `roomState` update via `NetworkManager`: `updateRoomState({ vehicles: { [vehicleId]: { gridObjects: { [newObjectId]: newObjectData } } } })`.
        *   Implement logic for removing objects (update `gridObjects: { [objectId]: null }`).
    *   **Modify `NetworkManager.js` (`syncVehiclesFromNetwork`):** Ensure `gridObjects` updates are merged correctly.
    *   *(Self-contained: Modifies `GameConfig.js`, `VehicleBuildingRenderer.js`, `VehicleBuildingManager.js`, `NetworkManager.js`)*

10. **Render & Interact with Grid Objects:**
    *   **Modify `InteriorRenderer.js`:** Use sprites (if available) or distinct shapes/colors to draw objects from `vehicle.gridObjects`.
    *   **Modify `Player.js` (`update` - Interior state):** Check if player is adjacent to an interactive object (e.g., StorageContainer).
    *   **Modify `Game.js` (Input Handling - Interior state):** If player presses 'E' while adjacent to an interactive object, trigger the object's interaction (e.g., open storage UI - requires new UI elements).
    *   *(Self-contained: Modifies `InteriorRenderer.js`, `Player.js`, `Game.js`, potentially requires new UI)*

---

This plan breaks the feature into smaller, manageable steps, focusing on data, state, rendering, and UI separately. Each step modifies a limited number of files, reducing the risk of complex merge conflicts or system-wide failures during development. Remember to test thoroughly after each step.