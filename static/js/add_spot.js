(function () {
  function setupAddSpotPopup() {
    const addSpotButton = document.getElementById("addSpotButton");
    const addSpotPopup = document.getElementById("addSpotPopup");
    const addSpotBackdrop = document.getElementById("addSpotBackdrop");
    const createSpotButton = document.getElementById("createSpotButton");

    const newSpotNameInput = document.getElementById("newSpotName");
    const newSpotCoordinatesInput =
      document.getElementById("newSpotCoordinates");
    const newSpotDescriptionInput =
      document.getElementById("newSpotDescription");

    const addSpotPriceFree = document.getElementById("addSpotPriceFree");
    const addSpotPriceButtons = Array.from(
      document.querySelectorAll("#addSpotPopup .add-spot-price-dollar"),
    );
    const addSpotTagButtons = Array.from(
      document.querySelectorAll(".add-spot-tag"),
    );

    if (
      !addSpotButton ||
      !addSpotPopup ||
      !addSpotBackdrop ||
      !createSpotButton ||
      !newSpotNameInput ||
      !newSpotCoordinatesInput ||
      !newSpotDescriptionInput ||
      !addSpotPriceFree
    ) {
      return;
    }

    let addSpotCloseTimeout = null;

    let addSpotDraft = {
      name: "",
      coordinates: "",
      description: "",
      price: "none",
      tags: [],
    };

    function isAddSpotDraftValid() {
      const hasName = addSpotDraft.name.trim().length > 0;
      const hasCoordinates = addSpotDraft.coordinates.trim().length > 0;
      const hasDescription = addSpotDraft.description.trim().length > 0;
      const hasPrice = addSpotDraft.price !== "none";
      const hasAtLeastOneTag = addSpotDraft.tags.length > 0;

      return (
        hasName &&
        hasCoordinates &&
        hasDescription &&
        hasPrice &&
        hasAtLeastOneTag
      );
    }

    function updateCreateSpotButtonState() {
      createSpotButton.disabled = !isAddSpotDraftValid();
    }

    function renderAddSpotPrice() {
      const freeSelected = addSpotDraft.price === "free";

      addSpotPriceFree.classList.toggle(
        "add-spot-price-free--active",
        freeSelected,
      );
      addSpotPriceFree.setAttribute("aria-pressed", String(freeSelected));

      addSpotPriceButtons.forEach((button) => {
        const value = button.dataset.addSpotPrice;
        const isActive = addSpotDraft.price === value;

        button.classList.toggle("add-spot-price-dollar--active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    }

    function renderAddSpotTags() {
      addSpotTagButtons.forEach((button, index) => {
        const isActive = addSpotDraft.tags.includes(index);

        button.classList.toggle("filter-icon--active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
      });
    }

    function renderAddSpotDraft() {
      newSpotNameInput.value = addSpotDraft.name;
      newSpotCoordinatesInput.value = addSpotDraft.coordinates;
      newSpotDescriptionInput.value = addSpotDraft.description;
      renderAddSpotPrice();
      renderAddSpotTags();
      updateCreateSpotButtonState();
    }

    function readAddSpotDraftFromInputs() {
      addSpotDraft.name = newSpotNameInput.value;
      addSpotDraft.coordinates = newSpotCoordinatesInput.value;
      addSpotDraft.description = newSpotDescriptionInput.value;
    }

    function resetAddSpotDraft() {
      addSpotDraft = {
        name: "",
        coordinates: "",
        description: "",
        price: "none",
        tags: [],
      };

      addSpotTagButtons.forEach((button) => {
        button.classList.remove("filter-icon--active");
        button.setAttribute("aria-pressed", "false");
      });

      renderAddSpotDraft();
    }

    function openAddSpotPopup() {
      if (addSpotCloseTimeout) {
        clearTimeout(addSpotCloseTimeout);
        addSpotCloseTimeout = null;
      }

      renderAddSpotDraft();

      addSpotPopup.hidden = false;
      addSpotBackdrop.hidden = false;

      requestAnimationFrame(() => {
        addSpotPopup.classList.add("add-spot-popup--open");
        addSpotBackdrop.classList.add("add-spot-backdrop--open");
      });

      addSpotPopup.setAttribute("aria-hidden", "false");
    }

    function closeAddSpotPopup(options = {}) {
      const { clearAfterClose = false, saveBeforeClose = false } = options;

      if (!addSpotPopup.classList.contains("add-spot-popup--open")) {
        return;
      }

      if (saveBeforeClose) {
        readAddSpotDraftFromInputs();
      }

      addSpotPopup.classList.remove("add-spot-popup--open");
      addSpotBackdrop.classList.remove("add-spot-backdrop--open");
      addSpotPopup.setAttribute("aria-hidden", "true");

      addSpotCloseTimeout = window.setTimeout(() => {
        addSpotPopup.hidden = true;
        addSpotBackdrop.hidden = true;
        addSpotCloseTimeout = null;

        if (clearAfterClose) {
          resetAddSpotDraft();
        }
      }, 220);
    }

    addSpotButton.addEventListener("click", () => {
      openAddSpotPopup();
    });

    addSpotBackdrop.addEventListener("click", () => {
      closeAddSpotPopup({ saveBeforeClose: true });
    });

    addSpotPopup.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    createSpotButton.addEventListener("click", () => {
      closeAddSpotPopup({ clearAfterClose: true, saveBeforeClose: false });
    });

    newSpotNameInput.addEventListener("input", () => {
      addSpotDraft.name = newSpotNameInput.value;
      updateCreateSpotButtonState();
    });

    newSpotCoordinatesInput.addEventListener("input", () => {
      addSpotDraft.coordinates = newSpotCoordinatesInput.value;
      updateCreateSpotButtonState();
    });

    newSpotDescriptionInput.addEventListener("input", () => {
      addSpotDraft.description = newSpotDescriptionInput.value;
      updateCreateSpotButtonState();
    });

    addSpotPriceFree.addEventListener("click", () => {
      addSpotDraft.price = addSpotDraft.price === "free" ? "none" : "free";
      renderAddSpotPrice();
      updateCreateSpotButtonState();
    });

    addSpotPriceButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const value = button.dataset.addSpotPrice;
        addSpotDraft.price = addSpotDraft.price === value ? "none" : value;
        renderAddSpotPrice();
        updateCreateSpotButtonState();
      });
    });

    addSpotTagButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        if (addSpotDraft.tags.includes(index)) {
          addSpotDraft.tags = addSpotDraft.tags.filter(
            (tagIndex) => tagIndex !== index,
          );
        } else {
          addSpotDraft.tags.push(index);
        }

        renderAddSpotTags();
        updateCreateSpotButtonState();
      });
    });

    updateCreateSpotButtonState();

    window.closeAddSpotPopup = closeAddSpotPopup;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupAddSpotPopup);
  } else {
    setupAddSpotPopup();
  }
})();
