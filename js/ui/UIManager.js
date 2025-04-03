import InventoryUI from './InventoryUI.js';
import BaseBuildingUI from './BaseBuildingUI.js';
import HUD from './HUD.js';
import MenuUI from './MenuUI.js';

export default class UIManager {
    constructor(game) {
        this.game = game;
        this.activeUI = null;

        // Initialize UI components
        this.hud = new HUD(game, 'hud');
        this.inventory = new InventoryUI(game);
        this.baseBuilding = new BaseBuildingUI(game);
        this.menu = new MenuUI(game);

        // Debug overlay reference (controlled by DebugUtils now)
        this.debugOverlay = document.getElementById('debug-overlay');

        // Controls info panel reference
        this.controlsInfo = document.getElementById('controls-info-bottom-left');

        // Set up notifications system
        this.notifications = {
            container: null,
            queue: [],
            maxNotifications: 3,

            init: () => {
                // Use existing notifications container
                this.notifications.container = document.getElementById('notifications-container');
                if (!this.notifications.container) {
                    console.error("Notifications container not found!");
                    // Optionally create it dynamically if needed
                    // container = document.createElement('div');
                    // container.id = 'notifications-container';
                    // document.getElementById('ui-overlay').appendChild(container);
                    // this.notifications.container = container;
                }
            },

            show: (message, type = 'info', duration = 3000) => {
                if (!this.notifications.container) return; // Guard against missing container

                const notification = document.createElement('div');
                notification.className = `notification notification-${type}`;
                // Sanitize message before setting innerHTML if message can contain user input
                // For internally generated messages, this is usually safe.
                notification.innerHTML = `<div class="notification-content">${message}</div>`;

                // Add to queue
                this.notifications.queue.push(notification);

                // Manage notifications display
                this.notifications.update();

                // Auto-remove after duration
                setTimeout(() => {
                    notification.classList.add('fade-out');
                    // Wait for fade out animation to complete before removing
                    setTimeout(() => {
                        this.notifications.remove(notification);
                    }, 300); // Match fade-out animation duration
                }, duration);
            },

            remove: (notification) => {
                if (!this.notifications.container) return; // Guard

                const index = this.notifications.queue.indexOf(notification);
                if (index !== -1) {
                    this.notifications.queue.splice(index, 1);
                    // Check if the notification is still a child before removing
                    if (notification.parentNode === this.notifications.container) {
                        this.notifications.container.removeChild(notification);
                    }
                    // Update display after removal
                    this.notifications.update();
                }
            },

            update: () => {
                if (!this.notifications.container) return; // Guard

                // Detach existing visible notifications to avoid flicker/re-rendering issues
                const currentNotifications = Array.from(this.notifications.container.children);
                currentNotifications.forEach(child => child.remove());

                // Add only the necessary notifications from the queue
                const visibleNotifications = this.notifications.queue.slice(-this.notifications.maxNotifications);
                visibleNotifications.forEach(notification => {
                    // Ensure the notification isn't already scheduled for removal (has fade-out class)
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
    }

    setupEventListeners() {
        // Global key handlers for UI
        document.addEventListener('keydown', (e) => {
            // Ignore inputs if focus is on an input field
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
                } else {
                    // If no other UI is open, open the menu
                    this.menu.show();
                }
            }

            // Specific UI toggles (only if no main UI is active OR it's the menu key)
            if (!this.isMajorUIActive() || e.code === 'Escape') {
                switch (e.code) {
                    case 'KeyI':
                        e.preventDefault();
                        this.inventory.toggle();
                        break;
                    case 'KeyB':
                        e.preventDefault();
                        this.baseBuilding.toggle(); // BaseBuilding checks proximity internally
                        break;
                }
            }
        });

        // HUD Button Listeners
        const toggleControlsBtn = document.getElementById('toggle-controls');
        const toggleDebugBtn = document.getElementById('toggle-debug');
        const gameMenuBtn = document.getElementById('game-menu-button');

        if (toggleControlsBtn && this.controlsInfo) {
            toggleControlsBtn.addEventListener('click', () => {
                const show = this.controlsInfo.classList.toggle('hidden');
                toggleControlsBtn.classList.toggle('active', !show);
            });
        }

        if (toggleDebugBtn && this.debugOverlay) {
            toggleDebugBtn.addEventListener('click', () => {
                const enabled = this.game.debug.toggle(); // Use debug utils toggle
                toggleDebugBtn.classList.toggle('active', enabled);
            });
            // Initial state sync
            toggleDebugBtn.classList.toggle('active', this.game.debug.isEnabled());
        }

        if (gameMenuBtn) {
            gameMenuBtn.addEventListener('click', () => {
                this.menu.toggle();
            });
        }
    }

    // Helper to check if Inventory, Building, or Menu is open
    isMajorUIActive() {
        return this.inventory.isVisible || this.baseBuilding.isVisible || this.menu.isVisible;
    }

    update() {
        // Update HUD data
        this.hud.update();

        // Update specific UI components if they are visible
        if (this.inventory.isVisible) {
            this.inventory.update();
        }
        if (this.baseBuilding.isVisible) {
            this.baseBuilding.update();
        }
        // Menu might not need frequent updates unless dynamic content is added
        // if (this.menu.isVisible) {
        //     this.menu.update();
        // }
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