import create from 'zustand';
import { persist } from 'zustand/middleware';

export type AppPermission = 'location' | 'microphone' | 'notifications' | 'analytics' | 'export';

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export interface PermissionsState {
  permissions: Record<AppPermission, PermissionStatus>;
  grantPermission: (perm: AppPermission) => void;
  denyPermission: (perm: AppPermission) => void;
  revokePermission: (perm: AppPermission) => void;
  setPermission: (perm: AppPermission, status: PermissionStatus) => void;
  checkPermission: (perm: AppPermission) => PermissionStatus;
  resetPermissions: () => void;
}

const defaultPermissions: Record<AppPermission, PermissionStatus> = {
  location: 'prompt',
  microphone: 'prompt',
  notifications: 'prompt',
  analytics: 'prompt',
  export: 'granted', // Export is always allowed unless revoked
};

export const usePermissionsStore = create<PermissionsState>()(
  persist(
    (set, get) => ({
      permissions: { ...defaultPermissions },
      grantPermission: (perm) => set((state) => ({
        permissions: { ...state.permissions, [perm]: 'granted' },
      })),
      denyPermission: (perm) => set((state) => ({
        permissions: { ...state.permissions, [perm]: 'denied' },
      })),
      revokePermission: (perm) => set((state) => ({
        permissions: { ...state.permissions, [perm]: 'prompt' },
      })),
      setPermission: (perm, status) => set((state) => ({
        permissions: { ...state.permissions, [perm]: status },
      })),
      checkPermission: (perm) => get().permissions[perm],
      resetPermissions: () => set(() => ({ permissions: { ...defaultPermissions } })),
    }),
    {
      name: 'permissions-store',
    }
  )
); 