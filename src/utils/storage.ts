import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Typed AsyncStorage wrapper for safe get/set/remove operations.
 * All operations are fire-and-forget safe with error logging.
 */

export async function getItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.error(`[Storage] Failed to read "${key}":`, error);
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.error(`[Storage] Failed to write "${key}":`, error);
  }
}

export async function removeItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`[Storage] Failed to remove "${key}":`, error);
  }
}

export async function multiRemove(keys: string[]): Promise<void> {
  try {
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    console.error(`[Storage] Failed to multi-remove:`, error);
  }
}

export async function getJSON<T>(key: string): Promise<T | null> {
  const raw = await getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    console.error(`[Storage] Failed to parse JSON for "${key}"`);
    return null;
  }
}

export async function setJSON(key: string, value: unknown): Promise<void> {
  await setItem(key, JSON.stringify(value));
}
