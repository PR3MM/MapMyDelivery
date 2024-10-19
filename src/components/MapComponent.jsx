import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet-routing-machine";
import "../index.css";
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';

const MapComponent = () => {
    const mapRef = useRef(null);
    const [map, setMap] = useState(null);
    const [deliveryPeople, setDeliveryPeople] = useState([]);
    const [restaurant, setRestaurant] = useState(null);
    const [destinations, setDestinations] = useState([]);
    const [currentMarkerType, setCurrentMarkerType] = useState('deliveryPerson');
    const [routes, setRoutes] = useState([]);
    const [routingControls, setRoutingControls] = useState([]);

    useEffect(() => {
        const mapInstance = L.map(mapRef.current).setView([18.5204, 73.8567], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
        setMap(mapInstance);

        return () => {
            mapInstance.remove();
        };
    }, []);

    const addLocation = (e) => {
        const { lat, lng } = e.latlng;
        
        if (currentMarkerType === 'deliveryPerson') {
            const newDeliveryPerson = { id: deliveryPeople.length + 1, location: { lat, lng } };
            setDeliveryPeople((prev) => [...prev, newDeliveryPerson]);
            //add different icon for delivery person

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

    const calculateRoutes = () => {
        // Clear previous routes
        routingControls.forEach(control => map.removeControl(control));
        setRoutingControls([]);

        const newRoutes = [];
        const newRoutingControls = [];

        deliveryPeople.forEach(person => {
            destinations.forEach(dest => {
                const waypoints = [
                    L.latLng(person.location.lat, person.location.lng),
                    L.latLng(restaurant.location.lat, restaurant.location.lng),
                    L.latLng(dest.location.lat, dest.location.lng)
                ];

                const routingControl = L.Routing.control({
                    waypoints: waypoints,
                    routeWhileDragging: false,
                    showAlternatives: true,
                    altLineOptions: {
                        styles: [
                            {color: 'black', opacity: 0.15, weight: 9},
                            {color: 'white', opacity: 0.8, weight: 6},
                            {color: 'blue', opacity: 0.5, weight: 2}
                        ]
                    },
                    createMarker: function() { return null; } // Prevents duplicate markers
                }).addTo(map);

                routingControl.on('routesfound', function(e) {
                    const routes = e.routes;
                    const bestRoute = routes[0]; // The first route is typically the best one

                    newRoutes.push({
                        deliveryPersonId: person.id,
                        destinationId: dest.id,
                        routes: routes.map(route => ({
                            distance: route.summary.totalDistance,
                            time: route.summary.totalTime,
                            coordinates: route.coordinates
                        })),
                        bestRoute: {
                            distance: bestRoute.summary.totalDistance,
                            time: bestRoute.summary.totalTime
                        }
                    });

                    setRoutes(newRoutes);
                });

                newRoutingControls.push(routingControl);
            });
        });

        setRoutingControls(newRoutingControls);
    };

    const getRouteColor = (index) => {
        const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33F1', '#33FFF1', '#F1FF33'];
        return colors[index % colors.length];
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
                    <div key={index} className="route">
                        <h3>Route {index + 1}</h3>
                        <p>Delivery Person: {route.deliveryPersonId}</p>
                        <p>Destination: {route.destinationId}</p>
                        <p>Best Route: {(route.bestRoute.distance / 1000).toFixed(2)} km, {(route.bestRoute.time / 60).toFixed(2)} minutes</p>
                        <h4>All Routes:</h4>
                        <ul>
                            {route.routes.map((r, i) => (
                                <li key={i}>
                                    Route {i + 1}: {(r.distance / 1000).toFixed(2)} km, {(r.time / 60).toFixed(2)} minutes
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MapComponent;