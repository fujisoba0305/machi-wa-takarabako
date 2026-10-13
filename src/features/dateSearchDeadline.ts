export const DATE_SEARCH_TIMEOUT_MS = 20_000;
export class DateSearchTimeout extends Error { constructor() { super('Date search timeout'); } }
// Race bounds UI waiting. The guard also prevents a late result starting a second request or updating another screen.
export async function withDateDeadline<T>(work: (current: () => boolean) => Promise<T>, isCurrent: () => boolean) {
  let expired = false;
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => { expired = true; reject(new DateSearchTimeout()); }, DATE_SEARCH_TIMEOUT_MS); });
  try { return await Promise.race([work(() => !expired && isCurrent()), deadline]); }
  finally { clearTimeout(timer!); expired = true; }
}
