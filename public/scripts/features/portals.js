/**
 * Portals Feature Module (Coming Soon)
 * Handles the cross-server portals feature placeholder page
 */

function getDashboardCore() {
    return window.DashboardCore;
}

const PortalsFeature = {
    state: {
        initialized: false
    },

    async init() {
        console.log('PortalsFeature.init() called');

        const dashboardCore = getDashboardCore();
        if (!dashboardCore) {
            console.error('DashboardCore not available');
            return;
        }

        await dashboardCore.initForSPA('portals');
        this.state.initialized = true;
        console.log('PortalsFeature initialized (Coming Soon)');
    },

    async cleanup() {
        console.log('PortalsFeature.cleanup() called');
        this.state.initialized = false;
    }
};

// Export for feature loader
window.PortalsFeature = PortalsFeature;
