(function () {
  function setupFiltersPopup() {
    const filtersButton = document.getElementById("filtersButton");
    const filterPopup = document.getElementById("filterPopup");
    const filterBackdrop = document.getElementById("filterBackdrop");
    const filterPopupTab = document.getElementById("filterPopupTab");
    const filterApplyButton = document.querySelector(".filter-apply");
    const filterResetButton = document.querySelector(".filter-reset");
    const filterIcons = Array.from(document.querySelectorAll(".filter-icon"));
    const distanceInput = document.getElementById("distanceInput");
    const priceFree = document.getElementById("priceFree");
    const priceButtons = Array.from(document.querySelectorAll(".price-dollar"));

    if (
      !filtersButton ||
      !filterPopup ||
      !filterBackdrop ||
      !filterPopupTab ||
      !filterApplyButton ||
      !filterResetButton ||
      !distanceInput ||
      !priceFree
    ) {
      return;
    }

    let filterCloseTimeout = null;

    let appliedFilterIconStates = filterIcons.map((button) =>
      button.classList.contains("filter-icon--active"),
    );
    let appliedDistanceValue = "";
    let appliedPriceOption = "none";

    let draftFilterIconStates = [...appliedFilterIconStates];
    let draftDistanceValue = appliedDistanceValue;
    let draftPriceOption = appliedPriceOption;

    function renderFilterIcons() {
      filterIcons.forEach((button, index) => {
        const isActive = draftFilterIconStates[index];
        button.classList.toggle("filter-icon--active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    }

    function renderPriceSelection() {
      const freeSelected = draftPriceOption === "free";

      priceFree.classList.toggle("price-free--active", freeSelected);
      priceFree.setAttribute("aria-pressed", String(freeSelected));

      priceButtons.forEach((button) => {
        const value = button.dataset.price;
        const isActive = draftPriceOption === value;
        button.classList.toggle("price-dollar--active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    }

    function renderDraftFilters() {
      renderFilterIcons();
      distanceInput.value = draftDistanceValue;
      renderPriceSelection();
    }

    function loadAppliedFiltersIntoDraft() {
      draftFilterIconStates = [...appliedFilterIconStates];
      draftDistanceValue = appliedDistanceValue;
      draftPriceOption = appliedPriceOption;
      renderDraftFilters();
    }

    function saveDraftFiltersAsApplied() {
      appliedFilterIconStates = [...draftFilterIconStates];
      appliedDistanceValue = draftDistanceValue;
      appliedPriceOption = draftPriceOption;
    }

    function resetDraftFilters() {
      draftFilterIconStates = filterIcons.map(() => false);
      draftDistanceValue = "";
      draftPriceOption = "none";
      renderDraftFilters();
    }

    function resetAppliedFilters() {
      appliedFilterIconStates = filterIcons.map(() => false);
      appliedDistanceValue = "";
      appliedPriceOption = "none";
    }

    function openFilterPopup() {
      if (filterCloseTimeout) {
        clearTimeout(filterCloseTimeout);
        filterCloseTimeout = null;
      }

      loadAppliedFiltersIntoDraft();

      filterPopup.hidden = false;
      filterBackdrop.hidden = false;

      requestAnimationFrame(() => {
        filterPopup.classList.add("filter-popup--open");
        filterBackdrop.classList.add("filter-popup-backdrop--open");
      });

      filterPopup.setAttribute("aria-hidden", "false");
      filtersButton.setAttribute("aria-expanded", "true");
    }

    function closeFilterPopup() {
      if (!filterPopup.classList.contains("filter-popup--open")) {
        return;
      }

      filterPopup.classList.remove("filter-popup--open");
      filterBackdrop.classList.remove("filter-popup-backdrop--open");
      filterPopup.setAttribute("aria-hidden", "true");
      filtersButton.setAttribute("aria-expanded", "false");

      filterCloseTimeout = window.setTimeout(() => {
        filterPopup.hidden = true;
        filterBackdrop.hidden = true;
        filterCloseTimeout = null;
      }, 220);
    }

    function toggleFilterPopup() {
      const isOpen = filterPopup.classList.contains("filter-popup--open");

      if (isOpen) {
        closeFilterPopup();
      } else {
        openFilterPopup();
      }
    }

    filtersButton.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleFilterPopup();
    });

    filterPopupTab.addEventListener("click", (event) => {
      event.stopPropagation();
      closeFilterPopup();
    });

    filterApplyButton.addEventListener("click", () => {
      saveDraftFiltersAsApplied();
      closeFilterPopup();
    });

    filterResetButton.addEventListener("click", () => {
      resetDraftFilters();
      saveDraftFiltersAsApplied();
    });

    filterPopupTab.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        closeFilterPopup();
      }
    });

    filterBackdrop.addEventListener("click", closeFilterPopup);

    filterPopup.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    filterIcons.forEach((button, index) => {
      button.addEventListener("click", () => {
        draftFilterIconStates[index] = !draftFilterIconStates[index];
        renderFilterIcons();
      });
    });

    distanceInput.addEventListener("input", () => {
      draftDistanceValue = distanceInput.value;
    });

    priceFree.addEventListener("click", () => {
      draftPriceOption = draftPriceOption === "free" ? "none" : "free";
      renderPriceSelection();
    });

    priceButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.price;
        draftPriceOption = draftPriceOption === value ? "none" : value;
        renderPriceSelection();
      });
    });

    renderDraftFilters();
    resetAppliedFilters();

    window.closeFilterPopup = closeFilterPopup;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupFiltersPopup);
  } else {
    setupFiltersPopup();
  }
})();