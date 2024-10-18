let map;
let deliveryPeople = [];
let restaurant = null;
let destinations = [];
let currentMarkerType = 'deliveryPerson'; // Default marker type
let distanceMatrix = [];

// Initialize the map
function initMap() {
    map = L.map('map').setView([18.5204, 73.8567], 12); // Centered on Pune
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
}

// Function to handle adding different markers
function startAddingMarkers() {
    map.off('click'); // Remove previous click listeners
    currentMarkerType = document.getElementById('markerType').value; // Get selected marker type
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

    // Enable the Optimize button if all types of markers are present
    if (deliveryPeople.length > 0 && restaurant && destinations.length > 0) {
        document.getElementById('optimizeButton').disabled = false;
    }
}

//function to calculate distance matrix
function calculateDistanceMatrix() {
    distanceMatrix = [];
    let allLocations = [restaurant, ...deliveryPeople, ...destinations];
    allLocations.forEach((source, i) => {
        distanceMatrix[i] = [];
        allLocations.forEach((destination, j) => {
            distanceMatrix[i][j] = calculateDistance(source.location, destination.location);
        });
    });
}

// Function to calculate the distance between two points
function calculateDistance(point1, point2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLon = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
}

// Function to assign delivery tasks based on the closest delivery person to each destination
function assignTasks(deliveryPeople, destinations) {
    let assignments = [];
    let availableDeliveryPeople = [...deliveryPeople];

    destinations.forEach(dest => {
        let closestPerson = availableDeliveryPeople.reduce((closest, person) => {
            let distance = calculateDistance(person.location, dest.location);
            return distance < closest.distance ? { person, distance } : closest;
        }, { person: null, distance: Infinity }).person;

        if (closestPerson) {
            assignments.push({ destination: dest, assignedTo: closestPerson });
            availableDeliveryPeople = availableDeliveryPeople.filter(p => p !== closestPerson);
        }
    });

    return assignments;
}

// Function to optimize routes and display the result
function optimizeRoutes() {
    let assignments = assignTasks(deliveryPeople, destinations);
    let optimizedRoutes = assignments.map(assignment => ({
        deliveryPerson: assignment.assignedTo,
        route: [assignment.assignedTo.location, restaurant.location, assignment.destination.location]
    }));

    displayRoutes(optimizedRoutes);
}

// Function to display routes on the map and in the results section
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
        `;
        resultsDiv.appendChild(routeDiv);

        // Draw route on map
        L.polyline(route.route, { color: getRandomColor(), weight: 3 }).addTo(map);
    });
}

// Function to generate a random color for the routes
function getRandomColor() {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
}

// Initialize the map when the page loads
initMap();
    