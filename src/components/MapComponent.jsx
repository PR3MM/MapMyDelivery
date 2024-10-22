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
                            // console.log(`Route calculated: Person ${i+1} to Destination ${j+1}, Distance: ${bestRoute.distance}`);
                        } else {
                            console.warn(`No valid route found for Person ${i+1} to Destination ${j+1}`);
                        }
                    } catch (error) {
                        console.error(`Error fetching route for Person ${i+1} to Destination ${j+1}:`, error.message);
                    }
                }
            }
        
            setDistanceMatrix(distanceMatrixTemp);

            
            // console.log("Distance matrix calculated:", distanceMatrixTemp);
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
        // console.log("%cAssigning Tasks", "color: blue; font-weight: bold;");
    
        if (distanceMatrix.length === 0 || deliveryPeople.length === 0 || destinations.length === 0) {
            console.error("%cCannot assign tasks: missing data", "color: red; font-weight: bold;");
            return;
        }
    
        // Ensure the matrix is square
        const N = Math.max(deliveryPeople.length, destinations.length);
        let costMatrix = Array.from({ length: N }, () => Array(N).fill(Infinity));
    
        for (let i = 0; i < deliveryPeople.length; i++) {
            for (let j = 0; j < destinations.length; j++) {
                costMatrix[i][j] = distanceMatrix[i][j];
            }
        }
    
        const result = assignmentProblem(costMatrix);
    
        // console.log("Optimal Assignment Result:", result);
    
        // Create assignments based on the result
        const newAssignments = result.assignments
            .filter(({ from, to }) => from < deliveryPeople.length && to < destinations.length)
            .map(({ from, to }) => ({
                assignedTo: deliveryPeople[from],
                destination: destinations[to]
            }));
    
        setAssignments(newAssignments);
            // console.log(newAssignments)
            // console.log("newAssignments")
    
        // Calculate and draw routes for each assignment
        newAssignments.forEach((assignment, index) => {
            calculateAndDrawRoute(
                assignment.assignedTo,
                assignment.destination,
                routeColors[index % routeColors.length]
            );
        });
    };

    
class HungarianAlgorithm {
    constructor() {
        this.costs = null;
        this.originalCosts = null;  
        this.n = 0;
        this.marked = null;
        this.rowCover = null;
        this.colCover = null;
        this.path = null;
        this.path_count = 0;
    }

    solve(costMatrix) {
        if (!costMatrix || !costMatrix.length || !costMatrix[0].length) {
            throw new Error('Invalid cost matrix');
        }
        if (costMatrix.length !== costMatrix[0].length) {
            throw new Error('Cost matrix must be square');
        }

        this.originalCosts = this.copyMatrix(costMatrix);
        this.costs = this.copyMatrix(costMatrix);
        this.n = this.costs.length;
        this.marked = Array(this.n).fill().map(() => Array(this.n).fill(0));
        this.rowCover = Array(this.n).fill(0);
        this.colCover = Array(this.n).fill(0);
        this.path = Array(this.n * 2).fill().map(() => Array(2).fill(0));
        this.path_count = 0;

        let step = 1;
        while (step) {
            switch(step) {
                case 1:
                    step = this.reduceRows();
                    break;
                case 2:
                    step = this.markIndependentZeros();
                    break;
                case 3:
                    step = this.coverColumns();
                    break;
                case 4:
                    step = this.findZero();
                    break;
                case 5:
                    step = this.constructPath();
                    break;
                case 6:
                    step = this.modifyCosts();
                    break;
                case 7:
                    return this.findOptimalAssignment();
            }
        }
    }

    reduceRows() {
        for (let i = 0; i < this.n; i++) {
            const minVal = Math.min(...this.costs[i]);
            for (let j = 0; j < this.n; j++) {
                this.costs[i][j] -= minVal;
            }
        }
        return 2;
    }

