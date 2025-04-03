# Nomad Dawn - Project Architecture and Design Document

## Overview

Nomad Dawn is a multiplayer open-world survival game where players navigate a desolate landscape, gather resources, and construct vehicles that serve as mobile bases. The game creates a stark contrast between the harsh exterior world and customizable, safe interior spaces created by players.

### Target Specifications
- Total game asset size: <500kb (HTML, JavaScript, CSS)
- Highly efficient network code for multiplayer interactions
- Procedurally generated open world

## Core Game Concepts

### The World
- **Procedurally Generated Landscape**: Uses simplex noise to create varied terrain.
- **Biome System**: Different regions with unique resources, challenges, and appearances.
- **Day/Night Cycle**: (Planned) Changes in visibility, environmental challenges, and lighting.
- **Resource Deposits**: Scattered resources for players to collect and use for construction.
- **Environmental Features**: Trees, rocks, debris, etc., generated based on biome.

### Player Experience
- **Survival Mechanics**: Managing health, food, and energy.
- **Resource Collection**: Gathering materials needed for construction and survival.
- **Exploration**: Discovering new areas, resources, and potential allies.
- **Vehicle Construction**: Building and customizing mobile bases.
- **Base Interior Design**: (Planned) Creating a personal, safe space within vehicles.

### Multiplayer Interaction
- **Collaboration**: Players can team up to gather resources and build larger structures.
- **Trading**: Exchange of resources and items between players.
- **Presence**: Players see each other's avatars and movements in real-time.
- **Room State**: Shared world elements like resources and vehicles are synchronized.
- **Potential Conflict**: Competition for limited resources (currently minimal combat).

## Technical Architecture

### Core Systems
- **Game (`js/core/Game.js`)**: Main game class, orchestrates initialization, game loop, and core systems.
- **InputManager (`js/core/InputManager.js`)**: Handles keyboard, mouse, and touch inputs.
- **NetworkManager (`js/core/NetworkManager.js`)**: Manages WebSocket connection (`WebsimSocket`), presence, room state synchronization, and events.
- **ResourceManager (`js/core/ResourceManager.js`)**: Loads and manages game assets (images, audio, JSON).
- **EntityManager (`js/entities/EntityManager.js`)**: Manages all game entities (players, vehicles, potentially NPCs).
- **UIManager (`js/ui/UIManager.js`)**: Manages all user interface elements and interactions.
- **DebugUtils (`js/utils/DebugUtils.js`)**: Provides debugging tools and overlay.
- **Config (`js/config/GameConfig.js`)**: Centralized configuration for game parameters, resources, vehicles, sprites, etc.

### Rendering System (`js/rendering/`)
- **Renderer (`js/rendering/Renderer.js`)**: Main rendering orchestrator, manages camera, coordinates sub-renderers.
- **WorldRenderer (`js/rendering/WorldRenderer.js`)**: Renders the game world background, chunks, features, and resources.
- **EntityRenderer (`js/rendering/EntityRenderer.js`)**: Renders entities (players, vehicles) with health bars and names.
- **EffectRenderer (`js/rendering/EffectRenderer.js`)**: Manages and renders visual effects (explosions, collection).
- **UIRenderer (`js/rendering/UIRenderer.js`)**: Renders canvas-based UI elements (Minimap, Debug Overlay).
- **SpriteManager (`js/rendering/SpriteManager.js`)**: Handles loading, caching, and drawing sprites from spritesheets.

### World System (`js/world/`)
- **World (`js/world/World.js`)**: Manages world state, chunk loading, biomes, and network synchronization for world data.
- **ChunkManager (`js/world/ChunkManager.js`)**: Handles loading, unloading, and generation of world chunks.
- **ResourceGenerator (`js/world/ResourceGenerator.js`)**: Generates resource deposits within chunks based on biome rules.
- **FeatureGenerator (`js/world/FeatureGenerator.js`)**: Generates environmental features (trees, rocks) within chunks.
- **Biome (`js/world/Biome.js`)**: Defines biome types and their properties (color, resources, features).

### Entity System (`js/entities/`)
- **Player (`js/entities/Player.js`)**: Represents the player character, handles movement, interactions, inventory, and network state.
- **Vehicle (`js/entities/Vehicle.js`)**: Represents player-built vehicles, handles movement, modules, and network state.
- **(Planned) NPC (`js/entities/NPC.js`)**: Base class for non-player characters.

### UI System (`js/ui/`)
- **HUD (`js/ui/HUD.js`)**: Displays Heads-Up Display information (health, position, resources) via DOM elements.
- **InventoryUI (`js/ui/InventoryUI.js`)**: Manages the inventory interface (DOM).
- **BaseBuildingUI (`js/ui/BaseBuildingUI.js`)**: Manages the vehicle construction/modification interface (DOM).
- **MenuUI (`js/ui/MenuUI.js`)**: Manages the main game menu (DOM).
- **MinimapRenderer (`js/ui/MinimapRenderer.js`)**: Handles rendering the minimap onto its canvas element.
- **Notifications**: Managed within `UIManager` to display temporary messages.

### Styles
- **style.css (`css/style.css`)**: Contains all CSS rules for styling the game interface (HUD, menus, UI panels, etc.).

### Main Entry Point
- **index.html**: Main HTML file, sets up the canvas, UI overlay structure, and includes the main script.
- **main.js (`js/main.js`)**: Initializes the game, handles the loading screen, and starts the game loop.

### Networking Layer (Websim)
- Utilizes the `WebsimSocket` global object for real-time communication.
- **Presence**: Each player's state (position, health, resources) broadcasted frequently. Managed by `NetworkManager` and `EntityManager`.
- **Room State**: Shared state for world elements like resource locations/availability and vehicle states. Managed by `NetworkManager` and `World`/`EntityManager`.
- **Events**: Used for ephemeral actions like sound triggers (future).
- **Presence Update Requests**: Used for direct player-to-player interactions like damage.

## Planned Features / Future Development
- Day/Night Cycle with dynamic lighting and shadows.
- Combat System (player vs. player, player vs. environment/NPCs).
- NPC System (enemies, traders, quest givers).
- Expanded Crafting System (more items, tools, base modules).
- Vehicle Interior Customization.
- Sound System.
- Quest/Objective System.
- Improved Collision Detection (Spatial Partitioning).
- Persistence (saving player/world state).

