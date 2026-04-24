(function () {
  function setupProfilePage() {
    const editAvatarButton = document.getElementById("editAvatarButton");
    const avatarFileInput = document.getElementById("avatarFileInput");
    const avatarImage = document.getElementById("avatarImage");
    const tabButtons = document.querySelectorAll(".profile-options .button");
    const tabContents = document.querySelectorAll(".profile-tab-content");
    const createCollectionButton = document.getElementById(
      "createCollectionButton",
    );
    const newCollectionInput = document.getElementById("newCollectionInput");
    const collectionOptions = document.querySelectorAll(".collection-option");
    const reviewLikeButtons = document.querySelectorAll(".review-card-like");

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

    if (editAvatarButton && avatarFileInput && avatarImage) {
      editAvatarButton.addEventListener("click", () => {
        avatarFileInput.click();
      });

      avatarFileInput.addEventListener("change", async (event) => {
        const [selectedFile] = event.target.files;

        if (!selectedFile) return; 

        const reader = new FileReader();
        reader.addEventListener("load", () => {
          avatarImage.src = reader.result;
        });
        reader.readAsDataURL(selectedFile);

        const formData = new FormData();
        formData.append("avatar", selectedFile);
        try{
          const response = await fetch("/profile/upload_avatar", {
            method: "POST", 
            body: formData
          });

          const result = await response.json();

          if(!response.ok){
            console.log(result.message);
            throw new Error(result.message || "Upload failed");
          }

          avatarImage.src = `/user/${result.username}/pfp?t=${Date.now()}`;
        } catch (err) {
          console.error(err);
          alert("Failed to upload profile picture");
        }



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
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupProfilePage);
  } else {
    setupProfilePage();
  }
})();