    markIndependentZeros() {
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                if (this.costs[i][j] === 0 && 
                    !this.rowCover[i] && 
                    !this.colCover[j]) {
                    this.marked[i][j] = 1;
                    this.rowCover[i] = 1;
                    this.colCover[j] = 1;
                }
            }
        }
        this.clearCovers();
        return 3;
    }

    coverColumns() {
        let count = 0;
        for (let j = 0; j < this.n; j++) {
            for (let i = 0; i < this.n; i++) {
                if (this.marked[i][j] === 1) {
                    this.colCover[j] = 1;
                    count++;
                    break;
                }
            }
        }
        return (count >= this.n) ? 7 : 4;
    }

    findZero() {
        let zero = this.findUncoveredZero();
        if (!zero) {
            return 6;
        }
        let row = zero[0];
        let col = zero[1];
        
        this.marked[row][col] = 2;
        let starCol = this.findStarInRow(row);
        
        if (starCol === -1) {
            this.path[0] = [row, col];
            this.path_count = 1;
            return 5;
        }
        
        this.rowCover[row] = 1;
        this.colCover[starCol] = 0;
        return 4;
    }

    constructPath() {
        let done = false;
        let r = -1, c = -1;

        this.path_count = 1;
        this.path[0] = [this.path[0][0], this.path[0][1]];

        while (!done) {
            r = this.findStarInCol(this.path[this.path_count - 1][1]);
            if (r === -1) {
                done = true;
            } else {
                this.path_count++;
                this.path[this.path_count - 1] = [r, this.path[this.path_count - 2][1]];
                c = this.findPrimeInRow(r);
                this.path_count++;
                this.path[this.path_count - 1] = [r, c];
            }
        }

        this.convertPath();
        this.clearCovers();
        this.erasePrimes();
        return 3;
    }

    modifyCosts() {
        let minVal = Infinity;

        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                if (!this.rowCover[i] && !this.colCover[j]) {
                    minVal = Math.min(minVal, this.costs[i][j]);
                }
            }
        }

        if (minVal === Infinity) {
            throw new Error('No solution exists');
        }

        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                if (this.rowCover[i]) {
                    this.costs[i][j] += minVal;
                }
                if (!this.colCover[j]) {
                    this.costs[i][j] -= minVal;
                }
            }
        }
        return 4;
    }

    findOptimalAssignment() {
        const assignments = [];
        let totalCost = 0;

        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                if (this.marked[i][j] === 1) {
                    assignments.push({
                        from: i,
                        to: j,
                        cost: this.originalCosts[i][j]
                    });
                    totalCost += this.originalCosts[i][j];
                }
            }
        }

        return {
            assignments,
            totalCost
        };
    }

    findUncoveredZero() {
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                if (this.costs[i][j] === 0 && !this.rowCover[i] && !this.colCover[j]) {
                    return [i, j];
                }
            }
        }
        return null;
    }

    findStarInRow(row) {
        for (let j = 0; j < this.n; j++) {
            if (this.marked[row][j] === 1) return j;
        }
        return -1;
    }

    findStarInCol(col) {
        for (let i = 0; i < this.n; i++) {
            if (this.marked[i][col] === 1) return i;
        }
        return -1;
    }

    findPrimeInRow(row) {
        for (let j = 0; j < this.n; j++) {
            if (this.marked[row][j] === 2) return j;
        }
        return -1;
    }

    convertPath() {
        for (let i = 0; i < this.path_count; i++) {
            if (this.marked[this.path[i][0]][this.path[i][1]] === 1) {
                this.marked[this.path[i][0]][this.path[i][1]] = 0;
            } else {
                this.marked[this.path[i][0]][this.path[i][1]] = 1;
            }
        }
    }

    erasePrimes() {
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                if (this.marked[i][j] === 2) {
                    this.marked[i][j] = 0;
                }
            }
        }
    }

    clearCovers() {
        this.rowCover.fill(0);
        this.colCover.fill(0);
    }

    copyMatrix(matrix) {
        return matrix.map(row => [...row]);
    }
}

const assignmentProblem = (costMatrix) => {
    const hungarian = new HungarianAlgorithm();
    return hungarian.solve(costMatrix);
};



// Test the implementation
// let costMatrix = [[82,83,69,92],[77,37,49,92],[11,69,5,86],[8,9,98,23]]


// const result = assignmentProblem(costMatrix);
// console.log("Total Cost:", result.totalCost);
// console.log("Assignments:", result.assignments);
    


    const calculateAndDrawRoute = async (person, dest, color) => {
        // console.log("%cCalculating route:", "color: cyan;", {person, dest, color});
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
    
                // console.log("%cRoute data received:", "color: green;", {distance: bestRoute.distance, time: bestRoute.time});
    
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
                {/* <button
                    // onClick={assignTasks}
                    onClick={assignTasksnew}
                    disabled={routes.length === 0}
                    className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600 disabled:opacity-50"
                > */}
                    {/* Assign Tasks
                </button> */}
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