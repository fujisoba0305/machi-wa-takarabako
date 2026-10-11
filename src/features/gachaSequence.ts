type GachaSequenceOptions = {
  setStep: (step: number) => void;
  showSearching: () => void;
  reducedMotion?: boolean;
};

// Presentation only: never searches, charges coins, or grants rewards.
// Cleanup prevents an abandoned animation from navigating a later screen.
export function scheduleGachaSequence({ setStep, showSearching, reducedMotion = false }: GachaSequenceOptions) {
  let cancelled = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  const later = (callback: () => void, delay: number) => {
    timers.push(globalThis.setTimeout(() => { if (!cancelled) callback(); }, delay));
  };
  setStep(reducedMotion ? 3 : 1);
  if (!reducedMotion) {
    later(() => setStep(2), 1100);
    later(() => setStep(3), 1800);
  }
  later(showSearching, reducedMotion ? 450 : 2800);
  return () => { cancelled = true; timers.forEach(timer => globalThis.clearTimeout(timer)); };
}
