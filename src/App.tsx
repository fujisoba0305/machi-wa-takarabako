import { FormEvent, useEffect, useState } from 'react';
import {
Compass,
BookOpen,
MapPinned,
UserRound,
Gem,
Sparkles,
} from 'lucide-react';

import {
getNearbyParks,
getNearbyCafes,
getNearbyRestaurants,
getNearbyFoodWalkSpots,
getNearbyViewSpots,
getNearbyEventSpots,
getNearbyRelaxSpots,
getNearbyCinemas,
getNearbyFreeRelaxSpots,
getNearbyShrinesAndTemples,
} from './services/overpass';

type ChoiceKey =
| 'distance'
| 'mood'
| 'budget'
| 'time'
| 'foodGenre'
| 'dateGenre'
| 'eventGenre'
| 'shrineGenre';

type Spot = {
type?: string;
id?: number | string;
lat?: number;
lon?: number;
center?: {
lat: number;
lon: number;
};
tags?: {
name?: string;
[key: string]: string | undefined;
};
};

const choiceGroups: Array<{
key: ChoiceKey;
label: string;
options: string[];
}> = [
{
key: 'distance',
label: '距離',
options: ['1km', '3km', '5km', '10km', '？km'],
},
{
key: 'mood',
label: '気分',
options: [
'カフェ',
'自然',
'写真',
'ストレス解消',
'デート',
'神社・お寺',
'グルメ',
'イベント',
'おまかせ',
],
},
{
key: 'budget',
label: '予算',
options: ['0円', '～1000円', '～3000円', '気にしない'],
},
{
key: 'time',
label: '時間',
options: ['朝', '昼', '夕方', '夜'],
},
{
key: 'foodGenre',
label: 'グルメジャンル',
options: [
'おまかせ',
'和食',
'イタリアン',
'中華',
'韓国料理',
'ラーメン',
'カレー',
'スイーツ',
],
},
{
key: 'dateGenre',
label: 'デートジャンル',
options: ['おまかせ', 'まったり', '食べ歩き', '夜景', 'イベント'],
},
{
key: 'eventGenre',
label: 'イベントジャンル',
options: ['おまかせ', '水族館', '動物園', '博物館', '美術館', '展望台'],
},
{
key: 'shrineGenre',
label: '神社・お寺ジャンル',
options: ['おまかせ', '御朱印巡り', '歴史散策', 'パワースポット'],
},
];

function TownIllustration() {
return (
<section className="town" aria-label="街並みのイラスト">
<div className="sky-sun" />
<div className="cloud cloud-left" />
<div className="cloud cloud-right" />

<div className="street-row">
<div className="tree" aria-hidden="true">
<span className="tree-top" />
<span className="tree-trunk" />
</div>

<div className="building cafe">
<div className="awning" />
<strong>CAFE</strong>
<span className="door" />
<span className="window" />
</div>

<div className="building library">
<div className="roof" />
<strong>LIBRARY</strong>
<span className="columns" />
</div>

<div className="building shop">
<div className="awning stripes" />
<strong>SHOP</strong>
<span className="door" />
<span className="window" />
</div>

<div className="lamp" aria-hidden="true">
<span className="lamp-light" />
<span className="lamp-post" />
</div>
</div>

<div className="treasure" aria-label="宝箱アイコン">
<span className="treasure-lid" />
<span className="treasure-body" />
<span className="treasure-lock" />
</div>
</section>
);
}

const randomItem = <T,>(items: T[]): T =>
items[Math.floor(Math.random() * items.length)];
function getOptionIcon(option: string) {
const icons: Record<string, string> = {
カフェ: '☕',
自然: '🌳',
写真: '📷',
ストレス解消: '😌',
デート: '❤️',
グルメ: '🍴',
イベント: '🎪',
'神社・お寺': '⛩',
おまかせ: '🎲',
'1km': '🚶',
'3km': '👟',
'5km': '🧭',
'10km': '🗺️',
'？km': '❓',
'0円': '🆓',
'500円': '🪙',
'1000円': '💴',
'3000円': '💰',
無制限: '👑',
昼: '☀️',
夜: '🌙',
};

return icons[option] || '';
}

function getSpotLocation(spot: Spot) {
if (typeof spot.lat === 'number' && typeof spot.lon === 'number') {
return {
lat: spot.lat,
lon: spot.lon,
};
}

if (
typeof spot.center?.lat === 'number' &&
typeof spot.center?.lon === 'number'
) {
return {
lat: spot.center.lat,
lon: spot.center.lon,
};
}

return null;
}

function calculateDistance(
lat1: number,
lon1: number,
lat2: number,
lon2: number
) {
const R = 6371;

const dLat = ((lat2 - lat1) * Math.PI) / 180;
const dLon = ((lon2 - lon1) * Math.PI) / 180;

const a =
Math.sin(dLat / 2) * Math.sin(dLat / 2) +
Math.cos((lat1 * Math.PI) / 180) *
Math.cos((lat2 * Math.PI) / 180) *
Math.sin(dLon / 2) *
Math.sin(dLon / 2);

const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

return R * c;
}

