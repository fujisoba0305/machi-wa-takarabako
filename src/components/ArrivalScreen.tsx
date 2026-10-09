import type { CSSProperties } from 'react';
import type { ActiveAdventure } from '../features/activeAdventure';
import { getNormalArrivalRewardExp } from '../features/normalArrivalReward';
import { walkingDestination } from '../features/walkingAdventure';
import { DestinationPhoto } from './HomeExplore';

type Props = { adventure: ActiveAdventure; rank?: string; onHome: () => void; onNext: () => void; onRate: () => void };
// Presentation only: no storage writes, reward callbacks, or animation-completion side effects.
export function ArrivalScreen({ adventure, rank, onHome, onNext, onRate }: Props) {
  if (!adventure.rewardClaimed || !adventure.completedAt || !adventure.arrival) return null;
  const destination = walkingDestination(adventure);
  const reward = getNormalArrivalRewardExp(adventure.target.kind === 'treasure');
  const elapsedMinutes = Math.floor(Math.max(0, adventure.completedAt - adventure.startedAt) / 60000);
  return <section className="arrival-screen" aria-label="到着達成">
    <header className="arrival-heading"><p>ADVENTURE COMPLETE</p><h1>やったー！</h1><h2>目的地に到着しました！</h2></header>
    <div className="arrival-celebration" aria-hidden="true">
      <div className="arrival-rays" />
      <div className="arrival-chest"><div className="arrival-chest-lid" /><div className="arrival-jewel">💎</div><div className="arrival-chest-base"><span>✦</span></div></div>
      {Array.from({length: 14}, (_, i) => <i key={i} className="arrival-confetti" style={{'--i':i} as CSSProperties}>✦</i>)}
    </div>
    <p className="arrival-exp"><strong>+{reward}</strong><span>EXP</span></p>
    <p className="arrival-congratulations">またひとつ、街の宝物に出会えたね。</p>
    <article className="arrival-destination">
      <DestinationPhoto url={destination.imageUrl} name={destination.name} category={adventure.result.treasure?.category || adventure.result.choices.mood} />
      <div><p>今回の目的地</p><h2>{destination.name}</h2>{rank && <span className="arrival-rank">🏅 {rank}</span>}</div>
    </article>
    <details className="arrival-record"><summary>🗺️ 今回の冒険の記録</summary><dl>
      <div><dt>目的地</dt><dd>{destination.name}</dd></div>
      <div><dt>獲得EXP</dt><dd>+{reward} EXP</dd></div>
      <div><dt>到着日時</dt><dd><time dateTime={new Date(adventure.completedAt).toISOString()}>{new Date(adventure.completedAt).toLocaleString('ja-JP')}</time></dd></div>
      <div><dt>出発時の徒歩ルート距離</dt><dd>{destination.distanceLabel}</dd></div>
      <div><dt>冒険開始からの経過時間</dt><dd>{elapsedMinutes < 1 ? '1分未満' : `${elapsedMinutes}分`}</dd></div>
    </dl><p>ルート距離は出発時の案内です。実際に歩いた距離ではありません。</p></details>
    <div className="arrival-actions">
      {adventure.target.kind === 'treasure' && <button type="button" className="arrival-rate" onClick={onRate}>⭐ この宝物を評価する</button>}
      <button type="button" className="arrival-next" onClick={onNext}>🧭 次の冒険に行く</button>
      <button type="button" className="arrival-home" onClick={onHome}>🏠 ホームに戻る</button>
    </div>
  </section>;
}
