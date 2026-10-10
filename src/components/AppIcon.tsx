import { Fragment } from 'react';
import { ArrowLeft, ArrowRight, Banknote, BookOpen, Box, Building2, CalendarDays, Camera, CheckCircle2, ChevronRight, CircleHelp, Coffee, Coins, Compass, Crown, Dice5, Film, Footprints, Gem, Gift, Heart, House, Leaf, Map, MapPin, Moon, Music, PartyPopper, Search, Smile, Sparkles, Sprout, Star, Store, Sun, Target, Tent, Trees, Trophy, UserRound, Utensils, Wallet, type LucideIcon } from 'lucide-react';

const icons = { back: ArrowLeft, next: ArrowRight, chevron: ChevronRight, banknote: Banknote, book: BookOpen, box: Box, building: Building2, calendar: CalendarDays, camera: Camera, check: CheckCircle2, help: CircleHelp, cafe: Coffee, coins: Coins, compass: Compass, crown: Crown, dice: Dice5, film: Film, walk: Footprints, gem: Gem, gift: Gift, heart: Heart, home: House, leaf: Leaf, map: Map, pin: MapPin, moon: Moon, music: Music, celebrate: PartyPopper, search: Search, smile: Smile, sparkle: Sparkles, sprout: Sprout, star: Star, shop: Store, sun: Sun, target: Target, event: Tent, nature: Trees, trophy: Trophy, user: UserRound, gourmet: Utensils, wallet: Wallet } satisfies Record<string, LucideIcon>;
export type AppIconName = keyof typeof icons | 'shrine';
// Icons are decorative. The adjacent Japanese label supplies the accessible name.
export function AppIcon({ name, className = '' }: { name: AppIconName; className?: string }) {
  const props = { className: 'app-icon app-icon--' + name + ' ' + className, width: 22, height: 22, strokeWidth: 1.8, 'aria-hidden': true as const, focusable: false as const };
  if (name === 'shrine') return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4c6 2 12 2 18 0M4 8h16M5 12h14M7 8v13M17 8v13M12 6v6M5 21h4M15 21h4" /></svg>;
  const Icon = icons[name];
  return <Icon {...props} />;
}

// Legacy category values are also stored in Supabase/localStorage. Translate only
// known UI labels at the rendering boundary, never names, comments or stored data.
const legacyIcons: Record<string, AppIconName> = {
  '🍴':'gourmet','🍜':'gourmet','☕':'cafe','⛩':'shrine','🌳':'nature','📷':'camera','📸':'camera','🧭':'compass','🗺':'map','📍':'pin','👣':'walk','🚶':'walk','👟':'walk','🥾':'walk',
  '💎':'gem','📖':'book','📦':'box','🏠':'home','👤':'user','🏪':'shop','🎯':'target','🪙':'coins','💴':'banknote','💰':'wallet','🆓':'gift','❓':'help','🎲':'dice','😊':'smile','😌':'leaf','❤️':'heart','❤':'heart','💖':'heart','🎪':'event','🏢':'building','🌃':'moon','🎬':'film','🍃':'leaf','🌿':'leaf','🌱':'sprout','☀':'sun','🌙':'moon','🎁':'gift','🎵':'music','✨':'sparkle','🌟':'star','⭐':'star','🔍':'search','🔎':'search','🎉':'celebrate','✅':'check','📅':'calendar','🎰':'dice','🏆':'trophy','→':'next','←':'back','›':'chevron'
};
const iconTokens = new RegExp('(' + Object.keys(legacyIcons).sort((a,b)=>b.length-a.length).join('|') + ')(?:\\uFE0F)?', 'gu');
export function plainIconLabel(text: string) { return text.replace(iconTokens, '').trim(); }
export function IconText({ text }: { text: string }) {
  const parts: Array<string | { name: AppIconName; key: number }> = [];
  let cursor = 0;
  for (const match of text.matchAll(iconTokens)) {
    parts.push(text.slice(cursor, match.index));
    parts.push({ name: legacyIcons[match[1]], key: match.index! });
    cursor = match.index! + match[0].length;
  }
  parts.push(text.slice(cursor));
  return <>{parts.map((part, i) => typeof part === 'string' ? <Fragment key={i}>{part}</Fragment> : <AppIcon key={part.key + '-icon'} name={part.name} />)}</>;
}
