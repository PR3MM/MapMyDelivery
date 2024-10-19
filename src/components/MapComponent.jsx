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
    
        // Normalize the cost matrix to be square by adding dummy rows/columns with Infinity.
        const N = Math.max(deliveryPeople.length, destinations.length);
        const costMatrix = Array.from({ length: N }, () => Array(N).fill(Infinity));
    
        for (let i = 0; i < deliveryPeople.length; i++) {
            for (let j = 0; j < destinations.length; j++) {
                costMatrix[i][j] = distanceMatrix[i][j];
            }
        }
    
        // Find the minimum cost and assignments using branch and bound.
        const { node, totalCost } = findMinCost(costMatrix, deliveryPeople.length, destinations.length);
        const assignments = getAssignments(node);
    
        console.log(assignments);
    
        // Map assignments to delivery people and destinations.
        const newAssignments = assignments.map(({ workerID, jobID }) => ({
            assignedTo: deliveryPeople[workerID],
            destination: destinations[jobID]
        }));
    
        setAssignments(newAssignments);
    
        // Clear existing routes.
        routes.forEach(route => {
            if (route.polyline) map.removeLayer(route.polyline);
            if (route.marker) map.removeLayer(route.marker);
        });
        setRoutes([]);
    
        console.log("%cNew Assignments:", "color: green; font-weight: bold;", newAssignments);
    
        // Calculate and draw new routes for each assignment.
        newAssignments.forEach((assignment, index) => {
            console.log("%cCalculating route for assignment:", "color: purple; font-weight: bold;", assignment);
            calculateAndDrawRoute(assignment.assignedTo, assignment.destination, routeColors[index % routeColors.length])
                .then(route => {
                    if (route) {
                        console.log("%cRoute calculated successfully:", "color: green;", route);
                        setRoutes(prevRoutes => [...prevRoutes, route]);
                    } else {
                        console.warn("%cFailed to calculate route", "color: orange;");
                    }
                })
                .catch(error => {
                    console.error("%cError calculating route:", "color: red;", error);
                });
        });
    
        console.log("%cTotal cost of assignments:", "color: blue;", totalCost);
    };
    
    // Helper function to map back the assignments from the min-cost node.
    const getAssignments = (node) => {
        let assignments = [];
        while (node.parent !== null) {
            assignments.push({ workerID: node.workerID, jobID: node.jobID });
            node = node.parent;
        }
        return assignments.reverse(); // reverse to get the order from the root to leaf
    };
    
    // Finds minimum cost using Branch and Bound.
    function findMinCost(costMatrix, numWorkers, numJobs) {
        const N = Math.max(numWorkers, numJobs);
        let pq = [];
    
        // Initialize the heap with a dummy node.
        let root = { parent: null, workerID: -1, jobID: -1, pathCost: 0, cost: 0, assigned: Array(N).fill(false) };
        pq.push(root);
    
        while (pq.length > 0) {
            let min = pq.shift();
            let i = min.workerID + 1;
    
            // If all workers have been assigned a job, return the result.
            if (i === numWorkers) {
                return { node: min, totalCost: min.cost };
            }
    
            // Explore all job assignments for the current worker.
            for (let j = 0; j < numJobs; j++) {
                if (!min.assigned[j]) {
                    let child = {
                        parent: min,
                        workerID: i,
                        jobID: j,
                        pathCost: min.pathCost + costMatrix[i][j],
                        assigned: [...min.assigned]
                    };
                    child.assigned[j] = true;
    
                    // Calculate the lower bound (cost estimate).
                    child.cost = child.pathCost + calculateLowerBound(costMatrix, i, child.assigned);
    
                    // Add the child to the priority queue.
                    pq.push(child);
                }
            }
    
            // Sort the queue by the cost to always expand the least-cost node.
            pq.sort((a, b) => a.cost - b.cost);
        }
    
        return { node: null, totalCost: Infinity }; // Return an invalid result if no solution is found.
    }
    
    // Calculate lower bound cost estimation.
    function calculateLowerBound(costMatrix, workerIdx, assigned) {
        let cost = 0;
        
        // Iterate over remaining workers and find the minimum possible cost for each.
        for (let i = workerIdx + 1; i < costMatrix.length; i++) {
            let minCost = Infinity;
            for (let j = 0; j < costMatrix[i].length; j++) {
                if (!assigned[j] && costMatrix[i][j] < minCost) {
                    minCost = costMatrix[i][j];
                }
            }
            cost += minCost;
        }
    
        return cost;
    }
    
    


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



   
    
    

    return (<div id="app" className="p-4">
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
                    onClick={assignTasks}
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
