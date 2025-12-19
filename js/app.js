// Meet Me in the Middle - Main Application

class MeetInTheMiddle {
    constructor() {
        // State
        this.map = null;
        this.location1 = null;
        this.location2 = null;
        this.midpoint = null;
        this.selectedCategory = 'restaurant';
        this.places = [];
        this.markers = {
            location1: null,
            location2: null,
            midpoint: null,
            places: []
        };

        // Debounce timers
        this.searchTimers = {};

        // Initialize the app
        this.init();
    }

    init() {
        this.initMap();
        this.bindEvents();
        this.checkInputs();
    }

    // Initialize Leaflet map
    initMap() {
        // Create map centered on US (will adjust when locations are set)
        this.map = L.map('map').setView([39.8283, -98.5795], 4);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
    }

    // Bind all event listeners
    bindEvents() {
        // Location inputs with autocomplete
        const input1 = document.getElementById('location1');
        const input2 = document.getElementById('location2');

        input1.addEventListener('input', (e) => this.handleLocationInput(e, 1));
        input2.addEventListener('input', (e) => this.handleLocationInput(e, 2));

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.input-group')) {
                this.closeSuggestions();
            }
        });

        // Category buttons
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleCategorySelect(e));
        });

        // Find button
        document.getElementById('findMiddle').addEventListener('click', () => this.findMeetingSpots());

        // View toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleViewToggle(e));
        });
    }

    // Handle location input with debounced search
    handleLocationInput(event, locationNum) {
        const query = event.target.value.trim();

        // Clear previous timer
        if (this.searchTimers[locationNum]) {
            clearTimeout(this.searchTimers[locationNum]);
        }

        // Clear location if input is empty
        if (!query) {
            if (locationNum === 1) {
                this.location1 = null;
            } else {
                this.location2 = null;
            }
            this.closeSuggestions(locationNum);
            this.checkInputs();
            return;
        }

        // Debounce search
        this.searchTimers[locationNum] = setTimeout(() => {
            this.searchLocations(query, locationNum);
        }, 300);
    }

    // Search for locations using Nominatim
    async searchLocations(query, locationNum) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
                {
                    headers: {
                        'Accept': 'application/json'
                    }
                }
            );

            if (!response.ok) throw new Error('Search failed');

            const results = await response.json();
            this.showSuggestions(results, locationNum);
        } catch (error) {
            console.error('Location search error:', error);
        }
    }

    // Display location suggestions
    showSuggestions(results, locationNum) {
        const suggestionsEl = document.getElementById(`suggestions${locationNum}`);

        if (results.length === 0) {
            suggestionsEl.classList.remove('active');
            return;
        }

        suggestionsEl.innerHTML = results.map(result => {
            const name = result.display_name.split(',')[0];
            const address = result.display_name.split(',').slice(1, 3).join(',');
            return `
                <div class="suggestion-item" data-lat="${result.lat}" data-lon="${result.lon}" data-name="${result.display_name}">
                    <div class="name">${name}</div>
                    <div class="address">${address}</div>
                </div>
            `;
        }).join('');

        // Add click handlers
        suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => this.selectLocation(item, locationNum));
        });

        suggestionsEl.classList.add('active');
    }

    // Select a location from suggestions
    selectLocation(item, locationNum) {
        const lat = parseFloat(item.dataset.lat);
        const lon = parseFloat(item.dataset.lon);
        const name = item.dataset.name;

        const location = { lat, lon, name };

        if (locationNum === 1) {
            this.location1 = location;
            document.getElementById('location1').value = name;
        } else {
            this.location2 = location;
            document.getElementById('location2').value = name;
        }

        this.closeSuggestions(locationNum);
        this.checkInputs();
        this.updateLocationMarker(locationNum);
    }

    // Close suggestions dropdown
    closeSuggestions(locationNum = null) {
        if (locationNum) {
            document.getElementById(`suggestions${locationNum}`).classList.remove('active');
        } else {
            document.querySelectorAll('.suggestions').forEach(el => el.classList.remove('active'));
        }
    }

    // Check if both inputs are filled to enable button
    checkInputs() {
        const btn = document.getElementById('findMiddle');
        btn.disabled = !(this.location1 && this.location2);
    }

    // Update marker on map for a location
    updateLocationMarker(locationNum) {
        const location = locationNum === 1 ? this.location1 : this.location2;
        const markerKey = locationNum === 1 ? 'location1' : 'location2';
        const markerClass = locationNum === 1 ? 'marker-a' : 'marker-b';
        const markerLabel = locationNum === 1 ? 'A' : 'B';

        // Remove existing marker
        if (this.markers[markerKey]) {
            this.map.removeLayer(this.markers[markerKey]);
        }

        // Create custom icon
        const icon = L.divIcon({
            className: 'custom-marker-wrapper',
            html: `<div class="custom-marker ${markerClass}">${markerLabel}</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        // Add new marker
        this.markers[markerKey] = L.marker([location.lat, location.lon], { icon })
            .addTo(this.map)
            .bindPopup(`<strong>${markerLabel}: ${location.name.split(',')[0]}</strong>`);

        // Fit map to show both markers if both exist
        if (this.location1 && this.location2) {
            const bounds = L.latLngBounds(
                [this.location1.lat, this.location1.lon],
                [this.location2.lat, this.location2.lon]
            );
            this.map.fitBounds(bounds, { padding: [50, 50] });
        } else {
            this.map.setView([location.lat, location.lon], 12);
        }
    }

    // Handle category selection
    handleCategorySelect(event) {
        const btn = event.currentTarget;

        // Update active state
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.selectedCategory = btn.dataset.category;
    }

    // Handle view toggle
    handleViewToggle(event) {
        const btn = event.currentTarget;
        const view = btn.dataset.view;

        // Update active button
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update active view
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');

        // Invalidate map size if switching to map
        if (view === 'map') {
            setTimeout(() => this.map.invalidateSize(), 100);
        }
    }

    // Main function to find meeting spots
    async findMeetingSpots() {
        if (!this.location1 || !this.location2) return;

        // Show loading state
        this.setLoading(true);

        try {
            // Calculate midpoint
            this.midpoint = this.calculateMidpoint(this.location1, this.location2);

            // Search for places near midpoint
            this.places = await this.searchPlaces(this.midpoint, this.selectedCategory);

            // Update UI
            this.updateMap();
            this.updateList();

            // Show results section
            document.querySelector('.view-toggle').style.display = 'flex';
            document.querySelector('.results-section').style.display = 'flex';

            // Fit map to show all markers
            this.fitMapToResults();

        } catch (error) {
            console.error('Error finding meeting spots:', error);
            this.showError('Unable to find places. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    // Calculate geographic midpoint
    calculateMidpoint(loc1, loc2) {
        // Convert to radians
        const lat1 = loc1.lat * Math.PI / 180;
        const lon1 = loc1.lon * Math.PI / 180;
        const lat2 = loc2.lat * Math.PI / 180;
        const lon2 = loc2.lon * Math.PI / 180;

        // Calculate midpoint using spherical coordinates
        const Bx = Math.cos(lat2) * Math.cos(lon2 - lon1);
        const By = Math.cos(lat2) * Math.sin(lon2 - lon1);

        const lat3 = Math.atan2(
            Math.sin(lat1) + Math.sin(lat2),
            Math.sqrt((Math.cos(lat1) + Bx) ** 2 + By ** 2)
        );
        const lon3 = lon1 + Math.atan2(By, Math.cos(lat1) + Bx);

        return {
            lat: lat3 * 180 / Math.PI,
            lon: lon3 * 180 / Math.PI
        };
    }

    // Search for places using Overpass API
    async searchPlaces(midpoint, category) {
        // Map category to Overpass amenity types
        const categoryMap = {
            'restaurant': 'restaurant',
            'cafe': 'cafe',
            'bar': 'bar|pub',
            'fast_food': 'fast_food'
        };

        const amenityType = categoryMap[category] || 'restaurant';

        // Search within ~8km radius (good for meeting in the middle)
        const radius = 8000;

        // Build Overpass query
        const query = `
            [out:json][timeout:25];
            (
                node["amenity"~"${amenityType}"](around:${radius},${midpoint.lat},${midpoint.lon});
                way["amenity"~"${amenityType}"](around:${radius},${midpoint.lat},${midpoint.lon});
            );
            out center body;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `data=${encodeURIComponent(query)}`
        });

        if (!response.ok) throw new Error('Places search failed');

        const data = await response.json();

        // Process and sort results by distance from midpoint
        const places = data.elements
            .map(element => {
                const lat = element.lat || element.center?.lat;
                const lon = element.lon || element.center?.lon;

                if (!lat || !lon) return null;

                const distance = this.calculateDistance(midpoint, { lat, lon });

                return {
                    id: element.id,
                    name: element.tags?.name || 'Unnamed Place',
                    lat,
                    lon,
                    cuisine: element.tags?.cuisine || '',
                    address: this.formatAddress(element.tags),
                    phone: element.tags?.phone || '',
                    website: element.tags?.website || '',
                    openingHours: element.tags?.opening_hours || '',
                    distance,
                    distanceText: this.formatDistance(distance)
                };
            })
            .filter(place => place && place.name !== 'Unnamed Place')
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 20); // Limit to 20 results

        return places;
    }

    // Calculate distance between two points (Haversine formula)
    calculateDistance(point1, point2) {
        const R = 6371; // Earth's radius in km
        const dLat = (point2.lat - point1.lat) * Math.PI / 180;
        const dLon = (point2.lon - point1.lon) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Format distance for display
    formatDistance(km) {
        if (km < 1) {
            return `${Math.round(km * 1000)}m`;
        }
        return `${km.toFixed(1)}km`;
    }

    // Format address from OSM tags
    formatAddress(tags) {
        if (!tags) return '';
        const parts = [];
        if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
        if (tags['addr:street']) parts.push(tags['addr:street']);
        if (tags['addr:city']) parts.push(tags['addr:city']);
        return parts.join(' ') || '';
    }

    // Update map with results
    updateMap() {
        // Clear existing place markers
        this.markers.places.forEach(marker => this.map.removeLayer(marker));
        this.markers.places = [];

        // Remove existing midpoint marker
        if (this.markers.midpoint) {
            this.map.removeLayer(this.markers.midpoint);
        }

        // Add midpoint marker
        const midpointIcon = L.divIcon({
            className: 'custom-marker-wrapper',
            html: `<div class="custom-marker marker-mid">M</div>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18]
        });

        this.markers.midpoint = L.marker([this.midpoint.lat, this.midpoint.lon], { icon: midpointIcon })
            .addTo(this.map)
            .bindPopup('<strong>Midpoint</strong>');

        // Add place markers
        this.places.forEach(place => {
            const icon = L.divIcon({
                className: 'place-marker-wrapper',
                html: `<div class="place-marker">${this.getCategoryEmoji()}</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            });

            const marker = L.marker([place.lat, place.lon], { icon })
                .addTo(this.map)
                .bindPopup(this.createPopupContent(place));

            this.markers.places.push(marker);
        });
    }

    // Get emoji for current category
    getCategoryEmoji() {
        const emojis = {
            'restaurant': '🍽️',
            'cafe': '☕',
            'bar': '🍺',
            'fast_food': '🍔'
        };
        return emojis[this.selectedCategory] || '📍';
    }

    // Create popup content for a place
    createPopupContent(place) {
        let content = `<div class="popup-content">
            <h3>${place.name}</h3>`;

        if (place.cuisine) {
            content += `<div class="cuisine">${this.formatCuisine(place.cuisine)}</div>`;
        }

        content += `<div class="distance">${place.distanceText} from midpoint</div>`;

        const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;
        content += `<a href="${directionsUrl}" target="_blank" class="directions-link">Get Directions</a>`;

        content += '</div>';
        return content;
    }

    // Format cuisine string
    formatCuisine(cuisine) {
        return cuisine.split(';').map(c =>
            c.trim().charAt(0).toUpperCase() + c.trim().slice(1)
        ).join(', ');
    }

    // Update list view with results
    updateList() {
        const listEl = document.getElementById('resultsList');
        const countEl = document.querySelector('.results-count');

        countEl.textContent = `${this.places.length} places found`;

        if (this.places.length === 0) {
            listEl.innerHTML = `
                <div class="no-results">
                    <h3>No places found</h3>
                    <p>Try a different category or expand your search area.</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = this.places.map(place => {
            const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}`;

            return `
                <div class="result-card" data-lat="${place.lat}" data-lon="${place.lon}">
                    <div class="card-header">
                        <h3>${place.name}</h3>
                        <span class="distance-badge">${place.distanceText}</span>
                    </div>
                    ${place.cuisine ? `<div class="cuisine">${this.formatCuisine(place.cuisine)}</div>` : ''}
                    ${place.address ? `<div class="address">📍 ${place.address}</div>` : ''}
                    <div class="card-footer">
                        <a href="${directionsUrl}" target="_blank">Get Directions</a>
                        ${place.website ? `<a href="${place.website}" target="_blank">Website</a>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Add click handlers to cards
        listEl.querySelectorAll('.result-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.tagName !== 'A') {
                    const lat = parseFloat(card.dataset.lat);
                    const lon = parseFloat(card.dataset.lon);
                    this.focusOnPlace(lat, lon);
                }
            });
        });
    }

    // Focus map on a specific place
    focusOnPlace(lat, lon) {
        // Switch to map view
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.toggle-btn[data-view="map"]').classList.add('active');
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        document.getElementById('mapView').classList.add('active');

        setTimeout(() => {
            this.map.invalidateSize();
            this.map.setView([lat, lon], 16);

            // Open popup for this marker
            this.markers.places.forEach(marker => {
                const markerLatLng = marker.getLatLng();
                if (Math.abs(markerLatLng.lat - lat) < 0.0001 && Math.abs(markerLatLng.lng - lon) < 0.0001) {
                    marker.openPopup();
                }
            });
        }, 100);
    }

    // Fit map to show all results
    fitMapToResults() {
        const points = [
            [this.location1.lat, this.location1.lon],
            [this.location2.lat, this.location2.lon],
            [this.midpoint.lat, this.midpoint.lon],
            ...this.places.slice(0, 10).map(p => [p.lat, p.lon])
        ];

        const bounds = L.latLngBounds(points);
        this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Set loading state
    setLoading(isLoading) {
        const btn = document.getElementById('findMiddle');
        const btnText = btn.querySelector('.btn-text');
        const btnLoading = btn.querySelector('.btn-loading');

        if (isLoading) {
            btn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
        } else {
            btn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    }

    // Show error message
    showError(message) {
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove();

        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = message;

        const inputSection = document.querySelector('.input-section');
        inputSection.insertAdjacentElement('afterend', errorEl);

        setTimeout(() => errorEl.remove(), 5000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MeetInTheMiddle();
});
