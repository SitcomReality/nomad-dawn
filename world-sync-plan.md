# World Feature & Resource Synchronization Plan

This plan outlines the steps to synchronize procedurally generated world features (trees, rocks) and resources across all clients using a shared world seed and track collected resources in the shared `roomState`.

**Goal:** Ensure all players see the same world features and resources in the same locations, and that collected resources disappear for everyone.

**Constraints:** Minimize changes to existing files per step, especially those identified as being at maximum length (`js/ui/InventoryUI.js`, `js/entities/VehicleBuildingManager.js`, `js/entities/Player.js`, `js/rendering/WorldRenderer.js`, `js/ui/BuildingToolPanel.js`, `js/core/NetworkManager.js`). Prefer creating new files over complex modifications to long files.

---

**Phase 1: World Seed Synchronization**

1.  **Define Seed in RoomState:**
    *   Establish `worldSeed` as a standard field within `room.roomState`.
2.  **NetworkManager Seed Handling:**
    *   Modify `NetworkManager.initialize`:
        *   After `this.room.initialize()`, check `this.room.roomState.worldSeed`.
        *   If the seed exists, store it locally (e.g., `this.worldSeed`).
        *   If the seed *doesn't* exist AND this client is *not* a guest:
            *   Generate a new seed (`Math.random()`).
            *   Store it locally.
            *   Call `this.updateRoomState({ worldSeed: generatedSeed })` to propose it as the shared seed.
        *   If the seed doesn't exist AND this client *is* a guest, wait for the seed to appear via `subscribeRoomState`.
    *   Modify `NetworkManager.setupNetworkHandlers`:
        *   Inside `subscribeRoomState` callback: If `roomState.worldSeed` exists and the local game doesn't have a seed yet (or if it needs confirmation), update the local seed and potentially re-initialize world generation if necessary (or signal the `Game` class).
3.  **Game Initialization with Seed:**
    *   Modify `Game.initializeWorld`:
        *   Accept an optional `seed` parameter.
        *   Wait for `NetworkManager` to provide the seed before proceeding.
        *   Pass the confirmed `worldSeed` to the `World` constructor.
    *   Modify `World` constructor to accept and store the `seed`.

*   *Files potentially modified:* `NetworkManager.js` (existing, long - minimal changes), `Game.js` (existing), `World.js` (existing).

---

**Phase 2: Deterministic Generation per Chunk**

1.  **Create Seeded RNG Utility:**
    *   Create a new utility function/class (e.g., `utils/SeedableRNG.js`) that can generate deterministic sequences of random numbers based on an initial seed. It should allow creating *new* RNG instances seeded from a combination of the world seed and chunk coordinates. A simple Linear Congruential Generator (LCG) like `s = (s * a + c) % m` is sufficient.
2.  **Update Generators:**
    *   Modify `FeatureGenerator.generateFeaturesForChunk` and `ResourceGenerator.generateResourcesForChunk`:
        *   Instead of using the single `world.rng`, create a *new* seeded RNG instance for *each* chunk using the `worldSeed` and the chunk's `x, y` coordinates (e.g., `seed = worldSeed + chunkX * largePrime1 + chunkY * largePrime2`).
        *   Use this chunk-specific RNG for all placement decisions within that chunk.

*   *Files potentially modified:* `FeatureGenerator.js` (existing), `ResourceGenerator.js` (existing).
*   *New file:* `utils/SeedableRNG.js`.

---

**Phase 3: Resource Tracking in RoomState**

1.  **Define Resource State:**
    *   Establish `resources` as a standard field within `room.roomState`. This will be an object mapping `resourceId` to its *current* state (e.g., `{ amount: 50 }` or `null` if collected). Initially, this object will be empty or non-existent in `roomState`.
2.  **World State Application:**
    *   Modify `World.syncFromNetworkState`:
        *   Process `roomState.resources`.
    *   Modify `World.updateResourcesFromNetwork` (or a new method):
        *   Iterate through the received `networkResources`.
        *   For each resource ID:
            *   Find the corresponding resource object *after* it has been deterministically generated in its chunk by Phase 2.
            *   If the network state for this ID is `null`, mark the local resource object as collected (e.g., add an `isCollected: true` flag or remove it from the chunk's list *only if* it was generated).
            *   If the network state has other data (e.g., reduced `amount`), update the local resource object accordingly.
3.  **Chunk Manager Handling:**
    *   Ensure `ChunkManager.generateChunk` reliably generates resources based on the deterministic RNG (Phase 2). The application of network state (collected status) happens *after* generation, potentially in the `World` class logic that uses the generated chunk data.

*   *Files potentially modified:* `World.js` (existing). `NetworkManager.js` might need minor adjustments if it brokers this data flow explicitly.

---

**Phase 4: Update Collection Logic**

1.  **Refactor Collection:**
    *   Move the resource collection logic (`requestCollectResource`) out of `Player.js` (which is too long) and into `InteractionManager.js`.
2.  **Modify `InteractionManager.requestCollectResource`:**
    *   When a player collects a resource:
        *   Trigger the local visual effect immediately.
        *   Send an `updateRoomState` call to the network: `room.updateRoomState({ resources: { [resource.id]: null } })`. This is the primary action to sync the collection.
        *   Optionally, update the player's *local* resource count immediately for responsiveness.
        *   Send a *presence* update for the player's new resource count: `room.updatePresence({ resources: player.resources })`. This ensures other players see the collector's inventory update, but the `roomState` update handles the resource *disappearance*.

*   *Files potentially modified:* `Player.js` (existing, long - logic removal), `InteractionManager.js` (existing - logic addition).

---

**Phase 5: Update Rendering Logic**

1.  **Create `WorldObjectManager`:**
    *   Create a new class `js/world/WorldObjectManager.js`.
    *   This manager will be responsible for:
        *   Holding references to generated features/resources from chunks.
        *   Receiving `roomState.resources` updates (passed from `World` or `NetworkManager`).
        *   Providing a method like `getVisibleObjects(area)` that returns only objects that should be rendered (i.e., generated objects that are *not* marked as collected/null in the `roomState` overrides).
2.  **Refactor `WorldRenderer`:**
    *   Modify `WorldRenderer.renderChunk`:
        *   Instead of directly iterating `chunk.features` and `chunk.resources`, call `game.worldObjectManager.getVisibleObjects(chunkBounds)` (or similar).
        *   Render only the objects returned by the manager.
3.  **Integrate `WorldObjectManager`:**
    *   Instantiate `WorldObjectManager` in `Game.js`.
    *   Update `World.js` or `NetworkManager.js` to pass `roomState.resources` updates to the `WorldObjectManager`.
    *   Update `ChunkManager.js` or `World.js` to register newly generated chunk objects with the `WorldObjectManager`.

*   *Files potentially modified:* `WorldRenderer.js` (existing, long - logic removal/simplification), `Game.js` (existing), `World.js` (existing), `ChunkManager.js` (existing).
*   *New file:* `js/world/WorldObjectManager.js`.

---

**Phase 6: (Future) Resource Respawn/Cleanup**

*   This involves server-side or host-client logic to periodically remove `null` entries from `roomState.resources`, allowing the deterministic generator to effectively respawn them on clients during the next chunk load/sync. This is outside the scope of these client-side changes but completes the picture.

---

