import { api } from './browser.js';

/**
 * @template T
 * @param {string} key
 * @param {T} [defaultValue]
 * @returns {Promise<T | undefined>}
 */
export async function getStorage(key, defaultValue) {
  const result = await api.storage.local.get(key);
  return result[key] ?? defaultValue;
}

/**
 * @template T
 * @param {string} key
 * @param {T} value
 * @returns {Promise<void>}
 */
export async function setStorage(key, value) {
  await api.storage.local.set({ [key]: value });
}

/**
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function removeStorage(key) {
  await api.storage.local.remove(key);
}

