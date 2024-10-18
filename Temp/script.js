let map;
let deliveryPeople = [];
let restaurant = null;
let destinations = [];
let currentMarkerType = 'deliveryPerson';
let distanceMatrix = [];
let routes = [];

// Initialize the map
function initMap() {
    map = L.map('map').setView([18.5204, 73.8567], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

// Start adding markers based on selected type
function startAddingMarkers() {
    map.off('click');
    currentMarkerType = document.getElementById('markerType').value;
    map.on('click', addLocation);
}

// Add a marker based on the click location
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

    // Enable optimization if markers are set
    if (deliveryPeople.length > 0 && restaurant && destinations.length > 0) {
        document.getElementById('optimizeButton').disabled = false;
    }
}

// Calculate the distance matrix between all locations
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

// Haversine formula to calculate distance between two points
function calculateDistance(point1, point2, callback) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    callback(distance);
}

// Assign delivery tasks based on proximity
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

// Optimize routes after calculating distances
function optimizeRoutes() {
    calculateDistanceMatrix().then(() => {
        let assignments = assignTasks();
        routes = assignments.map(assignment => ({
            deliveryPerson: assignment.assignedTo,
            route: [assignment.assignedTo.location, restaurant.location, assignment.destination.location]
        }));

        displayRoutes(routes);
    }).catch(error => {
        console.error('Error calculating distance matrix:', error);
        alert('Error calculating routes. Please try again.');
    });

    currentMarkerType = 'Stop'; // Reset marker type
}

// Display optimized routes on the page
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

// Display the selected route on the map// Display the selected route on the map
function showRoute(routeIndex) {
    const route = routes[routeIndex];

    // Clear previous routes
    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    // Create a new routing control
    const control = L.Routing.control({
        waypoints: [
            L.latLng(route.deliveryPerson.location),
            L.latLng(restaurant.location),
            L.latLng(route.route[2])
        ],
        router: L.Routing.graphHopper('API_KEY', {
            serviceUrl: 'https://graphhopper.com/api/1/route'
        }),
        routeWhileDragging: true,
        profile: 'car' // Adjust profile as necessary
    });

    // Handle the event when the route is found
    control.on('routesfound', function(e) {
        console.log('Route found:', e.routes);
        // Fit the map to the new route
        const routeCoordinates = e.routes[0].getLatLngs();
        map.fitBounds(L.latLngBounds(routeCoordinates));
    });

    // Add the control to the map
    control.addTo(map);
}
console.log('L.Routing:', L.Routing);
console.log('L.Routing.graphHopper:', L.Routing.graphHopper);


// Initialize the map when the page loads
initMap();
