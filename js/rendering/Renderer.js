import WorldRenderer from './WorldRenderer.js';
import EntityRenderer from './EntityRenderer.js';
import EffectRenderer from './EffectRenderer.js';
import UIRenderer from './UIRenderer.js';
import SpriteManager from './SpriteManager.js';
import InteriorRenderer from './InteriorRenderer.js';
// Assuming VehicleBuildingRenderer is handled within BaseBuildingUI or Game.render
// import VehicleBuildingRenderer from './VehicleBuildingRenderer.js';

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
        // VehicleBuildingRenderer instance is managed by BaseBuildingUI

        // Track last frame time for effects delta calculation
        this.lastFrameTime = performance.now();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        // Notify all sub-renderers of resize if needed
        if (this.uiRenderer && this.uiRenderer.onResize) {
            this.uiRenderer.onResize();
        }
        // VehicleBuildingRenderer needs resize notification if its canvas isn't fixed size
        // Assuming its canvas size is determined internally for now
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
        // Use a faster interpolation if target is null (e.g., recentering in guest mode)
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
    // Now takes cameraTarget directly instead of player
    renderWorld(world, cameraTarget) {
        if (!world) return;

        // Update camera to follow the target (passed from Game.render)
        this.updateCamera(cameraTarget);

        // Calculate view dimensions in world coordinates
        const viewWidthWorld = this.canvas.width / this.camera.zoom;
        const viewHeightWorld = this.canvas.height / this.camera.zoom;

        // Use specialized world renderer
        // Pass cameraTarget coordinates for chunk loading/visibility checks
        this.worldRenderer.render(world, cameraTarget, viewWidthWorld, viewHeightWorld);
    }

    // Takes localPlayer (can be null) for highlighting purposes
    renderEntities(entities, localPlayer) {
        this.entityRenderer.render(entities, localPlayer);
    }

    renderShadows() {
        if (!this.game.shadowManager) return;

        const shadowPolygons = this.game.shadowManager.getShadowPolygons();
        if (shadowPolygons.length === 0) return;

        this.ctx.save();
        // Simple rendering: draw semi-transparent black polygons
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'; // Shadow color and opacity

        for (const polygon of shadowPolygons) {
            if (!polygon || polygon.length < 3) continue; // Need at least 3 vertices

            const screenPolygon = polygon.map(p => this.worldToScreen(p.x, p.y));

            this.ctx.beginPath();
            this.ctx.moveTo(screenPolygon[0].x, screenPolygon[0].y);
            for (let i = 1; i < screenPolygon.length; i++) {
                this.ctx.lineTo(screenPolygon[i].x, screenPolygon[i].y);
            }
            this.ctx.closePath();
            this.ctx.fill();

            // Optional: Debug rendering for shadow polygons
            if (this.game.shadowManager.debug) {
                 this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.5)'; // Magenta border for debug
                 this.ctx.lineWidth = 1;
                 this.ctx.stroke();
            }
        }
        this.ctx.restore();

        // --- Future: Implement shadow mask rendering ---
        // 1. Create offscreen canvas (shadowMaskCanvas)
        // 2. Clear shadowMaskCanvas with transparent or fully lit color
        // 3. Draw shadow polygons onto shadowMaskCanvas with solid black/grey
        // 4. Draw shadowMaskCanvas onto the main canvas using appropriate composite operation
        //    (e.g., 'multiply' or 'destination-in' depending on approach)
    }

    renderEffects() {
        const currentTime = performance.now();
        // Calculate delta based on the game's rawDeltaTime for accuracy
        const delta = this.game.rawDeltaTime * 1000; // Convert seconds to ms

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
}