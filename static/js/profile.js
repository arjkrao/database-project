(function () {
  function setupProfilePage() {
    const editAvatarButton = document.getElementById("editAvatarButton");
    const avatarFileInput = document.getElementById("avatarFileInput");
    const avatarImage = document.getElementById("avatarImage");
    const tabButtons = document.querySelectorAll(".profile-options .button");
    const tabContents = document.querySelectorAll(".profile-tab-content");
    const createCollectionButton = document.getElementById("createCollectionButton");
    const newCollectionInput = document.getElementById("newCollectionInput");
    const collectionOptions = document.querySelectorAll(".collection-option");

    const addToCollectionsBackdrop = document.getElementById("addToCollectionsBackdrop");
    const addToCollectionsPopup = document.getElementById("addToCollectionsPopup");
    const addToCollectionsSpotName = document.getElementById("addToCollectionsSpotName");
    const addToCollectionsSaveButton = document.getElementById("addToCollectionsSaveButton");
    const addToCollectionsCloseButton = document.getElementById("addToCollectionsCloseButton");
    const addToCollectionsInputs = Array.from(
      document.querySelectorAll(".add-to-collections__input"),
    );

    const reviewLikeButtons = document.querySelectorAll(".review-card-like");
    const profileSpotButtons = document.querySelectorAll(".profile-spot-trigger");

    function setActiveTab(activeButton) {
      tabButtons.forEach((button) => {
        button.classList.remove("button--medium-gray");

        if (button !== activeButton) {
          button.classList.add("button--medium-gray");
        }
      });
    }

    function showTab(tabName) {
      tabContents.forEach((content) => {
        const isActive = content.dataset.content === tabName;
        content.hidden = !isActive;
        content.classList.toggle("profile-tab-content--active", isActive);
      });
    }

    function setActiveCollection(activeButton) {
      collectionOptions.forEach((button) => {
        button.classList.remove("collection-option--active");
      });

      activeButton.classList.add("collection-option--active");
    }

    function openAddToCollectionsPopup(spotName) {
      if (!addToCollectionsPopup || !addToCollectionsBackdrop) {
        return;
      }

      addToCollectionsSpotName.textContent = spotName;
      addToCollectionsPopup.hidden = false;
      addToCollectionsBackdrop.hidden = false;

      requestAnimationFrame(() => {
        addToCollectionsPopup.classList.add("bookmark-popup--open");
        addToCollectionsBackdrop.classList.add("bookmark-popup-backdrop--open");
      });

      addToCollectionsPopup.setAttribute("aria-hidden", "false");
    }

    function closeAddToCollectionsPopup() {
      if (!addToCollectionsPopup || !addToCollectionsBackdrop) {
        return;
      }

      if (!addToCollectionsPopup.classList.contains("bookmark-popup--open")) {
        return;
      }

      addToCollectionsPopup.classList.remove("bookmark-popup--open");
      addToCollectionsBackdrop.classList.remove("bookmark-popup-backdrop--open");
      addToCollectionsPopup.setAttribute("aria-hidden", "true");

      window.setTimeout(() => {
        addToCollectionsPopup.hidden = true;
        addToCollectionsBackdrop.hidden = true;
      }, 220);
    }

    if (editAvatarButton && avatarFileInput && avatarImage) {
      editAvatarButton.addEventListener("click", () => {
        avatarFileInput.click();
      });

      avatarFileInput.addEventListener("change", (event) => {
        const [selectedFile] = event.target.files;

        if (!selectedFile) {
          return;
        }

        const reader = new FileReader();

        reader.addEventListener("load", () => {
          avatarImage.src = reader.result;
        });

        reader.readAsDataURL(selectedFile);
      });
    }

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        setActiveTab(button);
        showTab(button.dataset.tab);

        window.scrollTo(scrollX, scrollY);
      });
    });

    collectionOptions.forEach((button) => {
      button.addEventListener("click", () => {
        setActiveCollection(button);
      });
    });

    reviewLikeButtons.forEach((button) => {
      const icon = button.querySelector(".fa-thumbs-up");

      button.addEventListener("click", () => {
        icon.classList.toggle("fa-regular");
        icon.classList.toggle("fa-solid");
      });
    });

    function createCollection() {
      if (!newCollectionInput) {
        return;
      }

      const newCollectionName = newCollectionInput.value.trim();

      if (!newCollectionName) {
        return;
      }

      newCollectionInput.value = "";
    }

    if (createCollectionButton) {
      createCollectionButton.addEventListener("click", createCollection);
    }

    if (newCollectionInput) {
      newCollectionInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          createCollection();
        }
      });
    }

    profileSpotButtons.forEach((button) => {
      const open = () => {
        openAddToCollectionsPopup(button.dataset.spotName || "Spot");
      };

      button.addEventListener("click", open);

      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open();
        }
      });
    });

    if (addToCollectionsBackdrop) {
      addToCollectionsBackdrop.addEventListener("click", closeAddToCollectionsPopup);
    }

    if (addToCollectionsPopup) {
      addToCollectionsPopup.addEventListener("click", (event) => {
        event.stopPropagation();
      });
    }

    if (addToCollectionsSaveButton) {
      addToCollectionsSaveButton.addEventListener("click", () => {
        closeAddToCollectionsPopup();
      });
    }

    if (addToCollectionsCloseButton) {
      addToCollectionsCloseButton.addEventListener("click", () => {
        closeAddToCollectionsPopup();
      });
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAddToCollectionsPopup();
      }
    });

    window.closeAddToCollectionsPopup = closeAddToCollectionsPopup;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupProfilePage);
  } else {
    setupProfilePage();
  }
})();