import { describe, expect, it, vi } from 'vitest';
import { scheduleGachaSequence } from './gachaSequence';

describe('gacha sequence', () => {
it('advances the animation and opens the searching screen after the timers finish', () => {
vi.useFakeTimers();
const setStep = vi.fn();
const showSearching = vi.fn();

scheduleGachaSequence({ setStep, showSearching });

expect(setStep).toHaveBeenLastCalledWith(1);
expect(showSearching).not.toHaveBeenCalled();

vi.advanceTimersByTime(1100);
expect(setStep).toHaveBeenLastCalledWith(2);

vi.advanceTimersByTime(1700);
expect(showSearching).toHaveBeenCalledOnce();
expect(setStep).toHaveBeenLastCalledWith(0);
vi.useRealTimers();
});
});
