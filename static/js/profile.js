(function () {
  function setupProfilePage() {
    let activeCollectionId = null;
    const editAvatarButton = document.getElementById("editAvatarButton");
    const avatarFileInput = document.getElementById("avatarFileInput");
    const avatarImage = document.getElementById("avatarImage");
    const tabButtons = document.querySelectorAll(".profile-options .button");
    const tabContents = document.querySelectorAll(".profile-tab-content");
    const createCollectionButton = document.getElementById("createCollectionButton");
    const newCollectionInput = document.getElementById("newCollectionInput");
    const collectionOptions = document.querySelectorAll(".collection-option");
    const reviewLikeButtons = document.querySelectorAll(".review-card-like");
    const collectionsList = document.querySelector(".collections-sidebar-list");
    const collectionGrid = document.getElementById("collectionSpotsGrid");
    const firstCollection = document.querySelector(".collection-item");
    const reviewsGrid = document.querySelector(".reviews-grid");

    function renderReviewStars(rating) {
      let html = "";

      for (let i = 1; i <= 5; i++) {
        if (rating >= i) {
          html += `<i class="fa-solid fa-star icon-star"></i>`;
        } else if (rating >= i - 0.5) {
          html += `<i class="fa-solid fa-star-half-stroke icon-star"></i>`;
        } else {
          html += `<i class="fa-regular fa-star icon-star"></i>`;
        }
      }

      return html;
    }

    function enterReviewEditMode(card) {
      const body = card.querySelector(".review-card-body");
      const stars = card.querySelector(".review-card-stars");
      const editButton = card.querySelector(".review-card-edit");

      const currentText = body.textContent.trim();
      const currentRating = card.dataset.rating || "5";

      body.innerHTML = `
        <textarea class="review-edit-text text">${currentText}</textarea>
      `;

      stars.innerHTML = `
        <select class="review-edit-rating text">
          <option value="1">1</option>
          <option value="1.5">1.5</option>
          <option value="2">2</option>
          <option value="2.5">2.5</option>
          <option value="3">3</option>
          <option value="3.5">3.5</option>
          <option value="4">4</option>
          <option value="4.5">4.5</option>
          <option value="5">5</option>
        </select>
      `;

      stars.querySelector(".review-edit-rating").value = String(currentRating);

      editButton.classList.remove("review-card-edit");
      editButton.classList.add("review-card-save");
      editButton.setAttribute("aria-label", "Save review");
      editButton.innerHTML = `<i class="fa-solid fa-check"></i>`;
    }

    async function saveReviewEdit(card) {
      const textInput = card.querySelector(".review-edit-text");
      const ratingInput = card.querySelector(".review-edit-rating");

      const newText = textInput.value.trim();
      const newRating = ratingInput.value;

      if (!newText) return;

      const formData = new FormData();
      formData.append("location_id", card.dataset.locationId);
      formData.append("review_timestamp", card.dataset.reviewTimestamp);
      formData.append("rating", newRating);
      formData.append("review_text", newText);

      const response = await fetch("/profile/review/edit", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to edit review");
      }

      card.dataset.rating = newRating;

      if (result.review_timestamp) {
        card.dataset.reviewTimestamp = result.review_timestamp;
      }

      card.querySelector(".review-card-body").textContent = newText;
      card.querySelector(".review-card-stars").innerHTML = renderReviewStars(Number(newRating));

      const saveButton = card.querySelector(".review-card-save");
      saveButton.classList.add("review-card-edit");
      saveButton.classList.remove("review-card-save");
      saveButton.setAttribute("aria-label", "Edit review");
      saveButton.innerHTML = `<i class="fa-regular fa-pen-to-square"></i>`;
    }

    async function deleteReview(card) {
      const formData = new FormData();
      formData.append("location_id", card.dataset.locationId);
      formData.append("review_timestamp", card.dataset.reviewTimestamp);

      const response = await fetch("/profile/review/delete", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to delete review");
      }

      card.remove();
    }

    if (reviewsGrid) {
      reviewsGrid.addEventListener("click", async (event) => {
        const card = event.target.closest(".review-card");
        if (!card) return;

        const editButton = event.target.closest(".review-card-edit");
        const saveButton = event.target.closest(".review-card-save");
        const deleteButton = event.target.closest(".review-card-delete");

        try {
          if (editButton) {
            enterReviewEditMode(card);
            return;
          }

          if (saveButton) {
            await saveReviewEdit(card);
            return;
          }

          if (deleteButton) {
            await deleteReview(card);
            return;
          }
        } catch (err) {
          console.error(err);
        }
      });
    }

    if (firstCollection) {
      activeCollectionId = firstCollection.dataset.collectionId;

      const firstButton = firstCollection.querySelector(".collection-option");
      if (firstButton) {
        setActiveCollection(firstButton);
      }

      loadCollection(firstCollection.dataset.collectionId);
    }

    window.refreshActiveCollection = async function () {
      if (!activeCollectionId) return;
      await loadCollection(activeCollectionId);
    };

    function createSpotCard(spot) {
      const div = document.createElement("div");

      div.className = "grid-item profile-spot profile-spot-trigger";
      div.dataset.spotName = spot.name;
      div.dataset.spotImage = spot.image;
      div.dataset.spotId = spot.id;
      div.tabIndex = 0;
      div.setAttribute("role", "button");
      div.setAttribute("aria-label", `Add ${spot.name} to collections`);

      div.innerHTML = `
        <img src="${spot.image}" alt="${spot.name}" class="grid-item-image">
        <div class="grid-item-label text text-black" style="text-align: center; font-weight: 700;">
          ${spot.name}
        </div>
      `;

      return div;
    }

    async function loadCollection(collectionId) {
      try {
        const response = await fetch(`/profile/collection/${collectionId}`);
        const spots = await response.json();

        if (!response.ok) {
          throw new Error("Failed to load collection");
        }

        // Clear current grid
        collectionGrid.innerHTML = "";

        // Insert new spots
        spots.forEach((spot) => {
          const card = createSpotCard(spot);
          collectionGrid.appendChild(card);
        });

      } catch (err) {
        console.error(err);
      }
    }

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
      const allButtons = document.querySelectorAll(".collection-option");

      allButtons.forEach((button) => {
        button.classList.remove("collection-option--active");
      });

      activeButton.classList.add("collection-option--active");
    }

    if (editAvatarButton && avatarFileInput && avatarImage) {
      editAvatarButton.addEventListener("click", () => {
        avatarFileInput.click();
      });

      avatarFileInput.addEventListener("change", async (event) => {
        const [selectedFile] = event.target.files;

        if (!selectedFile) {
          return;
        }

        const reader = new FileReader();
        reader.addEventListener("load", () => {
          avatarImage.src = reader.result;
        });
        reader.readAsDataURL(selectedFile);

        const formData = new FormData();
        formData.append("avatar", selectedFile);

        try {
          const response = await fetch("/profile/upload_avatar", {
            method: "POST",
            body: formData,
          });

          const result = await response.json();

          if (!response.ok) {
            console.log(result.message);
            throw new Error(result.message || "Upload failed");
          }

          const newImageUrl = `/user/${result.username}/pfp?t=${Date.now()}`;
          avatarImage.src = newImageUrl;

          const headerProfileImage = document.querySelector(
            ".header-profile-image",
          );
          if (headerProfileImage) {
            headerProfileImage.src = newImageUrl;
          }
        } catch (err) {
          console.error(err);
          alert("Failed to upload profile picture");
        }
      });
    }

    tabButtons.forEach((button) => {
      button.addEventListener("click", async () => {
        const scrollX = window.scrollX;
        const scrollY = window.scrollY;

        setActiveTab(button);
        showTab(button.dataset.tab);

        window.scrollTo(scrollX, scrollY);
      });
    });

    collectionsList.addEventListener("click", async (e) => {
      const deleteButton = e.target.closest(".collection-delete");
      const optionButton = e.target.closest(".collection-option");

      const item = e.target.closest(".collection-item");
      if (!item) return;

      const collectionId = item.dataset.collectionId;

      if (deleteButton) {
        const formData = new FormData();
        formData.append("collection_id", collectionId);

        try {
          const response = await fetch("/profile/delete_collection", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            throw new Error("Failed to delete collection");
          }

          item.remove();

          if (collectionGrid) {
            collectionGrid.innerHTML = "";
          }
        } catch (err) {
          console.error(err);
        }

        return;
      }

      if (optionButton) {
        activeCollectionId = item.dataset.collectionId;

        setActiveCollection(optionButton);
        await loadCollection(collectionId);
      }
    });

    reviewLikeButtons.forEach((button) => {
      const icon = button.querySelector(".fa-thumbs-up");

      button.addEventListener("click", () => {
        icon.classList.toggle("fa-regular");
        icon.classList.toggle("fa-solid");
      });
    });

    async function createCollection() {
      if (!newCollectionInput) {
        return;
      }

      const newCollectionName = newCollectionInput.value.trim();

      if (!newCollectionName) {
        return;
      }

      const formData = new FormData();
      formData.append("collection_name", newCollectionName);

      try {
        const response = await fetch("/profile/create_collection", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if(!response.ok){
          throw new Error("Failed to create collection");
        }

        console.log(result);
        newCollectionInput.value = "";

        const newElement = createCollectionElement(result);

        const createRow = document.querySelector(".collection-create-row");
        collectionsList.insertBefore(newElement, createRow);



      } catch (error){
        console.error(error);
      }
    }

    function createCollectionElement(collection) {
      const wrapper = document.createElement("div");
      wrapper.className = "collection-item";
      wrapper.dataset.collectionId = collection.id;
      wrapper.dataset.collectionName = collection.name;

      wrapper.innerHTML = `
        <button class="collection-option text-black" type="button">
          <span class="collection-option-dot"></span>
          <span class="heading-4">${collection.name}</span>
        </button>

        <button class="collection-delete" type="button">
          <i class="fa-solid fa-trash"></i>
        </button>
      `;

      return wrapper;
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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupProfilePage);
  } else {
    setupProfilePage();
  }
})();
