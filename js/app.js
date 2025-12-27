// Meet Me in the Middle - Main Application

class MeetInTheMiddle {
    constructor() {
        // State
        this.map = null;
        this.stepMaps = {};
        this.location1 = null;
        this.location2 = null;
        this.midpoint = null;
        this.selectedCategories = new Set(['restaurant']); // Categories selected on step 3
        this.currentStep = 1;
        this.markers = {
            location1: null,
            location2: null,
            midpoint: null
        };
        this.stepMarkers = {};

        // Multi-category state
        this.activeCategories = new Set();
        this.placesByCategory = {};      // Cache of fetched places by category
        this.markersByCategory = {};     // Markers on map by category

        // Midpoint calculation state
        this.midpointMethod = null;      // 'driving' or 'geographic'
        this.searchRadius = null;        // Final radius used (in meters)

        // Preview state (before confirming)
        this.previewLocations = { 1: null, 2: null };
        this.previewMarkers = { 1: null, 2: null };

        // Debounce timers
        this.searchTimers = {};

        // Category configuration
        this.categoryConfig = {
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

        // Confirm buttons (for preview -> confirmed)
        document.querySelectorAll('.confirm-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const locationNum = parseInt(e.currentTarget.dataset.location);
                this.confirmLocation(locationNum);
            });
        });

        // Clear/Change buttons
        document.querySelectorAll('.clear-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const locationNum = parseInt(e.currentTarget.dataset.location);
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

        // Category toggles (on results page)
        document.querySelectorAll('.category-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleCategoryToggle(e));
        });
    }

    // Handle click on step map - shows preview marker
    async handleStepMapClick(stepNum, event) {
        // Don't allow clicking if location is already confirmed
        const confirmedLocation = stepNum === 1 ? this.location1 : this.location2;
        if (confirmedLocation) return;

        const { lat, lng: lon } = event.latlng;

        // Show marker immediately with coordinates as placeholder
        const coordsName = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        const location = { lat, lon, name: coordsName };

        this.previewLocations[stepNum] = location;
        document.getElementById(`location${stepNum}`).value = coordsName;
        this.updatePreviewMarker(stepNum);
        this.updatePreviewDisplay(stepNum);

        // Then fetch the actual address name asynchronously
        try {
            const name = await this.reverseGeocode(lat, lon);
            // Only update if this is still the current preview location
            if (this.previewLocations[stepNum] &&
                this.previewLocations[stepNum].lat === lat &&
                this.previewLocations[stepNum].lon === lon) {
                this.previewLocations[stepNum].name = name;
                document.getElementById(`location${stepNum}`).value = name;
                this.updatePreviewDisplay(stepNum);
            }
        } catch (error) {
            console.error('Reverse geocoding failed:', error);
            // Keep the coordinates as the name (already set)
        }
    }

    // Update preview marker on step map (red, movable)
    updatePreviewMarker(stepNum) {
        const location = this.previewLocations[stepNum];

        // Remove existing preview marker
        if (this.previewMarkers[stepNum]) {
            this.stepMaps[stepNum].removeLayer(this.previewMarkers[stepNum]);
        }

        if (location) {
            // Create a red preview marker
            const icon = L.divIcon({
                className: 'custom-marker-wrapper',
                html: `<div class="custom-marker" style="border-color: #EF4444; color: #EF4444;">?</div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
            });

            this.previewMarkers[stepNum] = L.marker([location.lat, location.lon], { icon })
                .addTo(this.stepMaps[stepNum]);
        }
    }

    // Update preview location display
    updatePreviewDisplay(stepNum) {
        const location = this.previewLocations[stepNum];
        const previewEl = document.getElementById(`preview${stepNum}`);
        const nameEl = previewEl.querySelector('.preview-name');

        if (location) {
            nameEl.textContent = location.name.split(',').slice(0, 2).join(',');
            previewEl.style.display = 'flex';
        } else {
            previewEl.style.display = 'none';
        }
    }

    // Confirm the preview location and advance to next step
    confirmLocation(stepNum) {
        const previewLocation = this.previewLocations[stepNum];
        if (!previewLocation) return;

        // Move preview to confirmed
        if (stepNum === 1) {
            this.location1 = previewLocation;
        } else {
            this.location2 = previewLocation;
        }

        // Clear preview
        this.previewLocations[stepNum] = null;
        document.getElementById(`preview${stepNum}`).style.display = 'none';

        // Remove preview marker and add confirmed marker
        if (this.previewMarkers[stepNum]) {
            this.stepMaps[stepNum].removeLayer(this.previewMarkers[stepNum]);
            this.previewMarkers[stepNum] = null;
        }

        // Update confirmed marker and display
        this.updateStepMarker(stepNum);
        this.updateSelectedDisplay(stepNum);
        this.updateStepButtons();

        // Automatically advance to the next step
        this.goToStep(stepNum + 1);
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
        // Clear confirmed location
        if (locationNum === 1) {
            this.location1 = null;
            document.getElementById('location1').value = '';
        } else {
            this.location2 = null;
            document.getElementById('location2').value = '';
        }

        // Clear preview state
        this.previewLocations[locationNum] = null;
        if (this.previewMarkers[locationNum]) {
            this.stepMaps[locationNum].removeLayer(this.previewMarkers[locationNum]);
            this.previewMarkers[locationNum] = null;
        }
        document.getElementById(`preview${locationNum}`).style.display = 'none';

        // Remove confirmed marker
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

        // If going to step 3, update the summary and preload the results map area
        if (stepNum === 3) {
            this.updateSummary();
            // Preload results map tiles by setting view to midpoint area
            if (this.location1 && this.location2) {
                const preloadMidpoint = this.calculateMidpoint(this.location1, this.location2);
                this.map.setView([preloadMidpoint.lat, preloadMidpoint.lon], 12);
            }
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

    // Select a location from suggestions - goes to preview state
    selectLocation(item, locationNum) {
        // Don't allow if location is already confirmed
        const confirmedLocation = locationNum === 1 ? this.location1 : this.location2;
        if (confirmedLocation) {
            this.closeSuggestions(locationNum);
            return;
        }

        const lat = parseFloat(item.dataset.lat);
        const lon = parseFloat(item.dataset.lon);
        const name = item.dataset.name;
        const location = { lat, lon, name };

        // Set as preview (not confirmed)
        this.previewLocations[locationNum] = location;
        document.getElementById(`location${locationNum}`).value = name;

        this.closeSuggestions(locationNum);
        this.updatePreviewMarker(locationNum);
        this.updatePreviewDisplay(locationNum);

        // Center map on the selected location
        this.stepMaps[locationNum].setView([lat, lon], 12);
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

    // Handle category selection on step 3 (toggle multiple)
    handleCategorySelect(event) {
        const btn = event.currentTarget;
        const category = btn.dataset.category;

        if (this.selectedCategories.has(category)) {
            // Don't allow deselecting if it's the last one
            if (this.selectedCategories.size > 1) {
                this.selectedCategories.delete(category);
                btn.classList.remove('active');
            }
        } else {
            this.selectedCategories.add(category);
            btn.classList.add('active');
        }
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

        this.setLoading(true, 'Calculating driving route...');

        try {
            // Reset state
            this.activeCategories.clear();
            this.placesByCategory = {};
            this.markersByCategory = {};
            this.midpointMethod = null;
            this.searchRadius = null;

            const radii = [8000, 12000, 16000, 20000, 30000, 40000, 50000];
            const categories = Array.from(this.selectedCategories);
            let foundAnyPlaces = false;

            // Step 1: Try driving route midpoint
            try {
                this.setLoading(true, 'Calculating driving route...');
                this.midpoint = await this.getDrivingMidpoint(this.location1, this.location2);
                this.midpointMethod = 'driving';

                // Search with expanding radius - check ALL categories at each radius
                for (const radius of radii) {
                    this.setLoading(true, `Searching within ${radius / 1000}km of driving midpoint...`);

                    // Search all categories in parallel at this radius
                    const results = await Promise.all(
                        categories.map(cat => this.searchPlacesWithRadius(this.midpoint, cat, radius))
                    );

                    // Store results and check if any category found places
                    let foundAtThisRadius = false;
                    categories.forEach((cat, i) => {
                        this.placesByCategory[cat] = results[i];
                        if (results[i].length > 0) {
                            foundAtThisRadius = true;
                        }
                    });

                    if (foundAtThisRadius) {
                        this.searchRadius = radius;
                        foundAnyPlaces = true;
                        break;
                    }
                }
            } catch (routeError) {
                console.log('Driving route failed, falling back to geographic midpoint:', routeError.message);
            }

            // Step 2: If driving route failed or yielded no results, try geographic midpoint
            if (!foundAnyPlaces) {
                this.setLoading(true, 'Calculating geographic midpoint...');
                this.midpoint = this.calculateMidpoint(this.location1, this.location2);
                this.midpointMethod = 'geographic';

                // Search with expanding radius - check ALL categories at each radius
                for (const radius of radii) {
                    this.setLoading(true, `Searching within ${radius / 1000}km of geographic midpoint...`);

                    // Search all categories in parallel at this radius
                    const results = await Promise.all(
                        categories.map(cat => this.searchPlacesWithRadius(this.midpoint, cat, radius))
                    );

                    // Store results and check if any category found places
                    let foundAtThisRadius = false;
                    categories.forEach((cat, i) => {
                        this.placesByCategory[cat] = results[i];
                        if (results[i].length > 0) {
                            foundAtThisRadius = true;
                        }
                    });

                    if (foundAtThisRadius) {
                        this.searchRadius = radius;
                        foundAnyPlaces = true;
                        break;
                    }
                }

                // If still no results, use the largest radius
                if (!foundAnyPlaces) {
                    this.searchRadius = radii[radii.length - 1];
                }
            }

            // Initialize the base map (locations + midpoint)
            this.initResultsMapBase();

            // Add markers only for categories that have results
            this.selectedCategories.forEach(category => {
                const places = this.placesByCategory[category] || [];
                if (places.length > 0) {
                    this.activeCategories.add(category);
                    this.addCategoryMarkers(category);
                }
            });

            // Update toggle UI
            this.updateCategoryToggleUI();

            // Update list view
            this.updateListFromActiveCategories();

            // Update method indicator
            this.updateMethodIndicator();

            // Hide wizard, show results
            document.querySelectorAll('.wizard-step').forEach(s => s.classList.remove('active'));
            document.querySelector('.progress-steps').style.display = 'none';
            document.querySelector('.view-toggle').style.display = 'flex';
            document.querySelector('.results-section').style.display = 'flex';

            // Invalidate map size after container is visible, then fit bounds
            setTimeout(() => {
                this.map.invalidateSize();
                this.fitMapToResults();
            }, 50);

        } catch (error) {
            console.error('Error finding meeting spots:', error);
            this.showError('Unable to find places. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    // Update the method indicator in the results section
    updateMethodIndicator() {
        let indicator = document.getElementById('methodIndicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'methodIndicator';
            indicator.className = 'method-indicator';
            document.querySelector('.category-toggles').insertAdjacentElement('beforebegin', indicator);
        }

        const methodText = this.midpointMethod === 'driving' ? 'driving route' : 'geographic';
        const radiusKm = this.searchRadius / 1000;

        indicator.innerHTML = `
            <span class="method-icon">${this.midpointMethod === 'driving' ? '🚗' : '📍'}</span>
            <span class="method-text">Midpoint calculated via <strong>${methodText}</strong> (${radiusKm}km search radius)</span>
        `;
    }

    // Handle category toggle on results page
    async handleCategoryToggle(event) {
        const btn = event.currentTarget;
        const category = btn.dataset.category;
        const togglesContainer = document.querySelector('.category-toggles');

        // Prevent multiple simultaneous toggles
        if (togglesContainer.classList.contains('loading')) return;

        if (this.activeCategories.has(category)) {
            // Turn OFF - remove markers (instant, no loading needed)
            this.activeCategories.delete(category);
            this.removeCategoryMarkers(category);
            btn.classList.remove('active');
            this.updateListFromActiveCategories();
        } else {
            // Turn ON - need to fetch if not cached
            const needsFetch = !this.placesByCategory[category];

            if (needsFetch) {
                // Show loading state and disable all toggles
                togglesContainer.classList.add('loading');
                btn.classList.add('loading');
            }

            try {
                await this.loadCategory(category);
                this.activeCategories.add(category);
                this.addCategoryMarkers(category);
                btn.classList.add('active');
                this.updateListFromActiveCategories();
            } catch (error) {
                console.error(`Failed to load ${category}:`, error);
            } finally {
                togglesContainer.classList.remove('loading');
                btn.classList.remove('loading');
            }
        }
    }

    // Load places for a category (fetch if not cached)
    async loadCategory(category) {
        if (!this.placesByCategory[category]) {
            const radius = this.searchRadius || 8000;
            const places = await this.searchPlacesWithRadius(this.midpoint, category, radius);
            this.placesByCategory[category] = places;
        }
        return this.placesByCategory[category];
    }

    // Add markers for a category to the map
    addCategoryMarkers(category) {
        const places = this.placesByCategory[category] || [];
        if (!this.markersByCategory[category]) {
            this.markersByCategory[category] = [];
        }

        places.forEach(place => {
            const icon = L.divIcon({
                className: 'place-marker-wrapper',
                html: `<div class="place-marker">${this.getCategoryEmoji(category)}</div>`,
                iconSize: [32, 32], iconAnchor: [16, 16]
            });
            const marker = L.marker([place.lat, place.lon], { icon })
                .addTo(this.map)
                .bindPopup(this.createPopupContent(place, category));
            this.markersByCategory[category].push(marker);
        });
    }

    // Remove markers for a category from the map
    removeCategoryMarkers(category) {
        const markers = this.markersByCategory[category] || [];
        markers.forEach(marker => this.map.removeLayer(marker));
        this.markersByCategory[category] = [];
    }

    // Update category toggle button UI
    updateCategoryToggleUI() {
        document.querySelectorAll('.category-toggle').forEach(btn => {
            const category = btn.dataset.category;
            if (this.activeCategories.has(category)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Initialize base map with location markers and midpoint
    initResultsMapBase() {
        // Clear existing markers
        if (this.markers.midpoint) this.map.removeLayer(this.markers.midpoint);
        if (this.markers.location1) this.map.removeLayer(this.markers.location1);
        if (this.markers.location2) this.map.removeLayer(this.markers.location2);

        // Clear all category markers
        Object.keys(this.markersByCategory).forEach(cat => {
            this.removeCategoryMarkers(cat);
        });

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

    // Get driving route from OSRM and find the midpoint along the route
    async getDrivingMidpoint(loc1, loc2) {
        const url = `https://router.project-osrm.org/route/v1/driving/${loc1.lon},${loc1.lat};${loc2.lon},${loc2.lat}?overview=full&geometries=geojson`;

        const response = await fetch(url);
        if (!response.ok) throw new Error('Routing request failed');

        const data = await response.json();
        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            throw new Error('No route found');
        }

        const route = data.routes[0];
        const coordinates = route.geometry.coordinates; // Array of [lon, lat]
        const totalDistance = route.distance; // in meters
        const halfDistance = totalDistance / 2;

        // Walk along the route to find the midpoint
        let accumulatedDistance = 0;
        for (let i = 0; i < coordinates.length - 1; i++) {
            const [lon1, lat1] = coordinates[i];
            const [lon2, lat2] = coordinates[i + 1];

            const segmentDistance = this.calculateDistance(
                { lat: lat1, lon: lon1 },
                { lat: lat2, lon: lon2 }
            ) * 1000; // Convert to meters

            if (accumulatedDistance + segmentDistance >= halfDistance) {
                // Midpoint is on this segment
                const remaining = halfDistance - accumulatedDistance;
                const ratio = remaining / segmentDistance;

                return {
                    lat: lat1 + (lat2 - lat1) * ratio,
                    lon: lon1 + (lon2 - lon1) * ratio
                };
            }
            accumulatedDistance += segmentDistance;
        }

        // Fallback to last coordinate if something goes wrong
        const lastCoord = coordinates[coordinates.length - 1];
        return { lat: lastCoord[1], lon: lastCoord[0] };
    }

    // Search for places with a specific radius
    async searchPlacesWithRadius(midpoint, category, radius) {
        const config = this.categoryConfig[category] || this.categoryConfig['restaurant'];

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

    // Try to find places with increasing radii
    async searchWithExpandingRadius(midpoint, category, radii = [8000, 12000, 16000, 20000]) {
        for (const radius of radii) {
            const places = await this.searchPlacesWithRadius(midpoint, category, radius);
            if (places.length > 0) {
                return { places, radius };
            }
        }
        return { places: [], radius: radii[radii.length - 1] };
    }

    // Search for places using Overpass API
    async searchPlaces(midpoint, category) {
        const config = this.categoryConfig[category] || this.categoryConfig['restaurant'];
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

    getCategoryEmoji(category) {
        const emojis = {
            'restaurant': '🍽️', 'cafe': '☕', 'bar': '🍺', 'fast_food': '🍔',
            'park': '🌳', 'cinema': '🎬', 'museum': '🏛️', 'shopping': '🛍️',
            'library': '📚', 'gym': '💪', 'hotel': '🏨', 'bowling': '🎳'
        };
        return emojis[category] || '📍';
    }

    createPopupContent(place, category) {
        let content = `<div class="popup-content"><h3>${place.name}</h3>`;
        if (place.cuisine) content += `<div class="cuisine">${place.cuisine.split(';').map(c => c.trim().charAt(0).toUpperCase() + c.trim().slice(1)).join(', ')}</div>`;
        content += `<div class="distance">${place.distanceText} from midpoint</div>`;
        content += `<a href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}" target="_blank" class="directions-link">Get Directions</a></div>`;
        return content;
    }

    // Update list view from all active categories
    updateListFromActiveCategories() {
        const listEl = document.getElementById('resultsList');

        // Combine all places from active categories
        let allPlaces = [];
        this.activeCategories.forEach(category => {
            const places = this.placesByCategory[category] || [];
            places.forEach(place => {
                allPlaces.push({ ...place, category });
            });
        });

        // Sort by distance
        allPlaces.sort((a, b) => a.distance - b.distance);

        document.querySelector('.results-count').textContent = `${allPlaces.length} places found`;

        if (allPlaces.length === 0) {
            listEl.innerHTML = `<div class="no-results"><h3>No places found</h3><p>Toggle on some categories above.</p></div>`;
            return;
        }

        listEl.innerHTML = allPlaces.map(place => `
            <div class="result-card" data-lat="${place.lat}" data-lon="${place.lon}">
                <div class="card-header">
                    <h3><span class="card-emoji">${this.getCategoryEmoji(place.category)}</span> ${place.name}</h3>
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
            // Find and open popup for the matching marker across all categories
            Object.values(this.markersByCategory).forEach(markers => {
                markers.forEach(marker => {
                    const pos = marker.getLatLng();
                    if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lon) < 0.0001) {
                        marker.openPopup();
                    }
                });
            });
        }, 100);
    }

    fitMapToResults() {
        const points = [
            [this.location1.lat, this.location1.lon],
            [this.location2.lat, this.location2.lon],
            [this.midpoint.lat, this.midpoint.lon]
        ];

        // Add points from all active categories
        this.activeCategories.forEach(category => {
            const places = this.placesByCategory[category] || [];
            places.slice(0, 10).forEach(p => points.push([p.lat, p.lon]));
        });

        this.map.fitBounds(L.latLngBounds(points), { padding: [50, 50] });
    }

    setLoading(isLoading, message = 'Finding places...') {
        const btn = document.getElementById('findMiddle');
        const btnText = btn.querySelector('.btn-text');
        const btnLoading = btn.querySelector('.btn-loading');
        const loadingText = btn.querySelector('.loading-text');

        if (isLoading) {
            btn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'flex';
            if (loadingText) {
                loadingText.textContent = message;
            }
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
