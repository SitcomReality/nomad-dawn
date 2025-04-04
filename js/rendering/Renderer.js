import WorldRenderer from './WorldRenderer.js';
import EntityRenderer from './EntityRenderer.js';
import EffectRenderer from './EffectRenderer.js';
import UIRenderer from './UIRenderer.js';
import SpriteManager from './SpriteManager.js';
import InteriorRenderer from './InteriorRenderer.js';

export default class Renderer {
    // Pass game instance to constructor
    constructor(canvas, game) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.game = game; // Store game reference
        this.resizeCanvas();
        this.setupResizeListener();

        // Camera properties
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1,
            targetZoom: 1,
            zoomSpeed: 0.1,
            // Add target reference for following
            target: null
        };

        // Initialize specialized renderers (pass game instance)
        this.spriteManager = new SpriteManager(this, game);
        this.worldRenderer = new WorldRenderer(this, game);
        this.entityRenderer = new EntityRenderer(this, game);
        this.effectRenderer = new EffectRenderer(this, game);
        this.uiRenderer = new UIRenderer(this, game);
        this.interiorRenderer = new InteriorRenderer(this, game);

        // Track last frame time for effects delta calculation
        this.lastFrameTime = performance.now();

        // Lighting system properties
        this.lightingSystem = {
            enabled: true, // Enable the lighting system by default
            timeOfDay: 0.25, // 0 to 1, 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk
            ambientLight: 1.0, // Calculated
            lightColor: { r: 255, g: 255, b: 255 }, // Calculated
            // Shadow properties
            shadowVisibility: 1.0, // Calculated alpha factor (0 at night, 1 at day)
            shadowHorizontalOffsetFactor: 0, // -1 (left) to +1 (right)
            shadowVerticalOffsetFactor: 1, // 0 (midday) to 1 (dawn/dusk lower offset)
            shadowWidthFactor: 1, // Shape modifier (wider at dawn/dusk)
            shadowHeightFactor: 1, // Shape modifier (squatter at dawn/dusk)
        };

        // Initial lighting calculation
        this.updateLightingSystem();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Notify all sub-renderers of resize if needed
        if (this.uiRenderer && this.uiRenderer.onResize) {
            this.uiRenderer.onResize();
        }
        // We might need to notify interiorRenderer too if its layout depends on canvas size
        // For now, it calculates dimensions within its render method.
    }

    setupResizeListener() {
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Update camera position to follow a target (entity or fixed point)
    updateCamera(target = null) {
        // Update target if provided
        if (target) {
             this.camera.target = target;
        }

        // Determine target coordinates
        const targetX = this.camera.target ? this.camera.target.x : 0;
        const targetY = this.camera.target ? this.camera.target.y : 0;

        // Smoothly interpolate camera position to target
        const lerpFactor = this.camera.target ? 0.1 : 0.05;
        this.camera.x += (targetX - this.camera.x) * lerpFactor;
        this.camera.y += (targetY - this.camera.y) * lerpFactor;

        // Smoothly interpolate zoom
        this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * this.camera.zoomSpeed;
    }

    // Set target zoom level (can be called externally, e.g., by mouse wheel input)
    setTargetZoom(targetZoom) {
         // Clamp zoom level
         this.camera.targetZoom = Math.max(0.2, Math.min(3, targetZoom));
    }

    // Convert world coordinates to screen coordinates
    worldToScreen(worldX, worldY) {
        const screenX = (worldX - this.camera.x) * this.camera.zoom + this.canvas.width / 2;
        const screenY = (worldY - this.camera.y) * this.camera.zoom + this.canvas.height / 2;
        return { x: screenX, y: screenY };
    }

    // Convert screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        const worldX = (screenX - this.canvas.width / 2) / this.camera.zoom + this.camera.x;
        const worldY = (screenY - this.canvas.height / 2) / this.camera.zoom + this.camera.y;
        return { x: worldX, y: worldY };
    }

    // Main render function that delegates to specialized renderers
    renderWorld(world, cameraTarget) {
        if (!world) return;

        // Update camera to follow the target (passed from Game.render)
        this.updateCamera(cameraTarget);

        // Calculate view dimensions in world coordinates
        const viewWidthWorld = this.canvas.width / this.camera.zoom;
        const viewHeightWorld = this.canvas.height / this.camera.zoom;

        // Use specialized world renderer
        this.worldRenderer.render(world, cameraTarget, viewWidthWorld, viewHeightWorld);
    }

    renderEntities(entities, localPlayer) {
        this.entityRenderer.render(entities, localPlayer);
    }

    renderEffects() {
        const currentTime = performance.now();
        const delta = currentTime - this.lastFrameTime;

        // Only update/render if time has passed
        if (delta <= 0) return;

        this.effectRenderer.render(delta, currentTime);
    }

    // Renders canvas UI elements (Minimap)
    renderUI(game) {
        this.uiRenderer.render(game);
    }

    // Renders debug DOM overlay
    renderDebugInfo(debugData) {
        this.uiRenderer.renderDebugInfo(debugData);
    }

    createEffect(type, x, y, options = {}) {
        this.effectRenderer.createEffect(type, x, y, options);
    }

    // --- Lighting System Methods ---
    setTimeOfDay(time) {
        // Only update if time actually changed significantly
        if (Math.abs(this.lightingSystem.timeOfDay - time) > 0.0001) {
            this.lightingSystem.timeOfDay = time % 1; // Ensure time wraps around 1
            this.updateLightingSystem(); // Recalculate lighting values
        }
    }

    updateLightingSystem() {
        if (!this.lightingSystem.enabled) {
            // Set defaults if disabled
            this.lightingSystem.ambientLight = 1.0;
            this.lightingSystem.lightColor = { r: 255, g: 255, b: 255 };
            this.lightingSystem.shadowVisibility = 0;
            this.lightingSystem.shadowHorizontalOffsetFactor = 0;
            this.lightingSystem.shadowVerticalOffsetFactor = 1;
            this.lightingSystem.shadowWidthFactor = 1.0;
            this.lightingSystem.shadowHeightFactor = 1.0;
            return;
        }

        const time = this.lightingSystem.timeOfDay; // 0 to 1

        // --- Shadow Calculations ---
        this.lightingSystem.shadowVisibility = Math.max(0, Math.sin(time * Math.PI));
        this.lightingSystem.shadowHorizontalOffsetFactor = Math.cos(time * Math.PI);
        this.lightingSystem.shadowVerticalOffsetFactor = Math.abs(Math.cos(time * Math.PI));

        // --- MODIFIED: Increased stretch factor by 50% ---
        // Original stretch multiplier was 2.25
        const newStretchMultiplier = 2.25 * 1.5; // = 3.375
        this.lightingSystem.shadowWidthFactor = 1.0 + this.lightingSystem.shadowVerticalOffsetFactor * newStretchMultiplier;
        // --- END MODIFIED ---
        this.lightingSystem.shadowHeightFactor = 1.0 - this.lightingSystem.shadowVerticalOffsetFactor * 0.55;

        // --- Ambient Light & Color ---
        const ambientFactor = Math.cos( (time - 0.5) * Math.PI * 2) * 0.5 + 0.5;
        this.lightingSystem.ambientLight = Math.max(0.1, ambientFactor);

        const noonR = 255, noonG = 255, noonB = 255;
        const twilightR = 255, twilightG = 180, twilightB = 100;

        const noonProximity = Math.cos( (time - 0.5) * Math.PI );
        const blendFactor = Math.max(0, noonProximity);

        let r = twilightR + (noonR - twilightR) * blendFactor;
        let g = twilightG + (noonG - twilightG) * blendFactor;
        let b = twilightB + (noonB - twilightB) * blendFactor;

        const nightFade = Math.max(0, Math.cos(time * Math.PI * 2)) * 0.5 + 0.5;
        const nightIntensityFactor = Math.max(0.2, nightFade);

        r *= nightIntensityFactor;
        g *= nightIntensityFactor;
        b *= nightIntensityFactor;

        this.lightingSystem.lightColor = {
            r: Math.floor(Math.max(0, Math.min(255, r))),
            g: Math.floor(Math.max(0, Math.min(255, g))),
            b: Math.floor(Math.max(0, Math.min(255, b)))
        };
    }
}