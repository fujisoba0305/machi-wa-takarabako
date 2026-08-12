import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
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
import { getWalkingDistances } from './services/walkingDistance';
import { createTreasure } from './services/treasures';
import {
deleteTreasureImage,
uploadTreasureImage,
} from './services/treasureImages';

import takaranImage from './assets/takaran/takaran.png';
import titleBackground from './assets/title-background.png';
import takaranWelcome from "./assets/takaran/takaran-welcome.png";
import backgroundTown from './assets/gacha/background-town.png';
import gachaMachine from './assets/gacha/gacha-machine.png';
import gachaHandle from './assets/gacha/gacha-handle.png';
import capsuleEmpty from './assets/gacha/capsule-empty.png';
import treasureChest from './assets/gacha/treasure-chest.png';
import takaranSearch from './assets/takaran/takaran-search.png';


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

const capsuleIcons: Record<string, string> = {
自然: "🌳",
カフェ: "☕",
グルメ: "🍴",
デート: "💖",
写真: "📸",
夜景: "🌃",
映画: "🎬",
イベント: "🏢",
リラックス: "🍃",
"神社・お寺": "⛩️",
おまかせ: "🎁",
};

type Coordinates = {
latitude: number;
longitude: number;
};

type TreasureCategory =
| '☕ カフェ'
| '🍜 グルメ'
| '⛩️ 神社・お寺'
| '🌳 自然'
| '📷 写真スポット'
| '🏪 お店'
| '💎 その他';

type TreasureRegistration = {
name: string;
comment: string;
category: TreasureCategory;
latitude: number;
longitude: number;
image: File | null;
};

const treasureCategories: TreasureCategory[] = [
'☕ カフェ',
'🍜 グルメ',
'⛩️ 神社・お寺',
'🌳 自然',
'📷 写真スポット',
'🏪 お店',
'💎 その他',
];

function requestCurrentCoordinates(): Promise<Coordinates> {
return new Promise((resolve, reject) => {
if (!navigator.geolocation) {
reject(new Error('Geolocation is not supported'));
return;
}

navigator.geolocation.getCurrentPosition(
(position) => {
resolve({
latitude: position.coords.latitude,
longitude: position.coords.longitude,
});
},
reject,
{
enableHighAccuracy: true,
timeout: 10000,
maximumAge: 0,
}
);
});
}

const decorativeCapsuleIcons = ['☕', '🌳', '📷', '⛩️', '🍴', '🎵'];

export default function App() {
const [name, setName] = useState('');
const [hasStarted, setHasStarted] = useState(false);
const [takaranSpeech, setTakaranSpeech] = useState(
"😊 まずは僕を押してね！"
);
const [gachaStep, setGachaStep] = useState(0);
const [capsuleIcon, setCapsuleIcon] = useState("🎁");
const [showCapsule, setShowCapsule] = useState(false);
const [searchFailed, setSearchFailed] = useState(false);
const [isCapsuleOpening, setIsCapsuleOpening] = useState(false);
const [showTreasureBox, setShowTreasureBox] = useState(false);
const [screen, setScreen] = useState<
'home' | 'condition' | 'coin' | 'gacha' | 'searching' | 'result' | 'treasure-register'
>('home');
const startGacha = () => {
if (gachaStep !== 0) return;

setGachaStep(1);

window.setTimeout(() => {
setGachaStep(2);
}, 1100);

window.setTimeout(() => {
if (activeNormalSearchIdRef.current) {
console.info('[normal-search] searching_screen_transition', {
searchId: activeNormalSearchIdRef.current,
distance: choices.distance,
at: new Date().toISOString(),
});
}
setScreen('searching');
setGachaStep(0);
}, 2800);
};

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

const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);

const [nearbySpot, setNearbySpot] = useState<Spot | null>(null);
const [dateFinalSpot, setDateFinalSpot] = useState<Spot | null>(null);
const [spotDistance, setSpotDistance] = useState<number | null>(null);
const [searchExpandLevel, setSearchExpandLevel] = useState(0);
const [isSearching, setIsSearching] = useState(false);
const [courseStep, setCourseStep] = useState(1);
const [hasArrivedAtNormalSpot, setHasArrivedAtNormalSpot] = useState(false);
const [treasureName, setTreasureName] = useState('');
const [treasureComment, setTreasureComment] = useState('');
const [treasureCategory, setTreasureCategory] =
useState<TreasureCategory | ''>('');
const [treasureImage, setTreasureImage] = useState<File | null>(null);
const [treasureImagePreview, setTreasureImagePreview] = useState<string | null>(null);
const [registeredTreasure, setRegisteredTreasure] =
useState<TreasureRegistration | null>(null);
const [isTreasureSaving, setIsTreasureSaving] = useState(false);
const [treasureSaveError, setTreasureSaveError] = useState('');
const [treasureLocation, setTreasureLocation] = useState<Coordinates | null>(null);
const [isTreasureLocationLoading, setIsTreasureLocationLoading] = useState(false);
const [treasureLocationError, setTreasureLocationError] = useState('');
const normalArrivalRewardClaimedRef = useRef(false);
const normalSearchSequenceRef = useRef(0);
const activeNormalSearchIdRef = useRef<string | null>(null);
const treasureSaveInFlightRef = useRef(false);

