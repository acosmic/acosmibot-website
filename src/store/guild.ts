import { create } from 'zustand';

interface Guild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: number;
  features: string[];
}

interface GuildState {
  guilds: Guild[];
  selectedGuildId: string | null;
  currentGuild: Guild | null;
  setGuilds: (guilds: Guild[]) => void;
  setSelectedGuildId: (id: string | null) => void;
}

export const useGuildStore = create<GuildState>((set, get) => ({
  guilds: [],
  selectedGuildId: null,
  currentGuild: null,
  setGuilds: (guilds) => set({ guilds }),
  setSelectedGuildId: (id) => {
    const guild = get().guilds.find(g => g.id === id) || null;
    set({ selectedGuildId: id, currentGuild: guild });
  },
}));
