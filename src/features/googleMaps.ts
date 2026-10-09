type MapCoordinates = {
latitude: number;
longitude: number;
};

export function buildGoogleMapsDirectionsUrl(
origin: MapCoordinates,
destination: MapCoordinates,
waypoint?: MapCoordinates
) {
const params = new URLSearchParams({
api: '1',
origin: `${origin.latitude},${origin.longitude}`,
destination: `${destination.latitude},${destination.longitude}`,
travelmode: 'walking',
});

if (waypoint) {
params.set('waypoints', `${waypoint.latitude},${waypoint.longitude}`);
}

return `https://www.google.com/maps/dir/?${params.toString()}`;
}

// Keep navigation separate from adventure creation; resume must never reset a session.
export function navigateAdventureMap(origin: MapCoordinates, destination: MapCoordinates) {
  window.location.assign(buildGoogleMapsDirectionsUrl(origin, destination));
}
