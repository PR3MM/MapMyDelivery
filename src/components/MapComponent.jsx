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
    const [distanceMatrix, setDistanceMatrix] = useState([]);
    const [routes, setRoutes] = useState([]);

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
            L.marker([lat, lng]).addTo(map).bindPopup(`Delivery Person ${newDeliveryPerson.id}`);
        } else if (currentMarkerType === 'restaurant') {
            if (!restaurant) {
                setRestaurant({ location: { lat, lng } });
                L.marker([lat, lng], {
                    icon: L.icon({
                        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
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

    const calculateDistance = (start, end) => {
        return map.distance(start, end);
    };

    const calculateDistanceMatrix = () => {
        const allLocations = [restaurant, ...deliveryPeople, ...destinations];
        const matrix = [];

        for (let i = 0; i < allLocations.length; i++) {
            matrix[i] = [];
            for (let j = 0; j < allLocations.length; j++) {
                if (i !== j) {
                    matrix[i][j] = calculateDistance(
                        [allLocations[i].location.lat, allLocations[i].location.lng],
                        [allLocations[j].location.lat, allLocations[j].location.lng]
                    );
                } else {
                    matrix[i][j] = 0;
                }
            }
        }

        setDistanceMatrix(matrix);
        return matrix;
    };

    const assignTasks = (matrix) => {
        const assignments = [];
        const unassignedDestinations = [...destinations];

        deliveryPeople.forEach((person) => {
            if (unassignedDestinations.length > 0) {
                let minDistance = Infinity;
                let closestDestination;
                let closestIndex;

                unassignedDestinations.forEach((dest, index) => {
                    const distance = matrix[person.id][dest.id + deliveryPeople.length];
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestDestination = dest;
                        closestIndex = index;
                    }
                });

                assignments.push({
                    assignedTo: person,
                    destination: closestDestination,
                });

                unassignedDestinations.splice(closestIndex, 1);
            }
        });

        return assignments;
    };

    const optimizeRoutes = () => {
        const matrix = calculateDistanceMatrix();
        const assignments = assignTasks(matrix);
        const optimizedRoutes = assignments.map((assignment) => ({
            deliveryPersonId: assignment.assignedTo.id,
            destinationId: assignment.destination.id,
            route: [
                assignment.assignedTo.location,
                restaurant.location,
                assignment.destination.location
            ],
        }));

        setRoutes(optimizedRoutes);
        displayRoutes(optimizedRoutes);
    };

    const displayRoutes = (optimizedRoutes) => {
        optimizedRoutes.forEach((route, index) => {
            const waypoints = route.route.map(location => L.latLng(location.lat, location.lng));
            
            L.Routing.control({
                waypoints: waypoints,
                routeWhileDragging: true,
                lineOptions: {
                    styles: [{ color: getRouteColor(index), opacity: 0.6, weight: 4 }]
                },
                addWaypoints: false,
                draggableWaypoints: false,
                createMarker: function() { return null; }, // Prevents duplicate markers
            }).addTo(map);
        });
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
                <button onClick={optimizeRoutes} disabled={deliveryPeople.length === 0 || !restaurant || destinations.length === 0}>
                    Optimize Routes
                </button>
            </div>
            <div ref={mapRef} id="map" style={{ height: '500px' }}></div>
            <div id="results">
                <h2>Optimized Routes:</h2>
                {routes.map((route, index) => (
                    <div key={index} className="route">
                        <h3>Route {index + 1}</h3>
                        <p>Delivery Person: {route.deliveryPersonId}</p>
                        <p>Destination: {route.destinationId}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MapComponent;