useEffect(() => {
return () => {
if (treasureImagePreview) URL.revokeObjectURL(treasureImagePreview);
};
}, [treasureImagePreview]);

useEffect(() => {
if (screen !== 'searching') return;

const searchIsComplete =
choices.mood === 'デート'
? Boolean(nearbySpot && dateFinalSpot)
: Boolean(nearbySpot);

// 検索成功したら結果画面へ
if (searchIsComplete) {
const resultTimer = window.setTimeout(() => {
setScreen('result');
}, 1000);

return () => {
window.clearTimeout(resultTimer);
};
}

// 検索失敗が確定したら失敗画面で止める
if (searchFailed) return;

// まだ検索中なら何もしないで待つ
if (isSearching) return;

// 検索中でも成功でも失敗でもない場合だけ、
// 念のため5秒後に失敗扱い
const timeoutTimer = window.setTimeout(() => {
if (activeNormalSearchIdRef.current && choices.mood !== 'デート') {
console.warn('[normal-search] failed', {
searchId: activeNormalSearchIdRef.current,
reason: 'searching_screen_fallback_timeout',
});
}
setSearchFailed(true);
}, 5000);

return () => {
window.clearTimeout(timeoutTimer);
};
}, [
screen,
isSearching,
nearbySpot,
dateFinalSpot,
choices.mood,
searchFailed,
]);

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
(choices.mood !== 'グルメ' || Boolean(choices.foodGenre)) &&
(choices.mood !== 'デート' || Boolean(choices.dateGenre)) &&
(choices.mood !== 'イベント' || Boolean(choices.eventGenre));

function handleSubmit(event: FormEvent<HTMLFormElement>) {
event.preventDefault();

if (!trimmedName) return;

getCurrentLocation();

setHasStarted(true);
setScreen('home');
}

function selectChoice(key: ChoiceKey, option: string) {
setChoices((currentChoices) => ({
...currentChoices,
[key]: option,
}));
}

async function getCurrentLocation() {
if (!navigator.geolocation) {
setTakaranSpeech("😢 この端末では現在地が使えないみたい...");
alert('このブラウザでは現在地取得が使えません。');
return;
}

setTakaranSpeech("🔍 現在地を探してるよ...");

try {
const coordinates = await requestCurrentCoordinates();
setCurrentLocation(coordinates);
setTakaranSpeech("🎉 よし！冒険に行こう！");
} catch (error) {
console.error(error);
setTakaranSpeech("😢 現在地が見つからなかったよ...");
alert('現在地を取得できませんでした。ブラウザの位置情報許可を確認してください。');
}
}

function resetTreasureRegistration() {
setTreasureName('');
setTreasureComment('');
setTreasureCategory('');
setTreasureImage(null);
setTreasureImagePreview(null);
setRegisteredTreasure(null);
setIsTreasureSaving(false);
setTreasureSaveError('');
setTreasureLocation(null);
}

async function openTreasureRegistration() {
if (isTreasureLocationLoading) return;

setIsTreasureLocationLoading(true);
setTreasureLocationError('');

try {
const coordinates = await requestCurrentCoordinates();

resetTreasureRegistration();
setTreasureLocation(coordinates);
setScreen('treasure-register');
} catch (error) {
console.error(error);
setTreasureLocationError(
'現在地を取得できませんでした。位置情報の許可を確認して、もう一度お試しください。'
);
} finally {
setIsTreasureLocationLoading(false);
}
}

function closeTreasureRegistration() {
resetTreasureRegistration();
setScreen('home');
}

function handleTreasureImageChange(event: ChangeEvent<HTMLInputElement>) {
const file = event.target.files?.[0] ?? null;

setTreasureImage(file);
setTreasureImagePreview(file ? URL.createObjectURL(file) : null);
}

