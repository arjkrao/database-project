(function () {
  function setupHomeBookmarkPopup() {
    const bookmarkPopup = document.getElementById("bookmarkPopup");
    const bookmarkPopupBackdrop = document.getElementById(
      "bookmarkPopupBackdrop",
    );
    const bookmarkSpotName = document.getElementById("bookmarkPopupSpotName");
    const bookmarkSaveButton = document.getElementById(
      "bookmarkPopupSaveButton",
    );
    const bookmarkClearButton = document.getElementById(
      "bookmarkPopupClearButton",
    );
    const bookmarkCollectionInputs = Array.from(
      document.querySelectorAll(".bookmark-collection__input-home"),
    );

    if (
      !bookmarkPopup ||
      !bookmarkPopupBackdrop ||
      !bookmarkSpotName ||
      !bookmarkSaveButton ||
      !bookmarkClearButton ||
      bookmarkCollectionInputs.length === 0
    ) {
      return;
    }

    let activeBookmarkIcon = null;
    let activeBookmarkButton = null;
    const savedCollectionsBySpotId = new Map();

    function getSpotId(button) {
      const spotCard = button.closest(".spot-card");
      return spotCard?.dataset.spotId || spotCard?.dataset.spotName || "";
    }

    function readSavedCollections(button) {
      const raw = button.dataset.savedCollections;

      if (!raw) {
        return [];
      }

      try {
        const collections = JSON.parse(raw);
        return Array.isArray(collections) ? collections : [];
      } catch (error) {
        console.error("Failed to parse saved bookmark collections:", error);
        return [];
      }
    }

    function getSavedCollections(button) {
      const spotId = getSpotId(button);

      if (spotId && savedCollectionsBySpotId.has(spotId)) {
        return [...savedCollectionsBySpotId.get(spotId)];
      }

      const collections = readSavedCollections(button);

      if (spotId) {
        savedCollectionsBySpotId.set(spotId, collections);
      }

      return collections;
    }

    function setSavedCollections(button, collections) {
      const nextCollections = [...collections];
      const spotId = getSpotId(button);

      button.dataset.savedCollections = JSON.stringify(nextCollections);

      if (spotId) {
        savedCollectionsBySpotId.set(spotId, nextCollections);
      }
    }

    function getCurrentCollectionLabels() {
      return bookmarkCollectionInputs
        .filter((input) => input.checked)
        .map((input) => input.value);
    }

    function applyCollectionsToPopup(savedCollections) {
      bookmarkCollectionInputs.forEach((input) => {
        input.checked = savedCollections.includes(input.value);
      });
    }

    function setBookmarkIconState(icon, isSaved) {
      if (!icon) {
        return;
      }

      icon.classList.toggle("fa-solid", isSaved);
      icon.classList.toggle("fa-regular", !isSaved);
    }

    function syncBookmarkButton(button) {
      const icon = button.querySelector(".fa-bookmark");
      const savedCollections = getSavedCollections(button);

      setSavedCollections(button, savedCollections);
      setBookmarkIconState(icon, savedCollections.length > 0);
    }

    function syncHomeBookmarkButtons(root = document) {
      root.querySelectorAll(".spot-bookmark").forEach(syncBookmarkButton);
    }

    function openBookmarkPopup(spotName, button, icon) {
      bookmarkSpotName.textContent = spotName;
      activeBookmarkButton = button;
      activeBookmarkIcon = icon;

      const savedCollections = getSavedCollections(button);
      applyCollectionsToPopup(savedCollections);

      bookmarkPopup.hidden = false;
      bookmarkPopupBackdrop.hidden = false;

      requestAnimationFrame(() => {
        bookmarkPopup.classList.add("bookmark-popup--open");
        bookmarkPopupBackdrop.classList.add("bookmark-popup-backdrop--open");
      });

      bookmarkPopup.setAttribute("aria-hidden", "false");
    }

    function closeBookmarkPopup() {
      if (!bookmarkPopup.classList.contains("bookmark-popup--open")) {
        return;
      }

      bookmarkPopup.classList.remove("bookmark-popup--open");
      bookmarkPopupBackdrop.classList.remove("bookmark-popup-backdrop--open");
      bookmarkPopup.setAttribute("aria-hidden", "true");

      window.setTimeout(() => {
        bookmarkPopup.hidden = true;
        bookmarkPopupBackdrop.hidden = true;
        activeBookmarkIcon = null;
        activeBookmarkButton = null;
      }, 220);
    }

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Element)) {
        return;
      }

      const button = event.target.closest(".spot-bookmark");
      const spotsPanel = document.getElementById("spotsPanel");

      if (!button || !spotsPanel?.contains(button)) {
        return;
      }

      event.stopPropagation();

      const icon = button.querySelector(".fa-bookmark");
      const spotCard = button.closest(".spot-card");
      const spotName = spotCard?.dataset.spotName || "Spot";

      syncBookmarkButton(button);
      openBookmarkPopup(spotName, button, icon);
    });

    bookmarkPopupBackdrop.addEventListener("click", closeBookmarkPopup);

    bookmarkPopup.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    bookmarkSaveButton.addEventListener("click", () => {
      if (!activeBookmarkButton) {
        return;
      }

      const selectedCollections = getCurrentCollectionLabels();
      setSavedCollections(activeBookmarkButton, selectedCollections);
      setBookmarkIconState(activeBookmarkIcon, selectedCollections.length > 0);
      closeBookmarkPopup();
    });

    bookmarkClearButton.addEventListener("click", () => {
      bookmarkCollectionInputs.forEach((input) => {
        input.checked = false;
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeBookmarkPopup();
      }
    });

    window.closeBookmarkPopup = closeBookmarkPopup;
    window.syncHomeBookmarkButtons = syncHomeBookmarkButtons;
    syncHomeBookmarkButtons();
  }

  function setupProfileBookmarkPopup() {
    const addToCollectionsPopup = document.getElementById(
      "addToCollectionsPopup",
    );
    const addToCollectionsBackdrop = document.getElementById(
      "addToCollectionsPopupBackdrop",
    );
    const addToCollectionsSpotName = document.getElementById(
      "addToCollectionsPopupSpotName",
    );
    const addToCollectionsSaveButton = document.getElementById(
      "addToCollectionsPopupSaveButton",
    );
    const addToCollectionsClearButton = document.getElementById(
      "addToCollectionsPopupClearButton",
    );
    const addToCollectionsInputs = Array.from(
      document.querySelectorAll(".add-to-collections__input"),
    );

    if (
      !addToCollectionsPopup ||
      !addToCollectionsBackdrop ||
      !addToCollectionsSpotName ||
      !addToCollectionsSaveButton ||
      !addToCollectionsClearButton ||
      addToCollectionsInputs.length === 0
    ) {
      return;
    }

    let activeProfileSpotButton = null;

    function getSavedCollections(button) {
      const raw = button.dataset.savedCollections;
      return raw ? JSON.parse(raw) : [];
    }

    function setSavedCollections(button, collections) {
      button.dataset.savedCollections = JSON.stringify(collections);
    }

    function getCurrentCollectionLabels() {
      return addToCollectionsInputs
        .filter((input) => input.checked)
        .map((input) => input.value);
    }

    function applyCollectionsToPopup(savedCollections) {
      addToCollectionsInputs.forEach((input) => {
        input.checked = savedCollections.includes(input.value);
      });
    }

    function openAddToCollectionsPopup(spotName, button) {
      activeProfileSpotButton = button;
      addToCollectionsSpotName.textContent = spotName;

      const savedCollections = getSavedCollections(button);
      applyCollectionsToPopup(savedCollections);

      addToCollectionsPopup.hidden = false;
      addToCollectionsBackdrop.hidden = false;

      requestAnimationFrame(() => {
        addToCollectionsPopup.classList.add("bookmark-popup--open");
        addToCollectionsBackdrop.classList.add("bookmark-popup-backdrop--open");
      });

      addToCollectionsPopup.setAttribute("aria-hidden", "false");
    }

    function closeAddToCollectionsPopup() {
      if (!addToCollectionsPopup.classList.contains("bookmark-popup--open")) {
        return;
      }

      addToCollectionsPopup.classList.remove("bookmark-popup--open");
      addToCollectionsBackdrop.classList.remove(
        "bookmark-popup-backdrop--open",
      );
      addToCollectionsPopup.setAttribute("aria-hidden", "true");

      window.setTimeout(() => {
        addToCollectionsPopup.hidden = true;
        addToCollectionsBackdrop.hidden = true;
        activeProfileSpotButton = null;
      }, 220);
    }

    document.querySelectorAll(".profile-spot-trigger").forEach((button) => {
      setSavedCollections(button, getSavedCollections(button));

      const open = () => {
        openAddToCollectionsPopup(button.dataset.spotName || "Spot", button);
      };

      button.addEventListener("click", open);

      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });

    addToCollectionsBackdrop.addEventListener(
      "click",
      closeAddToCollectionsPopup,
    );

    addToCollectionsPopup.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    addToCollectionsSaveButton.addEventListener("click", () => {
      if (!activeProfileSpotButton) {
        return;
      }

      const selectedCollections = getCurrentCollectionLabels();
      setSavedCollections(activeProfileSpotButton, selectedCollections);
      closeAddToCollectionsPopup();
    });

    addToCollectionsClearButton.addEventListener("click", () => {
      addToCollectionsInputs.forEach((input) => {
        input.checked = false;
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAddToCollectionsPopup();
      }
    });

    window.closeAddToCollectionsPopup = closeAddToCollectionsPopup;
  }

  function initBookmarkPopups() {
    setupHomeBookmarkPopup();
    setupProfileBookmarkPopup();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBookmarkPopups);
  } else {
    initBookmarkPopups();
  }
})();