export default function App() {
const [name, setName] = useState('');
const [hasStarted, setHasStarted] = useState(false);
const [takaranSpeech, setTakaranSpeech] = useState(
"😊 まずは僕を押してね！"
);
const [gachaStep, setGachaStep] = useState(1);
const [showCapsule, setShowCapsule] = useState(false);
const [screen, setScreen] = useState<
'home' | 'condition' | 'coin' | 'gacha' | 'capsule' | 'result'
>('home');
const [choices, setChoices] = useState<Record<ChoiceKey, string>>({
distance: '',
mood: '',
budget: '',
time: '',
foodGenre: '',
dateGenre: '',
eventGenre: '',
shrineGenre:','
});

const [currentLocation, setCurrentLocation] = useState<{
latitude: number;
longitude: number;
} | null>(null);

const [nearbySpot, setNearbySpot] = useState<Spot | null>(null);
const [dateFinalSpot, setDateFinalSpot] = useState<Spot | null>(null);
const [spotDistance, setSpotDistance] = useState<number | null>(null);
const [searchExpandLevel, setSearchExpandLevel] = useState(0);
const [isSearching, setIsSearching] = useState(false);
const [courseStep, setCourseStep] = useState(1);
const [exp, setExp] = useState(() => {
const savedExp = localStorage.getItem('machiTakarabakoExp');
return savedExp ? Number(savedExp) : 0;
});

const [adventureCount, setAdventureCount] = useState(() => {
const savedCount = localStorage.getItem('machiTakarabakoAdventureCount');
return savedCount ? Number(savedCount) : 0;
});

const [levelUpMessage, setLevelUpMessage] = useState('');
const [achievementMessage, setAchievementMessage] = useState('');
const trimmedName = name.trim();
useEffect(() => {
localStorage.setItem('machiTakarabakoExp', String(exp));
}, [exp]);
useEffect(() => {
localStorage.setItem(
'machiTakarabakoAdventureCount',
String(adventureCount)
);
}, [adventureCount]);

const canProceedToGacha =
Boolean(choices.distance) &&
Boolean(choices.mood) &&
Boolean(choices.budget) &&
Boolean(choices.time) &&
(choices.mood !== 'グルメ' || Boolean(choices.foodGenre)) &&
(choices.mood !== 'デート' || Boolean(choices.dateGenre)) &&
(choices.mood !== 'イベント' || Boolean(choices.eventGenre));

function handleSubmit(event: FormEvent<HTMLFormElement>) {
event.preventDefault();

if (trimmedName) {
setHasStarted(true);
setScreen('home');
}
}

function selectChoice(key: ChoiceKey, option: string) {
setChoices((currentChoices) => ({
...currentChoices,
[key]: option,
}));
}

function getCurrentLocation() {
if (!navigator.geolocation) {
setTakaranSpeech("😢 この端末では現在地が使えないみたい...");
alert('このブラウザでは現在地取得が使えません。');
return;
}

setTakaranSpeech("🔍 現在地を探してるよ...");

navigator.geolocation.getCurrentPosition(
(position) => {
setCurrentLocation({
latitude: position.coords.latitude,
longitude: position.coords.longitude,
});

setTakaranSpeech("🎉 よし！冒険に行こう！");
},
(error) => {
console.error(error);
setTakaranSpeech("😢 現在地が見つからなかったよ...");
alert('現在地を取得できませんでした。ブラウザの位置情報許可を確認してください。');
},
{
enableHighAccuracy: true,
timeout: 10000,
maximumAge: 0,
}
);
}

useEffect(() => {
if (screen !== 'gacha') return;

setGachaStep(1);
setShowCapsule(false);

findNearbySpot();

const timer1 = setTimeout(() => setGachaStep(2), 1600);
const timer2 = setTimeout(() => setGachaStep(3), 3200);
const timer3 = setTimeout(() => setShowCapsule(true), 4500);

return () => {
clearTimeout(timer1);
clearTimeout(timer2);
clearTimeout(timer3);
};
}, [screen]);

function getRadius() {
if (choices.distance === '1km') return 1000;
if (choices.distance === '3km') return 3000;
if (choices.distance === '5km') return 5000;
if (choices.distance === '10km') return 10000;
return 3000;
}

function getSpotsInRange(spots: Spot[]) {
if (!currentLocation) return [];

const range = getDistanceRange();

return getNamedSpots(spots).filter((spot) => {
const location = getSpotLocation(spot);

if (!location) return false;

const distance = calculateDistance(
currentLocation.latitude,
currentLocation.longitude,
location.lat,
location.lon
);

console.log(
spot.tags?.name,
distance,
range.min,
range.max
);

return distance >= range.min && distance <= range.max;
});
}

function getNamedSpots(spots: Spot[]) {
return spots.filter((spot) => spot.tags?.name && getSpotLocation(spot));
}

function filterFreeSpots(spots: Spot[]) {
return spots.filter((spot) => {
const tags = spot.tags;

if (!tags) return false;

const isPaidLike =
tags.amenity === 'cafe' ||
tags.amenity === 'restaurant' ||
tags.amenity === 'fast_food' ||
tags.amenity === 'cinema' ||
tags.amenity === 'public_bath' ||
tags.leisure === 'spa' ||
tags.shop === 'bakery' ||
tags.shop === 'confectionery' ||
tags.shop === 'pastry' ||
tags.shop === 'coffee';

return !isPaidLike;
});
}
function getDistanceRange() {
const expand = searchExpandLevel;

if (choices.distance === '1km') {
return { min: 0, max: 1.5 + expand };
}

if (choices.distance === '3km') {
return { min: 0, max: 4 + expand };
}

if (choices.distance === '5km') {
return { min: 0, max: 6 + expand };
}

if (choices.distance === '10km') {
return { min: 0, max: 12 + expand };
}

return { min: 0, max: 999 };
}

function setSelectedSpot(spot: Spot | null) {
setNearbySpot(spot);

if (!currentLocation || !spot) {
setSpotDistance(null);
return;
}

const location = getSpotLocation(spot);

if (!location) {
setSpotDistance(null);
return;
}

const distance = calculateDistance(
currentLocation.latitude,
currentLocation.longitude,
location.lat,
location.lon
);

setSpotDistance(distance);
}

async function getSpotsByMood() {
if (!currentLocation) return [];

const latitude = currentLocation.latitude;
const longitude = currentLocation.longitude;
const radius = getRadius() + searchExpandLevel * 1000;

if (choices.mood === 'カフェ') {
return getNearbyCafes(latitude, longitude, radius);
}

if (choices.mood === '自然') {
return getNearbyParks(latitude, longitude, radius);
}

if (choices.mood === 'グルメ') {
return getNearbyRestaurants(
latitude,
longitude,
radius,
choices.foodGenre || 'おまかせ'
);
}

if (choices.mood === 'イベント') {
return getNearbyEventSpots(
latitude,
longitude,
radius,
choices.eventGenre || 'おまかせ'
);
}

if (choices.mood === '写真') {
return getNearbyViewSpots(latitude, longitude, radius);
}

if (choices.mood === 'ストレス解消') {
return getNearbyRelaxSpots(latitude, longitude, radius);
}

if (choices.mood === '神社・お寺') {
return getNearbyShrinesAndTemples(
latitude,
longitude,
radius,
choices.shrineGenre || 'おまかせ'
);
}

const randomMood = randomItem([
'カフェ',
'自然',
'グルメ',
'イベント',
'写真',
'ストレス解消',
]);

if (randomMood === 'カフェ') {
return getNearbyCafes(latitude, longitude, radius);
}

if (randomMood === '自然') {
return getNearbyParks(latitude, longitude, radius);
}

if (randomMood === 'グルメ') {
return getNearbyRestaurants(latitude, longitude, radius, 'おまかせ');
}

if (randomMood === 'イベント') {
return getNearbyEventSpots(latitude, longitude, radius, 'おまかせ');
}

if (randomMood === 'ストレス解消') {
return getNearbyRelaxSpots(latitude, longitude, radius);
}

return getNearbyViewSpots(latitude, longitude, radius);
}

async function findDateCourse() {
if (!currentLocation) return;

const latitude = currentLocation.latitude;
const longitude = currentLocation.longitude;

const targetDistanceKm = getRadius() / 1000;

const searchRadius =
choices.budget === '0円' && choices.dateGenre === 'まったり'
? getRadius() + 3000 + searchExpandLevel * 1000
: getRadius() + searchExpandLevel * 1000;

const maxCourseDistanceKm =
choices.distance === '1km'
? targetDistanceKm + 1
: choices.distance === '3km'
? targetDistanceKm + 2
: targetDistanceKm + 1.5;

let waypointSpots: Spot[] = [];

if (choices.budget === '0円') {
waypointSpots = await getNearbyRelaxSpots(latitude, longitude, searchRadius);
waypointSpots = filterFreeSpots(waypointSpots);
} else {
waypointSpots =
choices.dateGenre === '食べ歩き'
? await getNearbyFoodWalkSpots(latitude, longitude, searchRadius)
: await getNearbyCafes(latitude, longitude, searchRadius);
}

let finalSpots: Spot[] = [];

if (choices.dateGenre === 'まったり') {
finalSpots = await getNearbyRelaxSpots(latitude, longitude, searchRadius);

if (choices.budget === '0円') {
finalSpots = filterFreeSpots(finalSpots);
}
} else if (choices.dateGenre === '夜景') {
finalSpots = await getNearbyViewSpots(latitude, longitude, searchRadius);
} else if (choices.dateGenre === 'イベント') {
finalSpots = await getNearbyEventSpots(
latitude,
longitude,
searchRadius,
'おまかせ'
);
} else if (choices.dateGenre === '食べ歩き') {
finalSpots = await getNearbyRestaurants(
latitude,
longitude,
searchRadius,
'おまかせ'
);
} else {
finalSpots = await getNearbyParks(latitude, longitude, searchRadius);
}

const namedWaypoints = getNamedSpots(waypointSpots);
const namedFinalSpots = getNamedSpots(finalSpots);

const allCourses = namedWaypoints
.flatMap((waypoint) => {
const waypointLocation = getSpotLocation(waypoint);
if (!waypointLocation) return [];

return namedFinalSpots
.map((finalSpot) => {
const finalLocation = getSpotLocation(finalSpot);
if (!finalLocation) return null;

const waypointName = waypoint.tags?.name;
const finalName = finalSpot.tags?.name;

if (!waypointName || !finalName) return null;
if (waypointName === finalName) return null;

const distanceToWaypoint = calculateDistance(
latitude,
longitude,
waypointLocation.lat,
waypointLocation.lon
);

const distanceWaypointToFinal = calculateDistance(
waypointLocation.lat,
waypointLocation.lon,
finalLocation.lat,
finalLocation.lon
);

return {
waypoint,
finalSpot,
totalDistance: distanceToWaypoint + distanceWaypointToFinal,
};
})
.filter(
(
course
): course is {
waypoint: Spot;
finalSpot: Spot;
totalDistance: number;
} => course !== null
);
})
.sort(
(a, b) =>
Math.abs(a.totalDistance - targetDistanceKm) -
Math.abs(b.totalDistance - targetDistanceKm)
);

const courseCandidates = allCourses.filter(
(course) => course.totalDistance <= maxCourseDistanceKm
);

const selectedCourse =
courseCandidates.length > 0 ? randomItem(courseCandidates.slice(0, 5)) : allCourses[0];

if (selectedCourse) {
setNearbySpot(selectedCourse.waypoint);
setDateFinalSpot(selectedCourse.finalSpot);
setSpotDistance(selectedCourse.totalDistance);
} else {
setNearbySpot(null);
setDateFinalSpot(null);
setSpotDistance(null);
}
}

async function findNearbySpot() {
if (!currentLocation) {
alert('先に現在地を取得してください。');
setNearbySpot(null);
setDateFinalSpot(null);
setSpotDistance(null);
return;
}

setIsSearching(true);

try {
setNearbySpot(null);
setDateFinalSpot(null);
setSpotDistance(null);

if (choices.mood === 'デート') {
await findDateCourse();
return;
}

const spots = await getSpotsByMood();

const namedSpots = getNamedSpots(spots);

if (namedSpots.length > 0) {
const spot = randomItem(namedSpots);
setNearbySpot(spot);
setSelectedSpot(spot);

const location = getSpotLocation(spot);
if (location && currentLocation) {
const distance = calculateDistance(
currentLocation.latitude,
currentLocation.longitude,
location.lat,
location.lon
);
setSpotDistance(distance);
}
} else {
setNearbySpot(null);
setSelectedSpot(null);
setSpotDistance(null);
}

} catch (error) {
console.error(error);
setNearbySpot(null);
setDateFinalSpot(null);
setSpotDistance(null);
} finally {
setIsSearching(false);
}
}

function getWalkRank(currentExp: number) {
if (currentExp >= 3000) return '👑 お散歩マイスター';
if (currentExp >= 1500) return '🗺️ お散歩マスター';
if (currentExp >= 700) return '🥾 お散歩探検家';
if (currentExp >= 300) return '🎒 お散歩好き';
if (currentExp >= 100) return '🌱 お散歩初心者';
return '🚶 お散歩素人';
}
function getWalkRankInfo(currentExp: number) {
if (currentExp >= 3000) {
return {
rank: '👑 お散歩マイスター',
current: currentExp,
next: currentExp,
progress: 100,
nextRank: '最高ランク',
};
}

if (currentExp >= 1500) {
return {
rank: '🗺️ お散歩マスター',
current: currentExp - 1500,
next: 1500,
progress: ((currentExp - 1500) / 1500) * 100,
nextRank: '👑 お散歩マイスター',
};
}

if (currentExp >= 700) {
return {
rank: '🥾 お散歩探検家',
current: currentExp - 700,
next: 800,
progress: ((currentExp - 700) / 800) * 100,
nextRank: '🗺️ お散歩マスター',
};
}

if (currentExp >= 300) {
return {
rank: '🎒 お散歩好き',
current: currentExp - 300,
next: 400,
progress: ((currentExp - 300) / 400) * 100,
nextRank: '🥾 お散歩探検家',
};
}

if (currentExp >= 100) {
return {
rank: '🌱 お散歩初心者',
current: currentExp - 100,
next: 200,
progress: ((currentExp - 100) / 200) * 100,
nextRank: '🎒 お散歩好き',
};
}

return {
rank: '🚶 お散歩素人',
current: currentExp,
next: 100,
progress: (currentExp / 100) * 100,
nextRank: '🌱 お散歩初心者',
};
}
function getTakaran(exp: number) {
if (exp >= 3000) {
return {
level: 6,
icon: '🧚✨',
message: 'やっと会えたね！ここまで育ててくれてありがとう✨',
};
}

if (exp >= 1500) {
return {
level: 5,
icon: '📦🌿',
message: 'もう少しで本当の姿になれる気がする…！',
};
}

if (exp >= 700) {
return {
level: 4,
icon: '📦🙌',
message: '一緒に冒険するのが毎日楽しみだよ！',
};
}

if (exp >= 300) {
return {
level: 3,
icon: '📦👀',
message: '今日はどんな宝物を探しに行く？',
};
}

if (exp >= 100) {
return {
level: 2,
icon: '📦✨',
message: 'こんにちは！少し目が覚めてきたよ！',
};
}

return {
level: 1,
icon: '📦',
message: '……💤',
};
}
function getTakaranNextInfo(exp: number) {
if (exp >= 3000) {
return {
nextLevel: '最高レベル',
remainingExp: 0,
};
}

if (exp >= 1500) {
return {
nextLevel: 'Lv6 精霊たからん',
remainingExp: 3000 - exp,
};
}

if (exp >= 700) {
return {
nextLevel: 'Lv5 目覚めかけの宝箱',
remainingExp: 1500 - exp,
};
}

if (exp >= 300) {
return {
nextLevel: 'Lv4 手が出てくる宝箱',
remainingExp: 700 - exp,
};
}

if (exp >= 100) {
return {
nextLevel: 'Lv3 目が覚めた宝箱',
remainingExp: 300 - exp,
};
}

return {
nextLevel: 'Lv2 少し目覚める宝箱',
remainingExp: 100 - exp,
};
}
function getRandomTakaranMessage(level: number) {
const messages: Record<number, string[]> = {
1: [
'……💤',
'すやすや眠っているみたい。',
'まだ宝箱は静かです。',
],
2: [
'……あれ？',
'少しだけ目が覚めてきたよ。',
'街の気配を感じる…！',
],
3: [
'今日はどんな宝物を探しに行く？',
'一緒に歩くと楽しいね！',
'なんだか宝物の予感がするよ✨',
'知らない道ってワクワクするね。',
],
4: [
'一緒に冒険しよう！',
'君とならもっと遠くまで行けそう！',
'街にはまだ宝物がいっぱいあるよ！',
],
5: [
'もう少しで本当の姿になれる気がする…！',
'僕は誰なんだろう…',
'君が集めた宝物が、僕の力になってるよ。',
],
6: [
'やっと会えたね！',
'君が集めた宝物で、僕は生まれたんだ。',
'これからも一緒に冒険しよう✨',
],
};

const levelMessages = messages[level] || messages[1];
return levelMessages[Math.floor(Math.random() * levelMessages.length)];
}
function getAchievements(adventureCount: number) {
const achievements = [];

if (adventureCount >= 1) {
achievements.push('🏅 はじめての宝物');
}

if (adventureCount >= 5) {
achievements.push('🏅 街歩き見習い');
}

if (adventureCount >= 10) {
achievements.push('🏅 宝探し好き');
}

return achievements;
}
function getNewAchievement(count: number) {
if (count === 1) return '🏅 はじめての宝物';
if (count === 5) return '🏅 街歩き見習い';
if (count === 10) return '🏅 宝探し好き';
return '';
}
function getDestination() {
switch (choices.mood) {
case 'カフェ':
return {
title: 'ほっと一息つける場所',
place: '近くのカフェ',
description:
'今日は少しだけ寄り道して、お気に入りの一杯を探してみましょう。',
mission: '気になるメニューを1つ見つける。',
mapQuery: '近くのカフェ',
};

case '写真':
return {
title: '写真に残したくなる場所',
place: '近くの写真スポット',
description: 'いつもなら通り過ぎる景色を探してみましょう。',
mission: '今日だけの1枚を撮る。',
mapQuery: '近くの写真スポット',
};

case 'グルメ':
return {
title: 'お腹が喜ぶ場所',
place: '近くの飲食店',
description: '歩いた先で気になるお店を探してみましょう。',
mission: '看板メニューを見つける。',
mapQuery: '近くの飲食店',
};

case 'イベント':
return {
title: '街のイベントスポット',
place: '近くのイベントスポット',
description: '今日は少しだけ特別な場所へ出かけてみましょう。',
mission: '気になる展示や景色を1つ見つける。',
mapQuery: '近くの博物館',
};

case 'デート':
if (choices.dateGenre === '夜景') {
return {
title: '夜景デート',
place: '近くの夜景スポット',
description: '街の灯りを眺めながら特別な時間を過ごそう。',
mission: '写真を1枚撮る。',
mapQuery: '展望台',
};
}

if (choices.dateGenre === '食べ歩き') {
return {
title: '食べ歩きデート',
place: '近くの食べ歩きスポット',
description: '気になるお店を巡ろう。',
mission: '気になるお店を1軒見つける。',
mapQuery: '近くの商店街',
};
}

if (choices.dateGenre === 'まったり') {
return {
title: 'まったりデート',
place: '公園・川辺・温泉・映画館',
description: '今日は予定を詰め込まず、のんびり過ごそう。',
mission:
'最近楽しかったことを話したり、景色を眺めてのんびり過ごそう。',
mapQuery: '近くの公園',
};
}

if (choices.dateGenre === 'イベント') {
return {
title: 'イベントデート',
place: '近くのイベントスポット',
description: '普段行かない場所へ。',
mission: '新しい発見をする。',
mapQuery: '近くの水族館',
};
}

return {
title: '誰かと歩きたくなる場所',
place: '近くのデートスポット',
description: '景色や会話を楽しめる場所へ。',
mission: 'ゆっくり歩ける道を見つける。',
mapQuery: '近くのデートスポット',
};

case '自然':
return randomItem([
{
title: '水の音が聞こえる場所',
place: '近くの公園',
description: '少しだけ遠回りして、緑や水辺を探してみましょう。',
mission: '鳥の声や風の音を聞いてみる。',
mapQuery: '近くの公園',
},
{
title: '風が気持ちいい場所',
place: '近くの公園',
description: '風を感じながら歩いてみましょう。',
mission: '空を見上げる。',
mapQuery: '近くの公園',
},
{
title: '緑に囲まれた場所',
place: '近くの公園',
description: '自然の中で深呼吸してみましょう。',
mission: '気になる木を見つける。',
mapQuery: '近くの公園',
},
]);

case 'ストレス解消':
return {
title: '心をゆるめる場所',
place: '近くのリラックススポット',
description: '少しだけ肩の力を抜ける場所へ向かいましょう。',
mission: '深呼吸を3回する。',
mapQuery: '近くの公園',
};

case '神社・お寺':
return {
title: '心が整う場所',
place: '近くの神社・お寺',
description: '今日は少しだけ足を伸ばして、静かな場所で心を整えてみましょう。',
mission: '鳥居や本堂の前で、深呼吸を1回する。',
mapQuery: '近くの神社',
};

default:
return {
title: 'まだ知らない街の宝物',
place: '近くの気になるスポット',
description:
'今日は目的を決めすぎず、街の中にある小さな発見を探してみましょう。',
mission: '気になったものを1つ写真に残す。',
mapQuery: '近くの観光スポット',
};
}
}

function getDateCourse() {
if (choices.mood !== 'デート') return null;

if (choices.dateGenre === '食べ歩き') {
return ['カフェを楽しむ', '周辺を散策する', '気になるお店を1軒見つける'];
}

if (choices.dateGenre === '夜景') {
return ['カフェでひと休み', '夕焼けを探す', '夜景スポットへ向かう'];
}

if (choices.dateGenre === 'イベント') {
return [
'気になる展示やイベントを探す',
'近くのカフェで感想を話す',
'帰り道に写真を1枚撮る',
];
}

if (choices.dateGenre === 'まったり') {
return [
'カフェでひと休みする',
'川辺や公園を散歩する',
'最近楽しかったことを話す',
];
}

return ['カフェでひと休みする', '街を散策する', '気になる場所へ向かう'];
}

const destination = getDestination();
const walkRankInfo = getWalkRankInfo(exp);
const takaran = getTakaran(exp);
const takaranNextInfo = getTakaranNextInfo(exp);
const takaranMessage = getRandomTakaranMessage(takaran.level);
const achievements = getAchievements(adventureCount);
const dateCourse = getDateCourse();
const displayPlace = nearbySpot?.tags?.name || destination.place;

function openMapForSpot(spot: Spot | null, fallbackQuery: string) {
const location = spot ? getSpotLocation(spot) : null;

if (location) {
window.open(
`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lon}`,
'_blank'
);
return;
}

const query = currentLocation
? `${fallbackQuery} near ${currentLocation.latitude},${currentLocation.longitude}`
: fallbackQuery;

window.open(
`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
'_blank'
);
}

function openWaypointMap() {
if (!nearbySpot) return;

const location = getSpotLocation(nearbySpot);

if (!location) return;

window.open(
`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lon}`,
'_blank'
);
}

function openFinalMap() {
if (!dateFinalSpot) return;

const location = getSpotLocation(dateFinalSpot);

if (!location) return;

window.open(
`https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lon}`,
'_blank'
);
}

function openGoogleMap() {
if (choices.mood === 'デート') {
const waypointLocation = nearbySpot ? getSpotLocation(nearbySpot) : null;
const finalLocation = dateFinalSpot ? getSpotLocation(dateFinalSpot) : null;

if (currentLocation && waypointLocation && finalLocation) {
const params = new URLSearchParams({
api: '1',
origin: `${currentLocation.latitude},${currentLocation.longitude}`,
destination: `${finalLocation.lat},${finalLocation.lon}`,
waypoints: `${waypointLocation.lat},${waypointLocation.lon}`,
travelmode: 'walking',
});

window.open(
`https://www.google.com/maps/dir/?${params.toString()}`,
'_blank'
);
return;
}
}
openMapForSpot(nearbySpot, destination.mapQuery);
}


