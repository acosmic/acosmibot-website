/**
 * Embeds Feature Module (Coming Soon)
 * Handles the custom embeds feature placeholder page
 */

function getDashboardCore() {
    return window.DashboardCore;
}

const EmbedsFeature = {
    state: {
        initialized: false
    },

    async init() {
        console.log('EmbedsFeature.init() called');

        const dashboardCore = getDashboardCore();
        if (!dashboardCore) {
            console.error('DashboardCore not available');
            return;
        }

        await dashboardCore.initForSPA('embeds');
        this.state.initialized = true;
        console.log('EmbedsFeature initialized (Coming Soon)');
    },

    async cleanup() {
        console.log('EmbedsFeature.cleanup() called');
        this.state.initialized = false;
    }
};

// Export for feature loader
window.EmbedsFeature = EmbedsFeature;