async function handleTreasureRegistration(event: FormEvent<HTMLFormElement>) {
event.preventDefault();

if (
treasureSaveInFlightRef.current ||
!treasureLocation ||
!treasureName.trim() ||
!treasureCategory
) {
return;
}

const registration: TreasureRegistration = {
name: treasureName.trim(),
comment: treasureComment.trim(),
category: treasureCategory,
latitude: treasureLocation.latitude,
longitude: treasureLocation.longitude,
image: treasureImage,
};

treasureSaveInFlightRef.current = true;
setIsTreasureSaving(true);
setTreasureSaveError('');

try {
const uploadedImage = registration.image
? await uploadTreasureImage(registration.image)
: null;

try {
await createTreasure({
name: registration.name,
comment: registration.comment,
category: registration.category,
latitude: registration.latitude,
longitude: registration.longitude,
image_url: uploadedImage?.publicUrl ?? null,
});
} catch (error) {
if (uploadedImage) {
try {
await deleteTreasureImage(uploadedImage.path);
} catch (deleteError) {
console.error(
'[treasure-registration] Uploaded image cleanup failed',
deleteError
);
}
}

throw error;
}

setRegisteredTreasure(registration);
} catch {
console.error('[treasure-registration] Treasure save failed');
setTreasureSaveError(
'宝物を保存できませんでした。入力内容を確認して、もう一度お試しください。'
);
} finally {
treasureSaveInFlightRef.current = false;
setIsTreasureSaving(false);
}
}

useEffect(() => {
if (screen !== 'gacha') return;

let isCancelled = false;

async function runGacha() {
setShowCapsule(false);
setIsSearching(true);
setSearchFailed(false);

await findNearbySpot();

if (isCancelled) return;

const waitTime = choices.mood === 'デート' ? 2200 : 1200;

setTimeout(() => {
if (!isCancelled) {
setShowCapsule(true);
setIsSearching(false);
}
}, waitTime);
}

runGacha();

return () => {
isCancelled = true;
};
}, [screen]);

function getRadius() {
if (choices.distance === '1km') return 1000;
if (choices.distance === '3km') return 3000;
if (choices.distance === '5km') return 5000;
if (choices.distance === '10km') return 10000;
return 3000;
}

