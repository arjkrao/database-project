(function () {
  const mapElement = document.getElementById("spotsMap");
  const searchForm = document.querySelector(".home-left .search");
  const searchInput = document.querySelector(".home-left .search-input");

  if (!mapElement || !window.L) {
    return;
  }

  const defaultCenter = [38.0356, -78.5034];
  const defaultZoom = 14;
  const map = L.map(mapElement, {
    zoomControl: true,
  }).setView(defaultCenter, defaultZoom);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    subdomains: "abcd",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  }).addTo(map);

  const markerLayer = L.layerGroup().addTo(map);
  let allSpots = [];
  let markersBySpotId = new Map();
  let placementMode = false;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  }

  function getVisibleSpots() {
    const query = (searchInput?.value || "").trim().toLowerCase();

    if (!query) {
      return allSpots;
    }

    return allSpots.filter((spot) => {
      const tags = Array.isArray(spot.tags) ? spot.tags.join(" ") : "";
      return `${spot.name} ${spot.description} ${spot.price} ${tags}`
        .toLowerCase()
        .includes(query);
    });
  }

  function createPopupMarkup(spot) {
    const tags = Array.isArray(spot.tags) && spot.tags.length
      ? spot.tags.map(escapeHtml).join(", ")
      : "No tags";

    return `
      <div class="spots-map-popup">
        <strong>${escapeHtml(spot.name)}</strong>
        <div>${escapeHtml(spot.price || "No price")}</div>
        <p>${escapeHtml(spot.description || "No description provided.")}</p>
        <small>${tags}</small>
      </div>
    `;
  }

  function renderSpots(options = {}) {
    const { focusSpotId = null, fitBounds = true } = options;
    const visibleSpots = getVisibleSpots();
    const bounds = [];

    markerLayer.clearLayers();
    markersBySpotId = new Map();

    visibleSpots.forEach((spot) => {
      const latitude = Number(spot.latitude);
      const longitude = Number(spot.longitude);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }

      const marker = L.marker([latitude, longitude]).addTo(markerLayer);
      marker.bindPopup(createPopupMarkup(spot));
      markersBySpotId.set(String(spot.id), marker);
      bounds.push([latitude, longitude]);
    });

    if (!bounds.length) {
      map.setView(defaultCenter, defaultZoom);
      return;
    }

    if (focusSpotId !== null) {
      const focusedMarker = markersBySpotId.get(String(focusSpotId));
      if (focusedMarker) {
        map.setView(focusedMarker.getLatLng(), 16);
        focusedMarker.openPopup();
        return;
      }
    }

    if (!fitBounds) {
      return;
    }

    if (bounds.length === 1) {
      map.setView(bounds[0], 16);
    } else {
      map.fitBounds(bounds, { padding: [48, 48] });
    }
  }

  async function reloadSpotsMap(options = {}) {
    const response = await fetch("/api/spots", {
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Spots could not be loaded.");
    }

    allSpots = Array.isArray(data.spots) ? data.spots : [];
    renderSpots(options);
  }

  function addSpotToMap(spot) {
    if (!spot) {
      return reloadSpotsMap();
    }

    allSpots = allSpots.filter((existingSpot) => String(existingSpot.id) !== String(spot.id));
    allSpots.push(spot);
    renderSpots({ focusSpotId: spot.id });
  }

  function beginSpotPlacement() {
    placementMode = true;
    mapElement.classList.add("spots-map--placing");
    mapElement.focus({ preventScroll: true });
  }

  function endSpotPlacement() {
    placementMode = false;
    mapElement.classList.remove("spots-map--placing");
  }

  searchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
  });

  searchInput?.addEventListener("input", () => {
    renderSpots({ fitBounds: false });
  });

  map.on("click", (event) => {
    endSpotPlacement();

    if (window.openAddSpotPopupAtCoordinates) {
      window.openAddSpotPopupAtCoordinates(event.latlng.lat, event.latlng.lng);
    }
  });

  map.on("mouseout", () => {
    if (!placementMode) {
      mapElement.classList.remove("spots-map--placing");
    }
  });

  window.reloadSpotsMap = reloadSpotsMap;
  window.addSpotToMap = addSpotToMap;
  window.beginSpotPlacement = beginSpotPlacement;

  window.setTimeout(() => {
    map.invalidateSize();
    reloadSpotsMap().catch((error) => {
      console.error("Failed to load spots map:", error);
    });
  }, 0);
})();
