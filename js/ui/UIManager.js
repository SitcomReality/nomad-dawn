import InventoryUI from './InventoryUI.js';
import BaseBuildingUI from './BaseBuildingUI.js';
import HUD from './HUD.js';
import MenuUI from './MenuUI.js';
// Import BuildingToolPanel if needed for direct access (unlikely)
// import BuildingToolPanel from './BuildingToolPanel.js';

export default class UIManager {
    constructor(game) {
        this.game = game;
        this.activeUI = null; // Tracks which major UI panel is open (Inventory, Building, Menu)
        this.isGuestMode = false; // Track guest mode locally

        // Initialize UI components
        this.hud = new HUD(game, 'hud');
        this.inventory = new InventoryUI(game);
        this.baseBuilding = new BaseBuildingUI(game); // This now internally manages its sub-panels
        this.menu = new MenuUI(game);

        // Debug overlay reference (controlled by DebugUtils now)
        this.debugOverlay = document.getElementById('debug-overlay');

        // Controls info panel reference
        this.controlsInfo = document.getElementById('controls-info-bottom-left');

        // HUD Buttons Cache
        this.toggleControlsBtn = document.getElementById('toggle-controls');
        this.toggleDebugBtn = document.getElementById('toggle-debug');
        this.gameMenuBtn = document.getElementById('game-menu-button');
        // Potentially buttons inside inventory/building UI if needed

        // Set up notifications system
        this.notifications = {
            container: null,
            queue: [],
            maxNotifications: 3,

            init: () => {
                this.notifications.container = document.getElementById('notifications-container');
                if (!this.notifications.container) {
                    console.error("Notifications container #notifications-container not found!");
                }
            },

            show: (message, type = 'info', duration = 3000) => {
                if (!this.notifications.container) return;

                const notification = document.createElement('div');
                notification.className = `notification notification-${type}`;
                // Basic sanitization - replace < and > to prevent HTML injection
                const sanitizedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
                notification.innerHTML = `<div class="notification-content">${sanitizedMessage}</div>`;

                this.notifications.queue.push(notification);
                this.notifications.update();

                setTimeout(() => {
                    notification.classList.add('fade-out');
                    setTimeout(() => {
                        this.notifications.remove(notification);
                    }, 300);
                }, duration);
            },

            remove: (notification) => {
                if (!this.notifications.container) return;

                const index = this.notifications.queue.indexOf(notification);
                if (index !== -1) {
                    this.notifications.queue.splice(index, 1);
                    if (notification.parentNode === this.notifications.container) {
                        this.notifications.container.removeChild(notification);
                    }
                    this.notifications.update();
                }
            },

            update: () => {
                if (!this.notifications.container) return;

                const currentNotifications = Array.from(this.notifications.container.children);
                currentNotifications.forEach(child => child.remove());

                const visibleNotifications = this.notifications.queue.slice(-this.notifications.maxNotifications);
                visibleNotifications.forEach(notification => {
                    if (!notification.classList.contains('fade-out')) {
                        this.notifications.container.appendChild(notification);
                    }
                });
            }
        };

        // Initialize notifications system
        this.notifications.init();

        // Set up key bindings and event listeners
        this.setupEventListeners();

        // Initial UI state based on potential guest mode
        this.setGuestMode(this.game.isGuestMode);
    }

    // Method to update UI elements based on guest mode status
    setGuestMode(isGuest) {
        this.isGuestMode = isGuest;
        // Disable/hide buttons or elements inappropriate for guests
        // Example: Hide inventory and build buttons if they exist as direct HUD elements
        // If they are toggled by keys (I, B), the key handler needs the check.
        // If they are part of the main menu, the menu items could be disabled.

        // For now, we rely on keydown listener checks, but could hide buttons too:
        // const inventoryButton = document.getElementById('hud-inventory-button'); // Example ID
        // if (inventoryButton) inventoryButton.style.display = isGuest ? 'none' : 'block';

         const buildButton = document.getElementById('hud-build-button'); // Example ID
         if (buildButton) buildButton.style.display = isGuest ? 'none' : 'block';

         // Ensure Inventory/Build UIs are hidden if switching to guest mode while open
         if (isGuest) {
            if(this.inventory.isVisible) this.inventory.hide();
            if(this.baseBuilding.isVisible) this.baseBuilding.hide();
         }
    }

    setupEventListeners() {
        // Global key handlers for UI
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Handle Escape key globally
            if (e.code === 'Escape') {
                e.preventDefault();
                if (this.menu.isVisible) {
                    this.menu.hide();
                } else if (this.inventory.isVisible) {
                    this.inventory.hide();
                } else if (this.baseBuilding.isVisible) {
                    this.baseBuilding.hide();
                } else if (!this.isGuestMode) { // Guests cannot open menu with Esc
                    this.menu.show();
                }
            }

            // Specific UI toggles (prevent if guest)
            if (!this.isGuestMode) {
                 if (!this.isMajorUIActive() || e.code === 'Escape') { // Allow Esc even if UI is open
                    switch (e.code) {
                        case 'KeyI':
                            e.preventDefault();
                            this.inventory.toggle();
                            break;
                        case 'KeyB':
                            e.preventDefault();
                            this.baseBuilding.toggle();
                            break;
                    }
                }
            } else {
                 // Guests might still use some keys, but not I or B for core UI
                 // Example: Allow debug toggle for guests?
                 if (e.code === 'Backquote' && e.ctrlKey) {
                     // Debug toggle handled by DebugUtils globally
                 }
            }
        });

        // HUD Button Listeners
        if (this.toggleControlsBtn && this.controlsInfo) {
            this.toggleControlsBtn.addEventListener('click', () => {
                const show = this.controlsInfo.classList.toggle('hidden');
                this.toggleControlsBtn.classList.toggle('active', !show);
            });
        }

        if (this.toggleDebugBtn && this.debugOverlay) {
            this.toggleDebugBtn.addEventListener('click', () => {
                const enabled = this.game.debug.toggle();
                this.toggleDebugBtn.classList.toggle('active', enabled);
            });
            // Initial state sync
            this.toggleDebugBtn.classList.toggle('active', this.game.debug.isEnabled());
        }

        if (this.gameMenuBtn) {
            this.gameMenuBtn.addEventListener('click', () => {
                 // Guests cannot open the menu via the button
                 if (!this.isGuestMode) {
                    this.menu.toggle();
                 } else {
                     this.showNotification("Menu unavailable in Guest Mode", "warn");
                 }
            });
        }
    }

    // Helper to check if Inventory, Building, or Menu is open
    isMajorUIActive() {
        return this.inventory.isVisible || this.baseBuilding.isVisible || this.menu.isVisible;
    }

    update() {
        // Update HUD data (always update, even for guests to see world state changes reflected)
        this.hud.update();

        // Update specific UI components only if they are visible and not in guest mode
        if (!this.isGuestMode) {
            if (this.inventory.isVisible) {
                this.inventory.update();
            }
            if (this.baseBuilding.isVisible) {
                this.baseBuilding.update(); // BaseBuildingUI.update now calls toolPanel.update()
            }
            // Menu usually doesn't need per-frame updates
        }
    }

    showNotification(message, type = 'info', duration = 3000) {
        this.notifications.show(message, type, duration);
    }

    // Method to show the main HUD (called after loading)
    showHUD() {
        const hudElement = document.getElementById('hud');
        if (hudElement) {
            hudElement.classList.remove('hidden');
        }
    }

    // Method to hide the main HUD
    hideHUD() {
        const hudElement = document.getElementById('hud');
        if (hudElement) {
            hudElement.classList.add('hidden');
        }
    }
}