return (
<main className="app-shell">
{!hasStarted ? (
<div className="title-screen">
<TownIllustration />

<section className="intro" aria-labelledby="app-title">
<p className="eyebrow">はじまりの街歩き</p>
<h1 id="app-title">街は宝箱</h1>
<p className="subtitle">街は、まだ知らない宝箱。</p>
<p className="description">歩くだけで宝物が見つかる。</p>
</section>

<form className="name-form" onSubmit={handleSubmit}>
<label htmlFor="player-name">名前を入力してください</label>
<input
id="player-name"
name="player-name"
type="text"
value={name}
onChange={(event) => setName(event.target.value)}
placeholder="たから"
autoComplete="name"
/>
<button type="submit" disabled={!trimmedName}>
<Compass size={20} />
冒険を始める
</button>
</form>
</div>
) : screen === 'home' ? (
<section className="home-screen">
<div className="home-header">
<p className="home-kicker">🚶 好奇心を増やすお散歩アプリ</p>

<h1>📦 街は宝箱</h1>

<p>
{trimmedName}さん、
<br />
今日も街の宝物を探しに行こう！
</p>
</div>

<div
className="treasure-box-card takaran-tap-card"
onClick={getCurrentLocation}
>
<div className="treasure-box-icon">{takaran.icon}</div>

<h2>たからん Lv{takaran.level}</h2>

<p>
{takaranSpeech}
</p>

<small>
{currentLocation ? (
"🧭 冒険に出発しよう！"
) : (
<>
📍 現在地を取得します
<br />
君の近くに眠る宝物を探すため、
<br />
現在地を取得します。
<br />
<br />
※位置情報は宝物を探すためだけに利用します。
</>
)}
</small>
<button
className="takaran-location-button"
type="button"
onClick={getCurrentLocation}
>
📍 たからんを押して現在地を取得
</button>

{takaranNextInfo.remainingExp > 0 ? (
<p className="takaran-next">
🌟 進化まであと {takaranNextInfo.remainingExp} EXP
</p>
) : (
<p className="takaran-next">🎉 たからんは最高レベルです！</p>
)}

<div>
<p>現在のランク</p>
<strong>{walkRankInfo.rank}</strong>
<p>
{walkRankInfo.current} / {walkRankInfo.next} EXP
</p>

<div className="exp-bar">
<div
className="exp-bar-fill"
style={{ width: `${Math.min(walkRankInfo.progress, 100)}%` }}
/>
</div>

<p>次のランク：{walkRankInfo.nextRank}</p>

</div>
</div>

</section>
) : screen === 'condition' ? (
<section className="condition-screen" aria-live="polite">
<div className="condition-hero">
<p className="result-kicker">🎒 冒険の準備</p>
<h2>{trimmedName}さん、今日の宝物を探しに行こう</h2>
<p>条件を選ぶと、冒険コインが作られます。</p>
</div>

<div className="choice-panel adventure-choice-panel">
{choiceGroups
.filter(
(group) =>
(group.key !== 'foodGenre' || choices.mood === 'グルメ') &&
(group.key !== 'dateGenre' || choices.mood === 'デート') &&
(group.key !== 'eventGenre' || choices.mood === 'イベント') &&
(group.key !== 'shrineGenre' || choices.mood === '神社・お寺')
)
.map((group) => (
<fieldset className="choice-group adventure-choice-card" key={group.key}>
<legend>{group.label}</legend>

<div className="choice-buttons">
{group.options.map((option) => (
<button
className={
choices[group.key] === option
? 'choice-button selected'
: 'choice-button'
}
key={option}
onClick={() => selectChoice(group.key, option)}
type="button"
>
<span className="choice-icon">{getOptionIcon(option)}</span>
<span>{option}</span>
</button>
))}
</div>
</fieldset>
))}
</div>

<div className="selected-condition-card">
<p className="result-label">🪙 今日の冒険コイン</p>

<div className="coin-grid">
<div className="coin-item">
<span className="coin-title">距離</span>
<strong>{getOptionIcon(choices.distance)} {choices.distance || '未選択'}</strong>
</div>

<div className="coin-item">
<span className="coin-title">気分</span>
<strong>{getOptionIcon(choices.mood)} {choices.mood || '未選択'}</strong>
</div>

<div className="coin-item">
<span className="coin-title">予算</span>
<strong>{getOptionIcon(choices.budget)} {choices.budget || '未選択'}</strong>
</div>

<div className="coin-item">
<span className="coin-title">時間</span>
<strong>{getOptionIcon(choices.time)} {choices.time || '未選択'}</strong>
</div>
{choices.mood === 'デート' && choices.dateGenre && (
<div className="coin-item coin-wide">
<span className="coin-title">デートジャンル</span>
<strong>{choices.dateGenre}</strong>
</div>
)}

{choices.mood === 'グルメ' && choices.foodGenre && (
<div className="coin-item coin-wide">
<span className="coin-title">グルメジャンル</span>
<strong>{choices.foodGenre}</strong>
</div>
)}

{choices.mood === 'イベント' && choices.eventGenre && (
<div className="coin-item coin-wide">
<span className="coin-title">イベントジャンル</span>
<strong>{choices.eventGenre}</strong>
</div>
)}

{choices.mood === '神社・お寺' && choices.shrineGenre && (
<div className="coin-item coin-wide">
<span className="coin-title">神社・お寺ジャンル</span>
<strong>{choices.shrineGenre}</strong>
</div>
)}

</div>
</div>

<button
className="gacha-button"
type="button"
disabled={!canProceedToGacha}
onClick={() => {
setSearchExpandLevel(0);
setCourseStep(1);
setScreen('coin');
}}
>
<Compass size={20} />
冒険コインを作る
</button>
</section>

) : screen === 'coin' ? (
<section className="coin-screen">
<h2>投入するコイン</h2>
<p className="coin-subtitle">今日の冒険条件を刻印したコイン</p>

<div className="adventure-coin">
<span className="coin-label">🏆冒険コイン</span>
<p>{choices.distance}</p>
<p>{choices.mood}</p>
<p>{choices.budget}</p>
<p>{choices.time}</p>
</div>

<button
className="gacha-button"
type="button"
onClick={() => {
setScreen('gacha');

setTimeout(() => {
setScreen('capsule');
}, 3500);
}}
>
ガチャを回す
</button>

</section>
) : screen === 'gacha' ? (
<section className="gacha-screen treasure-gacha-stage">
<h1 className="gacha-main-title">✨ 街の宝ガチャ ✨</h1>
<p className="gacha-sub">
たからんが街の中から、今日の宝物を探しているよ…！
</p>

<div
className={`treasure-gacha-machine ${
gachaStep >= 3 ? 'gacha-found' : ''
}`}
>
<div className="gacha-sign-board">
<strong>街の宝ガチャ</strong>
</div>

<div className="gacha-glass-dome">
<span className="gacha-orb orb-1">☕</span>
<span className="gacha-orb orb-2">🌳</span>
<span className="gacha-orb orb-3">⛩️</span>
<span className="gacha-orb orb-4">🍜</span>
<span className="gacha-orb orb-5">📸</span>
<span className="gacha-orb orb-6">💎</span>
</div>

<div className="gacha-base">
<div className="gacha-door" />
<div className="gacha-lever">
<span className="lever-arm" />
<span className="lever-ball" />
</div>
</div>

{showCapsule && <div className="gacha-capsule-drop">🔴</div>}
</div>

<div className="gacha-message-card">
<p>
{gachaStep === 1 && '宝物を探し中…'}
{gachaStep === 2 && 'いい宝物を探してるよ〜！'}
{gachaStep === 3 && 'あっ！見つけたかも！'}
</p>
</div>

<button
className="gacha-button"
type="button"
disabled={!showCapsule}
onClick={() => setScreen('capsule')}
>
{showCapsule ? 'カプセルを受け取る' : '探しています…'}
</button>
</section>

) : screen === 'capsule' ? (
<section className="capsule-screen capsule-stage">
<h2>カプセルが出てきた！</h2>
<p>タップして中を見てみよう。</p>

<button
className="capsule-open-button"
type="button"
onClick={() => setScreen('result')}
>
<div className="big-capsule">
<div className="capsule-top" />
<div className="capsule-bottom" />
<div className="capsule-shine" />
</div>
<span>カプセルを開ける</span>
</button>
</section>

) : (
<section className="result-screen">
<p className="result-kicker">今日の宝物が見つかりました</p>
<h2>{destination.title}</h2>

<div className="result-card">
{choices.mood === 'デート' ? (
<>
<p className="result-label">❤️ 今日のデートコース</p>

<div className="spot-card-list">
<div className="spot-card">
<p className="spot-card-label">☕ 経由地</p>
<h3>{nearbySpot?.tags?.name || '経由地が見つかりませんでした'}</h3>
<p>まずはここへ向かいましょう。</p>
</div>

<div className="route-arrow">↓</div>

<div className="spot-card main-spot">
<p className="spot-card-label">💎 最終目的地</p>
<h3>{dateFinalSpot?.tags?.name || '目的地が見つかりませんでした'}</h3>
<p>今日の宝物が眠っている場所です。</p>
</div>
</div>

{dateCourse && (
<div className="mission-card">
<p className="result-label">🎯 今日のミッション</p>
{dateCourse.map((step, index) => (
<p key={step}>
{index + 1}. {step}
</p>
))}
</div>
)}

{courseStep === 1 && (
<button
className="gacha-button"
type="button"
onClick={() => {
openWaypointMap();
setCourseStep(2);
}}
>
🚶 経由地まで地図を開く
</button>
)}

{courseStep === 2 && (
<button
className="gacha-button"
type="button"
onClick={() => setCourseStep(3)}
>
☕ 経由地に到着した
</button>
)}

{courseStep === 3 && (
<>
<div className="arrival-card">
<p>☕ 経由地に到着しました！</p>
<p>次は最終目的地へ向かいましょう。</p>
</div>

<button
className="gacha-button"
type="button"
onClick={() => {
openFinalMap();
setCourseStep(4);
}}
>
💎 最終目的地まで地図を開く
</button>
</>
)}

{courseStep === 4 && (
<button
className="gacha-button"
type="button"
onClick={() => {
setExp((currentExp) => {
const beforeRank = getWalkRank(currentExp);
const nextExp = currentExp + 50;
const afterRank = getWalkRank(nextExp);

if (beforeRank !== afterRank) {
setLevelUpMessage(`✨ LEVEL UP!! ${afterRank} になりました！`);
}

return nextExp;
});

setAdventureCount((count) => {
const nextCount = count + 1;
const newAchievement = getNewAchievement(nextCount);

if (newAchievement) {
setAchievementMessage(`実績解除！ ${newAchievement}`);
}

return nextCount;
});

setCourseStep(5);
}}
>
🎉 ゴールした
</button>
)}

{courseStep === 5 && (
<div className="clear-card">
<h3>🎉 冒険達成！</h3>
<p>お疲れさまでした</p>

{levelUpMessage && (
<div className="level-up-box">
<p>{levelUpMessage}</p>
</div>
)}

{achievementMessage && (
<div className="achievement-popup">
<p>{achievementMessage}</p>
</div>
)}

<p>+50 EXP</p>
<p>現在のランク：{getWalkRank(exp)}</p>
</div>
)}
</>
) : (
<>
<div className="spot-card main-spot">
<p className="spot-card-label">💎 今日の目的地</p>
<h3>{displayPlace}</h3>
<p>{destination.description}</p>
</div>

<div className="mission-card">
<p className="result-label">🎯 今日のミッション</p>
<p>{destination.mission}</p>
</div>
</>
)}

<p>詳しい店舗名や場所は地図で確認してください。</p>

{spotDistance !== null && (
<div>
<p>現在地から 約{spotDistance.toFixed(1)}km</p>
<p>徒歩 約{Math.round((spotDistance / 4.8) * 60)}分</p>
</div>
)}

<p>
{trimmedName}さんの今日の条件は、
「{choices.distance}・{choices.mood}・{choices.budget}・
{choices.time}」。
</p>

<p>{destination.description}</p>
<p>ミッション：{destination.mission}</p>
</div>

<button
className="gacha-button"
type="button"
disabled={isSearching}
onClick={async () => {
setSearchExpandLevel((level) => level + 1);
await findNearbySpot();
}}
>
もう少し範囲を広げて探す
</button>

<button
className="gacha-button"
type="button"
onClick={() => {
setCourseStep(1);
setScreen('condition');
}}
>
もう一度ガチャを引く
</button>

<button className="gacha-button" type="button" onClick={openGoogleMap}>
{choices.mood === 'デート' ? '全体の地図を開く' : '地図を開く'}
</button>
</section>
)}
{hasStarted && (
<nav className="bottom-nav">
<button type="button" onClick={() => setScreen('home')}>
<span>🏠</span>
<small>ホーム</small>
</button>

<button type="button">
<span>📖</span>
<small>図鑑</small>
</button>

<button
type="button"
onClick={() => {
if (!currentLocation) {
alert('まずはたからんを押して、現在地を取得してね！');
setScreen('home');
return;
}

setSearchExpandLevel(0);
setCourseStep(1);
setScreen('condition');
}}
>
<span>📦</span>
<small>宝箱</small>
</button>

<button type="button">
<span>👤</span>
<small>マイページ</small>
</button>
</nav>
)}

</main>
);
}