import { useAuthStore } from '@/store/auth';
import { useGuildStore } from '@/store/guild';

export function setupLegacyShim() {
  (window as any).DashboardCore = {
    state: {
      get guildConfig() {
        return (window as any).DashboardState.getGuildConfig();
      },
      get currentGuildId() {
        return useGuildStore.getState().selectedGuildId;
      },
      get currentUser() {
        return useAuthStore.getState().user;
      }
    },
    markUnsavedChanges: () => {
      console.log('Legacy: markUnsavedChanges');
      // TODO: Connect to React dirty state if needed
    },
    initForSPA: async (feature: string) => {
      console.log(`Legacy: initForSPA(${feature})`);
    },
    init: async (feature: string) => {
      console.log(`Legacy: init(${feature})`);
    }
  };

  (window as any).DashboardState = {
    getGuildConfig: () => {
      // This is tricky because we don't have a single guild config in a store yet
      // In a real app, we'd have a useGuildConfig store
      return null;
    },
    getCurrentGuildId: () => useGuildStore.getState().selectedGuildId,
    getCurrentUser: () => useAuthStore.getState().user,
    getAvailableChannels: () => [],
    getAvailableRoles: () => [],
    subscribe: () => {},
    unsubscribe: () => {},
    notifyListeners: () => {}
  };
}
