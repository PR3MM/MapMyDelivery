import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import axios from "axios";
import "../index.css";
import 'leaflet/dist/leaflet.css';

const MapComponent = () => {
    const mapRef = useRef(null);
    const [map, setMap] = useState(null);
    const [deliveryPeople, setDeliveryPeople] = useState([]);
    const [restaurant, setRestaurant] = useState(null);
    const [destinations, setDestinations] = useState([]);
    const [currentMarkerType, setCurrentMarkerType] = useState('deliveryPerson');
    const [routes, setRoutes] = useState([]);
    const [assignments, setAssignments] = useState([]);
    const animationRef = useRef([]);
    const [distanceMatrix, setDistanceMatrix] = useState([]);

    const routeColors = [
        '#FF5733', '#33FF57', '#3357FF', '#FF33F1', '#33FFF1', '#F1FF33',
        '#FF8C33', '#33FF8C', '#338CFF', '#8C33FF', '#33FFFF', '#FFFF33'
    ];

    useEffect(() => {
        const mapInstance = L.map(mapRef.current).setView([18.5204, 73.8567], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
        setMap(mapInstance);

        return () => {
            mapInstance.remove();
            animationRef.current.forEach(animation => cancelAnimationFrame(animation));
        };
    }, []);

    const addLocation = (e) => {
        const { lat, lng } = e.latlng;
        
        if (currentMarkerType === 'deliveryPerson') {
            const newDeliveryPerson = { id: deliveryPeople.length + 1, location: { lat, lng } };
            setDeliveryPeople((prev) => [...prev, newDeliveryPerson]);

            L.marker([lat, lng], {
                icon: L.icon({
                    iconUrl: 'https://cdn-icons-png.freepik.com/256/6951/6951721.png?ga=GA1.1.1187748767.1708226618&semt=ais_hybrid',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                }),
            }).addTo(map).bindPopup(`Delivery Person ${newDeliveryPerson.id}`);
        } else if (currentMarkerType === 'restaurant') {
            if (!restaurant) {
                setRestaurant({ location: { lat, lng } });
                L.marker([lat, lng], {
                    icon: L.icon({
                        iconUrl: 'https://cdn-icons-png.freepik.com/256/6643/6643359.png?ga=GA1.1.1187748767.1708226618&semt=ais_hybrid',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                    }),
                }).addTo(map).bindPopup('Restaurant');
            } else {
                alert('Only one restaurant allowed!');
            }
        } else if (currentMarkerType === 'destination') {
            const newDestination = { id: destinations.length + 1, location: { lat, lng } };
            setDestinations((prev) => [...prev, newDestination]);
            L.marker([lat, lng], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                }),
            }).addTo(map).bindPopup(`Destination ${newDestination.id}`);
        }
    };

    const startAddingMarkers = () => {
        map.off('click');
        map.on('click', addLocation);
    };

    const calculateRoutes = async () => {
        const newRoutes = [];
        const graphhopperKey = '0594e127-63d0-4fc8-8413-33cdb50f3d34';
        let colorIndex = 0;
        const distanceMatrixTemp = Array.from(Array(deliveryPeople.length + 1), () => Array(destinations.length + 1).fill(Infinity));
    
        for (const person of deliveryPeople) {
            for (const dest of destinations) {
                const waypoints = [
                    `${person.location.lat},${person.location.lng}`,
                    `${restaurant.location.lat},${restaurant.location.lng}`,
                    `${dest.location.lat},${dest.location.lng}`
                ];
    
                try {
                    const response = await axios.get(
                        `https://graphhopper.com/api/1/route?point=${waypoints.join('&point=')}&vehicle=car&locale=en&calc_points=true&key=${graphhopperKey}`
                    );
    
                    if (response.data && response.data.paths && response.data.paths.length > 0) {
                        const routeColor = routeColors[colorIndex % routeColors.length];
                        colorIndex++;
    
                        const bestRoute = response.data.paths[0];
                        const routeCoordinates = decodePolyline(bestRoute.points);
    
                        newRoutes.push({
                            deliveryPersonId: person.id,
                            destinationId: dest.id,
                            color: routeColor,
                            distance: bestRoute.distance,
                            time: bestRoute.time,
                            coordinates: routeCoordinates,
                        });

                        // Store distances for assignment
                        distanceMatrixTemp[person.id][dest.id + deliveryPeople.length] = bestRoute.distance;

                        const polyline = L.polyline(routeCoordinates, {
                            color: routeColor,
                            weight: 4,
                            opacity: 1
                        }).addTo(map);
    
                        animateMarker(routeCoordinates, routeColor);
                    }
                } catch (error) {
                    console.error('Error fetching route:', error);
                }
            }
        }
    
        setDistanceMatrix(distanceMatrixTemp); // Save distance matrix
        setRoutes(newRoutes);
    };

    const animateMarker = (coordinates, color) => {
        let step = 0;
        const numSteps = coordinates.length;

        const rider = L.circleMarker(coordinates[0], {
            radius: 7,
            color: color,
            fillColor: color,
            fillOpacity: 1
        }).addTo(map);

        function animate() {
            step = (step + 1) % numSteps;
            rider.setLatLng(coordinates[step]);
            animationRef.current.push(requestAnimationFrame(animate));
        }

        animate();
    };

    function decodePolyline(encoded) {
        const poly = [];
        let index = 0, len = encoded.length;
        let lat = 0, lng = 0;

        while (index < len) {
            let b, shift = 0, result = 0;
            do {
                b = encoded.charAt(index++).charCodeAt(0) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lat += dlat;

            shift = 0;
            result = 0;
            do {
                b = encoded.charAt(index++).charCodeAt(0) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lng += dlng;

            poly.push([lat / 1e5, lng / 1e5]);
        }
        return poly;
    }

    const assignTasks = () => {
        let assignments = [];
        let availableDeliveryPeople = [...deliveryPeople];

        destinations.forEach(dest => {
            let closestPerson = availableDeliveryPeople.reduce((closest, person, index) => {
                let distance = distanceMatrix[person.id][dest.id + deliveryPeople.length];
                return distance < closest.distance ? { person, distance } : closest;
            }, { person: null, distance: Infinity }).person;

            if (closestPerson) {
                assignments.push({ destination: dest, assignedTo: closestPerson });
                availableDeliveryPeople = availableDeliveryPeople.filter(p => p !== closestPerson);
            }
        });

        setAssignments(assignments);
    };

    return (
        <div id="app">
            <div className="input-group">
                <label htmlFor="markerType">Select Marker Type:</label>
                <select
                    id="markerType"
                    onChange={(e) => setCurrentMarkerType(e.target.value)}
                    value={currentMarkerType}
                >
                    <option value="deliveryPerson">Delivery Person</option>
                    <option value="restaurant">Restaurant</option>
                    <option value="destination">Destination</option>
                </select>
                <button onClick={startAddingMarkers}>Start Adding Markers</button>
                <button onClick={calculateRoutes} disabled={deliveryPeople.length === 0 || !restaurant || destinations.length === 0}>
                    Calculate Routes
                </button>
            </div>
            <div ref={mapRef} id="map" style={{ height: '500px' }}></div>
            <div id="results">
                <h2>Calculated Routes:</h2>
                {routes.map((route, index) => (
                    <div key={index} className="route" style={{ borderLeft: `5px solid ${route.color}` }}>
                        <h3>Route {index + 1}</h3>
                        <p>{`Rider ${route.deliveryPersonId} to Destination ${route.destinationId}`}</p>
                        <p>Distance: {(route.distance / 1000).toFixed(2)} km</p>
                        <p>Time: {(route.time / 60000).toFixed(2)} minutes</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MapComponent;