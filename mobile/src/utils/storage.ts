import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Wraps expo-secure-store (Keychain on iOS, Keystore-backed EncryptedSharedPreferences on
 * Android) for the auth tokens. Deliberately not AsyncStorage: a JWT sitting in
 * AsyncStorage is plain, unencrypted text on disk, readable by anything with filesystem
 * access on a rooted device.
 *
 * expo-secure-store has no web implementation at all (throws "is not a function"), so the
 * web target — used only for previewing the app in a desktop browser, never a real deploy
 * target for this product — falls back to localStorage instead of hanging forever on the
 * first token read. Native behavior/security posture is unchanged.
 */
const ACCESS_TOKEN_KEY = 'schoolbite.accessToken';
const REFRESH_TOKEN_KEY = 'schoolbite.refreshToken';
const USER_KEY = 'schoolbite.user';

const webStore = {
  async getItemAsync(key: string) {
    return window.localStorage.getItem(key);
  },
  async setItemAsync(key: string, value: string) {
    window.localStorage.setItem(key, value);
  },
  async deleteItemAsync(key: string) {
    window.localStorage.removeItem(key);
  },
};

const store = Platform.OS === 'web' ? webStore : SecureStore;

export const tokenStorage = {
  async getAccessToken() {
    return store.getItemAsync(ACCESS_TOKEN_KEY);
  },
  async getRefreshToken() {
    return store.getItemAsync(REFRESH_TOKEN_KEY);
  },
  async setTokens(accessToken: string, refreshToken: string) {
    await Promise.all([
      store.setItemAsync(ACCESS_TOKEN_KEY, accessToken),
      store.setItemAsync(REFRESH_TOKEN_KEY, refreshToken),
    ]);
  },
  async setAccessToken(accessToken: string) {
    await store.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  },
  async clear() {
    await Promise.all([
      store.deleteItemAsync(ACCESS_TOKEN_KEY),
      store.deleteItemAsync(REFRESH_TOKEN_KEY),
      store.deleteItemAsync(USER_KEY),
    ]);
  },
};
