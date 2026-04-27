(function () {
  const REFRESH_INTERVAL_MS = 10000;

  function setupHomeSpotsRefresh() {
    const spotsList = document.querySelector(".spots-list");

    if (!spotsList) {
      return;
    }

    let latestSignature = null;
    let refreshInFlight = false;

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

      info.append(top, middle, bottom);
      inner.append(image, info);
      card.appendChild(inner);

      return card;
    }

    function renderSpotList(spots) {
      const scrollTop = spotsList.scrollTop;

      if (!spots.length) {
        const emptyState = createTextElement(
          "div",
          "text text-gray",
          "No spots yet.",
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
          renderSpotList(spots);
          latestSignature = nextSignature;
        }
      } catch (error) {
        console.error("Failed to refresh spots list:", error);
      } finally {
        refreshInFlight = false;
      }
    }

    window.reloadSpotsList = reloadSpotsList;

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
