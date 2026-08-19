interface PresentationLock {
  current: boolean;
}

export function tryAcquirePresentationLock(lock: PresentationLock): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function resetPresentationLock(lock: PresentationLock): void {
  lock.current = false;
}
