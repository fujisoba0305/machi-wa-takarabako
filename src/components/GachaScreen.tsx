import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AppIcon, IconText, plainIconLabel } from './AppIcon';
import { scheduleGachaSequence } from '../features/gachaSequence';
import takaran from '../assets/takaran/takaran-search.png';
import './GachaScreen.css';

const colors = ['#f9b43d', '#4fbfe9', '#f47c90', '#85c882', '#ad95dc', '#efaa48', '#64cbd0', '#f08b66'];
const symbols = ['☕', '🌳', '📷', '⛩️', '🍴', '🎵', '💎', '🧭'];
const messages = ['ハンドルを回して、冒険の行き先を見つけよう', 'どんな街の宝物に出会えるかな？', 'カプセルが出てきたよ！', 'さあ、カプセルを開こう！'];

type Props = { capsuleIcon: string; mood: string; distance: string; onReveal: () => void };

export function GachaScreen({ capsuleIcon, mood, distance, onReveal }: Props) {
  const [step, setStep] = useState(0);
  const locked = useRef(false);
  const cancel = useRef<(() => void) | null>(null);
  const reveal = useRef(onReveal);
  reveal.current = onReveal;
  useEffect(() => () => cancel.current?.(), []);

  function start() {
    // Synchronous guard also covers two clicks before React's next render.
    if (locked.current) return;
    locked.current = true;
    cancel.current = scheduleGachaSequence({
      setStep, showSearching: () => reveal.current(),
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    });
  }

  return <section className={`forest-gacha forest-gacha--step-${step}`} aria-labelledby="forest-gacha-title">
    <header className="forest-gacha-heading">
      <span className="forest-gacha-eyebrow"><AppIcon name="compass" /> LITTLE ADVENTURE</span>
      <h1 id="forest-gacha-title">今日の宝箱ガチャ</h1>
      <p>まだ知らない街の宝物に、会いに行こう。</p>
      <div className="forest-gacha-ticket"><AppIcon name="coins" /><span>今日の冒険コイン</span><strong>{plainIconLabel(mood) || 'おまかせ'}{distance && `・${distance}`}</strong></div>
    </header>
    <div className="forest-gacha-machine">
      <div className="forest-gacha-crown"><AppIcon name="gem" /></div>
      <div className="forest-gacha-dome" aria-hidden="true">
        <div className="forest-gacha-capsules">{colors.map((color, i) => <span key={color} className={`forest-gacha-ball forest-gacha-ball-${i}`} style={{ '--capsule-color': color, '--mix-delay': `${i * -0.09}s` } as CSSProperties}><IconText text={symbols[i]} /></span>)}</div>
        <span className="forest-gacha-glass-shine" />
      </div>
      <div className="forest-gacha-rim" />
      <div className="forest-gacha-body">
        <span className="forest-gacha-plaque">街は宝箱</span>
        <div className="forest-gacha-controls"><span className="forest-gacha-slot" /><button type="button" className="forest-gacha-handle" onClick={start} disabled={step !== 0} aria-label="マシンのハンドルを回す"><i /></button></div>
        <div className="forest-gacha-outlet" />
      </div>
      <div className="forest-gacha-foot" />
      {step >= 2 && <div className="forest-gacha-prize" aria-hidden="true"><span className="forest-gacha-light" /><span className="forest-gacha-prize-top" /><span className="forest-gacha-prize-bottom" /><span className="forest-gacha-prize-symbol"><IconText text={capsuleIcon} /></span></div>}
      <img className="forest-gacha-takaran" src={takaran} alt="たからん" width="105" height="105" />
    </div>
    <div className="forest-gacha-panel">
      <p role="status" aria-live="polite">{messages[step]}</p>
      <button type="button" className="forest-gacha-start" onClick={start} disabled={step !== 0} aria-label={step === 0 ? 'ガチャのハンドルを回す' : 'ガチャ演出中'}><AppIcon name={step === 0 ? 'coins' : 'sparkle'} />{step === 0 ? 'ハンドルを回す' : '宝物との出会いまで、もう少し'}</button>
      <span className="forest-gacha-note">たからんと一緒に、小さな冒険へ。</span>
    </div>
  </section>;
}
