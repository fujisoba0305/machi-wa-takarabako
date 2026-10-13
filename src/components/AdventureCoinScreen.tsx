import { AppIcon, IconText } from './AppIcon';
import takaran from '../assets/takaran/takaran-welcome.png';
import './AdventureCoinScreen.css';

type Props = { distance: string; mood: string; moodIcon: string; busy?: boolean; message?: string; onContinue: () => void };

// Presentation only. The parent owns the selected conditions and gacha transition.
export function AdventureCoinScreen({ distance, mood, moodIcon, onContinue, busy, message }: Props) {
  return <section className="coin-celebration" aria-labelledby="coin-celebration-title">
    <div className="coin-celebration-ribbon"><AppIcon name="sparkle" />冒険コイン完成！<AppIcon name="sparkle" /></div>
    <header className="coin-celebration-heading">
      <p>YOUR LITTLE ADVENTURE</p>
      <h2 id="coin-celebration-title">できたよ！</h2>
      <span>今日だけの冒険を、このコインに。</span>
    </header>
    <section className="coin-celebration-card" aria-label="今日の冒険条件">
      <p><AppIcon name="compass" />今日の冒険条件</p>
      <dl>
        <div><dt><AppIcon name="walk" />距離</dt><dd>{distance}</dd></div>
        <div><dt><IconText text={moodIcon} />気分</dt><dd>{mood}</dd></div>
      </dl>
      <span>どんな宝物に出会えるかな？</span>
    </section>
    <div className="coin-celebration-stage">
      <div className="coin-celebration-glow" aria-hidden="true" />
      <div className="coin-celebration-sparkles" aria-hidden="true">{[0,1,2,3,4,5].map(i => <span key={i}><AppIcon name="sparkle" /></span>)}</div>
      <div className="coin-celebration-token" role="img" aria-label="輝く金色の冒険コイン"><span><AppIcon name="compass" /><small>街は宝箱</small></span></div>
      <img className="coin-celebration-takaran" src={takaran} alt="コインの完成を喜ぶたからん" width="150" height="150" />
    </div>
    <p className="coin-celebration-message">このコインが、まだ知らない街の宝物へ<br />きっと導いてくれるよ。</p>
    {message && <p role="status" className="coin-celebration-message">{message}</p>}
    <button type="button" className="coin-celebration-next" disabled={busy} onClick={onContinue}><AppIcon name="coins" /><span>ガチャを回しに行こう！</span><AppIcon name="next" /></button>
  </section>;
}
