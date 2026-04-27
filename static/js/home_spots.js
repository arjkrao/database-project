(function () {
  const REFRESH_INTERVAL_MS = 10000;

  function setupHomeSpotsRefresh() {
    const spotsList = document.querySelector(".spots-list");
    const searchInput = document.querySelector(".home-left .search-input");
    const dateSortButton = document.getElementById("dateSortButton");
    const dateSortIcon = document.getElementById("dateSortIcon");

    if (!spotsList) {
      return;
    }

    const dateSortStates = [
      {
        direction: null,
        icon: "fa-sort",
        label: "Sort spots by date",
      },
      {
        direction: "desc",
        icon: "fa-sort-down",
        label: "Sort spots by newest first",
      },
      {
        direction: "asc",
        icon: "fa-sort-up",
        label: "Sort spots by oldest first",
      },
    ];
    const initialCardOrderBySpotId = new Map(
      Array.from(spotsList.querySelectorAll(".spot-card")).map(
        (card, index) => [card.dataset.spotId || "", index],
      ),
    );

    let latestSignature = null;
    let latestSpots = [];
    let latestUserRole = window.__userRole || null;
    let refreshInFlight = false;
    let currentDateSortIndex = 0;
    let filtersHaveChangedList = false;

    function getCurrentDateSortState() {
      return dateSortStates[currentDateSortIndex];
    }

    function getLocationId(value) {
      const locationId = Number(value);
      return Number.isFinite(locationId) ? locationId : 0;
    }

    function compareByLocationId(leftId, rightId, direction) {
      const difference = getLocationId(leftId) - getLocationId(rightId);

      if (difference === 0) {
        return 0;
      }

      return direction === "asc" ? difference : -difference;
    }

    function getSpotLocationId(spot) {
      return spot.location_id ?? spot.id;
    }

    function sortSpotsByDateState(spots) {
      const { direction } = getCurrentDateSortState();

      if (!direction) {
        return [...spots];
      }

      return [...spots].sort((left, right) =>
        compareByLocationId(
          getSpotLocationId(left),
          getSpotLocationId(right),
          direction,
        ),
      );
    }

    function sortRenderedCardsByDateState() {
      const { direction } = getCurrentDateSortState();
      const cards = Array.from(spotsList.querySelectorAll(".spot-card"));

      if (!cards.length) {
        return;
      }

      const currentCardOrder = new Map(
        cards.map((card, index) => [card, index]),
      );

      cards.sort((left, right) => {
        if (!direction) {
          const leftOrder =
            initialCardOrderBySpotId.get(left.dataset.spotId || "") ??
            currentCardOrder.get(left) ??
            0;
          const rightOrder =
            initialCardOrderBySpotId.get(right.dataset.spotId || "") ??
            currentCardOrder.get(right) ??
            0;
          return leftOrder - rightOrder;
        }

        const difference = compareByLocationId(
          left.dataset.spotId,
          right.dataset.spotId,
          direction,
        );

        if (difference !== 0) {
          return difference;
        }

        return (
          (currentCardOrder.get(left) ?? 0) - (currentCardOrder.get(right) ?? 0)
        );
      });

      spotsList.replaceChildren(...cards);
    }

    function renderDateSortState() {
      if (!dateSortButton || !dateSortIcon) {
        return;
      }

      const { direction, icon, label } = getCurrentDateSortState();
      dateSortIcon.classList.remove("fa-sort", "fa-sort-down", "fa-sort-up");
      dateSortIcon.classList.add(icon);
      dateSortButton.setAttribute("aria-label", label);
      dateSortButton.setAttribute("aria-pressed", String(Boolean(direction)));
    }

    function applyDateSortState() {
      if (latestSpots.length) {
        renderFilteredSpotList();
      } else {
        sortRenderedCardsByDateState();
      }
    }

    function parseJsonData(rawValue, fallback) {
      if (!rawValue) {
        return fallback;
      }

      try {
        const parsedValue = JSON.parse(rawValue);
        return parsedValue ?? fallback;
      } catch (error) {
        console.error("Failed to parse spot card data:", error);
        return fallback;
      }
    }

    function parseRatingCount(value) {
      const ratingCount = Number(String(value || "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(ratingCount) ? ratingCount : 0;
    }

    function parseRenderedSpots() {
      return Array.from(spotsList.querySelectorAll(".spot-card")).map((card) => {
        const image = card.querySelector(".spot-card-image");

        return {
          id: card.dataset.spotId || "",
          name: card.dataset.spotName || "Spot",
          image: card.dataset.spotImage || image?.getAttribute("src") || "",
          price: card.dataset.spotPrice || "",
          rating: Number(card.dataset.spotRating || 0),
          rating_count: parseRatingCount(card.dataset.spotRatingCount),
          status: card.dataset.spotStatus || "",
          is_owner: card.dataset.spotIsOwner === "true",
          description: card.dataset.spotDescription || "",
          tags: parseJsonData(card.dataset.spotTags, []),
          icons: parseJsonData(card.dataset.spotIcons, []),
          reviews: parseJsonData(card.dataset.spotReviews, []),
        };
      });
    }

    function normalizeText(value) {
      return String(value || "").trim().toLowerCase();
    }

    function getSearchQuery() {
      return normalizeText(searchInput?.value || "");
    }

    function getActiveFilters() {
      if (typeof window.getSpotFilters === "function") {
        return window.getSpotFilters();
      }

      return window.currentSpotFilters || {
        tags: [],
        price: "none",
      };
    }

    function normalizeFilterPrice(priceOption) {
      const normalizedOption = String(priceOption || "").trim();

      if (!normalizedOption || normalizedOption === "none") {
        return "";
      }

      if (normalizedOption === "free") {
        return "FREE";
      }

      if (/^[1-4]$/.test(normalizedOption)) {
        return "$".repeat(Number(normalizedOption));
      }

      return normalizedOption.toUpperCase();
    }

    function getSpotTags(spot) {
      if (Array.isArray(spot.tags) && spot.tags.length) {
        return spot.tags;
      }

      if (!Array.isArray(spot.icons)) {
        return [];
      }

      return spot.icons.map((icon) => icon.tooltip).filter(Boolean);
    }

    function hasActiveFilters(filters = getActiveFilters()) {
      return (
        (Array.isArray(filters.tags) && filters.tags.length > 0) ||
        Boolean(normalizeFilterPrice(filters.price))
      );
    }

    function matchesSearch(spot, query) {
      if (!query) {
        return true;
      }

      const searchableText = [
        spot.name,
        spot.description,
        spot.price,
        spot.status,
        ...getSpotTags(spot),
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    }

    function matchesTags(spot, selectedTags) {
      if (!selectedTags.length) {
        return true;
      }

      const spotTags = getSpotTags(spot).map(normalizeText);
      return selectedTags.some((tag) => spotTags.includes(tag));
    }

    function getFilteredSpots() {
      const filters = getActiveFilters();
      const selectedTags = Array.isArray(filters.tags)
        ? filters.tags.map(normalizeText).filter(Boolean)
        : [];
      const selectedPrice = normalizeFilterPrice(filters.price);
      const query = getSearchQuery();

      return latestSpots.filter((spot) => {
        const priceMatches = selectedPrice
          ? String(spot.price || "").trim().toUpperCase() === selectedPrice
          : true;

        return (
          matchesSearch(spot, query) &&
          matchesTags(spot, selectedTags) &&
          priceMatches
        );
      });
    }

    function renderFilteredSpotList() {
      const filteredSpots = sortSpotsByDateState(getFilteredSpots());
      const emptyMessage = latestSpots.length
        ? "No spots match these filters."
        : "No spots yet.";

      renderSpotList(filteredSpots, emptyMessage);
    }

    function handleFilterOrSearchChange() {
      const shouldRender = hasActiveFilters() || Boolean(getSearchQuery());

      if (!shouldRender && !filtersHaveChangedList) {
        return;
      }

      filtersHaveChangedList = shouldRender;
      renderFilteredSpotList();
    }

    function renderStars(rating) {
      const stars = document.createDocumentFragment();

      for (let i = 1; i <= 5; i += 1) {
        const star = document.createElement("i");
        star.classList.add("icon-star");

        if (rating >= i) {
          star.classList.add("fa-solid", "fa-star");
        } else if (rating >= i - 0.5) {
          star.classList.add("fa-solid", "fa-star-half-stroke");
        } else {
          star.classList.add("fa-regular", "fa-star");
        }

        stars.appendChild(star);
      }

      return stars;
    }

    function createTextElement(tagName, className, textContent) {
      const element = document.createElement(tagName);
      element.className = className;
      element.textContent = textContent;
      return element;
    }

    function createIconButton(icon) {
      const button = document.createElement("button");
      button.className = "icon-button-base";
      button.type = "button";
      button.setAttribute("data-tooltip", icon.tooltip || "Other");
      button.setAttribute("aria-label", icon.tooltip || "Other");

      const iconElement = document.createElement("i");
      String(icon.icon_class || "fa-solid fa-ellipsis")
        .split(" ")
        .filter(Boolean)
        .forEach((className) => {
          iconElement.classList.add(className);
        });

      button.appendChild(iconElement);
      return button;
    }

    function createSpotCard(spot) {
      const name = spot.name || "Spot";
      const rating = Number(spot.rating || 0);
      const displayRating = Number.isFinite(rating) ? rating.toFixed(1) : "0.0";
      const ratingCount = Number(spot.rating_count || 0);
      const tags = Array.isArray(spot.tags) ? spot.tags : [];
      const icons = Array.isArray(spot.icons) ? spot.icons : [];
      const reviews = Array.isArray(spot.reviews) ? spot.reviews : [];

      const card = document.createElement("div");
      card.className = "spot-card spot-card--clickable";
      card.dataset.spotId = String(spot.id ?? "");
      card.dataset.spotName = name;
      card.dataset.spotImage = spot.image || "";
      card.dataset.spotPrice = spot.price || "";
      card.dataset.spotRating = String(rating);
      card.dataset.spotRatingCount = `(${ratingCount})`;
      card.dataset.spotStatus = spot.status || "";
      card.dataset.spotIsOwner = String(Boolean(spot.is_owner));
      card.dataset.spotDescription = spot.description || "";
      card.dataset.spotTags = JSON.stringify(tags);
      card.dataset.spotIcons = JSON.stringify(icons);
      card.dataset.spotReviews = JSON.stringify(reviews);

      const inner = document.createElement("div");
      inner.className = "spot-card-inner";

      const image = document.createElement("img");
      image.className = "spot-card-image";
      image.src = spot.image || "";
      image.alt = name;

      const info = document.createElement("div");
      info.className = "spot-info";

      const top = document.createElement("div");
      top.className = "spot-card-top";

      const title = createTextElement("div", "text", name);

      const bookmarkButton = document.createElement("button");
      bookmarkButton.className = "spot-bookmark";
      bookmarkButton.type = "button";
      bookmarkButton.setAttribute("aria-label", "Toggle bookmark");

      const bookmarkIcon = document.createElement("i");
      bookmarkIcon.className = "fa-regular fa-bookmark icon-bookmark";
      bookmarkButton.appendChild(bookmarkIcon);

      top.append(title, bookmarkButton);

      const middle = document.createElement("div");
      middle.className = "spot-card-middle";

      const ratingSummary = document.createElement("div");
      ratingSummary.className = "spot-rating-summary";
      ratingSummary.appendChild(
        createTextElement("div", "small text-gray", displayRating),
      );

      const stars = document.createElement("div");
      stars.className = "spot-stars";
      stars.appendChild(renderStars(rating));
      ratingSummary.appendChild(stars);
      ratingSummary.appendChild(
        createTextElement("div", "small text-gray", `(${ratingCount})`),
      );

      middle.append(
        ratingSummary,
        createTextElement("div", "small text-secondary-dark", spot.price || ""),
      );

      const bottom = document.createElement("div");
      bottom.className = "spot-card-bottom";

      const iconContainer = document.createElement("div");
      iconContainer.className = "spot-icons";
      icons.forEach((icon) => {
        iconContainer.appendChild(createIconButton(icon));
      });

      bottom.appendChild(iconContainer);

      const isPrivateOrPending = spot.status === 'private' || spot.status === 'pending';
      // Fallback: If latestUserRole is null but document initially had admin class/elements we rely strictly on latestUserRole
      // In first load, JS reads DOM, but we set user role once API fires; though since spot.is_owner works natively this is sufficient for local bounds.
      if (latestUserRole === 'admin' || (Boolean(spot.is_owner) && isPrivateOrPending)) {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "spot-delete";
        deleteBtn.type = "button";
        deleteBtn.setAttribute("aria-label", "Delete spot");
        const deleteIcon = document.createElement("i");
        deleteIcon.className = "fa-solid fa-trash icon-delete";
        deleteBtn.appendChild(deleteIcon);
        bottom.appendChild(deleteBtn);
      }

      info.append(top, middle, bottom);
      inner.append(image, info);
      card.appendChild(inner);

      return card;
    }

    function renderSpotList(spots, emptyMessage = "No spots yet.") {
      const scrollTop = spotsList.scrollTop;

      if (!spots.length) {
        const emptyState = createTextElement(
          "div",
          "text text-gray",
          emptyMessage,
        );
        spotsList.replaceChildren(emptyState);
        return;
      }

      const fragment = document.createDocumentFragment();
      spots.forEach((spot) => {
        fragment.appendChild(createSpotCard(spot));
      });

      spotsList.replaceChildren(fragment);
      spotsList.scrollTop = scrollTop;

      if (window.syncHomeBookmarkButtons) {
        window.syncHomeBookmarkButtons(spotsList);
      }
    }

    function shouldAutoRefresh() {
      return (
        document.visibilityState === "visible" &&
        !document.querySelector(
          ".add-spot-popup--open, .bookmark-popup--open, .filter-popup--open",
        )
      );
    }

    async function reloadSpotsList(options = {}) {
      const { force = false } = options;

      if (refreshInFlight) {
        return;
      }

      refreshInFlight = true;

      try {
        const response = await fetch("/api/home/spots", {
          headers: {
            Accept: "application/json",
          },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Spots could not be loaded.");
        }

        const spots = Array.isArray(data.spots) ? data.spots : [];
        const nextSignature = JSON.stringify(spots);

        if (force || nextSignature !== latestSignature) {
          latestUserRole = data.user_role || null;
          latestSpots = spots;
          renderFilteredSpotList();
          latestSignature = nextSignature;
        }
      } catch (error) {
        console.error("Failed to refresh spots list:", error);
      } finally {
        refreshInFlight = false;
      }
    }

    window.reloadSpotsList = reloadSpotsList;
    window.renderFilteredSpotList = renderFilteredSpotList;

    dateSortButton?.addEventListener("click", () => {
      currentDateSortIndex = (currentDateSortIndex + 1) % dateSortStates.length;
      renderDateSortState();
      applyDateSortState();
    });

    searchInput?.addEventListener("input", handleFilterOrSearchChange);

    document.addEventListener("spotFiltersChange", handleFilterOrSearchChange);

    latestSpots = parseRenderedSpots();
    latestSignature = JSON.stringify(latestSpots);
    renderDateSortState();

    window.setInterval(() => {
      if (shouldAutoRefresh()) {
        reloadSpotsList();
      }
    }, REFRESH_INTERVAL_MS);

    document.addEventListener("visibilitychange", () => {
      if (shouldAutoRefresh()) {
        reloadSpotsList();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupHomeSpotsRefresh);
  } else {
    setupHomeSpotsRefresh();
  }
})();
