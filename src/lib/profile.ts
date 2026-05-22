/**
 * Утилиты для работы с профилями пользователей и локальным хранилищем.
 */

export const getActiveProfileId = (): string => {
  if (typeof window === 'undefined') return 'default';
  return localStorage.getItem('yomumogu_active_profile_id') || 'default';
};

export const setActiveProfileId = (profileId: string) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('yomumogu_active_profile_id', profileId);
};

export const getProfileKey = (key: string, profileId?: string): string => {
  const pid = profileId || getActiveProfileId();
  return `yomumogu_profile_${pid}_${key}`;
};

export const getProfileItem = (key: string, profileId?: string): string | null => {
  if (typeof window === 'undefined') return null;
  const newKey = getProfileKey(key, profileId);
  const value = localStorage.getItem(newKey);
  if (value !== null) return value;

  // Миграция со старых ключей без префикса профиля (только для дефолтного профиля)
  const pid = profileId || getActiveProfileId();
  if (pid === 'default') {
    const legacyKey = `yomumogu_${key}`;
    const legacyValue = localStorage.getItem(legacyKey);
    if (legacyValue !== null) {
      localStorage.setItem(newKey, legacyValue);
      localStorage.removeItem(legacyKey);
      return legacyValue;
    }
  }
  return null;
};

export const setProfileItem = (key: string, value: string, profileId?: string) => {
  if (typeof window === 'undefined') return;
  const newKey = getProfileKey(key, profileId);
  localStorage.setItem(newKey, value);
};

export const removeProfileItem = (key: string, profileId?: string) => {
  if (typeof window === 'undefined') return;
  const newKey = getProfileKey(key, profileId);
  localStorage.removeItem(newKey);
  
  const pid = profileId || getActiveProfileId();
  if (pid === 'default') {
    localStorage.removeItem(`yomumogu_${key}`);
  }
};

export interface ProfileInfo {
  id: string;
  name: string;
  createdAt: string;
}

export const getProfilesList = (): ProfileInfo[] => {
  if (typeof window === 'undefined') return [];
  const list = localStorage.getItem('yomumogu_profiles');
  if (list) {
    try {
      return JSON.parse(list);
    } catch {}
  }
  const defaultList = [{ id: 'default', name: 'Основной профиль', createdAt: new Date().toISOString() }];
  localStorage.setItem('yomumogu_profiles', JSON.stringify(defaultList));
  return defaultList;
};

export const saveProfilesList = (list: ProfileInfo[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('yomumogu_profiles', JSON.stringify(list));
};

export const createProfile = (id: string, name: string): ProfileInfo => {
  const list = getProfilesList();
  const newProfile = { id, name, createdAt: new Date().toISOString() };
  list.push(newProfile);
  saveProfilesList(list);
  return newProfile;
};

export const deleteProfile = (profileId: string) => {
  if (profileId === 'default') return;
  const list = getProfilesList();
  const updated = list.filter(p => p.id !== profileId);
  saveProfilesList(updated);
  
  if (typeof window !== 'undefined') {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`yomumogu_profile_${profileId}_`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
};

