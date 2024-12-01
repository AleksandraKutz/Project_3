let map = L.map('map', {            
    center: [36.7783, -119.4179],  // Lat, Lon for California
    zoom: 6
});

// Adding OpenStreetMap:
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Making empty group for layers:
let coverageLayer = L.layerGroup();  
let doctorRatioLayer = L.layerGroup();  
let combinedLayer = L.layerGroup();  // This is the new combined layer for population density and doctor ratio
let medianIncomeLayer = L.layerGroup();

// Function to create the custom triangle marker for coverageRate
function getCoverageMarker(coverageRate) {
    const size = Math.max(10, 30 - coverageRate / 2);  // Smaller size based on coverage rate

    // Creating a triangle icon using HTML and CSS
    const triangleIcon = L.divIcon({
        className: 'coverage-triangle',  // Custom class
        html: `<div style="width: 0; height: 0; border-left: ${size}px solid transparent; border-right: ${size}px solid transparent; border-bottom: ${size * 1.5}px solid ${getCoverageColor(coverageRate)};"></div>`,
        iconSize: [size * 2, size * 1.5]  // Width and height based on size of triangle
    });

    return triangleIcon;
}

// Making color depends on coverage rate:
function getCoverageColor(coverageRate) {
    if (coverageRate > 90) return '#FFB6C1';  // Light pink
    if (coverageRate > 70) return '#FF69B4';  // Pink
    if (coverageRate > 50) return '#C71585';  // Dark pink
    return '#000000';  // Black
}

// Creating triangle for each location based on lat, lon, and coverage rate
function createCoverageTriangle(location) {
    let coverageRate = location.Coverage_Rate;
    let coverageMarker = getCoverageMarker(coverageRate);

    L.marker([location.Latitude, location.Longitude], {
        icon: coverageMarker  // Use the custom triangle icon
    })
    .bindPopup('<b>Coverage Rate: ' + coverageRate.toFixed(2) + '%</b>')  // Showing coverage rate in the popup
    .addTo(coverageLayer);  // Adding the marker to the coverage layer
}

// Fetching data from the API and creating markers for coverage
fetch('/api/v1.0/locations')
    .then(response => response.json())
    .then(data => {
        data.forEach(location => {
            createCoverageTriangle(location);
        });
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });

// Function to normalize ratio (0-1)
function normalize(ratio, minRatio, maxRatio) {
    return (ratio - minRatio) / (maxRatio - minRatio);
}

// Assigning color scale for Children per Doctor (from green to red)
function getDoctorRatioColor(ratio, minRatio, maxRatio) {
    const normalized = normalize(ratio, minRatio, maxRatio);
    
    // Define a color scale from green to red
    const colorScale = d3.scaleLinear()
        .domain([0, 0.2, 0.4, 0.6, 0.8, 1])  //normalized values
        .range(["green", "lightgreen", "yellow", "orange", "red", "brown"]);

    return colorScale(normalized);
}

// Creating circles for Children - Doctor Ratio
function createDoctorRatioCircle(location, minRatio, maxRatio) {
    let ratio = location.Children_to_Doctor_Ratio;
    let lat = location.Latitude;
    let lng = location.Longitude;

    L.circle([lat, lng], {
        radius: 6000,  // Size of the circle
        color: getDoctorRatioColor(ratio, minRatio, maxRatio),
        fillColor: getDoctorRatioColor(ratio, minRatio, maxRatio),
        fillOpacity: 0.6,  
        weight: 4,  
        opacity: 0.1 
    })
    .bindPopup('<b>Children per Doctor Ratio: ' + Math.round(ratio) + '</b>')
    .addTo(doctorRatioLayer);  // Adding circle to layer
}

