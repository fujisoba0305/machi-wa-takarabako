import { getAccountClient } from './accountAuth';

/** Fail closed before invoking the browser GPS API. Existing guest records stay untouched. */
export async function requestAccountPosition<T>(locate: () => Promise<T>, expectedUid?: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const response = await Promise.race([
      getAccountClient().auth.getSession(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error('ログイン状態の確認に時間がかかっています。再ログインしてから現在地を取得してください。')), 8000); }),
    ]);
    clearTimeout(timer);
    const session = response.data.session;
    if (response.error || !session || session.user.is_anonymous || (session.expires_at && session.expires_at * 1000 <= Date.now()) || (expectedUid && session.user.id !== expectedUid)) {
      throw Error('現在地を取得する前にGoogleログインを完了してください。');
    }
    return await locate();
  } finally { clearTimeout(timer); }
}
