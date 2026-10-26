// Navigation & Session Persistence Helper for ZOYO Mobile Web & PWA
import { User } from '../types';

export const SESSION_USER_KEY = 'zoyo_user_session';
export const ACTIVE_TAB_KEY = 'zoyo_active_tab';

export type BackHandler = () => boolean; // return true if the back event was consumed

// Global LIFO stack of back handlers (modals, drawers, sub-views)
const backHandlers: BackHandler[] = [];

/**
 * Register a back button interceptor (e.g. For open modals, drawers, or chat view).
 * Returns an unregister cleanup function.
 */
export function registerBackHandler(handler: BackHandler): () => void {
  backHandlers.push(handler);
  return () => {
    const idx = backHandlers.lastIndexOf(handler);
    if (idx !== -1) {
      backHandlers.splice(idx, 1);
    }
  };
}

/**
 * Execute the topmost registered back handler, if any.
 * Returns true if a handler consumed the back press.
 */
export function executeBackHandler(): boolean {
  if (backHandlers.length > 0) {
    const topHandler = backHandlers[backHandlers.length - 1];
    try {
      const consumed = topHandler();
      if (consumed) return true;
    } catch (err) {
      console.warn('Back handler error:', err);
    }
  }
  return false;
}

/**
 * Retrieve saved user from localStorage
 */
export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed._id || parsed.id) && parsed.name) {
        return parsed as User;
      }
    }
  } catch (err) {
    console.warn('Error reading stored session user:', err);
  }
  return null;
}

/**
 * Persist user to localStorage
 */
export function saveStoredUser(user: User): void {
  try {
    if (user && (user._id || user.id) && user.name) {
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    }
  } catch (err) {
    console.warn('Error saving session user:', err);
  }
}

/**
 * Clear user session from localStorage
 */
export function clearStoredUser(): void {
  try {
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(ACTIVE_TAB_KEY);
  } catch (err) {
    console.warn('Error clearing stored session:', err);
  }
}

/**
 * Retrieve saved active tab from localStorage
 */
export function getStoredActiveTab(): string {
  try {
    const saved = localStorage.getItem(ACTIVE_TAB_KEY);
    if (saved && ['home', 'friends', 'games', 'chat', 'admin', 'profile'].includes(saved)) {
      return saved;
    }
  } catch {}
  return 'home';
}

/**
 * Persist active tab to localStorage
 */
export function saveStoredActiveTab(tab: string): void {
  try {
    localStorage.setItem(ACTIVE_TAB_KEY, tab);
  } catch {}
}
