import { divIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import type { Treasure } from '../services/treasures';
import { getNearbyTreasures, getTreasureCategoryMarker, TREASURE_MAP_RADIUS_KM } from '../features/treasureMap';
import { buildGoogleMapsDirectionsUrl } from '../features/googleMaps';

type Props = {
treasures: Treasure[];
selectedTreasure: Treasure | null;
onSelectTreasure: (treasure: Treasure) => void;
currentLocation: { latitude: number; longitude: number } | null;
};

export function TreasureMap({ treasures, selectedTreasure, onSelectTreasure, currentLocation }: Props) {
const visibleTreasures = currentLocation
? getNearbyTreasures(treasures, currentLocation)
: [];
const firstTreasure = visibleTreasures[0];
const center: [number, number] = currentLocation
? [currentLocation.latitude, currentLocation.longitude]
: firstTreasure ? [firstTreasure.latitude, firstTreasure.longitude] : [35.681236, 139.767125];

return (
<div className="treasure-map-layout">
<MapContainer center={center} zoom={14} scrollWheelZoom className="treasure-map">
<TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
{currentLocation && (
<Marker
position={[currentLocation.latitude, currentLocation.longitude]}
icon={divIcon({
className: 'treasure-current-location-shell',
html: '<span class="treasure-current-location-dot" aria-hidden="true"></span><span class="treasure-current-location-label">現在地</span>',
iconSize: [72, 42],
iconAnchor: [16, 16],
})}
title="現在地"
zIndexOffset={1000}
/>
)}
{visibleTreasures.map((treasure, index) => {
const marker = getTreasureCategoryMarker(treasure.category);
const markerIcon = divIcon({
className: 'treasure-map-marker-shell',
html: `<span class="treasure-map-marker treasure-map-marker--${marker.theme}" aria-hidden="true"><span>${marker.icon}</span></span>`,
iconSize: [42, 52],
iconAnchor: [21, 51],
popupAnchor: [0, -49],
});
return <Marker key={treasure.id ?? `${treasure.latitude}-${treasure.longitude}-${index}`}
position={[treasure.latitude, treasure.longitude]} icon={markerIcon}
eventHandlers={{ click: () => onSelectTreasure(treasure) }} title={treasure.name} />;
})}
</MapContainer>
{currentLocation && visibleTreasures.length === 0 && (
<p className="treasure-map-empty" role="status">
現在地から{TREASURE_MAP_RADIUS_KM}km以内に宝物はまだありません。
</p>
)}
{selectedTreasure && (
<article className={`treasure-map-detail ${selectedTreasure.image_url ? 'has-image' : ''}`} aria-live="polite">
{selectedTreasure.image_url && <img src={selectedTreasure.image_url} alt={selectedTreasure.name} />}
<div className="treasure-map-detail-content">
<p className="treasure-map-detail-category">{selectedTreasure.category}</p>
<h3 className="treasure-map-detail-name">{selectedTreasure.name}</h3>
<p className="treasure-map-detail-comment">{selectedTreasure.comment || 'コメントはありません。'}</p>
{currentLocation && (
<button
type="button"
className="treasure-map-directions-button"
onClick={() => window.open(
buildGoogleMapsDirectionsUrl(currentLocation, selectedTreasure),
'_blank'
)}
>
📍 ここへ行く
</button>
)}
</div>
</article>
)}
</div>
);
}
