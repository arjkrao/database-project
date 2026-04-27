(function () {
  function setupBookmarkPopup() {
    const popupId = "addToCollectionsPopup";

    const popup = document.getElementById(popupId);
    const backdrop = document.getElementById(`${popupId}Backdrop`);
    const spotNameEl = document.getElementById(`${popupId}SpotName`);
    const collectionsContainer = document.getElementById(`${popupId}Collections`);
    const saveButton = document.getElementById(`${popupId}SaveButton`);
    const clearButton = document.getElementById(`${popupId}ClearButton`);

    if (!popup || !backdrop || !collectionsContainer || !saveButton || !clearButton) {
      return;
    }

    let currentSpotId = null;
    let originalCheckedCollectionIds = new Set();

    function getCurrentCollections() {
      return Array.from(document.querySelectorAll(".collection-item")).map((item) => ({
        id: item.dataset.collectionId,
        name: item.dataset.collectionName,
      }));
    }

    function renderCollectionCheckboxes(collections, checkedIds) {
      collectionsContainer.innerHTML = "";

      if (collections.length === 0) {
        collectionsContainer.innerHTML = `
          <div class="text text-gray">No collections yet.</div>
        `;
        return;
      }

      collections.forEach((collection) => {
        const label = document.createElement("label");
        label.className = "bookmark-collection";

        label.innerHTML = `
          <input
            type="checkbox"
            class="add-to-collections__input bookmark-collection__input"
            value="${collection.id}"
            data-collection-id="${collection.id}"
            data-collection-name="${collection.name}"
          >
          <span class="bookmark-collection__box"></span>
          <span class="bookmark-collection__label heading-3 text-black">${collection.name}</span>
        `;

        const input = label.querySelector("input");
        input.checked = checkedIds.has(String(collection.id));

        collectionsContainer.appendChild(label);
      });
    }

    async function getCollectionsContainingSpot(spotId, collections) {
      const checkedIds = new Set();

      await Promise.all(
        collections.map(async (collection) => {
          const response = await fetch(`/profile/collection/${collection.id}`);
          const spots = await response.json();

          if (!response.ok) {
            throw new Error("Failed to check collection membership");
          }

          const containsSpot = spots.some((spot) => String(spot.id) === String(spotId));
          if (containsSpot) {
            checkedIds.add(String(collection.id));
          }
        }),
      );

      return checkedIds;
    }

    function openPopup() {
      popup.hidden = false;
      backdrop.hidden = false;

      requestAnimationFrame(() => {
        popup.classList.add("bookmark-popup--open");
        backdrop.classList.add("bookmark-popup-backdrop--open");
      });

      popup.setAttribute("aria-hidden", "false");
    }

    function closePopup() {
      popup.classList.remove("bookmark-popup--open");
      backdrop.classList.remove("bookmark-popup-backdrop--open");
      popup.setAttribute("aria-hidden", "true");

      window.setTimeout(() => {
        popup.hidden = true;
        backdrop.hidden = true;
      }, 220);
    }

    async function showForSpot(spotCard) {
      currentSpotId = spotCard.dataset.spotId;
      const spotName = spotCard.dataset.spotName || "Spot";

      if (!currentSpotId) {
        console.error("Missing data-spot-id on spot card");
        return;
      }

      spotNameEl.textContent = spotName;

      const collections = getCurrentCollections();

      try {
        originalCheckedCollectionIds = await getCollectionsContainingSpot(
          currentSpotId,
          collections,
        );

        renderCollectionCheckboxes(collections, originalCheckedCollectionIds);
        openPopup();
      } catch (err) {
        console.error(err);
      }
    }

    async function postCollectionChange(url, collectionId, locationId) {
      const formData = new FormData();
      formData.append("collection_id", collectionId);
      formData.append("location_id", locationId);

      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${url}`);
      }

      return response.json();
    }

    saveButton.addEventListener("click", async () => {
      if (!currentSpotId) return;

      const inputs = Array.from(
        collectionsContainer.querySelectorAll(".bookmark-collection__input"),
      );

      const currentlyCheckedIds = new Set(
        inputs
          .filter((input) => input.checked)
          .map((input) => String(input.dataset.collectionId)),
      );

      const requests = [];

      currentlyCheckedIds.forEach((collectionId) => {
        if (!originalCheckedCollectionIds.has(collectionId)) {
          requests.push(
            postCollectionChange(
              "/profile/collection/add_spot",
              collectionId,
              currentSpotId,
            ),
          );
        }
      });

      originalCheckedCollectionIds.forEach((collectionId) => {
        if (!currentlyCheckedIds.has(collectionId)) {
          requests.push(
            postCollectionChange(
              "/profile/collection/remove_spot",
              collectionId,
              currentSpotId,
            ),
          );
        }
      });

      try {
        await Promise.all(requests);

        if (window.refreshActiveCollection) {
          await window.refreshActiveCollection();
        }

        closePopup();
      } catch (err) {
        console.error(err);
      }
    });

    clearButton.addEventListener("click", () => {
      collectionsContainer
        .querySelectorAll(".bookmark-collection__input")
        .forEach((input) => {
          input.checked = false;
        });
    });

    backdrop.addEventListener("click", closePopup);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !popup.hidden) {
        closePopup();
      }
    });

    document.addEventListener("click", (event) => {
      const spotCard = event.target.closest(".profile-spot-trigger");
      if (!spotCard) return;

      showForSpot(spotCard);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupBookmarkPopup);
  } else {
    setupBookmarkPopup();
  }
})();