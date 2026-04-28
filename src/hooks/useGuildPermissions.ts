import { useGuildStore } from '@/store/guild';

export function useGuildPermissions(guildId: string | undefined) {
  const guild = useGuildStore(s => s.guilds.find(g => g.id === guildId));
  const isOwner = !!guild?.owner;
  const isAdmin = !!guild?.permissions?.includes('administrator');
  return { isOwner, isAdmin, canManage: isOwner || isAdmin };
}
