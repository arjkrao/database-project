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
      coordinatesInput: "",
      coordinates: null,
      description: "",
      price: "none",
      tags: [],
    };

    function isAddSpotDraftValid() {
      const hasName = addSpotDraft.name.trim().length > 0;
      const hasCoordinates = isValidCoordinates(addSpotDraft.coordinatesInput)
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
      newSpotCoordinatesInput.value = addSpotDraft.coordinatesInput;
      newSpotDescriptionInput.value = addSpotDraft.description;
      renderAddSpotPrice();
      renderAddSpotTags();
      updateCreateSpotButtonState();
    }

    function readAddSpotDraftFromInputs() {
      addSpotDraft.name = newSpotNameInput.value;
      addSpotDraft.coordinatesInput = newSpotCoordinatesInput.value;
      addSpotDraft.description = newSpotDescriptionInput.value;
    }

    function resetAddSpotDraft() {
      addSpotDraft = {
        name: "",
        coordinatesInput: "",
        coordinates: null,
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

    function isValidCoordinates(input) {
      const regex = /^\s*\(?\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)?\s*$/;
      return regex.test(input);
    }

    function parseCoordinates(input) {
      const match = input.match(/-?\d+(\.\d+)?/g);
      if (!match || match.length !== 2) return null;

      return {
        lat: parseFloat(match[0]),
        lon: parseFloat(match[1])
      };
    }

    createSpotButton.addEventListener("click", async () => {
      readAddSpotDraftFromInputs();

      // validate coordinates BEFORE sending
      if (!isValidCoordinates(addSpotDraft.coordinatesInput)) {
        alert("Invalid coordinates format. Use (lat, lon).");
        return;
      }

      const coords = parseCoordinates(addSpotDraft.coordinatesInput);
      if (!coords) {
        alert("Invalid coordinates");
        return;
      }
      addSpotDraft.coordinates = coords;

      const response = await fetch("/home/create_spot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(addSpotDraft)
      });

      const result = await response.json();
      console.log(result);
      closeAddSpotPopup();
    });

    newSpotNameInput.addEventListener("input", () => {
      addSpotDraft.name = newSpotNameInput.value;
      updateCreateSpotButtonState();
    });

    newSpotCoordinatesInput.addEventListener("input", () => {
      addSpotDraft.coordinatesInput = newSpotCoordinatesInput.value;
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
        const tagName = button.dataset.tooltip; // food, drink, etc.

        if (addSpotDraft.tags.includes(tagName)) {
          addSpotDraft.tags = addSpotDraft.tags.filter(
            (t) => t !== tagName,
          );
        } else {
          addSpotDraft.tags.push(tagName);
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