// Taking data from the API and creating layer for doctor ratio markers
fetch('/api/v1.0/locations')
    .then(response => response.json())
    .then(data => {
        let pointsData = [];
        let minRatio = Infinity;
        let maxRatio = -Infinity;

        data.forEach(location => {
            let ratio = location.Children_to_Doctor_Ratio;
            minRatio = Math.min(minRatio, ratio);
            maxRatio = Math.max(maxRatio, ratio);

            pointsData.push(location);
        });

        pointsData.forEach(location => {
            createDoctorRatioCircle(location, minRatio, maxRatio);
        });
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });

// Creating the combined marker based on Population Density and Children per Doctor Ratio
function createCombinedMarker(location, minRatio, maxRatio) {
    let populationDensity = location.Population_Density;
    let doctorRatio = location.Children_to_Doctor_Ratio;

    // Round the population density to 0 decimal places
    // and round the children to doctor ratio to 1 decimal place
    populationDensity = Math.round(populationDensity);  // Round population density
    doctorRatio = doctorRatio.toFixed(1);  // Round children to doctor ratio to 1 decimal place

    // Calculate size based on Population Density (scaled to a reasonable range)
    const size = Math.min(30, Math.max(6, location.Population_Density / 1500));  // Smaller size for combined layer
    
    // Get color based on doctor ratio with the new blue-red scale
    const color = getCombinedColor(doctorRatio, minRatio, maxRatio);
    
    // Create a circle marker for the combined layer
    L.circleMarker([location.Latitude, location.Longitude], {
        radius: size,  // Size based on Population Density
        color: color,  // Color based on Children to Doctor Ratio with new scale
        fillColor: color,
        fillOpacity: 0.6,
        weight: 1
    })
    .bindPopup(`<b>Population Density per 1 square mile: ${populationDensity}</b><br><b>Children to Doctor Ratio: ${doctorRatio}</b>`)
    .addTo(combinedLayer);  // Add to combined layer
}

// Assigning color scale for Population Density (from blue to red)
function getCombinedColor(ratio, minRatio, maxRatio) {
    const normalized = normalize(ratio, minRatio, maxRatio);

    // Define a color scale from blue to red
    const colorScale = d3.scaleLinear()
        .domain([0, 0.2, 0.4, 0.6, 0.8, 1])  // Normalized values
        .range(["#ffffcc", "#ffff00", "#ff9900", "#ff3300", "#b35c00", "#4b2a00"]);  // blue -> yellow -> red

    return colorScale(normalized);
}

// Fetching data and creating markers for the combined layer
fetch('/api/v1.0/locations')
    .then(response => response.json())
    .then(data => {
        let pointsData = [];
        let minRatio = Infinity;
        let maxRatio = -Infinity;

        // Find min and max ratio for color normalization
        data.forEach(location => {
            let ratio = location.Children_to_Doctor_Ratio;
            minRatio = Math.min(minRatio, ratio);
            maxRatio = Math.max(maxRatio, ratio);
            pointsData.push(location);
        });

        // Create the combined markers for each location
        pointsData.forEach(location => {
            createCombinedMarker(location, minRatio, maxRatio);
        });
    })
    .catch(error => {
        console.error('Error fetching data:', error);
    });

function getIncomeColors(ratio, minRatio, maxRatio) {
    const normalized = normalize(ratio, minRatio, maxRatio);

    // Define a color scale from blue to red
    let colorScale = d3.scaleLinear()
        .domain([0, 0.2, 0.4, 0.6, 0.8, 1])  // Normalized values
        .range(['skyblue','cornflowerblue','dodgerblue','blue', 'mediumblue','midnightblue']);

    return colorScale(normalized);
}

function scaleIncomeToRadius(income) {
    if (income < 20000) return 5; // Minimum radius
    if (income < 50000) return 10; // Medium radius
    if (income < 100000) return 15; // Larger radius
    return 20; // Maximum radius
}

