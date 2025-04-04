# World Feature & Resource Synchronization Plan

This plan outlines the steps to synchronize procedurally generated world features (trees, rocks) and resources across all clients using a shared world seed and track collected resources in the shared `roomState`. It also includes synchronizing the time of day.

**Goal:** Ensure all players see the same world features and resources in the same locations, and that collected resources disappear for everyone. Ensure all players experience the same time of day.

**Constraints:** Minimize changes to existing files per step, especially those identified as being at maximum length (`js/ui/InventoryUI.js`, `js/entities/VehicleBuildingManager.js`, `js/entities/Player.js`, `js/rendering/WorldRenderer.js`, `js/ui/BuildingToolPanel.js`, `js/core/NetworkManager.js`). Prefer creating new files over complex modifications to long files.

---

**Phase 1: World Seed Synchronization (COMPLETE)**

*   Defined `worldSeed` in `roomState`.
*   `NetworkManager` handles receiving/proposing the seed.
*   `Game` waits for and uses the confirmed seed for `World` initialization.

---

**Phase 2: Deterministic Generation per Chunk (COMPLETE)**

1.  **Created Seeded RNG Utility:** `utils/SeedableRNG.js`.
2.  **Updated Generators:**
    *   `FeatureGenerator.generateFeaturesForChunk` now accepts `worldSeed`, creates a chunk-specific `SeedableRNG`, and uses it for placement and variation.
    *   `ResourceGenerator.generateResourcesForChunk` now accepts `worldSeed`, creates chunk-specific `SeedableRNG` instances (separate for common/rare), and uses them for placement and variation.
3.  **Updated World/ChunkManager:** `World` passes its `seed` to `ChunkManager.generateChunk`, which then passes it to the generators.

*   *Files modified:* `FeatureGenerator.js`, `ResourceGenerator.js`, `World.js`, `ChunkManager.js`.
*   *New file:* `utils/SeedableRNG.js`.

---

**Phase 3: Time of Day Synchronization (COMPLETE)**

1.  **Defined `timeOfDay` in RoomState:** Standard field established.
2.  **NetworkManager Time Handling:**
    *   Modified `subscribeRoomState` callback in `NetworkManager` to call `game.setTimeOfDay(roomState.timeOfDay)`.
    *   Modified `NetworkManager` to handle `connected` and `disconnected` events by calling `game.handlePeersChanged()`.
3.  **Game Time Update:**
    *   Added `timeAuthority` flag to `Game`.
    *   Added `determineTimeAuthority` method based on sorted client IDs.
    *   Added `handlePeersChanged` to re-evaluate authority when peers change.
    *   Modified `Game.update` loop: Only the client with `timeAuthority` increments `timeOfDay` and sends periodic `updateRoomState` for `timeOfDay`.
    *   Added `setTimeOfDay` method in `Game` for `NetworkManager` to call.
    *   Ensured renderer uses the potentially network-updated `game.timeOfDay`.

*   *Files potentially modified:* `Game.js` (existing), `NetworkManager.js` (existing, max length - minimal changes made), `World.js` (existing - added call in sync).

---

**Phase 4: Resource Tracking in RoomState (NEXT)**

1.  **Define Resource State:**
    *   Establish `resources` as a standard field within `room.roomState`. This will be an object mapping `resourceId` to its *current* state (e.g., `{ amount: 50 }` or `null` if collected).
2.  **World State Application:**
    *   Modify `World.syncFromNetworkState`: Process `roomState.resources`.
    *   Create/Modify `World.updateResourcesFromNetwork`: Iterate received `networkResources`, find the corresponding local resource (generated deterministically), and update its state (e.g., mark as collected or change amount).
3.  **Chunk Manager Handling:** Ensure generated resources can be found/accessed by ID after generation.

*   *Files potentially modified:* `World.js` (existing). `NetworkManager.js` might need minor adjustments if it brokers this data flow explicitly (try to avoid modifying).

---

**Phase 5: Update Collection Logic**

1.  **Refactor Collection:**
    *   Move the resource collection logic (`requestCollectResource`) out of `Player.js` (which is too long) and into `InteractionManager.js`.
2.  **Modify `InteractionManager.requestCollectResource`:**
    *   When a player collects a resource:
        *   Trigger local visual effect.
        *   Send `updateRoomState({ resources: { [resource.id]: null } })`.
        *   Update player's local resource count.
        *   Send player `presence` update for inventory: `room.updatePresence({ resources: player.resources })`.

*   *Files potentially modified:* `Player.js` (existing, long - logic removal), `InteractionManager.js` (existing - logic addition).

---

**Phase 6: Update Rendering Logic**

1.  **Create `WorldObjectManager`:** New class `js/world/WorldObjectManager.js`.
    *   Holds generated features/resources.
    *   Receives `roomState.resources` updates.
    *   Provides `getVisibleObjects(area)` method, filtering out collected objects based on `roomState` overrides.
2.  **Refactor `WorldRenderer`:**
    *   Modify `WorldRenderer.renderChunk`: Call `game.worldObjectManager.getVisibleObjects()` instead of iterating `chunk.features`/`resources` directly. Render only returned objects.
3.  **Integrate `WorldObjectManager`:** Instantiate in `Game.js`, pass `roomState.resources` updates, register generated objects from chunks.

*   *Files potentially modified:* `WorldRenderer.js` (existing, long - logic removal/simplification), `Game.js` (existing), `World.js` (existing), `ChunkManager.js` (existing).
*   *New file:* `js/world/WorldObjectManager.js`.

---

**Phase 7: (Future) Resource Respawn/Cleanup**

*   Server-side or host-client logic to periodically remove `null` entries from `roomState.resources`, allowing respawn.

---