function getSpotsInRange(spots: Spot[], expandLevel: number) {
if (!currentLocation) return [];

const range = getDistanceRange(expandLevel);

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
return spots.filter((spot) => {
const name = spot.tags?.name;
const lat = spot.lat ?? spot.center?.lat;
const lon = spot.lon ?? spot.center?.lon;

return Boolean(name && lat && lon);
});
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
function getDistanceRange(expandLevel: number) {
const walkingRange = getWalkingDistanceRange(expandLevel);

return { min: 0, max: walkingRange.max };
}

function getWalkingDistanceRange(expandLevel: number) {
if (choices.distance === '1km') {
return { min: 0, max: 2 + expandLevel };
}

if (choices.distance === '3km') {
return { min: 2, max: 4 + expandLevel };
}

if (choices.distance === '5km') {
return { min: 4, max: 6 + expandLevel };
}

if (choices.distance === '10km') {
return { min: 9, max: 11 + expandLevel };
}

return { min: 0, max: 999 };
}

function getNormalSearchRadius(expandLevel: number) {
if (choices.distance === '？km') {
return getRadius() + expandLevel * 1000;
}

return getWalkingDistanceRange(expandLevel).max * 1000;
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

async function getSpotsByMood(expandLevel: number) {
if (!currentLocation) return [];

const latitude = currentLocation.latitude;
const longitude = currentLocation.longitude;
const radius = getNormalSearchRadius(expandLevel);

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
if (choices.dateGenre === '食べ歩き') {
const foodWalkSpots = await getNearbyFoodWalkSpots(
latitude,
longitude,
searchRadius
);

const namedFoodWalkSpots = getNamedSpots(foodWalkSpots);

if (namedFoodWalkSpots.length >= 2) {
const shuffledSpots = [...namedFoodWalkSpots].sort(() => Math.random() - 0.5);

const waypoint = shuffledSpots[0];
const finalSpot = shuffledSpots[1];

const waypointLocation = getSpotLocation(waypoint);
const finalLocation = getSpotLocation(finalSpot);

if (waypointLocation && finalLocation) {
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

setNearbySpot(waypoint);
setDateFinalSpot(finalSpot);
setSpotDistance(distanceToWaypoint + distanceWaypointToFinal);

setShowCapsule(true);
return;
}
}

setNearbySpot(null);
setDateFinalSpot(null);
setSpotDistance(null);
return;
}

let finalSpots: Spot[] = [];

if (choices.dateGenre === 'まったり') {
// 経由地検索で取得済みの候補をそのまま使う
// 同じAPIを2回呼ばない
finalSpots = [...waypointSpots];

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

setShowCapsule(true);

} else {
setNearbySpot(null);
setDateFinalSpot(null);
setSpotDistance(null);

setSearchFailed(true);
}
}

async function findNearbySpot(normalSearchExpandLevel = searchExpandLevel) {
const searchId =
choices.mood === 'デート'
? null
: `${Date.now().toString(36)}-${++normalSearchSequenceRef.current}`;

if (searchId) {
activeNormalSearchIdRef.current = searchId;
console.info('[normal-search] started', {
searchId,
distance: choices.distance,
expandLevel: normalSearchExpandLevel,
overpassRadiusMeters: getNormalSearchRadius(normalSearchExpandLevel),
haversineMaxMeters:
getDistanceRange(normalSearchExpandLevel).max * 1000,
at: new Date().toISOString(),
});
}

if (!currentLocation) {
if (searchId) {
console.warn('[normal-search] failed', {
searchId,
reason: 'current_location_missing',
});
}
alert('先に現在地を取得してください。');
setNearbySpot(null);
setDateFinalSpot(null);
setSpotDistance(null);
setSearchFailed(true);
setIsSearching(false);
return;
}

setIsSearching(true);
setSearchFailed(false);
normalArrivalRewardClaimedRef.current = false;
setHasArrivedAtNormalSpot(false);

try {
setNearbySpot(null);
setDateFinalSpot(null);
setSpotDistance(null);

if (choices.mood === 'デート') {
await findDateCourse();
return;
}

const spots = await getSpotsByMood(normalSearchExpandLevel);

const validSpots = getNamedSpots(spots);
const namedSpots = getSpotsInRange(spots, normalSearchExpandLevel);

console.log('取得したspots数:', spots.length);
console.log('名前ありspots数:', namedSpots.length);
console.log('namedSpots:', namedSpots);
if (searchId) {
console.info('[normal-search] overpass_complete', {
searchId,
overpassCount: spots.length,
validNameAndCoordinatesCount: validSpots.length,
haversineEligibleCount: namedSpots.length,
});
}

if (namedSpots.length === 0) {
if (searchId) {
console.warn('[normal-search] failed', {
searchId,
reason: 'no_haversine_candidates',
});
}
setNearbySpot(null);
setSelectedSpot(null);
setSpotDistance(null);

setSearchFailed(true);
return;
}

if (choices.distance === '？km') {
const spot = randomItem(namedSpots);
setSelectedSpot(spot);
setShowCapsule(true);
return;
}

const targetDistanceKm = getRadius() / 1000;
const closestCandidates = [...namedSpots]
.sort((spotA, spotB) => {
const locationA = getSpotLocation(spotA);
const locationB = getSpotLocation(spotB);

if (!locationA || !locationB) return 0;

const distanceA = calculateDistance(
currentLocation.latitude,
currentLocation.longitude,
locationA.lat,
locationA.lon
);
const distanceB = calculateDistance(
currentLocation.latitude,
currentLocation.longitude,
locationB.lat,
locationB.lon
);

return (
Math.abs(distanceA - targetDistanceKm) -
Math.abs(distanceB - targetDistanceKm)
);
})
.slice(0, 16);

const walkingDistanceRange = getWalkingDistanceRange(
normalSearchExpandLevel
);
const minWalkingDistanceMeters = walkingDistanceRange.min * 1000;
const maxWalkingDistanceMeters = walkingDistanceRange.max * 1000;
let eligibleCandidates: { spot: Spot; distanceMeters: number }[] = [];
let secondBatchExecuted = false;

for (let batchStart = 0; batchStart < closestCandidates.length; batchStart += 8) {
const batchNumber = batchStart / 8 + 1;
const batchCandidates = closestCandidates.slice(batchStart, batchStart + 8);
if (batchNumber === 2) secondBatchExecuted = true;

if (searchId) {
console.info('[normal-search] walking_batch_sent', {
searchId,
batchNumber,
candidateCount: batchCandidates.length,
});
}
const walkingDestinations = batchCandidates.map((spot, index) => {
const location = getSpotLocation(spot)!;

return {
id: String(index),
latitude: location.lat,
longitude: location.lon,
};
});

const walkingResults = await getWalkingDistances(
currentLocation,
walkingDestinations,
searchId ? { searchId, batchNumber } : undefined
);
const walkingStatusCounts = walkingResults.reduce(
(counts, result) => {
counts[result.status] += 1;
return counts;
},
{ OK: 0, NO_ROUTE: 0, ERROR: 0 }
);
const walkingDistanceById = new Map(
walkingResults
.filter(
(result) =>
result.status === 'OK' &&
typeof result.distanceMeters === 'number' &&
Number.isFinite(result.distanceMeters)
)
.map((result) => [result.id, result.distanceMeters as number])
);

eligibleCandidates = batchCandidates.flatMap((spot, index) => {
const distanceMeters = walkingDistanceById.get(String(index));

if (
typeof distanceMeters !== 'number' ||
distanceMeters < minWalkingDistanceMeters ||
distanceMeters > maxWalkingDistanceMeters
) {
return [];
}

return [{ spot, distanceMeters }];
});

if (searchId) {
console.info('[normal-search] walking_batch_complete', {
searchId,
batchNumber,
responseCount: walkingResults.length,
...walkingStatusCounts,
withinLimitCount: eligibleCandidates.length,
minWalkingDistanceMeters,
maxWalkingDistanceMeters,
});
}

if (eligibleCandidates.length > 0) break;
}

if (searchId) {
console.info('[normal-search] second_batch', {
searchId,
executed: secondBatchExecuted,
});
}

if (eligibleCandidates.length === 0) {
if (searchId) {
console.warn('[normal-search] failed', {
searchId,
reason: 'no_walking_candidates_within_limit',
});
}
setNearbySpot(null);
setSpotDistance(null);
setSearchFailed(true);
return;
}

const selectedCandidate = randomItem(eligibleCandidates);
if (searchId) {
console.info('[normal-search] succeeded', {
searchId,
distanceMeters: selectedCandidate.distanceMeters,
});
}
setNearbySpot(selectedCandidate.spot);
setSpotDistance(selectedCandidate.distanceMeters / 1000);
setShowCapsule(true);

} catch (error) {
console.error(error);
if (searchId) {
console.error('[normal-search] failed', {
searchId,
reason: 'search_or_walking_api_error',
error: error instanceof Error ? error.message : 'Unknown error',
});
}
setNearbySpot(null);
setDateFinalSpot(null);
setSpotDistance(null);
setSearchFailed(true);
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
const displayPlace =
choices.mood === 'デート'
? dateFinalSpot?.tags?.name || nearbySpot?.tags?.name || 'デートコースを探しています'
: nearbySpot?.tags?.name || '宝物を探しています';
function openMapForSpot(spot: Spot | null, fallbackQuery: string) {
const location = spot ? getSpotLocation(spot) : null;

if (location && currentLocation) {
const params = new URLSearchParams({
api: '1',
origin: `${currentLocation.latitude},${currentLocation.longitude}`,
destination: `${location.lat},${location.lon}`,
travelmode: 'walking',
});

window.open(
`https://www.google.com/maps/dir/?${params.toString()}`,
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
<main className={`app-shell ${!hasStarted ? 'title-mode' : ''}`}>

{!hasStarted ? (
<div
className="title-screen full-screen"
style={{
backgroundImage: `url(${titleBackground})`,
backgroundSize: 'cover',
backgroundPosition: 'center',
backgroundRepeat: 'no-repeat',
}}
>
<section className="intro" aria-labelledby="app-title">
<p className="eyebrow">
🌿 お散歩が、もっとワクワクする。
</p>

<div className="title-main-row">
<img
src={takaranImage}
alt="たからん"
className="title-main-takaran"
/>

<h1 id="app-title" className="title-main-text">
<span>街は</span>
<span>宝箱</span>
</h1>
</div>

<p className="subtitle">
お散歩がもっと楽しくなる宝探しアプリ
</p>

<div className="title-divider" />

<p className="description">
街には、まだ見ぬ宝物が眠っている。<br />
今日だけの景色、出会い、思い出を<br />
探しに行こう。
</p>
</section>

<form className="name-form" onSubmit={handleSubmit}>
<label htmlFor="player-name" className="name-label">
君の名前を教えてね😊
</label>
<div className="name-input-wrap">
<span className="name-input-icon">🌿</span>

<input
id="player-name"
name="player-name"
type="text"
value={name}
onChange={(event) => setName(event.target.value)}
placeholder="たから"
autoComplete="name"
/>
</div>
<button
type="submit"
className="start-location-button"
disabled={!trimmedName}
>
<Compass size={24} />
現在地を取得して始める
<span className="button-sparkles">✨</span>
</button>

</form>
</div>
) : screen === 'home' ? (
<section className="home-screen">
<div className="home-header">
<p className="home-welcome">
🌿 {trimmedName}さん、おかえり！
</p>

<h2 className="home-message">
今日だけの宝物を見つけに行こう！
</h2>

<div className="takaran-home-card">
<img src={takaranImage} alt="たからん" className="takaran-home-image" />

<div className="takaran-home-speech">
<p>こんにちは！</p>
<p>今日も一緒に宝物を探しに行こう！</p>
</div>
</div>
</div>

<div
className="treasure-box-card takaran-tap-card"
onClick={getCurrentLocation}
>
<button
type="button"
className="takaran-character-button"
onClick={(event) => {
const button = event.currentTarget;

button.classList.remove('is-bouncing');

requestAnimationFrame(() => {
button.classList.add('is-bouncing');
});
}}
>
<img
src={takaranWelcome}
alt="たからん"
className="takaran-main-image"
/>
</button>

<div className="takaran-level-badge">
🌟 Lv.{takaran.level}
</div>

<h2 className="takaran-name">
たからん
</h2>

<div className="takaran-speech-bubble">
<span className="speech-sparkle">✨</span>

<p>
{takaranSpeech}
</p>
</div>

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
onClick={() => {
if (!currentLocation) {
getCurrentLocation();
return;
}

setSearchExpandLevel(0);
setCourseStep(1);
setScreen('condition');
}}
>
{currentLocation ? '✨ 宝物を探しに行く' : '📍 たからんを押して現在地を取得'}
</button>
<p className="adventure-ready">
{currentLocation
? '🧭 冒険の準備完了！'
: '📍 たからんを押して現在地を取得しよう！'}
</p>

{takaranNextInfo.remainingExp > 0 ? (
<div className="takaran-evolution-card">
<p className="takaran-next-title">
⭐ 次の進化まであと
</p>

<strong className="takaran-next-exp">
{takaranNextInfo.remainingExp} EXP
</strong>

<div className="takaran-exp-bar">
<div
className="takaran-exp-bar-fill"
style={{
width: `${Math.min(
((100 - takaranNextInfo.remainingExp) / 100) * 100,
100
)}%`,
}}
/>
</div>

<p className="takaran-exp-label">
{Math.max(100 - takaranNextInfo.remainingExp, 0)} / 100 EXP
</p>
</div>
) : (
<div className="takaran-evolution-card">
<p className="takaran-next-title">
🎉 たからんは最高レベルです！
</p>
</div>
)}

<div className="walk-rank-card">
<p className="walk-rank-kicker">
🏅 お散歩ランク
</p>

<strong className="walk-rank-name">
{walkRankInfo.rank}
</strong>

<div className="walk-rank-exp-row">
<span>
{walkRankInfo.current} / {walkRankInfo.next} EXP
</span>

<span>
{Math.min(Math.round(walkRankInfo.progress), 100)}%
</span>
</div>

<div className="exp-bar">
<div
className="exp-bar-fill"
style={{
width: `${Math.min(walkRankInfo.progress, 100)}%`,
}}
/>
</div>

<p className="walk-rank-next">
次のランク：🌱 {walkRankInfo.nextRank}
</p>
</div>
</div>

<button
className="treasure-discovery-button"
type="button"
onClick={openTreasureRegistration}
disabled={isTreasureLocationLoading}
>
<span aria-hidden="true">💎</span>
<span>
<strong>
{isTreasureLocationLoading ? '今いる場所を確認中…' : '宝物を発見！'}
</strong>
<small>
押した場所を新しく取得して記録する
</small>
</span>
</button>
</section>

) : screen === 'treasure-register' ? (
<section className="treasure-register-screen" aria-live="polite">
<div className="treasure-register-header">
<p className="treasure-register-kicker">💎 街の宝物メモ</p>
<h2>ここを宝物として残そう！</h2>
<p>写真とひとことだけで、すぐに記録できます。</p>
</div>

{registeredTreasure ? (
<div className="treasure-registration-complete">
<div className="treasure-registration-icon" aria-hidden="true">✨💎✨</div>
<h3>宝物を登録しました！</h3>
<p className="treasure-registration-note">
宝物の情報を保存しました。
</p>

{treasureImagePreview && (
<img
src={treasureImagePreview}
alt="選択した宝物"
className="treasure-photo-preview"
/>
)}

<dl className="treasure-confirmation-list">
<div>
<dt>名前</dt>
<dd>{registeredTreasure.name}</dd>
</div>
<div>
<dt>カテゴリ</dt>
<dd>{registeredTreasure.category}</dd>
</div>
<div>
<dt>ひとこと</dt>
<dd>{registeredTreasure.comment || '（なし）'}</dd>
</div>
<div>
<dt>現在地</dt>
<dd>
緯度 {registeredTreasure.latitude.toFixed(6)} / 経度{' '}
{registeredTreasure.longitude.toFixed(6)}
</dd>
</div>
<div>
<dt>写真</dt>
<dd>{registeredTreasure.image?.name || '（なし）'}</dd>
</div>
</dl>

<button
className="gacha-button treasure-register-primary"
type="button"
onClick={closeTreasureRegistration}
>
ホームへ戻る
</button>
</div>
) : (
<form className="treasure-register-form" onSubmit={handleTreasureRegistration}>
<div className="treasure-location-card">
<span aria-hidden="true">📍</span>
<div>
<strong>この場所の現在地</strong>
{treasureLocation ? (
<p>
緯度 {treasureLocation.latitude.toFixed(6)}<br />
経度 {treasureLocation.longitude.toFixed(6)}
</p>
) : (
<p>現在地を取得できていません。</p>
)}
</div>
</div>

<label className="treasure-form-field">
<span>写真</span>
<input
type="file"
accept="image/*"
onChange={handleTreasureImageChange}
/>
</label>

{treasureImagePreview ? (
<img
src={treasureImagePreview}
alt="選択した宝物のプレビュー"
className="treasure-photo-preview"
/>
) : treasureImage ? (
<p className="treasure-file-name">選択済み：{treasureImage.name}</p>
) : null}

<label className="treasure-form-field">
<span>宝物の名前</span>
<input
type="text"
value={treasureName}
onChange={(event) => setTreasureName(event.target.value)}
placeholder="例：路地裏の小さな喫茶店"
maxLength={60}
required
/>
</label>

<label className="treasure-form-field">
<span>一言コメント</span>
<textarea
value={treasureComment}
onChange={(event) => setTreasureComment(event.target.value)}
placeholder="どんなところが気になった？"
maxLength={160}
rows={3}
/>
</label>

<label className="treasure-form-field">
<span>カテゴリ</span>
<select
value={treasureCategory}
onChange={(event) =>
setTreasureCategory(event.target.value as TreasureCategory | '')
}
required
>
<option value="">選んでください</option>
{treasureCategories.map((category) => (
<option key={category} value={category}>
{category}
</option>
))}
</select>
</label>

{treasureSaveError && (
<p className="treasure-save-error" role="alert">
{treasureSaveError}
</p>
)}

<div className="treasure-register-actions">
<button
className="treasure-cancel-button"
type="button"
onClick={closeTreasureRegistration}
disabled={isTreasureSaving}
>
キャンセル
</button>
<button
className="gacha-button treasure-register-primary"
type="submit"
disabled={
isTreasureSaving ||
!treasureLocation ||
!treasureName.trim() ||
!treasureCategory
}
>
{isTreasureSaving ? '💎 宝物を保存しています…' : '💎 登録する'}
</button>
</div>
</form>
)}
</section>

) : screen === 'condition' ? (
<section className="condition-screen" aria-live="polite">
<div className="condition-hero">
<div>
<p className="condition-board">🌿 冒険の準備</p>

<p className="condition-welcome">
{trimmedName}さん、
</p>

<h2>
    今日は
    <br />
    どんな冒険にする？
    </h2>

<p className="condition-description">
距離と気分を選ぶと、冒険コインが作られるよ✨
</p>
</div>

<img
src={takaranWelcome}
alt="たからん"
className="condition-takaran"
/>
</div>

<div className="choice-panel adventure-choice-panel">
{choiceGroups
.filter(
(group) =>
group.key !== 'budget' &&
group.key !== 'time' &&
(group.key !== 'foodGenre' || choices.mood === 'グルメ') &&
(group.key !== 'dateGenre' || choices.mood === 'デート') &&
(group.key !== 'eventGenre' || choices.mood === 'イベント') &&
(group.key !== 'shrineGenre' || choices.mood === '神社・お寺')
)
.map((group) => (
<fieldset
className="choice-group adventure-choice-card"
key={group.key}
>
<legend>
{group.key === 'distance'
? '🥾 距離を選ぼう'
: group.key === 'mood'
? '😊 気分を選ぼう'
: group.label}
</legend>

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
<span className="choice-icon">
{getOptionIcon(option)}
</span>

<span>{option}</span>
</button>
))}
</div>
</fieldset>
))}
</div>

<div className="selected-condition-card">
<p className="result-label">
🪙 今日の冒険コイン
</p>

<div className="coin-grid">
<div className="coin-item">
<span className="coin-title">距離</span>

<strong>
{getOptionIcon(choices.distance)}
{' '}
{choices.distance || '未選択'}
</strong>
</div>

<div className="coin-item">
<span className="coin-title">気分</span>

<strong>
{getOptionIcon(choices.mood)}
{' '}
{choices.mood || '未選択'}
</strong>
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
className="gacha-button adventure-coin-button"
type="button"
disabled={!canProceedToGacha}
onClick={() => {
setSearchExpandLevel(0);
setCourseStep(1);
setScreen('coin');
}}
>
<span className="adventure-coin-icon">🪙</span>

<span>
<strong>冒険コインを作る</strong>
<small>選んだ条件で宝物を探しに行こう！</small>
</span>

<span className="coin-button-sparkle">
✨
</span>
</button>
</section>

) : screen === 'coin' ? (
<section className="coin-screen">
<div className="coin-header">
<img
src={takaranWelcome}
alt="たからん"
className="coin-takaran"
/>

<p className="coin-ready">
🪙 冒険コイン完成！
</p>

<h2>できたよ！</h2>

<p className="coin-subtitle">
今日だけの冒険コインだよ✨
</p>
</div>

<div className="adventure-coin">
<span className="coin-label">🪙 今日の冒険コイン</span>

<div className="coin-detail">
<span>🥾 距離</span>
<strong>{choices.distance}</strong>
</div>

<div className="coin-detail">
<span>😊 気分</span>
<strong>
{getOptionIcon(choices.mood)} {choices.mood}
</strong>
</div>

<p className="coin-message">
このコインが、今日の宝物へ導いてくれるよ✨
</p>
</div>

<button
className="gacha-button adventure-start-button"
type="button"
onClick={() => {
setSearchFailed(false);
setNearbySpot(null);
setDateFinalSpot(null);
setSelectedSpot(null);
setSpotDistance(null);
setShowCapsule(false);
setGachaStep(0);
setIsCapsuleOpening(false);
setShowTreasureBox(false);

setCapsuleIcon(
capsuleIcons[choices.mood] ?? '🎁'
);

setScreen('gacha');

}}
>
🎰 ガチャスタート！
</button>
</section>

) : screen === 'gacha' ? (
<section className="gacha-screen treasure-gacha-stage">
<img
src={backgroundTown}
className="gacha-background"
alt=""
/>

<h1 className="gacha-main-title">✨　街の宝ガチャ　✨</h1>

<p className="gacha-sub">
たからんが宝物を見つけたよ✨
ハンドルを回して取り出そう！
</p>

<div
className={`treasure-gacha-machine ${
gachaStep >= 2 ? 'gacha-found' : ''
}`}
>
<img
src={gachaMachine}
className="gacha-machine-image"
alt="街の宝ガチャ"
/>

<button
type="button"
className={`gacha-handle-button ${
gachaStep >= 1 ? 'is-turning' : ''
}`}
onClick={startGacha}
disabled={gachaStep !== 0}
aria-label="ガチャのハンドルを回す"
>
<img
src={gachaHandle}
className="gacha-handle-image"
alt=""
/>
</button>

{gachaStep < 2 && (
<div
className={`gacha-capsule-cluster ${gachaStep === 1 ? 'is-mixing' : ''}`}
aria-hidden="true"
>
{decorativeCapsuleIcons.map((icon) => (
<div className="decorative-capsule" key={icon}>
<img
src={capsuleEmpty}
alt=""
className="capsule-shell"
/>

<div className="capsule-inner-icon">
{icon}
</div>
</div>
))}
</div>
)}


{gachaStep === 2 && (
<>
<div className="capsule-wrap popping-capsule-wrap">
<img
src={capsuleEmpty}
alt="選ばれたカプセル"
className="capsule-shell"
/>

<div className="capsule-inner-icon">
{capsuleIcon}
</div>
</div>
</>
)}

</div>
</section>
) : screen === 'searching' ? (

<section className="searching-screen">

<img
src={takaranSearch}
alt="たからん"
className="searching-takaran"
/>

{searchFailed ? (
<div className="search-failed-card" role="alert">
<h2 className="searching-title">
スポットが見つかりませんでした
</h2>

<p className="searching-message">
条件を変えるか、少し時間をおいてもう一度探してみてね。
</p>

<button
type="button"
className="gacha-button search-failed-button"
onClick={() => {
setSearchFailed(false);
setIsSearching(false);
setScreen('condition');
}}
>
条件を変えて戻る
</button>
</div>
) : (
<>
<h2 className="searching-title">
街の宝物を探しています…
</h2>

<p className="searching-message">
今日はどんな宝物があるかな？
</p>

<div className="searching-loader">
<span></span>
<span></span>
<span></span>
</div>
</>
)}

</section>

) : screen === 'result' ? (
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
{choices.mood === 'デート' || choices.distance === '？km' ? (
<>
<p>現在地から直線距離 約{spotDistance.toFixed(1)}km</p>
<p>実際の徒歩距離・時間は地図で確認してください。</p>
</>
) : (
<p>徒歩ルート 約{spotDistance.toFixed(1)}km</p>
)}
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
if (choices.mood === 'デート') {
setSearchExpandLevel((level) => level + 1);
await findNearbySpot();
return;
}

const nextExpandLevel = searchExpandLevel + 1;
setSearchExpandLevel(nextExpandLevel);
await findNearbySpot(nextExpandLevel);
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
{choices.mood !== 'デート' && (
<button
className="gacha-button"
type="button"
disabled={hasArrivedAtNormalSpot}
onClick={() => {
if (normalArrivalRewardClaimedRef.current) return;

normalArrivalRewardClaimedRef.current = true;
setHasArrivedAtNormalSpot(true);

setExp((currentExp) => {
const beforeRank = getWalkRank(currentExp);
const nextExp = currentExp + 20;
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
setAchievementMessage(`🏆 実績解除！ ${newAchievement}`);
}

return nextCount;
});

alert("🎉 到着おめでとう！\n+20 EXP 獲得しました！");
}}
>
{hasArrivedAtNormalSpot ? '✅ 到着済み（EXP獲得済み）' : '🎉 到着した！'}
</button>
)}
</section>
) :null}

{hasStarted &&
screen === 'result' &&
!isTreasureLocationLoading &&
!treasureLocationError && (
<button
className="treasure-floating-button"
type="button"
onClick={openTreasureRegistration}
aria-label="今いる場所で宝物を発見する"
title="宝物を発見"
>
<span aria-hidden="true">💎</span>
<small>＋</small>
</button>
)}

{isTreasureLocationLoading && (
<div className="treasure-location-status" role="status" aria-live="polite">
📍 今いる場所を確認しています…
</div>
)}

{treasureLocationError && !isTreasureLocationLoading && (
<div className="treasure-location-error" role="alert">
<span>{treasureLocationError}</span>
<button
type="button"
onClick={() => setTreasureLocationError('')}
aria-label="メッセージを閉じる"
>
×
</button>
</div>
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
