// New file: js/ui/MenuUI.js

export default class MenuUI {
    constructor(game) {
        this.game = game;
        this.isVisible = false;
        this.container = document.getElementById('game-menu');

        if (!this.container) {
            console.error("Game menu container #game-menu not found!");
            return;
        }

        // Get button references
        this.resumeButton = this.container.querySelector('#resume-game');
        this.settingsButton = this.container.querySelector('#menu-settings');
        this.quitButton = this.container.querySelector('#menu-quit');

        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.container) return;

        // Resume Game
        if (this.resumeButton) {
            this.resumeButton.addEventListener('click', () => {
                this.hide();
            });
        }

        // Settings (Placeholder)
        if (this.settingsButton) {
            this.settingsButton.addEventListener('click', () => {
                this.game.ui.showNotification("Settings not implemented yet.", "warn");
                // Later: Open a dedicated settings panel
            });
        }

        // Quit Game (Placeholder - actual quit might need server interaction or page reload)
        if (this.quitButton) {
            this.quitButton.addEventListener('click', () => {
                this.game.ui.showNotification("Quitting... (Reloading for now)", "info");
                // In a real scenario, you might disconnect cleanly or navigate away
                 setTimeout(() => window.location.reload(), 1000);
                 // this.game.stop(); // Stop the game loop if applicable
                 // this.game.network.disconnect(); // Disconnect network if applicable
            });
        }

        // We already handle closing with Escape key in UIManager
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        if (!this.isVisible && this.container) {
            // Hide other major UI panels if they are open
            if (this.game.ui.inventory.isVisible) this.game.ui.inventory.hide();
            if (this.game.ui.baseBuilding.isVisible) this.game.ui.baseBuilding.hide();

            this.container.classList.remove('hidden');
            this.isVisible = true;
            this.game.ui.activeUI = this; // Mark menu as active

             // Optional: Pause game simulation if desired (complex in multiplayer)
             // this.game.pauseSimulation();
        }
    }

    hide() {
        if (this.isVisible && this.container) {
            this.container.classList.add('hidden');
            this.isVisible = false;
             if (this.game.ui.activeUI === this) {
                 this.game.ui.activeUI = null;
             }
             // Optional: Resume game simulation
             // this.game.resumeSimulation();
        }
    }

    update() {
        // Currently no dynamic updates needed for the basic menu
    }
}