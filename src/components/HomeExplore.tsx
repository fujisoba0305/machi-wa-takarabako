import { useState } from 'react';
import { categoryScenery } from '../features/categoryScenery';

const categories = [
  ['🍴', 'グルメ', 'グルメ'], ['☕', 'カフェ', 'カフェ'], ['⛩️', '神社・お寺', '神社・お寺'],
  ['🌳', '公園・自然', '自然'], ['📷', '景色・写真', '写真'], ['🧭', 'おまかせ', 'おまかせ'],
];
export function HomeExplore({ name, onExplore, onCollection }: {
  name: string; onExplore: (mood?: string) => void; onCollection: () => void;
}) {
  return <>
    <header className="explore-hero">
      <p className="explore-brand">街は宝箱<span>歩けば、きっと見つかる。</span></p>
      <p className="explore-greeting">{name}さん、おかえり！</p>
      <h1>今日はどこへ<br />冒険しよう？</h1>
      <p className="explore-intro">いつもの街に、まだ知らない宝物。</p>
      <button className="explore-search" type="button" onClick={() => onExplore()}>🧭 距離と気分から宝物を探す <span aria-hidden="true">→</span></button>
    </header>
    <section className="explore-categories" aria-label="冒険のカテゴリ">
      {categories.map(([icon, label, mood]) => <button key={mood} type="button" onClick={() => onExplore(mood)}><span aria-hidden="true">{icon}</span>{label}</button>)}
    </section>
    <section className="explore-recommend" aria-labelledby="explore-recommend-title">
      <div><p className="explore-eyebrow">NEXT ADVENTURE</p><h2 id="explore-recommend-title">次の冒険のヒント</h2></div>
      <button type="button" onClick={onCollection}><span className="explore-map-icon" aria-hidden="true">🗺️</span><span><strong>みんなが見つけた宝物へ</strong><small>図鑑とマップで、街の発見を見てみよう</small></span><span aria-hidden="true">›</span></button>
      <p>行き先に迷ったら、ガチャにおまかせ。</p>
    </section>
  </>;
}

export function DestinationPhoto({ url, name, category = '' }: { url?: string | null; name: string; category?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const [failedCategory, setFailedCategory] = useState<string | null>(null);
  const scenery = categoryScenery(category);
  if (url && failed !== url) return <img className="gacha-treasure-result-image" src={url} alt={name} onError={() => setFailed(url)} />;
  return <div className="destination-category-photo">
    {failedCategory !== scenery.url && <img src={scenery.url} alt="" onError={() => setFailedCategory(scenery.url)} />}
    <span>カテゴリイメージ · {scenery.label}</span>
    {failedCategory === scenery.url && <p>🧭 どんな景色に出会えるかな</p>}
  </div>;
}
