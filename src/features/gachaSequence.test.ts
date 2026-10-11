import { afterEach, describe, expect, it, vi } from 'vitest';
import { scheduleGachaSequence } from './gachaSequence';

afterEach(() => vi.useRealTimers());
describe('gacha sequence', () => {
  it('turns, dispenses, opens, then navigates exactly once', () => {
    vi.useFakeTimers(); const setStep = vi.fn(); const showSearching = vi.fn();
    scheduleGachaSequence({ setStep, showSearching });
    expect(setStep).toHaveBeenLastCalledWith(1);
    vi.advanceTimersByTime(1100); expect(setStep).toHaveBeenLastCalledWith(2);
    vi.advanceTimersByTime(700); expect(setStep).toHaveBeenLastCalledWith(3);
    expect(showSearching).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); expect(showSearching).toHaveBeenCalledOnce();
    vi.runAllTimers(); expect(showSearching).toHaveBeenCalledOnce();
  });
  it('cancels stale animations when leaving the screen', () => {
    vi.useFakeTimers(); const setStep = vi.fn(); const showSearching = vi.fn();
    const cancel = scheduleGachaSequence({ setStep, showSearching });
    vi.advanceTimersByTime(1100); cancel(); cancel(); vi.runAllTimers();
    expect(setStep).toHaveBeenCalledTimes(2); expect(showSearching).not.toHaveBeenCalled();
  });
  it('uses a brief static reveal for reduced motion', () => {
    vi.useFakeTimers(); const setStep = vi.fn(); const showSearching = vi.fn();
    scheduleGachaSequence({ setStep, showSearching, reducedMotion: true });
    expect(setStep).toHaveBeenCalledExactlyOnceWith(3);
    vi.advanceTimersByTime(450); expect(showSearching).toHaveBeenCalledOnce();
  });
});
