import { useCallback, useEffect, useId, useState } from 'react';
import { acknowledgeTakaranGrowth, growthLines, growthThresholds, loadTakaranGrowth, routeLabels, routes, type GrowthView } from '../features/takaranGrowth';
import './TakaranGrowth.css';

const images = import.meta.glob<string>('../assets/takaran/evolution/*.png', { eager: true, query: '?url', import: 'default' });
const image = (id: string) => images['../assets/takaran/evolution/' + id + '.png'];
const names = {
  food: ['もぐもぐたからん', 'グルメたからん', 'まんぷくたからん'],
  nature: ['リーフたからん', 'フォレストたからん', 'しんりんたからん'],
  history: ['まなびたからん', 'はかせたからん', 'いにしえたからん'],
  city: ['おしゃれたからん', 'トラベルたからん', 'シティたからん'],
};
const unavailable: GrowthView = { available: false, growth: null, route: null, pendingStage: 0, message: '育成情報を確認できません。保存データは変更していません。' };
function safeLoad(uid: string) { try { return loadTakaranGrowth(localStorage, uid); } catch { return unavailable; } }

/** Mount keyed by authenticated UID. No search, location, reward or network operations. */
export function TakaranGrowth({ uid, adventureInProgress }: { uid: string; adventureInProgress: boolean }) {
  const [view, setView] = useState<GrowthView>(() => safeLoad(uid));
  const [dismissed, setDismissed] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [brokenImage, setBrokenImage] = useState('');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const galleryId = useId();
  const refresh = useCallback(() => { setView(safeLoad(uid)); setDismissed(false); setSaveMessage(''); }, [uid]);
  useEffect(() => {
    const update = (event: StorageEvent) => { if (event.key === 'machiPersonalDiscoveries.v1:' + uid || event.key === 'machiTakaranGrowth.v1:' + uid || event.key === null) refresh(); };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [uid, refresh]);
  const close = useCallback(() => {
    setDismissed(true);
    try {
      if (!acknowledgeTakaranGrowth(localStorage, uid, view.pendingStage)) setSaveMessage('演出の確認を保存できませんでした。冒険や発見記録には影響ありません。再表示される場合があります。');
    } catch { setSaveMessage('演出の確認を保存できませんでした。発見記録は保持しています。'); }
  }, [uid, view.pendingStage]);
  const showCelebration = view.available && view.pendingStage > 0 && !dismissed && !adventureInProgress;
  useEffect(() => {
    if (!showCelebration) return;
    const timer = window.setTimeout(close, 2500);
    return () => window.clearTimeout(timer);
  }, [showCelebration, close]);
  const g = view.growth;
  const currentId = view.route ? 'lv10_' + view.route : 'lv01_base';
  const currentName = view.route ? names[view.route][0] : 'たからん';
  const omenRoute = g && g.level >= 7 && !view.route ? g.leader : null;
  return <section className="my-page-card takaran-growth" aria-labelledby="takaran-growth-title">
    <h2 id="takaran-growth-title">たからんの育成</h2>
    <p>冒険者レベル・EXPとは別の、あなたのたからんです。</p>
    {!view.available || !g ? <p role="status">{view.message}</p> : <>
      <div className={`takaran-growth-portrait ${g.level >= 3 ? 'has-item' : ''} ${g.level >= 5 ? 'has-glow' : ''} ${g.level >= 7 && !view.route && g.leader ? 'omen-' + g.leader : ''}`}>
        {image(currentId) && brokenImage !== currentId ? <img src={image(currentId)} alt={currentName} onError={() => setBrokenImage(currentId)} /> : <p>画像を読み込めませんでした。育成記録は保持しています。</p>}
        {omenRoute && <span className="takaran-growth-symbols" data-omen={omenRoute} aria-hidden="true">{[0, 1, 2, 3].map(index => <span key={index}>{omenRoute === 'history' ? '✦' : omenRoute === 'city' ? (index % 2 ? '✧' : '✦') : null}</span>)}</span>}
        {g.level >= 3 && !view.route && <span className="takaran-growth-item" aria-label="冒険アイテム：冒険ノート">冒険<br/>ノート</span>}
      </div>
      <h3>{currentName}</h3><p className="takaran-growth-level">たからん Lv.{g.level}</p>
      <p className="takaran-growth-discoveries">{g.level < 10 ? `${g.count} / ${growthThresholds[g.level]}個の宝物を発見` : `${g.count}個の宝物を発見`}</p>
      <progress aria-label="たからんの成長ゲージ" aria-valuetext={g.level < 10 ? `Lv.${g.level}からLv.${g.level + 1}までの進捗：${Math.round(g.progress)}%` : 'Lv.10達成：100%'} max={100} value={g.progress} />
      <p className="takaran-growth-next-level">{g.level < 10 ? `あと${g.remaining}個でLv.${g.level + 1}！` : 'Lv.10達成！ 今後の発見も図鑑に蓄積されます。'}</p>
      <p className="takaran-growth-count-note">GPS到着済みの発見を集計（同じ宝物は1個）</p>
      <blockquote>{growthLines[g.level - 1]}</blockquote>
      {g.level >= 7 && !view.route && g.leader && <p className="takaran-growth-omen">{routeLabels[g.leader]}の力が集まっています。進化先はまだ確定していません。</p>}
      {view.message && <p role="status">{view.message}</p>}
      {showCelebration && <div className="takaran-growth-celebration" role="region" aria-label="たからんの成長演出">
        <p role="status">{view.pendingStage === 10 ? `${currentName}に進化しました！` : view.pendingStage === 7 ? '進化の予兆！新しい力が集まっています。' : view.pendingStage === 5 ? '羽が輝きはじめました！' : '冒険ノートを手に入れました！'}</p>
        <button type="button" onClick={close}>演出をスキップ</button>
      </div>}
      <p className="takaran-growth-next-goal">{g.level < 10 ? '次の進化目標：Lv.10で本格進化' : '次の進化目標：Lv.20（今後対応予定）'}</p>
      <button className="takaran-growth-gallery-toggle" type="button" aria-expanded={galleryOpen} aria-controls={galleryId} onClick={() => setGalleryOpen(open => !open)}>{galleryOpen ? '進化図鑑を閉じる' : '進化図鑑を見る'}<span aria-hidden="true">{galleryOpen ? '−' : '＋'}</span></button>
      <div id={galleryId} className="takaran-growth-gallery-panel" hidden={!galleryOpen}>{galleryOpen && <>
      <h3>たからん進化図鑑</h3>
      <p>解放した姿だけを表示します。Lv.20・30の育成は今後対応予定です。</p>
      <ul className="takaran-growth-gallery">
        <li><img src={image('lv01_base')} alt="基本のたからん" loading="lazy" /><span>たからん</span><small>Lv.1</small></li>
        {([10, 20, 30] as const).flatMap((level, index) => routes.map(route => {
          const unlocked = level === 10 && view.route === route;
          return <li key={level + route} className={unlocked ? 'unlocked' : 'locked'}>
            {unlocked ? <img src={image('lv10_' + route)} alt={names[route][index]} loading="lazy" /> : <span className="takaran-growth-hidden" aria-hidden="true">？</span>}
            <span>{unlocked ? names[route][index] : '？？？'}</span><small>Lv.{level}{level > 10 ? '・？？？' : ''}</small>
          </li>;
        }))}
      </ul>
      </>}</div>
    </>}
    {saveMessage && <p role="status">{saveMessage}</p>}
    <button type="button" onClick={refresh}>育成情報を再確認</button>
    <p className="takaran-growth-note">投稿だけ・同じ宝物への再訪では成長しません。旧履歴・過去のデート冒険は推測で加算しません。育成はこの端末・Googleアカウント別で、端末間同期はありません。</p>
  </section>;
}
