import { divIcon } from 'leaflet';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import type { Treasure } from '../services/treasures';
import { getTreasureCategoryIcon, hasValidTreasureCoordinates } from '../features/treasureMap';

type Props = {
treasures: Treasure[];
selectedTreasure: Treasure | null;
onSelectTreasure: (treasure: Treasure) => void;
currentLocation: { latitude: number; longitude: number } | null;
};

export function TreasureMap({ treasures, selectedTreasure, onSelectTreasure, currentLocation }: Props) {
const visibleTreasures = treasures.filter(hasValidTreasureCoordinates);
const firstTreasure = visibleTreasures[0];
const center: [number, number] = currentLocation
? [currentLocation.latitude, currentLocation.longitude]
: firstTreasure ? [firstTreasure.latitude, firstTreasure.longitude] : [35.681236, 139.767125];

return (
<div className="treasure-map-layout">
<MapContainer center={center} zoom={14} scrollWheelZoom className="treasure-map">
<TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
{visibleTreasures.map((treasure, index) => {
const icon = getTreasureCategoryIcon(treasure.category);
const markerIcon = divIcon({
className: 'treasure-map-marker-shell',
html: `<span class="treasure-map-marker" aria-hidden="true">${icon}</span>`,
iconSize: [44, 44], iconAnchor: [22, 42],
});
return <Marker key={treasure.id ?? `${treasure.latitude}-${treasure.longitude}-${index}`}
position={[treasure.latitude, treasure.longitude]} icon={markerIcon}
eventHandlers={{ click: () => onSelectTreasure(treasure) }} title={treasure.name} />;
})}
</MapContainer>
{selectedTreasure && (
<article className={`treasure-map-detail ${selectedTreasure.image_url ? 'has-image' : ''}`} aria-live="polite">
{selectedTreasure.image_url && <img src={selectedTreasure.image_url} alt={selectedTreasure.name} />}
<div>
<p className="treasure-map-detail-category">{getTreasureCategoryIcon(selectedTreasure.category)} {selectedTreasure.category}</p>
<h3>{selectedTreasure.name}</h3>
<p>{selectedTreasure.comment || 'コメントはありません。'}</p>
</div>
</article>
)}
</div>
);
}
