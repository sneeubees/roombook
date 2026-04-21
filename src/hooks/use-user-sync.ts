// No-op shim: kept only so legacy call sites don't crash on import.
// Convex Auth owns the users table directly, so there is nothing to sync.
export function useUserSync() {
  return;
}
