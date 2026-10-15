import { IconText } from './AppIcon';
import { useState } from 'react';
import type { ActiveAdventure } from '../features/activeAdventure';
import { WALKING_MISSION, walkingDestination } from '../features/walkingAdventure';

type Props = {
  adventure: ActiveAdventure;
  busy: boolean;
  registering: boolean;
  message: string;
  onDiscover: () => void;
  onNavigate: () => void;
  onArrive: () => void;
};
export function WalkingScreen({ adventure, busy, registering, message, onDiscover, onNavigate, onArrive }: Props) {
  const destination = walkingDestination(adventure);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return <section className="walking-screen" aria-label="冒険中のウォーキング">
    <header className="walking-header">
      <p className="walking-eyebrow">街は宝箱</p>
      <h1><IconText text="🚶 宝物を探して" /><br />ウォーキング中！</h1>
      <p>道の途中にも、きっと宝物がある。</p>
    </header>
    <article className="walking-destination walking-glass">
      {destination.imageUrl && failedImage !== destination.imageUrl &&
        <img src={destination.imageUrl} alt={destination.name} onError={() => setFailedImage(destination.imageUrl)} className="walking-destination-photo" />}
      <div className="walking-destination-body">
        <p className="walking-label">今回の目的地</p>
        <h2>{destination.name}</h2>
        <p className="walking-route"><span>{adventure.result.walkingTrial ? '徒歩検索・試験版' : '出発時の徒歩ルート'}</span><strong>{destination.distanceLabel}</strong></p>
      </div>
    </article>
    <section className="walking-mission walking-glass" aria-label="ウォーキングミッション">
      <h2><IconText text="🎯 ウォーキングミッション" /></h2>
      <p>{WALKING_MISSION}</p>
      <small>見つけたら、写真とひとことで残してみよう。</small>
    </section>
    <div className="walking-actions">
      <button type="button" className="walking-discover" disabled={busy || registering} onClick={onDiscover}>
        <IconText text={registering ? '📍 今いる場所を確認中…' : '💎 宝物を見つけた！'} />
      </button>
      <button type="button" className="walking-navigate" disabled={busy || registering} onClick={onNavigate}><IconText text="🧭 ナビを再開する" /></button>
      <button type="button" className="walking-arrive" disabled={busy || registering || adventure.rewardClaimed} onClick={onArrive}>
        <IconText text={busy ? '📍 現在地を確認中…' : '📍 到着した！'} />
      </button>
    </div>
    {message && <p className="walking-message walking-glass" role="status"><IconText text={message} /></p>}
  </section>;
}
