import { Coordinates } from '../types';

// We just need the types here, implementation runs in browser context
export const getDirections = async (
    origin: string,
    destination: string,
    mode: google.maps.TravelMode = google.maps.TravelMode.WALKING
): Promise<google.maps.DirectionsResult> => {
    const directionsService = new google.maps.DirectionsService();

    return new Promise((resolve, reject) => {
        directionsService.route(
            {
                origin,
                destination,
                travelMode: mode,
                provideRouteAlternatives: true, // We want multiple routes to calculate shade for
            },
            (result, status) => {
                if (status === google.maps.DirectionsStatus.OK && result) {
                    resolve(result);
                } else {
                    reject(new Error(`Directions request failed: ${status}`));
                }
            }
        );
    });
};

export const getPlaceDetails = async (placeId: string): Promise<google.maps.places.PlaceResult> => {
    const service = new google.maps.places.PlacesService(document.createElement('div'));
    return new Promise((resolve, reject) => {
        service.getDetails({ placeId }, (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                resolve(place);
            } else {
                reject(status);
            }
        });
    });
}
