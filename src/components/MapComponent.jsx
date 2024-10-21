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
        const graphhopperKey = import.meta.env.VITE_GRAPHHOPPER_KEY;
        if (!graphhopperKey) {
            console.error("GraphHopper API key is missing");
            return;
        }
    
        const distanceMatrixTemp = Array.from(Array(deliveryPeople.length), () => Array(destinations.length).fill(Infinity));
        
        try {
            for (let i = 0; i < deliveryPeople.length; i++) {
                for (let j = 0; j < destinations.length; j++) {
                    const person = deliveryPeople[i];
                    const dest = destinations[j];
                    if (!person || !dest || !restaurant) {
                        console.error(`Missing data for calculation: person=${person}, dest=${dest}, restaurant=${restaurant}`);
                        continue;
                    }
                    
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
                            const bestRoute = response.data.paths[0];
                            distanceMatrixTemp[i][j] = bestRoute.distance;
                            console.log(`Route calculated: Person ${i+1} to Destination ${j+1}, Distance: ${bestRoute.distance}`);
                        } else {
                            console.warn(`No valid route found for Person ${i+1} to Destination ${j+1}`);
                        }
                    } catch (error) {
                        console.error(`Error fetching route for Person ${i+1} to Destination ${j+1}:`, error.message);
                    }
                }
            }
        
            setDistanceMatrix(distanceMatrixTemp);

            
            console.log("Distance matrix calculated:", distanceMatrixTemp);
            assignTasks(distanceMatrixTemp, deliveryPeople, destinations);
        } catch (error) {
            console.error("Error in calculateRoutes:", error);
        }
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
        return rider;
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

    const assignTasks = (distanceMatrix, deliveryPeople, destinations) => {
        console.log("%cAssigning Tasks", "color: blue; font-weight: bold;");
    
        if (distanceMatrix.length === 0 || deliveryPeople.length === 0 || destinations.length === 0) {
            console.error("%cCannot assign tasks: missing data", "color: red; font-weight: bold;");
            return;
        }
    
        // Ensure the matrix is square
        const N = Math.max(deliveryPeople.length, destinations.length);
        const costMatrix = Array.from({ length: N }, () => Array(N).fill(Infinity));
    
        for (let i = 0; i < deliveryPeople.length; i++) {
            for (let j = 0; j < destinations.length; j++) {
                costMatrix[i][j] = distanceMatrix[i][j];
            }
        }
    
        const result = assignmentProblem(costMatrix);
    
        console.log("Optimal Assignment Result:", result);
    
        // Create assignments based on the result
        const newAssignments = result.assignments
            .filter(({ from, to }) => from < deliveryPeople.length && to < destinations.length)
            .map(({ from, to }) => ({
                assignedTo: deliveryPeople[from],
                destination: destinations[to]
            }));
    
        setAssignments(newAssignments);
            console.log(newAssignments)
            console.log("newAssignments")
    
        // Calculate and draw routes for each assignment
        newAssignments.forEach((assignment, index) => {
            calculateAndDrawRoute(
                assignment.assignedTo,
                assignment.destination,
                routeColors[index % routeColors.length]
            );
        });
    };

    // Implementing Hungarian Algorithm
    //matrix and n == rows|columns
//     const hungarianAlgorithm = (matrix,n) => {
//         let size = n;
//         for(let i=0;i<size;i++){
//             for(let j=0;j<size;j++){
//                 cost[i][j] = -1*(matrix[i*n+j]);

//                 let ans  =  -1* hungarian();
//                 return ans;
//             }
//     }
// }



// Example usage
function assignmentProblem(costMatrix) {
    const n = costMatrix.length;  // Assuming square matrix
    let minCost = Infinity;
    let bestAssignment = [];

    function permute(arr, l, r) {
        if (l === r) {
            // Calculate total cost for this permutation
            let currentCost = 0;
            for (let i = 0; i < n; i++) {
                currentCost += costMatrix[i][arr[i]];
            }

            // Update the minimum cost and best assignment if needed
            if (currentCost < minCost) {
                minCost = currentCost;
                bestAssignment = [...arr];
            }
        } else {
            // Permute all possible assignments
            for (let i = l; i <= r; i++) {
                [arr[l], arr[i]] = [arr[i], arr[l]];  // Swap
                permute(arr, l + 1, r);
                [arr[l], arr[i]] = [arr[i], arr[l]];  // Backtrack
            }
        }
    }

    // Initialize array for destination indices [0, 1, 2, ..., n-1]
    let destinationIndices = Array.from({ length: n }, (_, i) => i);

    // Generate all permutations of destination assignments
    permute(destinationIndices, 0, n - 1);

    // Return the optimal assignment and its cost
    return {
        totalCost: minCost,
        assignments: bestAssignment.map((to, from) => ({ from, to }))
    };
}


