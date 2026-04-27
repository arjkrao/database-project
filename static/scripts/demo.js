const map = L.map("map", {
  zoomControl: true
}).setView([39.8283, -98.5795], 4);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const markerLayer = L.layerGroup().addTo(map);
const searchInput = document.querySelector("#search-input");
const categoryFilter = document.querySelector("#category-filter");
const refreshMapButton = document.querySelector("#refresh-map");
const refreshListButton = document.querySelector("#refresh-list");
const locationList = document.querySelector("#location-list");
const resultsTitle = document.querySelector("#results-title");
const locationForm = document.querySelector("#location-form");
const formMessage = document.querySelector("#form-message");
const nameInput = locationForm.elements.namedItem("name");
const latitudeInput = locationForm.elements.namedItem("latitude");
const longitudeInput = locationForm.elements.namedItem("longitude");

let allLocations = [];
let pendingClickLatLng = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}

function setMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.style.color = isError ? "#b42318" : "#115e59";
}

function formatCoordinate(value) {
  return Number(value).toFixed(6);
}

function fillLocationForm(lat, lng) {
  latitudeInput.value = formatCoordinate(lat);
  longitudeInput.value = formatCoordinate(lng);
  locationForm.scrollIntoView({ behavior: "smooth", block: "start" });
  nameInput.focus();
  setMessage(`Selected ${formatCoordinate(lat)}, ${formatCoordinate(lng)} from the map.`);
}

async function createLocation(payload) {
  const response = await fetch("/api/locations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "The location could not be saved.");
  }

  return data.location;
}

function buildClickPopupContent(lat, lng) {
  return `
    <div class="map-popup">
      <p>
        <strong>Selected point</strong><br>
        Latitude: ${formatCoordinate(lat)}<br>
        Longitude: ${formatCoordinate(lng)}
      </p>
      <div class="map-popup-actions">
        <button class="popup-button primary" type="button" data-map-action="quick-create">
          Create here
        </button>
        <button class="popup-button" type="button" data-map-action="prefill-form">
          Use in form
        </button>
      </div>
    </div>
  `;
}

function renderCategoryOptions() {
  const categories = [...new Set(allLocations.map((location) => location.category).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  const currentValue = categoryFilter.value;

  categoryFilter.innerHTML = '<option value="">All categories</option>';

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.append(option);
  }

  categoryFilter.value = categories.includes(currentValue) ? currentValue : "";
}

function getVisibleLocations() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedCategory = categoryFilter.value;

  return allLocations.filter((location) => {
    const matchesQuery =
      !query ||
      location.name.toLowerCase().includes(query) ||
      (location.category || "").toLowerCase().includes(query) ||
      (location.description || "").toLowerCase().includes(query);
    const matchesCategory = !selectedCategory || location.category === selectedCategory;
    return matchesQuery && matchesCategory;
  });
}

function renderMapAndList() {
  const visibleLocations = getVisibleLocations();
  markerLayer.clearLayers();
  locationList.innerHTML = "";
  resultsTitle.textContent = `${visibleLocations.length} marker${
    visibleLocations.length === 1 ? "" : "s"
  }`;

  if (!visibleLocations.length) {
    locationList.innerHTML =
      '<div class="empty-state">No locations match the current filter.</div>';
    map.setView([39.8283, -98.5795], 4);
    return;
  }

  const bounds = [];

  for (const location of visibleLocations) {
    const marker = L.marker([location.latitude, location.longitude]).addTo(markerLayer);
    marker.bindPopup(
      `<strong>${escapeHtml(location.name)}</strong><br>${escapeHtml(
        location.category || "Custom"
      )}<br>${escapeHtml(location.description || "No description provided.")}`
    );

    bounds.push([location.latitude, location.longitude]);

    const card = document.createElement("article");
    card.className = "location-card";
    card.innerHTML = `
      <div class="section-heading">
        <div>
          <h3>${escapeHtml(location.name)}</h3>
          <p>${escapeHtml(location.category || "Custom")}</p>
        </div>
        <button class="button secondary" type="button" data-delete-id="${escapeHtml(
          location.id
        )}">
          Delete
        </button>
      </div>
      <p>${escapeHtml(location.description || "No description provided.")}</p>
      <div class="meta-row">
        <span class="chip">${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}</span>
      </div>
    `;
    locationList.append(card);
  }

  map.fitBounds(bounds, { padding: [40, 40] });
}

async function loadLocations() {
  refreshMapButton.disabled = true;
  refreshListButton.disabled = true;

  try {
    const response = await fetch("/api/locations");
    const data = await response.json();
    allLocations = data.locations || [];
    renderCategoryOptions();
    renderMapAndList();
  } catch (error) {
    locationList.innerHTML =
      '<div class="empty-state">The map data could not be loaded.</div>';
  } finally {
    refreshMapButton.disabled = false;
    refreshListButton.disabled = false;
  }
}

locationForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(locationForm);
  const payload = Object.fromEntries(formData.entries());

  try {
    const location = await createLocation(payload);
    locationForm.reset();
    setMessage(`Saved "${location.name}" to the map dataset.`);
    await loadLocations();
  } catch (error) {
    setMessage(error.message || "The location could not be saved.", true);
  }
});

locationList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-delete-id]");

  if (!button) {
    return;
  }

  try {
    const response = await fetch(`/api/locations/${button.dataset.deleteId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error("Delete failed");
    }

    setMessage("Location removed.");
    await loadLocations();
  } catch (error) {
    setMessage("The location could not be removed.", true);
  }
});

searchInput.addEventListener("input", renderMapAndList);
categoryFilter.addEventListener("change", renderMapAndList);
refreshMapButton.addEventListener("click", loadLocations);
refreshListButton.addEventListener("click", loadLocations);

map.on("click", (event) => {
  pendingClickLatLng = event.latlng;
  L.popup()
    .setLatLng(event.latlng)
    .setContent(buildClickPopupContent(event.latlng.lat, event.latlng.lng))
    .openOn(map);
});

map.getContainer().addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-map-action]");

  if (!actionButton || !pendingClickLatLng) {
    return;
  }

  const { lat, lng } = pendingClickLatLng;

  if (actionButton.dataset.mapAction === "prefill-form") {
    fillLocationForm(lat, lng);
    map.closePopup();
    return;
  }

  if (actionButton.dataset.mapAction === "quick-create") {
    const name = window.prompt(
      `Create a location at ${formatCoordinate(lat)}, ${formatCoordinate(lng)}.\nEnter a name:`
    );

    if (name === null) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setMessage("A name is required to create a location.", true);
      return;
    }

    const category = window.prompt("Category for this marker:", "Custom");
    if (category === null) {
      return;
    }

    const description =
      window.prompt("Description for this marker:", "") ?? "";

    try {
      const location = await createLocation({
        name: trimmedName,
        category: category.trim() || "Custom",
        description: description.trim(),
        latitude: lat,
        longitude: lng
      });
      setMessage(
        `Saved "${location.name}" at ${formatCoordinate(lat)}, ${formatCoordinate(lng)}.`
      );
      map.closePopup();
      await loadLocations();
    } catch (error) {
      setMessage(error.message || "The location could not be saved.", true);
    }
  }
});

loadLocations();
