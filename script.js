let map;
let deliveryPeople = [];
let restaurant = null;
let destinations = [];
let currentMarkerType = 'deliveryPerson';
let distanceMatrix = [];
let routes = [];

function initMap() {
    map = L.map('map').setView([18.5204, 73.8567], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

function startAddingMarkers() {
    map.off('click');
    currentMarkerType = document.getElementById('markerType').value;
    map.on('click', addLocation);
}

function addLocation(e) {
    const selectedType = currentMarkerType;

    if (selectedType === 'deliveryPerson') {
        deliveryPeople.push({ location: e.latlng });
        L.marker(e.latlng).addTo(map).bindPopup(`Delivery Person ${deliveryPeople.length}`);
    } else if (selectedType === 'restaurant') {
        if (!restaurant) {
            restaurant = { location: e.latlng };
            L.marker(e.latlng, {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41]
                })
            }).addTo(map).bindPopup('Restaurant');
        } else {
            alert('Only one restaurant allowed!');
        }
    } else if (selectedType === 'destination') {
        destinations.push({ location: e.latlng });
        L.marker(e.latlng, {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41]
            })
        }).addTo(map).bindPopup(`Destination ${destinations.length}`);
    }

    if (deliveryPeople.length > 0 && restaurant && destinations.length > 0) {
        document.getElementById('optimizeButton').disabled = false;
    }
}

function calculateDistanceMatrix() {
    distanceMatrix = [];
    let allLocations = [restaurant, ...deliveryPeople, ...destinations];
    const promises = [];

    for (let i = 0; i < allLocations.length; i++) {
        distanceMatrix[i] = [];
        for (let j = 0; j < allLocations.length; j++) {
            if (i !== j) {
                promises.push(
                    new Promise((resolve) => {
                        calculateDistance(allLocations[i].location, allLocations[j].location, (distance) => {
                            distanceMatrix[i][j] = distance;
                            resolve();
                        });
                    })
                );
            } else {
                distanceMatrix[i][j] = 0;
            }
        }
    }

    return Promise.all(promises);
}

function calculateDistance(point1, point2, callback) {
    // First, try using the OpenRouteService API
    fetch(`https://api.openrouteservice.org/v2/directions/driving-car?api_key=YOUR_API_KEY_HERE&start=${point1.lng},${point1.lat}&end=${point2.lng},${point2.lat}`)
        .then(response => response.json())
        .then(data => {
            const distance = data.features[0].properties.segments[0].distance / 1000; // Convert to km
            callback(distance);
        })
        .catch(error => {
            console.error("Error with OpenRouteService API:", error);
            // Fallback to a simple distance calculation
            const R = 6371; // Radius of the Earth in km
            const dLat = (point2.lat - point1.lat) * Math.PI / 180;
            const dLon = (point2.lng - point1.lng) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;
            callback(distance);
        });
}

function assignTasks() {
    let assignments = [];
    let availableDeliveryPeople = [...deliveryPeople];

    destinations.forEach(dest => {
        let closestPerson = availableDeliveryPeople.reduce((closest, person, index) => {
            let distance = distanceMatrix[index + 1][destinations.indexOf(dest) + deliveryPeople.length + 1];
            return distance < closest.distance ? { person, distance } : closest;
        }, { person: null, distance: Infinity }).person;

        if (closestPerson) {
            assignments.push({ destination: dest, assignedTo: closestPerson });
            availableDeliveryPeople = availableDeliveryPeople.filter(p => p !== closestPerson);
        }
    });

    return assignments;
}

function optimizeRoutes() {
    calculateDistanceMatrix().then(() => {
        let assignments = assignTasks();
        routes = assignments.map(assignment => ({
            deliveryPerson: assignment.assignedTo,
            route: [assignment.assignedTo.location, restaurant.location, assignment.destination.location]
        }));

        displayRoutes(routes);
    });
}

function displayRoutes(routes) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<h2>Optimized Routes:</h2>';

    routes.forEach((route, i) => {
        const routeDiv = document.createElement('div');
        routeDiv.className = 'route';
        routeDiv.innerHTML = `
            <h3>Route ${i + 1}</h3>
            <p>Delivery Person: Start (${route.deliveryPerson.location.lat.toFixed(4)}, ${route.deliveryPerson.location.lng.toFixed(4)})</p>
            <p>Restaurant: (${restaurant.location.lat.toFixed(4)}, ${restaurant.location.lng.toFixed(4)})</p>
            <p>Destination: (${route.route[2].lat.toFixed(4)}, ${route.route[2].lng.toFixed(4)})</p>
            <button onclick="showRoute(${i})">Show Route</button>
        `;
        resultsDiv.appendChild(routeDiv);
    });
}

function showRoute(routeIndex) {
    const route = routes[routeIndex];
    
    // Clear previous routes
    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    // Draw the route
    const routeCoordinates = route.route.map(point => [point.lat, point.lng]);
    L.polyline(routeCoordinates, {color: 'blue', weight: 4}).addTo(map);

    // Fit the map to the route
    map.fitBounds(L.latLngBounds(routeCoordinates));
}

// Initialize the map when the page loads
initMap();