// Test the implementation
// const costMatrix = [
//     [1500, 4000, 4500],
//     [2000, 6000, 3500],
//     [2000, 4000, 2500]
// ];

// const result = assignmentProblem(costMatrix);
// console.log("Total Cost:", result.totalCost);
// console.log("Assignments:", result.assignments);
    


    const calculateAndDrawRoute = async (person, dest, color) => {
        console.log("%cCalculating route:", "color: cyan;", {person, dest, color});
        const graphhopperKey = import.meta.env.VITE_GRAPHHOPPER_KEY;
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
                const bestRoute = response.data.paths[0];
                const routeCoordinates = decodePolyline(bestRoute.points);
    
                console.log("%cRoute data received:", "color: green;", {distance: bestRoute.distance, time: bestRoute.time});
    
                const polyline = L.polyline(routeCoordinates, {
                    color: color,
                    weight: 4,
                    opacity: 1
                }).addTo(map);
    
                const marker = animateMarker(routeCoordinates, color);
    
                return {
                    deliveryPersonId: person.id,
                    destinationId: dest.id,
                    color: color,
                    distance: bestRoute.distance,
                    time: bestRoute.time,
                    coordinates: routeCoordinates,
                    polyline: polyline,
                    marker: marker
                };
            } else {
                console.warn("%cNo valid route found", "color: orange;");
            }
        } catch (error) {
            console.error('%cError fetching route:', "color: red;", error);
        }
    
        return null;
    };

    const assignTasksnew = () => {
        // Create a new div element for assignments
        const assignmentsHTML = document.createElement('div');
    
        // Generate the assignments list by mapping over the assignments array
        const assignmentsList = assignments.map((assignment) => (
            `<li>Delivery Person ${assignment.assignedTo.id} assigned to Destination ${assignment.destination.id}</li>`
        )).join('');
    
        // Generate the list of idle delivery people by filtering out those already assigned
        const idlePeopleList = deliveryPeople
            .filter(person => !assignments.some(a => a.assignedTo.id === person.id))
            .map(person => `<li>Delivery Person ${person.id}</li>`)
            .join('');
    
        // Set the inner HTML of the assignmentsHTML div
        assignmentsHTML.innerHTML = `
            <h2 class="text-lg font-semibold">Assignments:</h2>
            <ul class="list-disc ml-6">
                ${assignmentsList || '<li>No assignments available.</li>'}
            </ul>
            <h2 class="text-lg font-semibold mt-4">Idle Delivery People:</h2>
            <ul class="list-disc ml-6">
                ${idlePeopleList || '<li>All delivery people are assigned.</li>'}
            </ul>
        `;
    
        // Append the constructed HTML to the container
        document.getElementById('app').appendChild(assignmentsHTML);
    };
    
    


   
    
    

    return (<div id="app" className="p-4 bg-black">
        <div className="mb-4 flex flex-col space-y-2">
            <label htmlFor="markerType" className="font-semibold">Select Marker Type:</label>
            <select
                id="markerType"
                onChange={(e) => setCurrentMarkerType(e.target.value)}
                value={currentMarkerType}
                className="border border-gray-300 rounded p-2"
            >
                <option value="deliveryPerson">Delivery Person</option>
                <option value="restaurant">Restaurant</option>
                <option value="destination">Destination</option>
            </select>
            <div className="flex space-x-2">
                <button
                    onClick={startAddingMarkers}
                    className="bg-yellow-400 text-white px-4 py-2 rounded hover:bg-yellow-500"
                >
                    Start Adding Markers
                </button>
                <button
                    onClick={calculateRoutes}
                    disabled={deliveryPeople.length === 0 || destinations.length === 0 || !restaurant}
                    className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
                >
                    Calculate Routes
                </button>
                <button
                    // onClick={assignTasks}
                    onClick={assignTasksnew}
                    disabled={routes.length === 0}
                    className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 disabled:opacity-50"
                >
                    Assign Tasks
                </button>
            </div>
        </div>
        <div ref={mapRef} className="h-96 border border-gray-300"></div>
        {/* <div className="mt-4">
                <h2 className="text-lg font-semibold">Assignments:</h2>
                <ul className="list-disc ml-6">
                    {assignments.map((assignment, index) => (
                        <li key={index}>
                            Delivery Person {assignment.assignedTo.id} assigned to Destination {assignment.destination.id}
                        </li>
                    ))}
                </ul>
                <h2 className="text-lg font-semibold mt-4">Idle Delivery People:</h2>
                <ul className="list-disc ml-6">
                    {deliveryPeople.filter(person => !assignments.some(a => a.assignedTo.id === person.id)).map(person => (
                        <li key={person.id}>Delivery Person {person.id}</li>
                    ))}
                </ul>
            </div> */}
    </div>
    
    );
};

export default MapComponent;