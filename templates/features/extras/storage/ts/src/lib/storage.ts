import { api } from './browser';

export async function getStorage<T = any>(key: string, defaultValue?: T): Promise<T | undefined> {
  const result = await api.storage.local.get(key);
  return (result[key] as T) ?? defaultValue;
}

export async function setStorage<T = any>(key: string, value: T): Promise<void> {
  await api.storage.local.set({ [key]: value });
}

export async function removeStorage(key: string): Promise<void> {
  await api.storage.local.remove(key);
}

