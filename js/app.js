// Meet Me in the Middle - Main Application

class MeetInTheMiddle {
    constructor() {
        // State
        this.map = null;
        this.stepMaps = {};
        this.location1 = null;
        this.location2 = null;
        this.midpoint = null;
        this.selectedCategory = 'restaurant';
        this.places = [];
        this.currentStep = 1;
        this.markers = {
            location1: null,
            location2: null,
            midpoint: null,
            places: []
        };
        this.stepMarkers = {};

        // Debounce timers
        this.searchTimers = {};

        // Initialize the app
        this.init();
    }

    init() {
        this.initResultsMap();
        this.initStepMaps();
        this.bindEvents();
        this.updateStepUI();
    }

    // Initialize the results map
    initResultsMap() {
        this.map = L.map('map').setView([39.8283, -98.5795], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.map);
    }

    // Initialize maps for each step
    initStepMaps() {
        // Step 1 map
        this.stepMaps[1] = L.map('stepMap1').setView([39.8283, -98.5795], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(this.stepMaps[1]);
        this.stepMaps[1].on('click', (e) => this.handleStepMapClick(1, e));
        this.stepMarkers[1] = null;

        // Step 2 map
        this.stepMaps[2] = L.map('stepMap2').setView([39.8283, -98.5795], 4);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap'
        }).addTo(this.stepMaps[2]);
        this.stepMaps[2].on('click', (e) => this.handleStepMapClick(2, e));
        this.stepMarkers[2] = null;
    }

    // Bind all event listeners
    bindEvents() {
        // Location inputs with autocomplete
        document.getElementById('location1').addEventListener('input', (e) => this.handleLocationInput(e, 1));
        document.getElementById('location2').addEventListener('input', (e) => this.handleLocationInput(e, 2));

        // Close suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.location-search')) {
                this.closeSuggestions();
            }
        });

        // Clear/Change buttons
        document.querySelectorAll('.clear-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const locationNum = parseInt(e.target.dataset.location);
                this.clearLocation(locationNum);
            });
        });

        // Next buttons
        document.getElementById('next1').addEventListener('click', () => this.goToStep(2));
        document.getElementById('next2').addEventListener('click', () => this.goToStep(3));

        // Back buttons
        document.getElementById('back2').addEventListener('click', () => this.goToStep(1));
        document.getElementById('back3').addEventListener('click', () => this.goToStep(2));

        // Edit buttons in summary
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const step = parseInt(e.target.dataset.goto);
                this.goToStep(step);
            });
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

    // Handle click on step map
    async handleStepMapClick(stepNum, event) {
        const { lat, lng: lon } = event.latlng;

        try {
            // Reverse geocode the clicked location
            const name = await this.reverseGeocode(lat, lon);
            const location = { lat, lon, name };

            // Update state
            if (stepNum === 1) {
                this.location1 = location;
                document.getElementById('location1').value = name;
            } else {
                this.location2 = location;
                document.getElementById('location2').value = name;
            }

            // Update marker on step map
            this.updateStepMarker(stepNum);
            this.updateSelectedDisplay(stepNum);
            this.updateStepButtons();

        } catch (error) {
            console.error('Reverse geocoding failed:', error);
            // Use coordinates as fallback
            const name = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
            const location = { lat, lon, name };

            if (stepNum === 1) {
                this.location1 = location;
                document.getElementById('location1').value = name;
            } else {
                this.location2 = location;
                document.getElementById('location2').value = name;
            }

            this.updateStepMarker(stepNum);
            this.updateSelectedDisplay(stepNum);
            this.updateStepButtons();
        }
    }

    // Update marker on step map
    updateStepMarker(stepNum) {
        const location = stepNum === 1 ? this.location1 : this.location2;
        const markerClass = stepNum === 1 ? 'marker-a' : 'marker-b';
        const markerLabel = stepNum === 1 ? 'A' : 'B';

        // Remove existing marker
        if (this.stepMarkers[stepNum]) {
            this.stepMaps[stepNum].removeLayer(this.stepMarkers[stepNum]);
        }

        if (location) {
            const icon = L.divIcon({
                className: 'custom-marker-wrapper',
                html: `<div class="custom-marker ${markerClass}">${markerLabel}</div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });

            this.stepMarkers[stepNum] = L.marker([location.lat, location.lon], { icon })
                .addTo(this.stepMaps[stepNum]);

            // Center map on location
            this.stepMaps[stepNum].setView([location.lat, location.lon], 12);
        }

        // If we're on step 2 and location 1 exists, show it on the map
        if (stepNum === 2 && this.location1) {
            // Add location 1 marker to step 2 map for reference
            const icon1 = L.divIcon({
                className: 'custom-marker-wrapper',
                html: `<div class="custom-marker marker-a" style="opacity: 0.5;">A</div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });
            L.marker([this.location1.lat, this.location1.lon], { icon: icon1 })
                .addTo(this.stepMaps[2]);
        }
    }

    // Update selected location display
    updateSelectedDisplay(stepNum) {
        const location = stepNum === 1 ? this.location1 : this.location2;
        const selectedEl = document.getElementById(`selected${stepNum}`);
        const nameEl = selectedEl.querySelector('.selected-name');

        if (location) {
            nameEl.textContent = location.name.split(',').slice(0, 2).join(',');
            selectedEl.style.display = 'flex';
        } else {
            selectedEl.style.display = 'none';
        }
    }

    // Update step navigation buttons
    updateStepButtons() {
        document.getElementById('next1').disabled = !this.location1;
        document.getElementById('next2').disabled = !this.location2;
    }

    // Clear a location
    clearLocation(locationNum) {
        if (locationNum === 1) {
            this.location1 = null;
            document.getElementById('location1').value = '';
        } else {
            this.location2 = null;
            document.getElementById('location2').value = '';
        }

        // Remove marker
        if (this.stepMarkers[locationNum]) {
            this.stepMaps[locationNum].removeLayer(this.stepMarkers[locationNum]);
            this.stepMarkers[locationNum] = null;
        }

        this.updateSelectedDisplay(locationNum);
        this.updateStepButtons();
    }

    // Navigate to a step
    goToStep(stepNum) {
        this.currentStep = stepNum;
        this.updateStepUI();

        // If going to step 2, set the map view to include location 1
        if (stepNum === 2 && this.location1) {
            setTimeout(() => {
                this.stepMaps[2].invalidateSize();
                this.stepMaps[2].setView([this.location1.lat, this.location1.lon], 10);
                this.updateStepMarker(2);
            }, 100);
        }

        // If going to step 3, update the summary
        if (stepNum === 3) {
            this.updateSummary();
        }

        // Invalidate map size when showing
        if (stepNum <= 2) {
            setTimeout(() => {
                this.stepMaps[stepNum].invalidateSize();
            }, 100);
        }
    }

    // Update the step UI (progress indicators and wizard sections)
    updateStepUI() {
        // Update progress steps
        document.querySelectorAll('.progress-steps .step').forEach(step => {
            const stepNum = parseInt(step.dataset.step);
            step.classList.remove('active', 'completed');

            if (stepNum < this.currentStep) {
                step.classList.add('completed');
            } else if (stepNum === this.currentStep) {
                step.classList.add('active');
            }
        });

        // Update connectors
        document.querySelectorAll('.step-connector').forEach((connector, index) => {
            if (index + 1 < this.currentStep) {
                connector.classList.add('completed');
            } else {
                connector.classList.remove('completed');
            }
        });

        // Update wizard steps
        document.querySelectorAll('.wizard-step').forEach(step => {
            step.classList.remove('active');
        });
        document.getElementById(`step${this.currentStep}`).classList.add('active');
    }

    // Update summary in step 3
    updateSummary() {
        if (this.location1) {
            document.getElementById('summaryLocation1').textContent =
                this.location1.name.split(',').slice(0, 2).join(',');
        }
        if (this.location2) {
            document.getElementById('summaryLocation2').textContent =
                this.location2.name.split(',').slice(0, 2).join(',');
        }
    }

    // Handle location input with debounced search
    handleLocationInput(event, locationNum) {
        const query = event.target.value.trim();

        if (this.searchTimers[locationNum]) {
            clearTimeout(this.searchTimers[locationNum]);
        }

        if (!query) {
            this.closeSuggestions(locationNum);
            return;
        }

        this.searchTimers[locationNum] = setTimeout(() => {
            this.searchLocations(query, locationNum);
        }, 300);
    }

    // Search for locations using Nominatim
    async searchLocations(query, locationNum) {
        try {
            const params = new URLSearchParams({
                format: 'json',
                q: query,
                limit: '8',
                addressdetails: '1',
                extratags: '1',
                namedetails: '1',
                dedupe: '1'
            });

            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?${params}`,
                { headers: { 'Accept': 'application/json' } }
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
            const parts = result.display_name.split(',').map(p => p.trim());
            const name = parts[0];
            const type = result.type || '';
            const category = result.class || '';
            let address = parts.slice(1, 3).join(', ');
            const typeLabel = this.getLocationTypeLabel(type, category);

            return `
                <div class="suggestion-item" data-lat="${result.lat}" data-lon="${result.lon}" data-name="${result.display_name}">
                    <div class="name">${name}${typeLabel ? ` <span class="type-badge">${typeLabel}</span>` : ''}</div>
                    <div class="address">${address}</div>
                </div>
            `;
        }).join('');

        suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => this.selectLocation(item, locationNum));
        });

        suggestionsEl.classList.add('active');
    }

    // Get human-readable label for location type
    getLocationTypeLabel(type, category) {
        const typeLabels = {
            'city': 'City', 'town': 'Town', 'village': 'Village',
            'suburb': 'Neighborhood', 'neighbourhood': 'Neighborhood',
            'county': 'County', 'state': 'State', 'country': 'Country',
            'hamlet': 'Village', 'administrative': 'Area'
        };
        if (typeLabels[type]) return typeLabels[type];
        if (category === 'amenity' || category === 'shop' || category === 'tourism') return 'Place';
        return '';
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
        this.updateStepMarker(locationNum);
        this.updateSelectedDisplay(locationNum);
        this.updateStepButtons();
    }

    // Close suggestions dropdown
    closeSuggestions(locationNum = null) {
        if (locationNum) {
            document.getElementById(`suggestions${locationNum}`).classList.remove('active');
        } else {
            document.querySelectorAll('.suggestions').forEach(el => el.classList.remove('active'));
        }
    }

    // Reverse geocode coordinates to get address
    async reverseGeocode(lat, lon) {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
            { headers: { 'Accept': 'application/json' } }
        );
        if (!response.ok) throw new Error('Reverse geocoding failed');
        const data = await response.json();
        return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
    }

    // Handle category selection
    handleCategorySelect(event) {
        const btn = event.currentTarget;
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedCategory = btn.dataset.category;
    }

    // Handle view toggle
    handleViewToggle(event) {
        const btn = event.currentTarget;
        const view = btn.dataset.view;

        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');

        if (view === 'map') {
            setTimeout(() => this.map.invalidateSize(), 100);
        }
    }

    // Main function to find meeting spots
    async findMeetingSpots() {
        if (!this.location1 || !this.location2) return;

        this.setLoading(true);

        try {
            this.midpoint = this.calculateMidpoint(this.location1, this.location2);
            this.places = await this.searchPlaces(this.midpoint, this.selectedCategory);

            this.updateResultsMap();
            this.updateList();

            // Hide wizard, show results
            document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
            document.querySelector('.progress-steps').style.display = 'none';
            document.querySelector('.view-toggle').style.display = 'flex';
            document.querySelector('.results-section').style.display = 'flex';

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
        const lat1 = loc1.lat * Math.PI / 180;
        const lon1 = loc1.lon * Math.PI / 180;
        const lat2 = loc2.lat * Math.PI / 180;
        const lon2 = loc2.lon * Math.PI / 180;

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
        const categoryConfig = {
            'restaurant': { tags: [{ key: 'amenity', value: 'restaurant' }] },
            'cafe': { tags: [{ key: 'amenity', value: 'cafe' }] },
            'bar': { tags: [{ key: 'amenity', value: 'bar|pub' }] },
            'fast_food': { tags: [{ key: 'amenity', value: 'fast_food' }] },
            'park': { tags: [
                { key: 'leisure', value: 'park' },
                { key: 'leisure', value: 'garden' },
                { key: 'leisure', value: 'nature_reserve' }
            ]},
            'cinema': { tags: [
                { key: 'amenity', value: 'cinema' },
                { key: 'amenity', value: 'theatre' }
            ]},
            'museum': { tags: [
                { key: 'tourism', value: 'museum' },
                { key: 'tourism', value: 'gallery' }
            ]},
            'shopping': { tags: [
                { key: 'shop', value: 'mall' },
                { key: 'shop', value: 'department_store' },
                { key: 'shop', value: 'supermarket' }
            ]},
            'library': { tags: [{ key: 'amenity', value: 'library' }] },
            'gym': { tags: [
                { key: 'leisure', value: 'fitness_centre' },
                { key: 'leisure', value: 'sports_centre' },
                { key: 'amenity', value: 'gym' }
            ]},
            'hotel': { tags: [
                { key: 'tourism', value: 'hotel' },
                { key: 'tourism', value: 'motel' }
            ]},
            'bowling': { tags: [{ key: 'leisure', value: 'bowling_alley' }] }
        };

        const config = categoryConfig[category] || categoryConfig['restaurant'];
        const radius = 8000;

        const tagQueries = config.tags.map(tag => `
            node["${tag.key}"~"${tag.value}"](around:${radius},${midpoint.lat},${midpoint.lon});
            way["${tag.key}"~"${tag.value}"](around:${radius},${midpoint.lat},${midpoint.lon});
        `).join('');

        const query = `[out:json][timeout:25];(${tagQueries});out center body;`;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `data=${encodeURIComponent(query)}`
        });

        if (!response.ok) throw new Error('Places search failed');
        const data = await response.json();

        return data.elements
            .map(element => {
                const lat = element.lat || element.center?.lat;
                const lon = element.lon || element.center?.lon;
                if (!lat || !lon) return null;

                const distance = this.calculateDistance(midpoint, { lat, lon });
                return {
                    id: element.id,
                    name: element.tags?.name || 'Unnamed Place',
                    lat, lon,
                    cuisine: element.tags?.cuisine || '',
                    address: this.formatAddress(element.tags),
                    phone: element.tags?.phone || '',
                    website: element.tags?.website || '',
                    distance,
                    distanceText: this.formatDistance(distance)
                };
            })
            .filter(place => place && place.name !== 'Unnamed Place')
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 20);
    }

    // Calculate distance between two points
    calculateDistance(point1, point2) {
        const R = 6371;
        const dLat = (point2.lat - point1.lat) * Math.PI / 180;
        const dLon = (point2.lon - point1.lon) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    formatDistance(km) {
        return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
    }

    formatAddress(tags) {
        if (!tags) return '';
        const parts = [];
        if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
        if (tags['addr:street']) parts.push(tags['addr:street']);
        if (tags['addr:city']) parts.push(tags['addr:city']);
        return parts.join(' ') || '';
    }

    // Update results map
    updateResultsMap() {
        // Clear existing markers
        this.markers.places.forEach(marker => this.map.removeLayer(marker));
        this.markers.places = [];
        if (this.markers.midpoint) this.map.removeLayer(this.markers.midpoint);
        if (this.markers.location1) this.map.removeLayer(this.markers.location1);
        if (this.markers.location2) this.map.removeLayer(this.markers.location2);

        // Add location markers
        const iconA = L.divIcon({
            className: 'custom-marker-wrapper',
            html: `<div class="custom-marker marker-a">A</div>`,
            iconSize: [36, 36], iconAnchor: [18, 18]
        });
        this.markers.location1 = L.marker([this.location1.lat, this.location1.lon], { icon: iconA })
            .addTo(this.map).bindPopup(`<strong>A: ${this.location1.name.split(',')[0]}</strong>`);

        const iconB = L.divIcon({
            className: 'custom-marker-wrapper',
            html: `<div class="custom-marker marker-b">B</div>`,
            iconSize: [36, 36], iconAnchor: [18, 18]
        });
        this.markers.location2 = L.marker([this.location2.lat, this.location2.lon], { icon: iconB })
            .addTo(this.map).bindPopup(`<strong>B: ${this.location2.name.split(',')[0]}</strong>`);

        // Add midpoint marker
        const midpointIcon = L.divIcon({
            className: 'custom-marker-wrapper',
            html: `<div class="custom-marker marker-mid">M</div>`,
            iconSize: [36, 36], iconAnchor: [18, 18]
        });
        this.markers.midpoint = L.marker([this.midpoint.lat, this.midpoint.lon], { icon: midpointIcon })
            .addTo(this.map).bindPopup('<strong>Midpoint</strong>');

        // Add place markers
        this.places.forEach(place => {
            const icon = L.divIcon({
                className: 'place-marker-wrapper',
                html: `<div class="place-marker">${this.getCategoryEmoji()}</div>`,
                iconSize: [32, 32], iconAnchor: [16, 16]
            });
            const marker = L.marker([place.lat, place.lon], { icon })
                .addTo(this.map)
                .bindPopup(this.createPopupContent(place));
            this.markers.places.push(marker);
        });
    }

    getCategoryEmoji() {
        const emojis = {
            'restaurant': '🍽️', 'cafe': '☕', 'bar': '🍺', 'fast_food': '🍔',
            'park': '🌳', 'cinema': '🎬', 'museum': '🏛️', 'shopping': '🛍️',
            'library': '📚', 'gym': '💪', 'hotel': '🏨', 'bowling': '🎳'
        };
        return emojis[this.selectedCategory] || '📍';
    }

    createPopupContent(place) {
        let content = `<div class="popup-content"><h3>${place.name}</h3>`;
        if (place.cuisine) content += `<div class="cuisine">${place.cuisine.split(';').map(c => c.trim().charAt(0).toUpperCase() + c.trim().slice(1)).join(', ')}</div>`;
        content += `<div class="distance">${place.distanceText} from midpoint</div>`;
        content += `<a href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}" target="_blank" class="directions-link">Get Directions</a></div>`;
        return content;
    }

    updateList() {
        const listEl = document.getElementById('resultsList');
        document.querySelector('.results-count').textContent = `${this.places.length} places found`;

        if (this.places.length === 0) {
            listEl.innerHTML = `<div class="no-results"><h3>No places found</h3><p>Try a different category.</p></div>`;
            return;
        }

        listEl.innerHTML = this.places.map(place => `
            <div class="result-card" data-lat="${place.lat}" data-lon="${place.lon}">
                <div class="card-header">
                    <h3>${place.name}</h3>
                    <span class="distance-badge">${place.distanceText}</span>
                </div>
                ${place.cuisine ? `<div class="cuisine">${place.cuisine.split(';').map(c => c.trim().charAt(0).toUpperCase() + c.trim().slice(1)).join(', ')}</div>` : ''}
                ${place.address ? `<div class="address">📍 ${place.address}</div>` : ''}
                <div class="card-footer">
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}" target="_blank">Get Directions</a>
                    ${place.website ? `<a href="${place.website}" target="_blank">Website</a>` : ''}
                </div>
            </div>
        `).join('');

        listEl.querySelectorAll('.result-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.tagName !== 'A') {
                    this.focusOnPlace(parseFloat(card.dataset.lat), parseFloat(card.dataset.lon));
                }
            });
        });
    }

    focusOnPlace(lat, lon) {
        document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.toggle-btn[data-view="map"]').classList.add('active');
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        document.getElementById('mapView').classList.add('active');

        setTimeout(() => {
            this.map.invalidateSize();
            this.map.setView([lat, lon], 16);
            this.markers.places.forEach(marker => {
                const pos = marker.getLatLng();
                if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lon) < 0.0001) {
                    marker.openPopup();
                }
            });
        }, 100);
    }

    fitMapToResults() {
        const points = [
            [this.location1.lat, this.location1.lon],
            [this.location2.lat, this.location2.lon],
            [this.midpoint.lat, this.midpoint.lon],
            ...this.places.slice(0, 10).map(p => [p.lat, p.lon])
        ];
        this.map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    }

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

    showError(message) {
        const existingError = document.querySelector('.error-message');
        if (existingError) existingError.remove();

        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = message;

        document.querySelector('.wizard-step.active .step-card').appendChild(errorEl);
        setTimeout(() => errorEl.remove(), 5000);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new MeetInTheMiddle();
});
