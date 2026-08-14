type GachaSequenceOptions = {
setStep: (step: number) => void;
showSearching: () => void;
schedule?: (callback: () => void, delayMs: number) => unknown;
};

export function scheduleGachaSequence({
setStep,
showSearching,
schedule = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
}: GachaSequenceOptions) {
setStep(1);

schedule(() => {
setStep(2);
}, 1100);

schedule(() => {
showSearching();
setStep(0);
}, 2800);
}
