(function () {
  const FILTERS_CHANGE_EVENT = "spotFiltersChange";

  function setupFiltersPopup() {
    const filtersButton = document.getElementById("filtersButton");
    const filterPopup = document.getElementById("filterPopup");
    const filterBackdrop = document.getElementById("filterBackdrop");
    const filterPopupTab = document.getElementById("filterPopupTab");
    const filterApplyButton = filterPopup?.querySelector(".filter-apply");
    const filterResetButton = filterPopup?.querySelector(".filter-reset");
    const filterIcons = Array.from(
      filterPopup?.querySelectorAll(".filter-icon") || [],
    );
    const priceFree = document.getElementById("priceFree");
    const priceButtons = Array.from(
      filterPopup?.querySelectorAll(".price-dollar") || [],
    );

    if (
      !filtersButton ||
      !filterPopup ||
      !filterBackdrop ||
      !filterPopupTab ||
      !filterApplyButton ||
      !filterResetButton ||
      !priceFree
    ) {
      return;
    }

    let filterCloseTimeout = null;

    let appliedFilterIconStates = filterIcons.map((button) =>
      button.classList.contains("filter-icon--active"),
    );
    let appliedPriceOption = "none";

    let draftFilterIconStates = [...appliedFilterIconStates];
    let draftPriceOption = appliedPriceOption;

    function createFilterState(iconStates, priceOption) {
      return {
        tags: filterIcons
          .filter((_, index) => iconStates[index])
          .map((button) => button.dataset.tooltip)
          .filter(Boolean),
        price: priceOption,
      };
    }

    function getAppliedFilters() {
      return createFilterState(appliedFilterIconStates, appliedPriceOption);
    }

    function publishAppliedFilters() {
      const filters = getAppliedFilters();
      window.currentSpotFilters = filters;

      document.dispatchEvent(
        new CustomEvent(FILTERS_CHANGE_EVENT, {
          detail: filters,
        }),
      );
    }

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
      renderPriceSelection();
    }

    function loadAppliedFiltersIntoDraft() {
      draftFilterIconStates = [...appliedFilterIconStates];
      draftPriceOption = appliedPriceOption;
      renderDraftFilters();
    }

    function saveDraftFiltersAsApplied(options = {}) {
      const { publish = true } = options;

      appliedFilterIconStates = [...draftFilterIconStates];
      appliedPriceOption = draftPriceOption;

      if (publish) {
        publishAppliedFilters();
      }
    }

    function resetDraftFilters() {
      draftFilterIconStates = filterIcons.map(() => false);
      draftPriceOption = "none";
      renderDraftFilters();
    }

    function resetAppliedFilters(options = {}) {
      const { publish = true } = options;

      appliedFilterIconStates = filterIcons.map(() => false);
      appliedPriceOption = "none";

      if (publish) {
        publishAppliedFilters();
      }
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
        saveDraftFiltersAsApplied();
      });
    });

    priceFree.addEventListener("click", () => {
      draftPriceOption = draftPriceOption === "free" ? "none" : "free";
      renderPriceSelection();
      saveDraftFiltersAsApplied();
    });

    priceButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.price;
        draftPriceOption = draftPriceOption === value ? "none" : value;
        renderPriceSelection();
        saveDraftFiltersAsApplied();
      });
    });

    resetAppliedFilters({ publish: false });
    loadAppliedFiltersIntoDraft();

    window.closeFilterPopup = closeFilterPopup;
    window.getSpotFilters = getAppliedFilters;
    publishAppliedFilters();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupFiltersPopup);
  } else {
    setupFiltersPopup();
  }
})();
