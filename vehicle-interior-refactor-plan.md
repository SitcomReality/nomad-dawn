# Vehicle Interior Systems Refactoring Plan

## 1. Introduction and Goals

The current implementation for viewing and editing vehicle interiors is spread across multiple large files with significant functional overlap, particularly in rendering logic. This makes maintenance difficult and error-prone.

The primary goals of this refactor are:
- **Consolidate Redundancy:** Merge the separate rendering logic for viewing (`InteriorRenderer`) and building (`VehicleBuildingRenderer`) into a single, unified renderer.
- **Improve Separation of Concerns:** Decouple the building logic (what happens when a user clicks) from the networking and data management logic (how changes are queued and sent).
- **Increase Modularity:** Break down the monolithic `VehicleBuildingManager` into smaller, more focused modules.
- **Enhance Maintainability:** Create a clearer data flow and a more logical file structure that is easier to understand and extend.

This refactoring will be performed in phases to ensure each step is incremental and verifiable.

---

## 2. Refactoring Phases

### Phase 1: Consolidate Rendering Logic

The most significant overlap exists between `InteriorRenderer.js` and `VehicleBuildingRenderer.js`. Both render the vehicle's grid, tiles, and objects. This phase will merge them into a single, more capable class.

-   **Step 1.1: Create a Unified Grid Renderer.**
    A new file will be created: `js/rendering/VehicleInteriorGridRenderer.js`. This class will be responsible for all 2D grid rendering for vehicle interiors. It will support different rendering "modes" (e.g., 'view' for when the player is inside, and 'build' for the editing UI) to handle mode-specific features like hover effects or player avatar rendering.

-   **Step 1.2: Merge Rendering Logic.**
    The core drawing logic for tiles, objects, special locations, and grid lines from both `InteriorRenderer.js` and `VehicleBuildingRenderer.js` will be moved into the new `VehicleInteriorGridRenderer.js`. The `render` method in the new class will accept a configuration object that specifies the mode and other relevant data (like the player's position for 'view' mode, or hovered cell for 'build' mode).

-   **Step 1.3: Update System Integrations.**
    `BaseBuildingUI.js` will be updated to use the new `VehicleInteriorGridRenderer` in 'build' mode. The main `GameLoop.js` will be modified to call the main `Renderer.js`, which will use the new grid renderer in 'view' mode whenever the player's state is 'Interior'.

-   **Step 1.4: Deprecate and Remove Old Files.**
    Once the new renderer is fully integrated and functional, `js/rendering/InteriorRenderer.js` and `js/rendering/VehicleBuildingRenderer.js` will be deleted to complete the consolidation.

### Phase 2: Separate Building Logic from Data Management

The `VehicleBuildingManager.js` file currently handles tool state, click logic, resource checking, network update queueing, and pending modification tracking. This is too many responsibilities for one file. We will extract the data and networking tasks into a dedicated module.

-   **Step 2.1: Create a Modification Queue Manager.**
    A new file will be created: `js/core/VehicleModificationQueue.js`. This class will be solely responsible for managing the queue of pending interior changes.

-   **Step 2.2: Migrate Networking Logic.**
    All logic related to queueing, batching, and sending network updates for vehicle modifications (`networkUpdateQueue`, `networkUpdateTimeout`, `sendNetworkUpdates`) will be moved from `VehicleBuildingManager.js` into the new `VehicleModificationQueue.js`.

-   **Step 2.3: Migrate Pending State Logic.**
    The logic for tracking modifications that have been sent but not yet confirmed by the network (`pendingModifications`, `confirmModifications`, `isModificationPending`) will also be moved into `VehicleModificationQueue.js`.

-   **Step 2.4: Refactor the Building Manager.**
    `VehicleBuildingManager.js` will be simplified. It will now hold an instance of `VehicleModificationQueue` and will delegate all networking and pending state tasks to it. Its primary focus will be narrowed to handling user input (grid clicks), checking resource costs, and telling the queue manager what changes to make. This makes it a pure "controller" that translates user actions into modification requests.

### Phase 3: Final Cleanup and Verification

This final phase ensures that the new, refactored system is correctly integrated and that all old dependencies have been removed.

-   **Step 3.1: Review Data Flow.**
    All affected files (`GameLoop.js`, `BaseBuildingUI.js`, `VehicleBuildingManager.js`, etc.) will be reviewed to confirm they are using the new classes correctly and that data flows logically from user input to the manager, then to the queue, and finally to the network.

-   **Step 3.2: Verify Functionality.**
    The system will be tested to ensure that both viewing a vehicle interior and modifying it in the building UI work as expected. This includes placing and removing tiles and objects, seeing pending modifications, and having those modifications confirmed correctly by the network.

-   **Step 3.3: Update Planning Documents.**
    The main `vehicle-interior-plan.md` will be updated to reflect the completion of this refactor and to outline any new opportunities for improvement that were identified during the process.