// Function to create layer of median income 
function createMarkerMedianIncome(incomeData) {
    var incomeMarkers = [];
    let minRatio = Infinity; // Initialize minRatio
    let maxRatio = -Infinity; // Initialize maxRatio

    // First pass to determine min and max doctor ratios
    incomeData.forEach(function(incomeData) {
        let doctorRatio = incomeData.Children_to_Doctor_Ratio;
        minRatio = Math.min(minRatio, doctorRatio);
        maxRatio = Math.max(maxRatio, doctorRatio);
    });

    // Second pass to create markers
    incomeData.forEach(function(incomeData) {
        let income = incomeData.Family_Median_Income; 
        let doctorRatio = incomeData.Children_to_Doctor_Ratio; 
        let lat = incomeData.Latitude; 
        let lng = incomeData.Longitude; 
        let zip = incomeData.Zip_Code; 

        // Determine the color based on doctor ratio
        let color = getIncomeColors(doctorRatio, minRatio, maxRatio);

        // Create a circle marker for each location
        let circleMarker = L.circleMarker([lat, lng], { 
            // radius: Math.sqrt(income) * 0.05, // Scale the size 
            radius: scaleIncomeToRadius(income),
            fillColor: color,
            color: color,
            weight: 3,
            opacity: 1,
            fillOpacity: 0.75
        }).bindPopup('Zip Code: ' + zip + '<br>Median Income: $' + income +'<br>Children to Doctor ratio: ' +doctorRatio); // Added income to popup

        incomeMarkers.push(circleMarker); // Add the circle marker to the array
    });

    // Add all circle markers to the map
    L.layerGroup(incomeMarkers).addTo(medianIncomeLayer);

    // Create a legend control
    var legendMedianIncome = L.control({ position: 'bottomright' });

    legendMedianIncome.onAdd = function() {
        let div = L.DomUtil.create('div', 'info legend');
        // let div = L.DomUtil.create("div", "info legend");
            grades = [0, 0.2, 0.4, 0.6, 0.8, 1]; // Normalized values
            let colors = ['skyblue', 'cornflowerblue', 'dodgerblue', 'blue', 'mediumblue', 'midnightblue'];

        // Add a title to the legend
        div.innerHTML += '<h4>Children to Doctor Ratio</h4>';

        // Loop through the grades and create a colored square for each
        for (let i = 0; i < grades.length; i++) {
            div.innerHTML +=
                '<i style="background:' + colors[i] +'; width: 20px; height: 20px; display: inline-block; margin-right: 5px;"></i> ' +
                grades[i] + (grades[i + 1] ? ' &ndash; ' + grades[i + 1] + '<br>' : '+');
        }
   
        // Add the background styling for the legend container
        div.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        div.style.padding = '10px';
        div.style.borderRadius = '5px';
        div.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)';

        return div;
    };

    // Add the legend to the map
    legendMedianIncome.addTo(map); // Initially add to the map

    // Function to show/hide the legend based on layer visibility
    function updateLegendVisibility() {
        if (map.hasLayer(medianIncomeLayer)) {
            legendMedianIncome.addTo(map); // Show legend if layer is visible
        } else {
            map.removeControl(legendMedianIncome); // Hide legend if layer is not visible
        }
    }

    // Call this function to set the initial visibility
    updateLegendVisibility();

    // Add an event listener to update the legend visibility when the layer is toggled
    medianIncomeLayer.on('add', updateLegendVisibility);
    medianIncomeLayer.on('remove', updateLegendVisibility);
}


// Fetching data and creating markers
d3.json('/api/v1.0/locations')
.then(function(data) {
    createMarkerMedianIncome(data);
});

// Control panel to turn on/off layers
L.control.layers(null, {
    "Percentage of insured children": coverageLayer,
    "Children per doctor": doctorRatioLayer,  // Ensure this layer is available in the control panel
    "Population Density vs Children to Doctor Ratio": combinedLayer,  // Adding the new combined layer
    "Family Median Income and children per doctor rate": medianIncomeLayer
}).addTo(map);
