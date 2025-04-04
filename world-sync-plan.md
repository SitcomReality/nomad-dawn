# World Feature & Resource Synchronization Plan

This plan outlines the steps to synchronize procedurally generated world features (trees, rocks) and resources across all clients using a shared world seed and track collected resources in the shared `roomState`. It also includes synchronizing the time of day.

**Goal:** Ensure all players see the same world features and resources in the same locations, and that collected resources disappear for everyone. Ensure all players experience the same time of day.

**Constraints:** Minimize changes to existing files per step, especially those identified as being at maximum length (`js/ui/InventoryUI.js`, `js/entities/VehicleBuildingManager.js`, `js/entities/Player.js`, `js/rendering/WorldRenderer.js`, `js/ui/BuildingToolPanel.js`, `js/core/NetworkManager.js`, `js/core/Game.js`). Prefer creating new files over complex modifications to long files.

---

**Phase 1: World Seed Synchronization (COMPLETE)**

*   Defined `worldSeed` in `roomState`.
*   `NetworkManager` handles receiving/proposing the seed.
*   `Game` waits for and uses the confirmed seed for `World` initialization.

---

**Phase 2: Deterministic Generation per Chunk (COMPLETE)**

*   Created `utils/SeedableRNG.js`.
*   Updated `FeatureGenerator` and `ResourceGenerator` to use chunk-specific RNGs seeded by world seed and chunk coordinates.
*   Updated `World` and `ChunkManager` to pass the world seed.

---

**Phase 3: Time of Day Synchronization (COMPLETE)**

*   Established `timeOfDay` in `roomState`.
*   `NetworkManager` syncs `timeOfDay` to `Game`.
*   `Game` determines `timeAuthority` based on sorted client IDs and updates `timeOfDay` / `roomState` if authority.

---

**Phase 4: Resource Tracking in RoomState (COMPLETE)**

*   **Defined Resource State:** Established `resources` in `room.roomState` (object mapping `resourceId` to `null` if collected).
*   **World State Application:**
    *   Modified `World.syncFromNetworkState`: Stores `roomState.resources` into `this.resourceOverrides`.
    *   Added `World.isResourceActive(resourceId)`: Checks `this.resourceOverrides` to see if a resource should be considered active (not `null`).

---

**Phase 5: Update Collection Logic (COMPLETE)**

*   **Refactor Collection:** Moved resource collection logic (`requestCollectResource`) from `Player.js` to `InteractionManager.js`.
*   **Modify `InteractionManager.requestCollectResource`:**
    *   When 'E' is pressed near a resource (`handleOverworldInteraction`), call `requestCollectResource`.
    *   `requestCollectResource` now:
        *   Triggers local visual effect.
        *   Sends `updateRoomState({ resources: { [resource.id]: null } })`.
        *   Updates player's local resource count (which flags presence update).
        *   Checks `world.isResourceActive` before attempting collection.

---

**Phase 6: Update Rendering Logic (COMPLETE)**

*   **Create `WorldObjectManager`:** New class `js/world/WorldObjectManager.js`.
    *   Stores generated features/resources.
    *   Receives `roomState.resources` updates via `updateResourceOverrides`.
    *   Provides `getVisibleObjects(bounds)` method, filtering out collected/inactive objects.
    *   Provides `findResourceById(id)` method.
*   **Integrate `WorldObjectManager`:**
    *   Instantiated in `Game.js`.
    *   `NetworkManager` passes `roomState.resources` updates to `WorldObjectManager`.
    *   `ChunkManager` registers generated objects with `WorldObjectManager` and removes them on unload.
    *   `World` uses `WorldObjectManager` for `isResourceActive` and `findResourceById`.
*   **Refactor `WorldRenderer`:**
    *   Created `js/rendering/WorldObjectRenderer.js` and moved `renderWorldObject` and `adjustColorForLighting` into it.
    *   `WorldRenderer.render` now gets visible objects from `game.worldObjectManager.getVisibleObjects()` and calls `worldObjectRenderer.render()` for each object, instead of iterating chunk features/resources.

---

**Phase 7: (NEXT) Resource Respawn/Cleanup**

*   Implement server-side or host-client logic to periodically remove `null` entries from `roomState.resources`, allowing resources to respawn based on the deterministic generator. This is likely outside the scope of the current client-side focus.

---



