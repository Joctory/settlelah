let dishes = [];
let members = []; // Initialize as empty array
let currentStep = 1;
let groups = JSON.parse(localStorage.getItem("groups")) || {};
let currentGroup = "";
let editMode = false;
let editingIndex = -1;
const settleChoiceError = document.querySelector(".settle-choice-error");
const savedGroupError = document.querySelector(".saved-group-error");

// Variable to track current active bubble
let currentActiveBubble = 2;

// Variables to track current active page
let activePage = "home";
let pageContainers = {
  1: "historyContainer",
  2: "homeContainer",
  3: "settingsContainer",
};

// Variables to track current screens
let currentSettleView = "settleChoiceView";

// Variable to track the previous view
let previousView = "";

// Add a variable to track if we're editing a group
let isEditingGroup = false;

function showError(message) {
  document.getElementById("error").textContent = message;
}

function clearError() {
  const errorElement = document.getElementById("error");
  if (errorElement) {
    errorElement.textContent = "";
  }
}

// Function to switch between pages
function switchPage(pageId) {
  // Hide all pages
  Object.values(pageContainers).forEach((containerId) => {
    const container = document.getElementById(containerId);
    if (container) {
      container.classList.remove("active");
      container.classList.add("inactive");
    }
  });

  // Show the selected page
  const selectedContainer = document.getElementById(pageContainers[pageId]);
  if (selectedContainer) {
    selectedContainer.classList.remove("inactive");
    selectedContainer.classList.add("active");
    activePage = pageContainers[pageId].replace("Container", "");

    // If switching to history page, fetch history data
    if (pageId === 1) {
      fetchHistory();
    }
  }
}

function nextStep(step, action) {
  if (step === 1) {
    const selectedRadio = document.querySelector('input[name="group"]:checked'); // Get the selected radio button
    const groupSelect = selectedRadio ? selectedRadio.value : ""; // Get its value or set to empty if none selected

    if (!groupSelect && action !== "new") {
      showError('Please select a group or click "New Split Group".');
      return;
    }
    if (action === "select") {
      currentGroup = groupSelect;
      members = groups[groupSelect];
      loadMembersForDrag();
      currentStep = 2; // Skip to Step 3 (Add Dishes)
      document.getElementById("step1").style.display = "none";
      document.getElementById("step3").style.display = "block";
      updateGroupActions();
      dishes = [];
      updateDishList();
      document.getElementById("dishMembers").innerHTML = "";
      document.getElementById("next3").disabled = true;
      closeSummary();
      return;
    } else {
      members = [];
      currentGroup = "";
    }
  } else if (step === 2) {
    if (members.length === 0) {
      showError("Please add at least one member.");
      return;
    }
    loadMembersForDrag();
  }

  clearError();
  document.getElementById(`step${step}`).style.display = "none";
  currentStep = step + 1;
  document.getElementById(`step${currentStep}`).style.display = "block";
  updateGroupActions();
}

function backStep(step) {
  if (step > 1 && (dishes.length > 0 || members.length > 0)) {
    document.getElementById("backConfirmModal").style.display = "block";
    return;
  }
  resetToHome(step);
}

// function confirmBack() {
//   resetToHome(currentStep);
//   closeBackConfirm();
// }

// function closeBackConfirm() {
//   document.getElementById("backConfirmModal").style.display = "none";
// }

function showStep(step) {
  document.querySelectorAll(".step").forEach((s) => (s.style.display = "none"));
  document.getElementById(`step${step}`).style.display = "block";
  currentStep = step;
  clearError();
}

function resetToHome(step) {
  dishes = [];
  members = [];
  currentGroup = "";
  updateDishList();
  closeSummary();
  document.getElementById("dishMembers").innerHTML = "";
  document.getElementById("next3").disabled = true;
  showStep(1);
  document.getElementById("groupSelect").value = "";
  document.getElementById("next1").disabled = true;
  clearError();
}

function loadMembersForDrag() {
  const memberPool = document.getElementById("memberPool");
  memberPool.innerHTML = "";
  members.forEach((member, index) => {
    const li = document.createElement("li");
    li.textContent = member;
    li.dataset.member = member;
    li.ondblclick = () => editMember(index);
    memberPool.appendChild(li);
  });
}

function scanReceipt() {
  const fileInput = document.getElementById("receiptImage");
  const scanButton = document.getElementById("scanReceiptBtn");
  const errorMessage = document.querySelector(".scan-receipt-error-message");
  const scanOverlay = document.querySelector(".scan-receipt-overlay");

  const file = fileInput.files[0];
  if (!file) {
    errorMessage.textContent = "Please select a receipt image to scan.";
    errorMessage.style.display = "block";
    return;
  } else {
    errorMessage.textContent = "";
    errorMessage.style.display = "none";
  }

  // Check file size (max 10MB)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > MAX_FILE_SIZE) {
    errorMessage.textContent = "File size exceeds 10MB limit. Please upload a smaller file.";
    errorMessage.style.display = "block";
    return;
  } else {
    errorMessage.textContent = "";
    errorMessage.style.display = "none";
  }

  // Show the scanning overlay
  if (scanOverlay) {
    scanOverlay.classList.add("active");
  }

  // Disable the scan button during processing
  scanButton.disabled = true;
  scanButton.textContent = "Processing...";

  // Create form data for the API request
  const formData = new FormData();
  formData.append("document", file);

  // Make the API request to our backend instead of directly to Mindee
  fetch("/api/scan-receipt", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(`HTTP error ${response.status}: ${text}`);
        });
      }
      return response.json();
    })
    .then((data) => {
      // Check if we have valid data
      if (!data.success || !data.dishes) {
        throw new Error("Invalid response data");
      }

      const newDishes = data.dishes;

      // Add the dishes to the list
      if (!dishes) dishes = [];
      dishes = dishes.concat(newDishes);

      // Hide the scan-item-btn after successful receipt scan
      const scanItemBtn = document.querySelector(".scan-item-btn");
      if (scanItemBtn) {
        scanItemBtn.style.display = "none";
      }

      // Update the UI but don't show summary yet
      updateDishSummary();

      // Update success toast with item count
      const toastCount = document.querySelector(".toast-count");
      if (toastCount) {
        toastCount.textContent = `${newDishes.length} item${newDishes.length !== 1 ? "s" : ""} added`;
      }
    })
    .catch((error) => {
      console.error("Error scanning receipt:", error);
      // Prepare to show error toast after scanning animation completes
      // We'll store the error message to display in the toast
      window.scanErrorMessage = error.message;
    })
    .finally(() => {
      // Keep the overlay visible for 3 seconds before hiding it
      setTimeout(() => {
        // Update the scanning text based on success or failure
        const scanningText = document.querySelector(".scanning-text");
        if (scanningText) {
          if (window.scanErrorMessage) {
            scanningText.textContent = "Scan failed!";
            scanningText.style.animation = "none";
            scanningText.style.color = "#ff4c4c"; // Red color for error
          } else {
            scanningText.textContent = "Scanning complete!";
            scanningText.style.animation = "none";
            scanningText.style.color = "#4cff4c"; // Green color for success
          }
        }

        setTimeout(() => {
          // Hide the scanning overlay with a fade out effect
          if (scanOverlay) {
            // Close the modal and show a success message
            hideModal("scanReceiptModal");

            // Remove the active class and reset styles after fade out completes
            setTimeout(() => {
              scanOverlay.classList.remove("active");
              scanOverlay.style.transition = "";
              scanOverlay.style.opacity = "";

              // Reset the scanning text for next time
              if (scanningText) {
                scanningText.textContent = "Scanning your receipt...";
                scanningText.style.animation = "";
                scanningText.style.color = "";
              }

              // Show either success or error toast based on result
              if (window.scanErrorMessage) {
                // Show error toast using showToast function
                showToast("scanErrorToast");

                // Update error message
                const errorToast = document.getElementById("scanErrorToast");
                if (errorToast) {
                  const errorMessageEl = errorToast.querySelector(".toast-error-message");
                  if (errorMessageEl) {
                    errorMessageEl.textContent = window.scanErrorMessage || "Unable to process receipt";
                  }

                  // Set up try again button
                  const tryAgainBtn = errorToast.querySelector(".try-again-btn");
                  if (tryAgainBtn) {
                    tryAgainBtn.onclick = function () {
                      showModal("scanReceiptModal");
                      // Hide the toast immediately when button is clicked
                      errorToast.classList.remove("show");
                    };
                  }

                  // Clear the error message
                  window.scanErrorMessage = null;
                }
              } else {
                // Show success toast using showToast function
                showSummary("fully-open");
                showToast("scanSuccessToast");

                // Set up view items button
                const successToast = document.getElementById("scanSuccessToast");
                if (successToast) {
                  // Set up view items button
                  const viewItemsBtn = successToast.querySelector(".view-items-btn");
                  if (viewItemsBtn) {
                    viewItemsBtn.onclick = function () {
                      showSummary("fully-open");
                      // Hide the toast immediately when button is clicked
                      successToast.classList.remove("show");
                    };
                  }
                }
              }

              // Add a CSS transition for smoother fade out
              scanOverlay.style.transition = "opacity 0.5s ease";
              scanOverlay.style.opacity = "0";
            }, 500); // Match this to the CSS transition time
          }
        }, 1000);

        // Re-enable the scan button
        scanButton.disabled = false;
        scanButton.textContent = "Scan Receipt";
      }, 2000); // 3-second delay
    });
}

function addDish() {
  const dishName = document.getElementById("dishName").value.trim();
  const dishCost = document.getElementById("dishCost").value;
  const assignedMembers = Array.from(document.getElementById("dishMembers").children).map((li) => li.dataset.member);

  if (!dishName) {
    showError("Please enter a dish name.");
    return;
  }
  if (!dishCost || isNaN(dishCost) || parseFloat(dishCost) <= 0) {
    showError("Please enter a valid dish cost greater than 0.");
    return;
  }
  if (assignedMembers.length === 0) {
    showError("Please drag at least one member to assign the dish.");
    return;
  }

  clearError();
  dishes.push({ name: dishName, cost: parseFloat(dishCost), members: assignedMembers });
  updateDishList();
  clearDishInputs();
  showSummary();
  document.getElementById("next3").disabled = false;
}

function editDish(index) {
  const dish = dishes[index];
  document.getElementById("itemName").value = dish.name;
  document.getElementById("itemPrice").value = dish.cost;
  const assigned = document.getElementById("assignedMembers");
  assigned.innerHTML = "";

  dish.members.forEach((member) => {
    // Handle both object format and legacy string format
    let memberName, avatarNumber;

    if (typeof member === "object" && member.name) {
      memberName = member.name;
      avatarNumber = member.avatar;
    } else {
      memberName = member;
      // Generate consistent avatar based on name
      const nameHash = memberName.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
      avatarNumber = Math.abs(nameHash % 12) + 1;
    }

    const memberWrapper = document.createElement("div");
    memberWrapper.className = "member-avatar-wrapper sortable-item";
    memberWrapper.dataset.name = memberName;

    const memberAvatar = document.createElement("div");
    memberAvatar.className = "member-avatar";

    // Create img element for cat avatar
    const img = document.createElement("img");
    img.src = `assets/cat-icon/cat-${avatarNumber}.svg`;
    img.alt = `Cat avatar ${avatarNumber}`;
    img.className = "cat-avatar-img";
    memberAvatar.appendChild(img);

    const memberNameDiv = document.createElement("div");
    memberNameDiv.className = "member-name";
    memberNameDiv.textContent = memberName;

    memberWrapper.appendChild(memberAvatar);
    memberWrapper.appendChild(memberNameDiv);

    // Add double-tap to remove functionality
    memberWrapper.ondblclick = () => memberWrapper.remove();

    assigned.appendChild(memberWrapper);
  });

  dishes.splice(index, 1);
  updateDishList();
  clearError();
  // showSummary();
  closeBillSummaryModal();
}

function deleteDish(index, fromSummary = false) {
  dishes.splice(index, 1);

  // Update dish list in other views if they exist
  const dishList = document.getElementById("dishList");
  if (dishList) {
    updateDishList();
  }

  // Update the bill summary to reflect the changes
  // This will hide the confirm button if all dishes are removed
  updateDishSummary();

  // Keep the bill summary open but minimize it if all dishes are removed
  if (dishes.length === 0) {
    // Disable next button if it exists
    const nextButton = document.getElementById("next3");
    if (nextButton) {
      nextButton.disabled = true;
    }

    // Just minimize the summary if empty
    closeSummary();
  } else if (!fromSummary) {
    // Only show summary if not already in it
    showSummary();
  }
}

function updateDishList() {
  const dishList = document.getElementById("dishList");
  if (!dishList) return; // Add early return if dishList is null

  dishList.innerHTML = "";
  dishes.forEach((dish, index) => {
    const li = document.createElement("li");
    li.innerHTML = `${dish.name}: $${dish.cost.toFixed(2)} (split: ${dish.members.join(", ")}) 
      <button onclick="editDish(${index})">Edit</button>
      <button onclick="deleteDish(${index})">Delete</button>`;
    dishList.appendChild(li);
  });

  const total = dishes.reduce((sum, dish) => sum + dish.cost, 0);
  const summaryTotal = document.getElementById("summaryTotal");
  if (summaryTotal) {
    summaryTotal.textContent = `Total Dishes Cost: $${total.toFixed(2)}`;
  }
}

function clearDishInputs() {
  document.getElementById("dishName").value = "";
  document.getElementById("dishCost").value = "";
  document.getElementById("dishMembers").innerHTML = "";
}

function showSummary(openState = "fully-open") {
  // Update the dish summary content
  updateDishSummary();

  // Show the modal overlay
  const overlay = document.getElementById("billSummaryOverlay");
  overlay.classList.add("active");

  // Show the bill summary modal with specified state
  const modal = document.getElementById("billSummaryModal");
  modal.style.display = "block";

  // Set the appropriate class for the opening state
  setTimeout(() => {
    modal.classList.remove("peeking", "half-open", "fully-open");
    modal.classList.add(openState);
  }, 10);
}

function closeSummary() {
  // Just minimize the bill summary modal to peeking state, don't hide it completely
  const modal = document.getElementById("billSummaryModal");
  modal.classList.remove("fully-open", "half-open");
  modal.classList.add("peeking");

  // Hide the modal overlay
  const overlay = document.getElementById("billSummaryOverlay");
  overlay.classList.remove("active");

  // We no longer hide the modal completely, just minimize it
}

// Show or hide the bill summary based on the current view
function toggleBillSummaryVisibility(show) {
  const modal = document.getElementById("billSummaryModal");
  const overlay = document.getElementById("billSummaryOverlay");

  if (show) {
    // Make the bill summary peek from the bottom
    modal.style.display = "block";

    // Check if finaliseSettleBillScreen is active
    const finaliseScreen = document.getElementById("finaliseSettleBillScreen");
    const isFinaliseBillActive = finaliseScreen && finaliseScreen.classList.contains("active");

    // If on finalise screen, make it peek, otherwise follow normal behavior
    if (isFinaliseBillActive) {
      // Ensure it's at least in peeking mode
      if (!modal.classList.contains("fully-open") && !modal.classList.contains("half-open")) {
        modal.classList.add("peeking");
      }
    } else {
      modal.classList.add("peeking");
      modal.classList.remove("fully-open", "half-open");
    }

    overlay.classList.remove("active");
  } else {
    // Hide the bill summary completely
    modal.style.display = "none";
    modal.classList.remove("peeking", "half-open", "fully-open");
    overlay.classList.remove("active");
  }
}

function updateDishSummary() {
  const container = document.getElementById("dishSummaryContainer");
  if (!container) return;

  container.innerHTML = "";

  if (!dishes || dishes.length === 0) {
    container.innerHTML = "<p>No items added yet.</p>";

    // Disable confirm button if no dishes
    const confirmButton = document.querySelector(".confirm-bill-btn");
    if (confirmButton) {
      confirmButton.disabled = true;
    }
    return;
  }

  // Loop through the dishes and create a dish summary item for each one
  dishes.forEach((dish, index) => {
    const dishItem = document.createElement("div");
    dishItem.className = "dish-summary-item";

    // Dish name and price in one div
    const dishHeader = document.createElement("div");
    dishHeader.className = "dish-header";

    const dishName = document.createElement("p");
    dishName.className = "dish-name";
    dishName.textContent = dish.name;

    const dishPrice = document.createElement("p");
    dishPrice.className = "dish-price";
    dishPrice.textContent = `$${parseFloat(dish.cost).toFixed(2)}`;

    dishHeader.appendChild(dishName);
    dishHeader.appendChild(dishPrice);

    // Split among divider
    const divider = document.createElement("div");
    divider.className = "dish-members-divider";
    const dividerText = document.createElement("span");
    dividerText.textContent = "Split Among";
    divider.appendChild(dividerText);

    // Dish members
    const dishMembers = document.createElement("div");
    dishMembers.className = "dish-members";

    dish.members.forEach((member) => {
      const memberPill = document.createElement("div");
      memberPill.className = "dish-member-pill";
      memberPill.textContent = member;
      dishMembers.appendChild(memberPill);
    });

    // Action buttons
    const actions = document.createElement("div");
    actions.className = "dish-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "dish-action-btn";
    editBtn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>';
    editBtn.onclick = () => editDish(index);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "dish-action-btn";
    deleteBtn.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    deleteBtn.onclick = () => deleteDish(index, true); // Pass true to indicate deletion from summary

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    dishHeader.appendChild(actions);

    // Assemble dish item
    dishItem.appendChild(dishHeader);
    dishItem.appendChild(divider);
    dishItem.appendChild(dishMembers);

    container.appendChild(dishItem);
  });

  // Enable confirm button and add click handler with validation
  const confirmButton = document.querySelector(".confirm-bill-btn");
  if (confirmButton) {
    confirmButton.disabled = false;

    // Remove any existing event listeners using a different approach
    confirmButton.onclick = function () {
      // Check if all dishes have members assigned
      const dishesWithoutMembers = dishes.filter((dish) => !dish.members || dish.members.length === 0);

      if (dishesWithoutMembers.length > 0) {
        // Show toast notification using showToast function
        const missingMembersToast = document.getElementById("missingMembersToast");
        if (missingMembersToast) {
          // Update error message with count
          const errorMessageEl = missingMembersToast.querySelector(".toast-error-message");
          if (errorMessageEl) {
            errorMessageEl.textContent = `${dishesWithoutMembers.length} item${
              dishesWithoutMembers.length !== 1 ? "s" : ""
            } ${dishesWithoutMembers.length !== 1 ? "have" : "has"} no members assigned`;
          }

          // Show the toast
          showToast("missingMembersToast");
        }
        return;
      }

      // If all dishes have members, proceed to finalize bill
      showFinaliseSettleBillScreen();
    };
  }

  const addMoreItemsBtn = document.querySelector(".add-more-items-btn");
  if (addMoreItemsBtn) {
    addMoreItemsBtn.onclick = function () {
      // Keep the bill summary modal visible and ensure it's in at least peeking state
      const billSummaryModal = document.getElementById("billSummaryModal");
      const overlay = document.getElementById("billSummaryOverlay");

      if (billSummaryModal) {
        billSummaryModal.style.display = "block";

        // If not already in an open state, set to peeking
        billSummaryModal.classList.remove("fully-open", "half-open");
        billSummaryModal.classList.add("peeking");
        if (overlay) {
          overlay.classList.remove("active");
        }
      }
    };
  }
}

// Function to show the Finalise Settle Bill screen
function showFinaliseSettleBillScreen() {
  //uncheck the checkbox of settle equally
  document.getElementById("settleEqually").checked = false;
  showSettleView("finaliseSettleBillScreen");
  // Hide addSettleItemView but keep settleNowScreen active
  const addSettleItemView = document.getElementById("addSettleItemView");
  if (addSettleItemView) {
    addSettleItemView.classList.remove("active");
  }

  // Keep the settle now screen active
  const settleNowScreen = document.getElementById("settleNowScreen");
  if (settleNowScreen) {
    settleNowScreen.classList.add("active");
    settleNowScreen.classList.remove("inactive");
  }

  // Keep the bill summary modal visible and ensure it's in at least peeking state
  const billSummaryModal = document.getElementById("billSummaryModal");
  const overlay = document.getElementById("billSummaryOverlay");

  if (billSummaryModal) {
    billSummaryModal.style.display = "block";

    // If not already in an open state, set to peeking
    billSummaryModal.classList.remove("fully-open", "half-open");
    billSummaryModal.classList.add("peeking");
    if (overlay) {
      overlay.classList.remove("active");
    }
  }

  // Show the Finalise Settle Bill screen
  const finaliseScreen = document.getElementById("finaliseSettleBillScreen");
  if (finaliseScreen) {
    finaliseScreen.classList.remove("inactive");
    finaliseScreen.classList.add("active");
  }

  // Add event listener to the Settle Lah button
  const settleLahButton = finaliseScreen.querySelector(".settle-lah-btn");
  if (settleLahButton) {
    settleLahButton.onclick = function () {
      showLoadingScreen();
    };
  }

  function showLoadingScreen() {
    // Reset and show loading screen
    resetLoadingAnimation();
    showSettleView("loadingScreen");

    // Get the loading bar element
    const loadingBar = document.querySelector(".loading-bar");

    // Set initial width
    let width = 0;

    // Create interval to increase width slowly during fetch
    const loadingInterval = setInterval(() => {
      // Increase by smaller increments
      width += 1;

      // Only go up to 80% while waiting for the response
      if (width > 90) {
        width = 90;
        clearInterval(loadingInterval);
      }

      // Update the width
      loadingBar.style.width = width + "%";
    }, 100);

    const settleMatter = document.getElementById("settleMatter").value || "No one ask!";
    const taxProfile = document.getElementById("taxProfile").value;
    const discount = document.getElementById("discountValue").value || "0";
    const applyServiceCharge = document.getElementById("serviceChargeCheckbox").checked;
    const applyGst = document.getElementById("gstCheckbox").checked;
    const paynowName = document.getElementById("paynowName").value;
    const paynowID = document.getElementById("paynowPhone").value;
    const serviceChargeValue = document.getElementById("serviceChargeValue").value || "10";
    const billData = {
      members,
      settleMatter,
      dishes,
      discount,
      applyServiceCharge,
      applyGst,
      taxProfile,
      paynowName,
      paynowID,
      serviceChargeValue,
    };

    fetch("/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(billData),
    })
      .then((response) => response.json())
      .then((result) => {
        const backendData = {
          settleMatter: result.billData.settleMatter,
          dateString: new Date(result.billData.timestamp).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          timeString: new Date(result.billData.timestamp)
            .toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })
            .replace(" ", ""),
          itemCount: result.billData.dishes.length,
          subtotal: `$${result.billData.breakdown.subtotal.toFixed(2)}`,
          serviceCharge: `$${result.billData.breakdown.serviceCharge.toFixed(2)}`,
          serviceChargeRate: result.billData.serviceChargeRate || "10%", // Add service charge rate
          afterService: `$${result.billData.breakdown.afterService.toFixed(2)}`,
          discount: `$${result.billData.breakdown.discountAmount.toFixed(2)}`,
          afterDiscount: `$${result.billData.breakdown.afterDiscount.toFixed(2)}`,
          gst: `$${result.billData.breakdown.gst.toFixed(2)}`,
          gstRate: result.billData.gstRate || "9%", // Add GST rate
          totalAmount: `$${result.billData.breakdown.total.toFixed(2)}`,
        };

        // Update the loading receipt with the processed data
        const loadingReceipt = document.getElementById("loadingReceipt");
        const successReceipt = document.getElementById("successReceipt");
        updateReceiptDetails(loadingReceipt, backendData);
        updateReceiptDetails(successReceipt, backendData);

        document.getElementById("shareOptionList").innerHTML = `
      <div class="share-buttons">
                <a
                  id="shareWhatsappBtn"
                  class="share-btn"
                  href="https://wa.me/?text=Check%20this%20out!%20${result.link}"
                  target="_blank"
                >
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/whatsapp.svg" alt="WhatsApp" />
                  <span class="share-btn-span">WhatsApp</span>
                </a>

                <a
                  id="shareFacebookBtn"
                  class="share-btn"
                  href="https://www.facebook.com/sharer/sharer.php?u=${result.link}"
                  target="_blank"
                >
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/facebook.svg" alt="Facebook" />
                  <span class="share-btn-span">Facebook</span>
                </a>

                <a
                  id="shareTwitterBtn"
                    class="share-btn"
                  href="https://twitter.com/intent/tweet?text=Check%20this%20out!&url=${result.link}"
                  target="_blank"
                >
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/twitter.svg" alt="Twitter" />
                  <span class="share-btn-span">Twitter</span>
                </a>

                <a
                  id="shareLinkedinBtn"
                  class="share-btn"
                  href="https://www.linkedin.com/sharing/share-offsite/?url=${result.link}"
                  target="_blank"
                >
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/linkedin.svg" alt="LinkedIn" />
                  <span class="share-btn-span">LinkedIn</span>
                </a>

                <a
                  id="shareTelegramBtn"
                  class="share-btn"
                  href="https://t.me/share/url?url=${result.link}&text=Check%20this%20out!"
                  target="_blank"
                >
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/telegram.svg" alt="Telegram" />
                  <span class="share-btn-span">Telegram</span>
                </a>

                <a
                  id="shareEmailBtn"
                  class="share-btn"
                  href="mailto:?subject=Check%20this%20out&body=Check%20this%20link:%20${result.link}"
                  target="_blank"
                >
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/maildotru.svg" alt="Email" />
                  <span class="share-btn-span">Email</span>
                </a>

                <a
                  id="shareSmsBtn"
                  class="share-btn"
                  href="sms:?&body=Check%20this%20out!%20${result.link}"
                >
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/signal.svg" alt="SMS" />
                  <span class="share-btn-span">SMS</span>
                </a>

                <button class="share-btn" onclick="copyToClipboard("${result.link}")">
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/linktree.svg" alt="Copy" />
                  <span class="share-btn-span">Copy Link</span>
                </button>
              </div>
      `;

        // Add reveal bill button and set the link to the result page
        const revealBtn = document.querySelector(".reveal-bill-btn");
        revealBtn.onclick = function () {
          window.open(result.link, "_blank");
        };

        // Complete the loading bar to 100% when result is received
        const completeInterval = setInterval(() => {
          width += 5;
          loadingBar.style.width = width + "%";
          document.getElementById("loadingReceipt").classList.add("received");

          if (width >= 100) {
            clearInterval(completeInterval);

            // Add "finished" class to loadingReceipt after loading completes
            setTimeout(function () {
              document.getElementById("loadingReceipt").classList.add("finished");

              // Show success screen after animation completes
              setTimeout(function () {
                showSettleView("successScreen");
              }, 1000);
            }, 5000); // Changed to 5 seconds for a better user experience
          }
        }, 100);

        // Store bill ID and timestamp in localStorage
        const billIds = JSON.parse(localStorage.getItem("billHistory") || "[]");
        if (!billIds.includes(result.id)) {
          billIds.push(result.id);
          localStorage.setItem("billHistory", JSON.stringify(billIds));
        }
      })
      .catch((err) => {
        clearInterval(loadingInterval);
        showError("Error calculating bill. Please try again.");
      });
  }

  // Update service charge label to match the value in the input
  const serviceChargeInput = document.getElementById("serviceChargeValue");
  const serviceChargeLabel = document.querySelector('label[for="serviceChargeCheckbox"]');
  if (serviceChargeInput && serviceChargeLabel) {
    serviceChargeInput.addEventListener("input", function () {
      // The label structure includes the input field, so we don't need to modify it directly
    });
  }
}

// Function to update any receipt with settlement details
function updateReceiptDetails(receiptContainer, data) {
  // Find all detail elements by their class names instead of IDs
  const settleMatterEl = receiptContainer.querySelector(".successSettleMatter");
  const dateEl = receiptContainer.querySelector(".successDate");
  const timeEl = receiptContainer.querySelector(".successTime");
  const itemCountEl = receiptContainer.querySelector(".successItemCount");
  const subtotalEl = receiptContainer.querySelector(".successSubtotal");
  const serviceChargeEl = receiptContainer.querySelector(".successServiceCharge");
  const serviceChargeRow = receiptContainer.querySelector(".serviceChargeRow");
  const serviceChargeRate = receiptContainer.querySelector(".serviceChargeRate");
  const afterServiceEl = receiptContainer.querySelector(".successAfterService");
  const afterServiceRow = receiptContainer.querySelector(".afterServiceRow");
  const discountEl = receiptContainer.querySelector(".successDiscount");
  const discountRow = receiptContainer.querySelector(".discountRow");
  const afterDiscountEl = receiptContainer.querySelector(".successAfterDiscount");
  const afterDiscountRow = receiptContainer.querySelector(".afterDiscountRow");
  const gstEl = receiptContainer.querySelector(".successGST");
  const gstRow = receiptContainer.querySelector(".gstRow");
  const gstRate = receiptContainer.querySelector(".gstRate");
  const amountEl = receiptContainer.querySelector(".successAmount");

  // Update the text content if elements exist
  if (settleMatterEl) settleMatterEl.textContent = data.settleMatter || "No one ask!";
  if (dateEl) dateEl.textContent = data.dateString;
  if (timeEl) timeEl.textContent = data.timeString;
  if (itemCountEl) itemCountEl.textContent = data.itemCount;
  if (subtotalEl) subtotalEl.textContent = data.subtotal;

  // Handle Service Charge
  if (serviceChargeEl && serviceChargeRow) {
    const serviceChargeValue = parseFloat(data.serviceCharge.replace("$", ""));
    if (serviceChargeValue > 0) {
      serviceChargeEl.textContent = data.serviceCharge;
      serviceChargeRow.style.display = "";

      // Set service charge rate
      if (serviceChargeRate) {
        serviceChargeRate.textContent = data.serviceChargeRate || "10%";
      }
    } else {
      serviceChargeRow.style.display = "none";
    }
  }

  // Handle After Service
  if (afterServiceEl && afterServiceRow) {
    const serviceChargeValue = parseFloat(data.serviceCharge.replace("$", ""));
    if (serviceChargeValue > 0) {
      // Calculate after service amount from subtotal + service charge
      const subtotalValue = parseFloat(data.subtotal.replace("$", ""));
      const afterServiceValue = subtotalValue + serviceChargeValue;
      afterServiceEl.textContent = `$${afterServiceValue.toFixed(2)}`;
      afterServiceRow.style.display = "";
    } else {
      afterServiceRow.style.display = "none";
    }
  }

  // Handle Discount
  if (discountEl && discountRow) {
    // Extract discount from data if available, otherwise don't show
    const discountValue = parseFloat(data.discount?.replace("$", "") || "0");
    if (discountValue > 0) {
      discountEl.textContent = data.discount;
      discountRow.style.display = "";
    } else {
      discountRow.style.display = "none";
    }
  }

  // Handle After Discount
  if (afterDiscountEl && afterDiscountRow) {
    const discountValue = parseFloat(data.discount?.replace("$", "") || "0");
    if (discountValue > 0) {
      // Calculate amount after discount
      const subtotalValue = parseFloat(data.subtotal.replace("$", ""));
      const serviceChargeValue = parseFloat(data.serviceCharge.replace("$", ""));
      const afterServiceValue = subtotalValue + serviceChargeValue;
      const afterDiscountValue = afterServiceValue - discountValue;
      afterDiscountEl.textContent = `$${afterDiscountValue.toFixed(2)}`;
      afterDiscountRow.style.display = "";
    } else {
      afterDiscountRow.style.display = "none";
    }
  }

  // Handle GST
  if (gstEl && gstRow) {
    const gstValue = parseFloat(data.gst.replace("$", ""));
    if (gstValue > 0) {
      gstEl.textContent = data.gst;
      gstRow.style.display = "";

      // Set GST rate
      if (gstRate) {
        gstRate.textContent = data.gstRate || "9%";
      }
    } else {
      gstRow.style.display = "none";
    }
  }

  if (amountEl) amountEl.textContent = data.totalAmount;
}

function showSuccessScreen() {
  // Update avatar group with actual members
  const avatarGroup = document.querySelector(".success-footer .avatar-group");

  // Clear current avatars
  avatarGroup.innerHTML = "";

  // Get actual members from the global members array
  // Show up to 5 members, if more exist, show a "+" sign
  const maxVisibleMembers = 5;
  const visibleMembers = members.slice(0, maxVisibleMembers);
  const hasMoreMembers = members.length > maxVisibleMembers;

  // Add member avatars
  visibleMembers.forEach((member, index) => {
    // Create avatar container
    const avatar = document.createElement("div");
    avatar.className = "avatar";

    // Create and set avatar image
    const avatarImg = document.createElement("img");
    avatarImg.className = "avatar-img";

    // Use different cat avatars for each member (cycling through 1-5)
    const catNumber = (index % 5) + 1;
    avatarImg.src = `assets/cat-icon/cat-${catNumber}.svg`;

    // Append image to avatar container
    avatar.appendChild(avatarImg);

    // Append avatar to group
    avatarGroup.appendChild(avatar);
  });

  // Add "+" sign if there are more members
  if (hasMoreMembers || members.length === 0) {
    // If no members, still show at least the default 5 avatars
    if (members.length === 0) {
      for (let i = 0; i < 5; i++) {
        const avatar = document.createElement("div");
        avatar.className = "avatar";

        const avatarImg = document.createElement("img");
        avatarImg.className = "avatar-img";
        avatarImg.src = `assets/cat-icon/cat-${i + 1}.svg`;

        avatar.appendChild(avatarImg);
        avatarGroup.appendChild(avatar);
      }
    }

    // Add the "+" text node
    const plusSign = document.createTextNode("+");
    avatarGroup.appendChild(plusSign);
  }

  // Add event listeners to buttons
  const shareBtn = document.querySelector(".share-bill-btn");

  shareBtn.onclick = function () {
    // Show share modal
    showShareModal();
  };
}

// Function to show share modal
function showShareModal() {
  const modal = document.getElementById("shareBillModal");
  const overlay = document.getElementById("shareBillOverlay");
  const closeBtn = document.querySelector(".share-close-modal");

  // Display the modal and overlay - no need to set display:block
  // as visibility is controlled by the bottom position in CSS
  modal.classList.add("active");
  overlay.classList.add("active");

  // Make sure the close button works
  if (closeBtn) {
    closeBtn.onclick = closeShareModal;
  }

  // Close modal when clicking outside
  overlay.onclick = closeShareModal;
}

// Function to close share modal
function closeShareModal() {
  const modal = document.getElementById("shareBillModal");
  const overlay = document.getElementById("shareBillOverlay");

  // Remove active class from both modal and overlay simultaneously
  // This allows both to animate out at the same time
  modal.classList.remove("active");
  overlay.classList.remove("active");
}

// Function to hide the Finalise Settle Bill screen
function hideFinaliseSettleBillScreen() {
  // Hide the Finalise Settle Bill screen
  const finaliseScreen = document.getElementById("finaliseSettleBillScreen");
  if (finaliseScreen) {
    finaliseScreen.classList.remove("active");
    finaliseScreen.classList.add("inactive");
  }

  // Show the addSettleItemView screen
  const addSettleItemView = document.getElementById("addSettleItemView");
  if (addSettleItemView) {
    addSettleItemView.classList.add("active");
  }

  // Keep the settle now screen active
  const settleNowScreen = document.getElementById("settleNowScreen");
  if (settleNowScreen) {
    settleNowScreen.classList.remove("inactive");
    settleNowScreen.classList.add("active");
  }
  showSettleView("addSettleItemView");

  showSummary();
  // Navigate to add settle item view
}

// Initialize drag functionality for the bill summary modal
function initializeBillSummaryDrag() {
  const modal = document.getElementById("billSummaryModal");
  const overlay = document.getElementById("billSummaryOverlay");
  const dragHandle = document.querySelector(".bill-summary-drag-handle");
  let startY = 0;
  let startTop = 0;
  let currentState = "peeking";

  // Initially hide the modal until we're in the right view
  modal.style.display = "none";

  // Touch event handlers for the drag handle
  dragHandle.addEventListener("touchstart", handleDragStart);
  dragHandle.addEventListener("touchmove", handleDragMove);
  dragHandle.addEventListener("touchend", handleDragEnd);

  // Mouse event handlers for desktop (optional)
  dragHandle.addEventListener("mousedown", handleDragStart);
  document.addEventListener("mousemove", handleDragMove);
  document.addEventListener("mouseup", handleDragEnd);

  // Overlay click handler to close the modal
  overlay.addEventListener("click", function () {
    // Just minimize to peeking state, don't hide completely
    modal.classList.remove("fully-open", "half-open");
    modal.classList.add("peeking");

    // Hide the overlay
    overlay.classList.remove("active");
  });

  let isDragging = false;

  function handleDragStart(e) {
    isDragging = true;
    startY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;

    // Get the current position from the transform
    const style = window.getComputedStyle(modal);
    startTop = parseInt(style.bottom);

    e.preventDefault();
  }

  function handleDragMove(e) {
    if (!isDragging) return;

    const currentY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;
    const deltaY = startY - currentY;

    // Calculate new position (delta is inverted because we're moving from bottom)
    let newBottom = startTop + deltaY;

    // Constrain the modal to stay within bounds
    const modalHeight = modal.offsetHeight;
    newBottom = Math.min(0, Math.max(-modalHeight + 100, newBottom));

    // Update modal position
    modal.style.bottom = `${newBottom}px`;

    // Update overlay opacity based on modal position
    const progress = (newBottom + modalHeight) / modalHeight;
    overlay.style.opacity = Math.max(0, Math.min(0.5, progress));

    e.preventDefault();
  }

  function handleDragEnd(e) {
    if (!isDragging) return;
    isDragging = false;

    // Get final position
    const style = window.getComputedStyle(modal);
    const finalBottom = parseInt(style.bottom);
    const modalHeight = modal.offsetHeight;

    // Determine which state to snap to based on position
    if (finalBottom > -modalHeight * 0.25) {
      // Almost at the top - fully open
      modal.classList.remove("peeking", "half-open");
      modal.classList.add("fully-open");
      currentState = "fully-open";
      overlay.classList.add("active");
    } else if (finalBottom > -modalHeight * 0.75) {
      // In the middle - half open
      modal.classList.remove("peeking", "fully-open");
      modal.classList.add("half-open");
      currentState = "half-open";
      overlay.classList.add("active");
    } else {
      // Near the bottom - peeking
      modal.classList.remove("fully-open", "half-open");
      modal.classList.add("peeking");
      currentState = "peeking";
      overlay.classList.remove("active");
    }

    // Reset any inline styles to use the CSS classes
    modal.style.bottom = "";
    overlay.style.opacity = "";
  }
}

// Function to reset the loading animation
function resetLoadingAnimation() {
  const loadingScreen = document.getElementById("loadingScreen");
  const loadingBar = loadingScreen.querySelector(".loading-bar");

  // Reset the loading bar width to 0
  loadingBar.style.transition = "none";
  loadingBar.style.width = "0";

  // Force a reflow
  void loadingBar.offsetWidth;

  // Restore the transition
  loadingBar.style.transition = "width 2s ease-in-out";
}

// Initialize swipe detection for the add item view and finalise bill screen
function initializeSwipeGesture() {
  const addSettleItemView = document.getElementById("addSettleItemView");
  const finaliseSettleBillScreen = document.getElementById("finaliseSettleBillScreen");
  let startY = 0;
  let startTime = 0;

  // Function to handle touch start for both screens
  const handleTouchStart = function (e) {
    startY = e.touches[0].clientY;
    startTime = new Date().getTime();
  };

  // Function to handle touch end for both screens
  const handleTouchEnd = function (e) {
    const endY = e.changedTouches[0].clientY;
    const endTime = new Date().getTime();
    const deltaY = startY - endY;
    const deltaTime = endTime - startTime;

    // If the swipe is quick enough and long enough
    if (deltaTime < 300 && deltaY > 50) {
      showSummary("fully-open");
    }
  };

  // Add event listeners to add settle item view
  addSettleItemView.addEventListener("touchstart", handleTouchStart);
  addSettleItemView.addEventListener("touchend", handleTouchEnd);

  // Add event listeners to finalise settle bill screen
  finaliseSettleBillScreen.addEventListener("touchstart", handleTouchStart);
  finaliseSettleBillScreen.addEventListener("touchend", handleTouchEnd);

  // Initialize the bill summary drag functionality
  initializeBillSummaryDrag();
}

function showSettings() {
  // Original code
  const popup = document.getElementById("settingsPopup");
  popup.style.display = "block";
}

function closeSettings() {
  const popup = document.getElementById("settingsPopup");
  popup.style.display = "none";
}

function saveSettings() {
  const profile = document.getElementById("taxProfile").value;
  const serviceValue = document.getElementById("serviceChargeValue")?.value || "10";
  document.getElementById("serviceRate").textContent = `${serviceValue}%`;
  document.getElementById("gstRate").textContent = profile === "singapore" ? "9%" : "6%";
  updateGSTCheckboxLabel(profile);
  closeSettings();
}

function addMemberPopup(mode = "new") {
  editMode = mode === "edit";
  document.getElementById("newMemberName").value = "";
  document.getElementById("addMemberPopup").style.display = "block";
}

function closeAddMember() {
  document.getElementById("addMemberPopup").style.display = "none";
}

function saveNewMember() {
  const name = document.getElementById("newMemberName").value.trim();
  if (!name) {
    showError("Please enter a member name.");
    return;
  }
  if (members.includes(name)) {
    showError("This name is already added.");
    return;
  }
  members.push(name);
  if (editMode) {
    updateEditGroupList();
  } else {
    updateMemberList();
  }
  closeAddMember();
  clearError();
  document.getElementById("next2").disabled = false;
}

function updateMemberList() {
  const list = document.getElementById("memberList");
  list.innerHTML = "";
  members.forEach((member, index) => {
    const li = document.createElement("li");
    li.textContent = member;
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = () => editMember(index);
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.onclick = () => removeMember(index);
    li.appendChild(editBtn);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

// Remove member
function removeMember() {
  const nameInput = document.getElementById("editMemberName");
  const memberName = nameInput.dataset.originalName;

  // Remove from members array - find index using the name property
  const index = members.findIndex((member) =>
    typeof member === "object" ? member.name === memberName : member === memberName
  );

  if (index !== -1) {
    members.splice(index, 1);
  }

  // Remove from UI
  const memberItems = document.querySelectorAll(".member-item");
  memberItems.forEach((item) => {
    if (item.dataset.name === memberName) {
      // Add fade-out animation
      item.style.opacity = "0";
      item.style.transform = "translateY(10px)";
      setTimeout(() => {
        item.remove();
      }, 300);
    }
  });

  // Close the modal
  hideModal("editMemberModal");
}

function editMember(index) {
  editingIndex = index;
  document.getElementById("editMemberName").value = members[index];
  document.getElementById("editMemberPopup").style.display = "block";
}

function closeEditMember() {
  document.getElementById("editMemberPopup").style.display = "none";
  editingIndex = -1;
}

// Save an edited member name
function saveEditedMember() {
  const nameInput = document.getElementById("editMemberName");
  const newName = nameInput.value.trim();
  const originalName = nameInput.dataset.originalName;
  const inputField = nameInput.closest(".input-field");
  const errorMessage = inputField.querySelector(".error-message");
  const avatarElement = document.querySelector(".edit-member-avatar");
  const avatarNumber = avatarElement.dataset.avatarNumber;

  // Validate input
  if (!newName) {
    inputField.classList.add("error");
    errorMessage.classList.add("visible");
    return;
  }

  // Check if the name already exists and it's not the one being edited
  if (
    members.some((member) => {
      const memberName = typeof member === "object" ? member.name : member;
      return memberName === newName && memberName !== originalName;
    })
  ) {
    inputField.classList.add("error");
    errorMessage.textContent = "This name already exists";
    errorMessage.classList.add("visible");
    return;
  }

  // Update the name in the members array
  const index = members.findIndex((member) => {
    return typeof member === "object" ? member.name === originalName : member === originalName;
  });

  if (index !== -1) {
    // If member is a string (old format), convert to object with avatar
    if (typeof members[index] === "string") {
      members[index] = {
        name: newName,
        avatar: avatarNumber,
      };
    } else {
      // Just update the name
      members[index].name = newName;
    }
  }

  // Update the UI
  const memberItems = document.querySelectorAll(".member-item");
  memberItems.forEach((item) => {
    if (item.dataset.name === originalName) {
      // Update both the dataset and the displayed name
      item.dataset.name = newName;
      item.querySelector(".member-name").textContent = newName;
    }
  });

  // Close the modal
  hideModal("editMemberModal");
}

function editGroupMembers() {
  if (!currentGroup) return;
  updateEditGroupList();
  document.getElementById("editGroupPopup").style.display = "block";
}

function closeEditGroup() {
  document.getElementById("editGroupPopup").style.display = "none";
}

function updateEditGroupList() {
  const list = document.getElementById("editGroupList");
  list.innerHTML = "";
  members.forEach((member, index) => {
    const li = document.createElement("li");
    li.textContent = member;
    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = () => editMember(index);
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.onclick = () => removeMember(index);
    li.appendChild(editBtn);
    li.appendChild(removeBtn);
    list.appendChild(li);
  });
}

function saveEditedGroup() {
  if (members.length === 0) {
    showError("Please add at least one member.");
    return;
  }
  dishes = [];
  updateDishList();
  closeSummary();
  document.getElementById("dishMembers").innerHTML = "";
  document.getElementById("next3").disabled = true;
  groups[currentGroup] = [...members];
  localStorage.setItem("groups", JSON.stringify(groups));
  loadMembersForDrag();
  closeEditGroup();
  showError("Group members updated. All dishes have been cleared.");
}

function saveAsGroup() {
  document.getElementById("groupName").value = "";
  document.getElementById("groupMembersPreview").textContent = members.join(", ");
  document.getElementById("saveGroupPopup").style.display = "block";
}

function closeSaveGroup() {
  document.getElementById("saveGroupPopup").style.display = "none";
}

function confirmSaveGroup() {
  const groupName = document.getElementById("groupName").value.trim();
  if (!groupName) {
    showError("Please enter a group name.");
    return;
  }
  if (groups[groupName]) {
    showError("Group name already exists. Choose a different name.");
    return;
  }
  groups[groupName] = [...members];
  currentGroup = groupName;
  localStorage.setItem("groups", JSON.stringify(groups));
  updateGroupSelect();
  document.getElementById("editGroupBtn").style.display = "inline";
  document.getElementById("saveGroupBtn").style.display = "none";
  closeSaveGroup();
  clearError();
}

function updateGroupSelect() {
  const select = document.getElementById("groupSelect");
  select.innerHTML = ""; // Clear existing options
  Object.keys(groups).forEach((group) => {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "group"; // Group name for radio buttons
    radio.value = group;
    label.appendChild(radio);
    label.appendChild(document.createTextNode(group));
    select.appendChild(label);

    // Add onchange event to each radio button
    radio.onchange = () => {
      document.getElementById("next1").disabled = !radio.checked; // Enable if checked
    };
  });
}

function updateGroupActions() {
  document.getElementById("editGroupBtn").style.display = currentGroup ? "inline" : "none";
  document.getElementById("saveGroupBtn").style.display = currentGroup ? "none" : "inline";
}

function fetchHistory() {
  const billIds = JSON.parse(localStorage.getItem("billHistory") || "[]");
  const historyList = document.querySelector(".history-list");
  const historyLoading = document.querySelector(".history-loading");

  // Show loading spinner
  if (historyLoading) {
    historyLoading.classList.add("active");
  }

  // Clear previous content
  historyList.innerHTML = "";

  // Show skeleton loading placeholders
  const placeholdersCount = billIds.length > 0 ? Math.min(billIds.length, 5) : 3;

  for (let i = 0; i < placeholdersCount; i++) {
    const placeholder = document.createElement("div");
    placeholder.className = "loading-placeholder";
    historyList.appendChild(placeholder);
  }

  if (billIds.length === 0) {
    // Add slight delay before showing no history message for better UX
    setTimeout(() => {
      // Hide loading spinner
      if (historyLoading) {
        historyLoading.classList.remove("active");
      }
      historyList.innerHTML = "<p class='no-history'>No history yet.</p>";
      document.getElementById("clearHistoryBtn").style.display = "none";
    }, 800);
    return;
  } else {
    document.getElementById("clearHistoryBtn").style.display = "block";
  }

  Promise.all(
    billIds.map((id) =>
      fetch(`/result/${id}`, {
        headers: {
          Accept: "application/json",
        },
      })
        .then((res) => {
          if (!res.ok) throw new Error("Bill not found");
          return res.json();
        })
        .then((data) => {
          // Use the full data object for creating UI elements
          const timestamp =
            JSON.parse(localStorage.getItem(`bill:${id}`) || "{}").timestamp || data.timestamp || Date.now();
          return { ...data, id, timestamp };
        })
        .catch((error) => {
          console.error("Error fetching bill:", error);
          return null;
        })
    )
  )
    .then((bills) => {
      // Add slight delay for better UX
      setTimeout(() => {
        // Hide loading spinner
        if (historyLoading) {
          historyLoading.classList.remove("active");
        }

        // Clear skeleton loaders
        historyList.innerHTML = "";

        const validBills = bills.filter((bill) => bill);
        if (validBills.length === 0) {
          historyList.innerHTML = "<p class='no-history'>No valid history found.</p>";
          return;
        }

        validBills
          .sort((a, b) => b.timestamp - a.timestamp) // Newest first
          .forEach((bill) => {
            // Create a settle item that matches the design
            const settleItem = document.createElement("a");
            settleItem.href = `/result/${bill.id}`;
            settleItem.target = "_blank";
            settleItem.className = "settle-item";

            // Format date
            const date = new Date(bill.timestamp);
            const formattedDate = date.toLocaleString();

            // Get total amount from the breakdown
            const total = bill.breakdown?.total || 0;
            const formattedTotal = `$${total.toFixed(2)}`;

            // Get settle matter
            const settleMatter = bill.settleMatter || "Settlement";

            // Get members (if available)
            const members = bill.members || [];

            // Create avatars for members (up to 5)
            const membersAvatars = members
              .slice(0, 5)
              .map(
                (member) =>
                  `<div class="avatar">
                <img class="avatar-img" src="assets/cat-icon/cat-${member.avatar || 1}.svg" />
              </div>`
              )
              .join("");

            // Add + indicator if more than 5 members
            const plusIndicator = members.length > 5 ? "+" : "";

            settleItem.innerHTML = `
              <div class="settle-top">
                <div class="settle-info">
                  <p class="settle-info-amount">${formattedTotal}</p>
                  <p class="settle-info-matter">${settleMatter}</p>
                  <p class="settle-info-group">${members.length} members</p>
                </div>
                <div class="settle-arrow">
                  <img src="assets/arrow.svg" alt="arrow" />
                </div>
              </div>
              <div class="settle-bottom">
                <div class="settle-info-date">
                  <span>${formattedDate}</span>
                </div>
                <div class="settle-avatar">
                  <div class="avatar-group">
                    ${membersAvatars}
                    ${plusIndicator}
                  </div>
                </div>
              </div>
            `;

            historyList.appendChild(settleItem);
          });
      }, 800); // Delay for better UX
    })
    .catch((err) => {
      // Hide loading spinner
      if (historyLoading) {
        historyLoading.classList.remove("active");
      }

      historyList.innerHTML = "";
      historyList.innerHTML = "<p class='no-history'>Error loading history. Please try again.</p>";
      console.error("Error loading history:", err);
    });
}

// New function to delete the selected group
function deleteSelectedGroup() {
  const selectedGroup = document.querySelector('input[name="group"]:checked');
  if (!selectedGroup) {
    showError("Please select a group to delete.");
    return;
  }
  const groupName = selectedGroup.value;
  delete groups[groupName];
  localStorage.setItem("groups", JSON.stringify(groups));
  updateGroupSelect(); // Refresh the group list
  showError(`Group "${groupName}" has been deleted.`);
}

function moveWithCalc(id) {
  const container = document.getElementById("navbarContainer");
  const containerWidth = container.offsetWidth;
  const numBubbles = 3;
  const spacing = containerWidth / numBubbles;

  // Calculate position based on container width
  const position = spacing * (id - 0.5) + "px";

  // Define theme classes for each menu item
  const themeClasses = {
    1: "theme-history",
    2: "theme-home",
    3: "theme-settings",
  };

  moveWithClass(id, position, themeClasses[id]);

  // Switch to the corresponding page
  switchPage(id);
}

// Function to handle window resize
function handleResize() {
  if (currentActiveBubble) {
    moveWithCalc(currentActiveBubble);
  }
}

// Updated move function to use classes instead of direct colors
function moveWithClass(id, position, themeClass) {
  // Update current active bubble
  currentActiveBubble = id;

  // Remove previous theme classes
  const container = document.getElementById("navbarContainer");
  const bg = document.getElementById("navbg");

  // Reset all menu elements and bubbles
  for (let i = 1; i <= 3; i++) {
    const bubble = document.getElementById(`bubble${i}`);
    const menuElement = document.getElementById(`menu${i}`);

    // Reset bubbles
    bubble.style.transform = "translateY(150%)";
    bubble.style.boxShadow = "none";
    bubble.classList.remove("bubble-bounce");
    document.getElementById(`bubble${i}`).querySelector(".icon").style.opacity = 0;

    // Reset menu elements
    menuElement.classList.remove("active");
    menuElement.style.opacity = "0.4";
  }

  // Remove all theme classes
  ["theme-history", "theme-home", "theme-settings"].forEach((cls) => {
    container.classList.remove(cls);
    bg.classList.remove(cls);
  });

  // Add new theme class
  container.classList.add(themeClass);
  bg.classList.add(themeClass);

  // Animate active bubble with a slight delay
  setTimeout(() => {
    const activeBubble = document.getElementById(`bubble${id}`);
    activeBubble.style.transform = ""; // Remove inline transform to allow CSS animation
    activeBubble.classList.add("bubble-bounce");
    activeBubble.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)";
    activeBubble.querySelector(".icon").style.opacity = 0.7;

    // Hide the corresponding menu element
    const activeMenu = document.getElementById(`menu${id}`);
    activeMenu.classList.add("active");
  }, 50);
}

// Toggle dark mode
function toggleDarkMode() {
  if (document.body.classList.contains("dark-mode")) {
    document.body.classList.remove("dark-mode");
    localStorage.setItem("darkMode", "disabled");
  } else {
    document.body.classList.add("dark-mode");
    localStorage.setItem("darkMode", "enabled");
  }
}

// Update tax rates based on profile
function updateTaxRates(profile) {
  const serviceRate = document.getElementById("serviceRate");
  const gstRate = document.getElementById("gstRate");

  // Update GST checkbox label
  updateGSTCheckboxLabel(profile);

  // Update service charge label
  const serviceValue = document.getElementById("serviceChargeValue")?.value || "10";
  serviceRate.textContent = `${serviceValue}%`;

  // GST/VAT rates differ
  if (profile === "singapore") {
    gstRate.textContent = "9%";
  } else if (profile === "malaysia") {
    gstRate.textContent = "6%";
  }
}

// Update the GST checkbox label based on the selected tax profile
function updateGSTCheckboxLabel(profile) {
  const gstCheckboxLabel = document.querySelector('label[for="gstCheckbox"]');
  if (gstCheckboxLabel) {
    const rate = profile === "singapore" ? "9%" : "6%";
    gstCheckboxLabel.textContent = `Add ${rate} GST`;
  }
}

// Show the Settle Now screen
function showSettleNowScreen() {
  // Hide all pages
  Object.values(pageContainers).forEach((containerId) => {
    const container = document.getElementById(containerId);
    if (container) {
      container.classList.remove("active");
      container.classList.add("inactive");
    }
  });

  // Show the Settle Now screen
  const settleNowScreen = document.getElementById("settleNowScreen");
  settleNowScreen.classList.remove("inactive");
  settleNowScreen.classList.add("active");

  // Check if there are any saved groups
  const hasSavedGroups = Object.keys(groups).length > 0;

  // If no saved groups, hide the saved group option and select new group
  if (!hasSavedGroups) {
    document.querySelector(".saved-group-option").style.display = "none";
    document.querySelector(".or-divider").style.display = "none";
    document.querySelector(".new-group-option").classList.add("selected");
  }

  // Reset to initial settle view
  showSettleView("settleChoiceView");

  // Hide navbar
  document.getElementById("navbarContainer").classList.add("navbar-hidden");
}

// Hide the Settle Now screen and go back to home
function hideSettleNowScreen() {
  // Hide the settle now screen
  const settleNowScreen = document.getElementById("settleNowScreen");
  settleNowScreen.classList.remove("active");
  settleNowScreen.classList.add("inactive");

  // Show the home screen
  const homeContainer = document.getElementById("homeContainer");
  homeContainer.classList.remove("inactive");
  homeContainer.classList.add("active");

  // Show navbar again
  document.getElementById("navbarContainer").classList.remove("navbar-hidden");

  // Completely hide the bill summary when leaving the settle now screen
  const modal = document.getElementById("billSummaryModal");
  if (modal) {
    modal.style.display = "none";
    modal.classList.remove("peeking", "half-open", "fully-open");
  }

  // Hide the overlay
  const overlay = document.getElementById("billSummaryOverlay");
  if (overlay) {
    overlay.classList.remove("active");
  }
}

// Function to switch between views
function showSettleView(viewId) {
  // Hide all views
  document.querySelectorAll(".settle-view").forEach((view) => {
    view.classList.remove("active");
  });

  // Hide the finalise bill screen as it's not a regular settle-view
  const finaliseScreen = document.getElementById("finaliseSettleBillScreen");
  if (finaliseScreen) {
    finaliseScreen.classList.remove("active");
    finaliseScreen.classList.add("inactive");
  }

  // Show the requested view
  const viewToShow = document.getElementById(viewId);
  if (viewToShow) {
    viewToShow.classList.add("active");
    currentSettleView = viewId;
  }

  // Special handling for views outside the white-slide-container
  const whiteSlideContainer = document.querySelector(".white-slide-container");
  if (viewId === "addSettleItemView" || viewId === "finaliseSettleBillScreen") {
    whiteSlideContainer.classList.add("hidden");
    // Show the bill summary when in Add Settle Item view
    toggleBillSummaryVisibility(true);
  } else {
    whiteSlideContainer.classList.remove("hidden");
    // Hide the bill summary in all other views
    toggleBillSummaryVisibility(false);
  }

  const settleNowScreen = document.getElementById("settleNowScreen");
  if (viewId === "loadingScreen") {
    settleNowScreen.classList.remove("active");
    settleNowScreen.classList.add("inactive");
  }

  const loadingScreen = document.getElementById("loadingScreen");
  if (viewId === "successScreen") {
    loadingScreen.classList.remove("active");
    loadingScreen.classList.add("inactive");
    showSuccessScreen();
  }

  // Update header text based on current view
  updateSettleNowHeader();
}

// Update the header text based on current view
function updateSettleNowHeader() {
  const header = document.querySelector(".settle-now-header h1");
  if (currentSettleView === "settleChoiceView") {
    header.textContent = "Settle Now?";
  } else if (currentSettleView === "newGroupMembersView") {
    if (isEditingGroup) {
      header.textContent = "Edit Group";
    } else {
      header.textContent = "Settle Now?";
    }
  } else if (currentSettleView === "addSettleItemView") {
    header.textContent = "Add Settle Item";
  } else if (currentSettleView === "savedGroupsView") {
    header.textContent = "Settle With Saved Group";
  } else if (currentSettleView === "finaliseSettleBillScreen") {
    header.textContent = "Finalise Settle Bill";
  }

  // Check if finaliseSettleBillScreen is active and update its header separately
  const finaliseScreen = document.getElementById("finaliseSettleBillScreen");
  if (finaliseScreen && finaliseScreen.classList.contains("active")) {
    const finaliseHeader = finaliseScreen.querySelector(".settle-now-header h1");
    if (finaliseHeader) {
      finaliseHeader.textContent = "Finalise Settle Bill";
    }
  }
}

// Handle back button functionality based on current view
function handleSettleBackButton() {
  if (currentSettleView === "settleChoiceView") {
    // If on main settle screen, go back to home
    hideSettleNowScreen();
  } else if (currentSettleView === "newGroupMembersView") {
    // If editing a group, return to saved groups view
    if (isEditingGroup) {
      isEditingGroup = false;
      showSettleView("savedGroupsView");
      // Update the header to match the saved groups view
      updateSettleNowHeader();
    } else {
      // If on new group members view, go back to settle choice
      showSettleView("settleChoiceView");
    }
  } else if (currentSettleView === "addSettleItemView") {
    // Show the back confirmation modal
    showModal("backConfirmModal");
  } else if (currentSettleView === "savedGroupsView") {
    // If on saved groups view, go back to settle choice
    showSettleView("settleChoiceView");
  } else if (currentSettleView === "finaliseSettleBillScreen") {
    hideFinaliseSettleBillScreen();
  }
}

// Function to load and render saved groups
function loadSavedGroups() {
  const groupsList = Object.keys(groups);
  const container = document.querySelector(".saved-groups-list-container");
  const noGroupsMessage = document.querySelector(".no-saved-groups");

  // Clear previous content
  container.innerHTML = "";

  if (groupsList.length === 0) {
    // Show no groups message
    noGroupsMessage.style.display = "flex";
    document.querySelector(".saved-groups-next-btn").disabled = true;
  } else {
    // Hide no groups message and show groups
    noGroupsMessage.style.display = "none";
    document.querySelector(".saved-groups-next-btn").disabled = false;

    // Add each group to the container with increasing delays
    groupsList.forEach((groupName, index) => {
      const membersList = groups[groupName];
      const card = createSavedGroupCard(groupName, membersList, index);
      container.appendChild(card);
    });
  }
}

// Create a saved group card element
function createSavedGroupCard(groupName, membersList, cardIndex) {
  const card = document.createElement("div");
  card.className = "saved-group-card";
  card.dataset.groupName = groupName;
  const baseDelay = 0.2 + cardIndex * 0.2; // Base delay increases by 0.2s for each card
  card.style.animationDelay = `${baseDelay}s`; // Add initial delay for the card

  // Create title
  const title = document.createElement("div");
  title.className = "saved-group-title";
  title.textContent = groupName;
  title.style.animationDelay = `${baseDelay + 0.1}s`; // Slightly delayed after card

  // Create members area
  const membersContainer = document.createElement("div");
  membersContainer.className = "saved-group-members";
  membersContainer.style.animationDelay = `${baseDelay + 0.2}s`; // Delayed after title

  // Show all member avatars
  const displayMembers = membersList;

  displayMembers.forEach((member, index) => {
    const avatarWrapper = document.createElement("div");
    avatarWrapper.className = "member-avatar-wrapper";
    avatarWrapper.style.animationDelay = `${baseDelay + 0.3 + index * 0.2}s`; // Stagger the avatar animations

    const avatarIcon = document.createElement("div");
    avatarIcon.className = "member-avatar";

    // Create img element for cat avatar
    const img = document.createElement("img");

    // Determine the avatar number based on member format
    let memberName, avatarNumber;

    if (typeof member === "object" && member.name) {
      memberName = member.name;
      avatarNumber = member.avatar || Math.floor(Math.random() * 12) + 1;
    } else {
      memberName = member;
      // For backward compatibility with old format, generate a consistent avatar
      // based on the member's name string
      const nameHash = memberName.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
      avatarNumber = Math.abs(nameHash % 12) + 1;
    }

    img.src = `assets/cat-icon/cat-${avatarNumber}.svg`;
    img.alt = `Cat avatar ${avatarNumber}`;
    img.className = "cat-avatar-img saved-group-avatar-img";

    avatarIcon.appendChild(img);
    avatarWrapper.appendChild(avatarIcon);

    // Add member name
    const memberNameElement = document.createElement("div");
    memberNameElement.className = "member-name";
    memberNameElement.textContent = memberName;
    avatarWrapper.appendChild(memberNameElement);

    membersContainer.appendChild(avatarWrapper);
  });

  // Add member count
  const memberCount = document.createElement("div");
  memberCount.className = "member-count";
  memberCount.style.animationDelay = `${baseDelay + 0.6}s`; // Delayed after avatars

  // Show total members count
  memberCount.textContent = `${membersList.length} members`;

  // Create action buttons
  const actionButtons = document.createElement("div");
  actionButtons.className = "action-buttons";
  actionButtons.style.animationDelay = `${baseDelay + 0.7}s`; // Delayed after member count

  // Edit button
  const editBtn = document.createElement("button");
  editBtn.className = "group-action-btn edit-btn";
  editBtn.innerHTML = "<img class='group-action-btn-img' src='assets/edit.svg' alt='Edit' />";
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    editSavedGroup(groupName, e);
  });

  // Delete button
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "group-action-btn delete-btn";
  deleteBtn.innerHTML = "<img class='group-action-btn-img' src='assets/bin.svg' alt='Delete' />";
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteSavedGroup(groupName, e);
  });

  actionButtons.appendChild(editBtn);
  actionButtons.appendChild(deleteBtn);

  // Add all elements to card
  card.appendChild(title);
  card.appendChild(membersContainer);
  card.appendChild(memberCount);
  card.appendChild(actionButtons);

  // Make the whole card clickable to select it
  card.addEventListener("click", () => {
    selectSavedGroup(groupName);
  });

  return card;
}

// Function to select a saved group
function selectSavedGroup(groupName) {
  // Deselect all cards first
  document.querySelectorAll(".saved-group-card").forEach((card) => {
    card.classList.remove("selected");
  });

  // Select the clicked card
  const selectedCard = document.querySelector(`.saved-group-card[data-group-name="${groupName}"]`);
  if (selectedCard) {
    selectedCard.classList.add("selected");
    currentGroup = groupName;
    members = [...groups[groupName]];
    savedGroupError.style.display = "none";
  }
}

// Function to edit a saved group
function editSavedGroup(groupName, event) {
  // Set the editing flag
  isEditingGroup = true;

  // Set the current group
  currentGroup = groupName;

  // Load group members
  members = [...groups[groupName]];

  // Navigate to the new group members view
  showSettleView("newGroupMembersView");

  // Update the title to show we're editing
  document.querySelector(".new-group-members-container h2").textContent = "Edit Group Members";

  // Change the Next button text to Done
  document.querySelector(".next-btn").textContent = "Done";

  // Initialize the member list with the loaded members
  initializeMemberList();

  // Stop event propagation if event is provided
  if (event) {
    event.stopPropagation();
  }
}

// Function to delete a saved group with confirmation
function deleteSavedGroup(groupName, event) {
  if (event) {
    event.stopPropagation();
  }

  // Store the group name for the confirmation
  document.getElementById("deleteGroupModal").dataset.groupName = groupName;

  // Show the delete confirmation modal
  showModal("deleteGroupModal");
}

// Show modal function
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    // First set display to flex, then add the active class after a small delay
    // This allows the CSS transition to work properly
    modal.style.display = "flex";
    setTimeout(() => {
      modal.classList.add("active");
    }, 10);

    // Reset any form errors
    const errorMessages = modal.querySelectorAll(".error-message");
    errorMessages.forEach((el) => el.classList.remove("visible"));

    const inputFields = modal.querySelectorAll(".input-field");
    inputFields.forEach((el) => el.classList.remove("error"));

    // Reset form inputs only for the add member modal, not the edit modal
    if (modalId === "addMemberModal") {
      const inputs = modal.querySelectorAll("input");
      inputs.forEach((input) => (input.value = ""));
    }
  }
}

// Hide modal function
function hideModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    const modalContent = modal.querySelector(".modal-content");

    // Add closing classes to trigger animations
    modal.classList.add("closing");
    if (modalContent) {
      modalContent.classList.add("closing");
    }

    // Wait for animation to complete before hiding
    setTimeout(() => {
      modal.classList.remove("active", "closing");
      if (modalContent) {
        modalContent.classList.remove("closing");
      }
      modal.style.display = "none";
    }, 300);
  }
}

// Show the Group Members view with selected group
function showGroupMembersView(groupName) {
  // If a group is selected, load its members
  if (groupName && groups[groupName]) {
    currentGroup = groupName;
    members = [...groups[groupName]];
  } else {
    // Default empty members array if no group selected
    members = [];
    currentGroup = "";
  }

  // Update the UI to show members
  initializeMemberList();

  // Reset Next button text to "Next"
  document.querySelector(".next-btn").textContent = "Next";

  // Show the group members view
  showSettleView("newGroupMembersView");
}

// Save the current members to localStorage
function saveGroupToStorage() {
  if (currentGroup) {
    groups[currentGroup] = [...members];
    localStorage.setItem("groups", JSON.stringify(groups));
    console.log(`Saved group "${currentGroup}" with ${members.length} members`);
  }
}

// Add member to UI
function addMemberToUI(memberName, avatarNumber) {
  const memberList = document.querySelector(".member-list");

  const memberItem = document.createElement("div");
  memberItem.className = "member-item";
  memberItem.dataset.name = memberName; // Store member name as data attribute
  // Add animation delay based on the number of existing members
  const existingMembers = document.querySelectorAll(".member-item").length;
  memberItem.style.animationDelay = `${(existingMembers + 1) * 0.15}s`;

  const avatarDiv = document.createElement("div");
  avatarDiv.className = "member-avatar";

  // Create img element for cat avatar
  const img = document.createElement("img");
  img.src = `assets/cat-icon/cat-${avatarNumber}.svg`;
  img.alt = `Cat avatar ${avatarNumber}`;
  img.className = "cat-avatar-img";
  avatarDiv.appendChild(img);

  // Store the avatar number as data attribute
  avatarDiv.dataset.avatarNumber = avatarNumber;

  const nameDiv = document.createElement("div");
  nameDiv.className = "member-name";
  nameDiv.textContent = memberName;

  memberItem.appendChild(avatarDiv);
  memberItem.appendChild(nameDiv);

  // Add click event to open edit modal
  memberItem.addEventListener("click", function () {
    // Use the current text content from the nameDiv rather than the original memberName variable
    // This ensures we get the updated name if it was edited
    const currentName = nameDiv.textContent;
    const currentAvatar = avatarDiv.dataset.avatarNumber;
    openEditMemberModal(currentName, currentAvatar);
  });

  memberList.appendChild(memberItem);
}

// Open edit member modal
function openEditMemberModal(memberName, avatarNumber) {
  const modal = document.getElementById("editMemberModal");
  const nameInput = document.getElementById("editMemberName");
  const avatarElement = document.querySelector(".edit-member-avatar");

  // Set values
  nameInput.value = memberName;

  // Clear previous avatar content
  avatarElement.innerHTML = "";

  // Create and add avatar image
  const img = document.createElement("img");
  img.src = `assets/cat-icon/cat-${avatarNumber}.svg`;
  img.alt = `Cat avatar ${avatarNumber}`;
  img.className = "cat-avatar-img";
  avatarElement.appendChild(img);

  // Store avatar number
  avatarElement.dataset.avatarNumber = avatarNumber;

  // Store original name as data attribute to identify the member being edited
  nameInput.dataset.originalName = memberName;

  // Show modal
  showModal("editMemberModal");
}

// Remove member
function removeMember() {
  const nameInput = document.getElementById("editMemberName");
  const memberName = nameInput.dataset.originalName;

  // Remove from members array - find index using the name property
  const index = members.findIndex((member) =>
    typeof member === "object" ? member.name === memberName : member === memberName
  );

  if (index !== -1) {
    members.splice(index, 1);
  }

  // Remove from UI
  const memberItems = document.querySelectorAll(".member-item");
  memberItems.forEach((item) => {
    if (item.dataset.name === memberName) {
      // Add fade-out animation
      item.style.opacity = "0";
      item.style.transform = "translateY(10px)";
      setTimeout(() => {
        item.remove();
      }, 300);
    }
  });

  // Close the modal
  hideModal("editMemberModal");
}

// Add a new member
function addNewMember() {
  const memberNameInput = document.getElementById("memberName");
  const memberName = memberNameInput.value.trim();
  const inputField = memberNameInput.closest(".input-field");
  const errorMessage = inputField.querySelector(".error-message");

  // Validate input
  if (!memberName) {
    inputField.classList.add("error");
    errorMessage.classList.add("visible");
    return;
  }

  // Check if the name already exists
  if (members.some((member) => (typeof member === "object" ? member.name === memberName : member === memberName))) {
    inputField.classList.add("error");
    errorMessage.textContent = "This name already exists";
    errorMessage.classList.add("visible");
    return;
  }

  // Generate a random avatar number (1-12)
  const avatarNumber = Math.floor(Math.random() * 12) + 1;

  // Add the member to the array as an object with name and avatar
  members.push({
    name: memberName,
    avatar: avatarNumber,
  });

  // Create and add the member to the UI
  addMemberToUI(memberName, avatarNumber);

  // Hide the modal
  hideModal("addMemberModal");
}

function clearHistory() {
  // Show the confirmation modal
  showModal("clearHistoryConfirmModal");
}

// Function to actually clear the history after confirmation
function confirmClearHistory() {
  // Get bill IDs from localStorage before removing them
  const billIds = JSON.parse(localStorage.getItem("billHistory") || "[]");

  // Show loading in the history list
  const historyList = document.querySelector(".history-list");
  if (historyList) {
    historyList.innerHTML = "<p class='no-history'>Clearing history...</p>";
  }

  // Only proceed with server deletion if there are IDs to delete
  if (billIds && billIds.length > 0) {
    // First delete from the server/database
    fetch("/history", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: billIds }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to clear history from server");
        }
        return response.text();
      })
      .then(() => {
        // Successfully deleted from server, now clear localStorage
        localStorage.removeItem("billHistory");
        Object.keys(localStorage)
          .filter((key) => key.startsWith("bill:"))
          .forEach((key) => localStorage.removeItem(key));

        // Refresh the history list
        fetchHistory();

        // Hide the confirmation modal
        hideModal("clearHistoryConfirmModal");

        // Show success toast
        showToast("historyClearedToast");
      })
      .catch((error) => {
        console.error("Error clearing history:", error);

        // Refresh the history list anyway to restore display
        fetchHistory();

        // Hide the confirmation modal
        hideModal("clearHistoryConfirmModal");
      });
  } else {
    // No IDs to delete from server, just clear localStorage
    localStorage.removeItem("billHistory");
    Object.keys(localStorage)
      .filter((key) => key.startsWith("bill:"))
      .forEach((key) => localStorage.removeItem(key));

    // Refresh the history list
    fetchHistory();

    // Hide the confirmation modal
    hideModal("clearHistoryConfirmModal");

    // Show the toast notification
    showToast("historyClearedToast");
  }
}

// Function to show a toast notification
function showToast(toastId) {
  const toast = document.getElementById(toastId);
  if (toast) {
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3000); // Hide after 3 seconds
  }
}

// Initialize page navigation event listeners
function initPageNavigation() {
  // Handle Settle Now button click from home screen
  document.getElementById("startSettleCard").addEventListener("click", function () {
    showSettleNowScreen();
  });

  // Handle Clear History button click
  document.getElementById("clearHistoryBtn")?.addEventListener("click", function () {
    clearHistory();
  });

  // Handle Confirm Clear History button click
  document.getElementById("confirmClearHistoryBtn")?.addEventListener("click", function () {
    confirmClearHistory();
  });

  // Handle Get Started button click
  document.querySelector(".get-started-btn").addEventListener("click", function () {
    const savedGroupSelected = document.querySelector(".saved-group-option").classList.contains("selected");
    const newGroupSelected = document.querySelector(".new-group-option").classList.contains("selected");

    if (savedGroupSelected) {
      // Check if we have saved groups
      if (Object.keys(groups).length > 0) {
        // Load and show saved groups view
        loadSavedGroups();
        showSettleView("savedGroupsView");
      } else {
        // No saved groups, show message
        alert("No saved groups found. Please create a new group first.");
        document.querySelector(".new-group-option").click();
      }
    } else if (newGroupSelected) {
      // Start with empty members
      members = [];
      currentGroup = "";

      // Make sure Next button says "Next"
      const nextBtn = document.querySelector(".next-btn");
      if (nextBtn) nextBtn.textContent = "Next";

      // Make sure title is correct
      const title = document.querySelector(".new-group-members-container h2");
      if (title) title.textContent = "Settle With New Group";

      // Reset editing flag
      isEditingGroup = false;

      showSettleView("newGroupMembersView");
      initializeMemberList();
      settleChoiceError.style.display = "none";
    } else {
      // No option selected, show message
      settleChoiceError.style.display = "block";
    }
  });

  // Handle Back button click on Settle Now screen
  document.querySelector(".back-button").addEventListener("click", function () {
    handleSettleBackButton();
  });

  // Handle saved group option click
  document.querySelector(".saved-group-option").addEventListener("click", function () {
    // Toggle selected state first
    this.classList.add("selected");
    document.querySelector(".new-group-option").classList.remove("selected");

    // Enable the Get Started button
    document.querySelector(".get-started-btn").disabled = false;
    settleChoiceError.style.display = "none";
  });

  // Handle new group option click
  document.querySelector(".new-group-option").addEventListener("click", function () {
    // Toggle selected state
    this.classList.add("selected");
    document.querySelector(".saved-group-option").classList.remove("selected");

    // Enable the Get Started button
    document.querySelector(".get-started-btn").disabled = false;
    settleChoiceError.style.display = "none";
  });

  // Handle Next button click in new group members view
  document.querySelector(".next-btn").addEventListener("click", function () {
    // If we're editing a group, save changes before proceeding
    if (isEditingGroup && currentGroup) {
      // Save the updated members to the group
      saveGroupToStorage();

      // Store the group name for the confirmation
      document.getElementById("groupUpdatedModal").dataset.groupName = currentGroup;

      // Show the group updated modal
      showModal("groupUpdatedModal");

      return;
    }

    // Set the previous view to settleChoiceView for proper back navigation
    previousView = "settleChoiceView";

    // Update the header text
    document.querySelector(".settle-now-header h1").textContent = "Add Settle Item";

    // Ensure the New favourite group button is visible since we're coming from new group
    const newFavouriteGroupBtn = document.querySelector(".new-favourite-group-btn");
    const successMessage = document.querySelector(".group-success-message");

    if (newFavouriteGroupBtn && successMessage) {
      newFavouriteGroupBtn.style.display = "flex";
      successMessage.classList.remove("visible");
    }

    // Load members into the UI
    updateSettleItemMembersUI();
  });

  // Handle add member button click
  document.querySelector(".add-member-button").addEventListener("click", function () {
    showModal("addMemberModal");
  });

  // Handle close modal buttons
  document.querySelectorAll(".close-modal").forEach(function (button) {
    button.addEventListener("click", function () {
      const modal = this.closest(".modal");
      hideModal(modal.id);
    });
  });

  // Handle add member submit button click
  document.querySelector(".add-member-submit").addEventListener("click", function () {
    addNewMember();
  });

  // Handle save edited member button click
  document.querySelector(".save-member-btn").addEventListener("click", function () {
    saveEditedMember();
  });

  // Handle remove member button click
  document.querySelector(".remove-member-btn").addEventListener("click", function () {
    removeMember();
  });

  // Handle Enter key press in member name inputs
  document.getElementById("memberName").addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      addNewMember();
    }
  });

  document.getElementById("editMemberName").addEventListener("keypress", function (e) {
    if (e.key === "Enter") {
      saveEditedMember();
    }
  });

  // Handle click outside the modals to close them
  document.querySelectorAll(".modal").forEach(function (modal) {
    modal.addEventListener("click", function (e) {
      if (e.target === this) {
        hideModal(this.id);
      }
    });
  });

  // Handle Next button click in saved groups view
  document.querySelector(".saved-groups-next-btn").addEventListener("click", function () {
    if (!currentGroup) {
      const savedGroupError = document.querySelector(".saved-group-error");
      savedGroupError.style.display = "block";
      return;
    } else {
      savedGroupError.style.display = "none";
    }

    // Store current view before navigating
    previousView = "savedGroupsView";

    // Navigate to add settle item view
    showSettleView("addSettleItemView");

    // Scroll the addSettleItemView container to the top
    const addSettleItemView = document.getElementById("addSettleItemView");
    if (addSettleItemView) {
      addSettleItemView.scrollTop = 0;
    }

    // Update UI with selected group members
    updateSettleItemMembersUI();

    // Show group name instead of "New favourite group?" button
    const newFavouriteGroupBtn = document.querySelector(".new-favourite-group-btn");
    const successMessage = document.querySelector(".group-success-message");
    const groupNameDisplay = document.querySelector(".group-name-display");

    if (newFavouriteGroupBtn && successMessage && groupNameDisplay) {
      // Hide the button and show success message with group name
      newFavouriteGroupBtn.style.display = "none";
      groupNameDisplay.textContent = `Group "${currentGroup}" selected`;
      successMessage.classList.add("visible");
    }
  });

  // Handle Next button click in new group members view
  document.querySelector(".new-group-next-btn").addEventListener("click", function () {
    //if no members, show error message
    if (members.length === 0 || members.length < 2) {
      const errorMessage = document.querySelector(".new-group-error-message");
      errorMessage.style.display = "block";
      return;
    } else {
      const errorMessage = document.querySelector(".new-group-error-message");
      errorMessage.style.display = "none";
      // Navigate to add settle item view
      showSettleView("addSettleItemView");

      // Scroll the addSettleItemView container to the top
      const addSettleItemView = document.getElementById("addSettleItemView");
      if (addSettleItemView) {
        addSettleItemView.scrollTop = 0;
      }

      // Update UI with selected group members
      updateSettleItemMembersUI();
    }
  });
}

// Set up bill summary modal close button
const billSummaryCloseBtn = document.querySelector("#billSummaryModal .summary-close-modal");
if (billSummaryCloseBtn) {
  billSummaryCloseBtn.addEventListener("click", function () {
    closeBillSummaryModal();
  });
}

function closeBillSummaryModal() {
  // Just minimize to peeking state, don't hide completely
  const modal = document.getElementById("billSummaryModal");
  modal.classList.remove("fully-open", "half-open");
  modal.classList.add("peeking");

  // Hide the overlay
  const overlay = document.getElementById("billSummaryOverlay");
  overlay.classList.remove("active");
}

// Make sure navbar is visible initially
const navbarContainer = document.getElementById("navbarContainer");
if (navbarContainer) {
  navbarContainer.classList.remove("navbar-hidden");
}

// Add Item button click handler
const addItemBtn = document.querySelector(".add-item-btn");
if (addItemBtn) {
  addItemBtn.addEventListener("click", function () {
    // Get item details
    const itemName = document.getElementById("itemName").value.trim();
    const itemPrice = document.getElementById("itemPrice").value.trim();
    const assignedMembers = Array.from(document.querySelector(".assigned-members").children).map(
      (item) => item.dataset.name
    );

    // Validate input
    let hasError = false;

    // Check item name
    if (!itemName) {
      document.getElementById("itemNameError").classList.add("visible");
      hasError = true;
    } else {
      document.getElementById("itemNameError").classList.remove("visible");
    }

    // Check item price
    if (!itemPrice) {
      document.getElementById("itemPriceError").classList.add("visible");
      hasError = true;
    } else {
      document.getElementById("itemPriceError").classList.remove("visible");
    }

    // Check if members are assigned
    if (assignedMembers.length === 0) {
      document.querySelector(".member-required-message").style.display = "block";
      hasError = true;
    } else {
      document.querySelector(".member-required-message").style.display = "none";
    }

    if (hasError) {
      return;
    }

    // Reset form
    document.getElementById("itemName").value = "";
    document.getElementById("itemPrice").value = "";
    document.querySelector(".assigned-members").innerHTML = "";
    document.getElementById("settleEqually").checked = false;

    // Create a new dish object
    const newDish = {
      name: itemName,
      cost: itemPrice,
      members: assignedMembers,
    };

    // Add the dish to the dishes array
    if (!dishes) dishes = [];
    dishes.push(newDish);

    // Show the bill summary
    showSummary();
  });
}

// New favourite group button handler
const newFavouriteGroupBtn = document.querySelector(".new-favourite-group-btn");
if (newFavouriteGroupBtn) {
  newFavouriteGroupBtn.addEventListener("click", function () {
    // Show the create group modal
    showModal("createGroupModal");

    // Reset the form
    const groupNameInput = document.getElementById("groupName");
    if (groupNameInput) {
      groupNameInput.value = "";
      const inputField = groupNameInput.closest(".input-field");
      inputField.classList.remove("error");
      const errorMessage = inputField.querySelector(".error-message");
      errorMessage.classList.remove("visible");
      errorMessage.textContent = "Please enter group's name";
    }
  });
}

// Cancel button in create group modal
const cancelGroupBtn = document.querySelector(".create-group-modal .cancel-btn");
if (cancelGroupBtn) {
  cancelGroupBtn.addEventListener("click", function () {
    hideModal("createGroupModal");
  });
}

// Confirm button in create group modal
const confirmGroupBtn = document.querySelector(".create-group-modal .confirm-btn");
if (confirmGroupBtn) {
  confirmGroupBtn.addEventListener("click", function () {
    const groupNameInput = document.getElementById("groupName");
    const groupName = groupNameInput.value.trim();
    const inputField = groupNameInput.closest(".input-field");
    const errorMessage = inputField.querySelector(".error-message");

    // Validate input
    if (!groupName) {
      inputField.classList.add("error");
      errorMessage.classList.add("visible");
      return;
    }

    // Check if the group name already exists
    if (groups[groupName]) {
      inputField.classList.add("error");
      errorMessage.textContent = "This group name already exists";
      errorMessage.classList.add("visible");
      return;
    }

    // Create new group
    groups[groupName] = [...members];
    localStorage.setItem("groups", JSON.stringify(groups));
    currentGroup = groupName;

    // Hide the modal
    hideModal("createGroupModal");

    // Show success message
    const successMessage = document.querySelector(".group-success-message");
    const groupNameDisplay = document.querySelector(".group-name-display");
    const newGroupBtn = document.querySelector(".new-favourite-group-btn");

    if (successMessage && groupNameDisplay && newGroupBtn) {
      // Update group name in success message and show it
      groupNameDisplay.textContent = `Group "${groupName}" created`;
      successMessage.classList.add("visible");

      // Hide the "New favourite group?" button temporarily
      newGroupBtn.style.display = "none";

      // Hide success message and restore button after 3 seconds
      // setTimeout(() => {
      //   successMessage.classList.remove("visible");
      //   newGroupBtn.style.display = "flex";
      // }, 3000);
    }

    // Stay on the add settle item view and update UI if needed
    updateSettleItemMembersUI();
  });
}

// Close button in create group modal
const closeGroupModalBtn = document.querySelector(".create-group-modal .close-modal");
if (closeGroupModalBtn) {
  closeGroupModalBtn.addEventListener("click", function () {
    hideModal("createGroupModal");
  });
}

// Group updated confirmation
const groupUpdatedConfirmBtn = document.querySelector(".group-updated-confirm-btn");
if (groupUpdatedConfirmBtn) {
  groupUpdatedConfirmBtn.addEventListener("click", function () {
    const modal = document.getElementById("groupUpdatedModal");
    hideModal(modal.id);

    // Reset editing flag
    isEditingGroup = false;

    // Return to the saved groups view
    showSettleView("savedGroupsView");
    updateSettleNowHeader();

    // Refresh the saved groups list
    loadSavedGroups();
  });
}

// Delete group confirmation
const deleteConfirmBtn = document.querySelector(".delete-confirm-btn");
if (deleteConfirmBtn) {
  deleteConfirmBtn.addEventListener("click", function () {
    const modal = document.getElementById("deleteGroupModal");
    const groupName = modal.dataset.groupName;

    if (groupName) {
      // Delete the group
      delete groups[groupName];
      localStorage.setItem("groups", JSON.stringify(groups));

      // Refresh the saved groups list
      loadSavedGroups();
    }

    // Hide the modal
    hideModal(modal.id);
  });
}

// Back confirmation
const backConfirmBtn = document.querySelector(".back-confirm-btn");
if (backConfirmBtn) {
  backConfirmBtn.addEventListener("click", function () {
    // Hide the modal
    hideModal("backConfirmModal");
    document.querySelector(".assigned-members").innerHTML = "";
    document.getElementById("dishSummaryContainer").innerHTML = "";
    // Clear dishes array and update the dish list
    dishes = [];

    // Close the bill summary if it's open
    closeSummary();

    // Navigate back to the appropriate view based on previousView
    showSettleView(previousView);

    // Update the header text
    updateSettleNowHeader();

    // If going back to newGroupMembersView, ensure the title is correct
    if (previousView === "newGroupMembersView") {
      // Update title if we're editing a group
      if (isEditingGroup) {
        document.querySelector(".new-group-members-container h2").textContent = "Edit Group Members";
      } else {
        document.querySelector(".new-group-members-container h2").textContent = "Settle With New Group";
      }
    }
  });
}

// Weather API configuration
const WEATHER_API_KEY = "3f6c36c6fa294f523e38bddac2c7bb6f"; // Replace with your OpenWeatherMap API key
const SINGAPORE_LAT = 1.3521;
const SINGAPORE_LON = 103.8198;

// Function to fetch weather data
async function fetchWeatherData() {
  try {
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${SINGAPORE_LAT}&lon=${SINGAPORE_LON}&appid=${WEATHER_API_KEY}&units=metric`
    );
    const data = await response.json();

    // Update weather card
    document.querySelector(".weather-location p").textContent = data.weather[0].description;
    document.querySelector(".weather-temp h1").textContent = `${Math.round(data.main.temp)}°`;

    // Update weather icon based on weather condition
    const weatherIcon = document.querySelector(".weather-icon");
    const iconCode = data.weather[0].icon;
    weatherIcon.innerHTML = `<img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="Weather icon">`;
  } catch (error) {
    console.error("Error fetching weather data:", error);
  }
}

// Document ready function
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM fully loaded");

  // Initialize dishes array if it doesn't exist
  if (typeof dishes === "undefined") {
    window.dishes = [];
  }

  // Initialize the tax profile dropdown
  initTaxProfileDropdown();

  // Initialize the navigation
  initPageNavigation();

  // Initialize the theme toggle
  initThemeToggle();

  // Make sure the settle now screen is hidden initially
  hideSettleNowScreen();

  // Initialize member list with default members
  initializeMemberList();

  // Initialize swipe gesture for bill summary
  initializeSwipeGesture();

  // Initialize navbar to home position
  moveWithCalc(2);
  currentActiveBubble = 2;

  // Set home page as active
  switchPage(2);

  // Check if dark mode was previously enabled
  if (localStorage.getItem("darkMode") === "enabled") {
    document.body.classList.add("dark-mode");
    document.getElementById("darkModeToggle").checked = true;
  }

  // Initialize tax profile
  const savedTaxProfile = localStorage.getItem("taxProfile");
  if (savedTaxProfile) {
    document.getElementById("taxProfile").value = savedTaxProfile;
    updateTaxRates(savedTaxProfile);
  } else {
    // Default is Singapore
    localStorage.setItem("taxProfile", "singapore");
    updateTaxRates("singapore");
  }

  // Add event listener for tax profile changes
  document.getElementById("taxProfile").addEventListener("change", function () {
    const taxProfile = this.value;
    localStorage.setItem("taxProfile", taxProfile);
    updateTaxRates(taxProfile);
    // You can add additional functionality here when tax profile changes
    console.log(`Tax profile changed to: ${taxProfile}`);
  });

  // Ensure menu icons have pointer events
  document.querySelectorAll(".menuElement").forEach((menu) => {
    menu.style.pointerEvents = "auto";
  });

  // Fetch weather data when page loads
  fetchWeatherData();

  // Refresh weather data every 30 minutes
  setInterval(fetchWeatherData, 30 * 60 * 1000);

  // Close buttons for all confirmation modals
  document.querySelectorAll(".modal .close-modal").forEach(function (button) {
    button.addEventListener("click", function () {
      const modal = this.closest(".modal");
      hideModal(modal.id);
    });
  });

  // Cancel buttons for all confirmation modals
  document.querySelectorAll(".modal .cancel-btn").forEach(function (button) {
    button.addEventListener("click", function () {
      const modal = this.closest(".modal");
      hideModal(modal.id);
    });
  });

  // Optimize input focus handling for item-details-section
  const setupInputFocusHandling = function () {
    const itemNameInput = document.getElementById("itemName");
    const itemPriceInput = document.getElementById("itemPrice");

    if (itemNameInput && itemPriceInput) {
      // Prepare the inputs for fast focus by touching them once
      [itemNameInput, itemPriceInput].forEach((input) => {
        // Prevent any animation delays when focusing inputs
        input.addEventListener(
          "touchstart",
          function (e) {
            // Ensure this input is ready to be focused immediately
            this.style.willChange = "transform";
            // Don't prevent default to allow focus
          },
          { passive: true }
        );

        // Ensure proper cleanup after focus/blur
        input.addEventListener(
          "blur",
          function () {
            this.style.willChange = "auto";
          },
          { passive: true }
        );
      });
    }
  };

  // Call this setup when the page loads and whenever the view becomes active
  setupInputFocusHandling();

  // Also set it up again when the addSettleItemView becomes active
  const addSettleItemView = document.getElementById("addSettleItemView");
  if (addSettleItemView) {
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.attributeName === "class" && addSettleItemView.classList.contains("active")) {
          // View is now active, optimize inputs
          setupInputFocusHandling();
        }
      });
    });

    observer.observe(addSettleItemView, { attributes: true });
  }

  // Add event listener for file input change to display the file name
  const fileInput = document.getElementById("receiptImage");
  if (fileInput) {
    fileInput.addEventListener("change", function () {
      const uploadTextElement = document.querySelector(".upload-text");
      if (uploadTextElement) {
        if (fileInput.files.length > 0) {
          // Replace button text with filename
          uploadTextElement.textContent = fileInput.files[0].name;
        }
      }
    });
  }
});

// Initialize tax profile dropdown function
function initTaxProfileDropdown() {
  const taxProfileDropdown = document.getElementById("taxProfile");
  if (taxProfileDropdown) {
    taxProfileDropdown.addEventListener("change", function () {
      updateTaxRates(this.value);
    });
  }

  // Add event listener for service charge input
  const serviceChargeInput = document.getElementById("serviceChargeValue");
  if (serviceChargeInput) {
    serviceChargeInput.addEventListener("input", function () {
      const serviceRate = document.getElementById("serviceRate");
      if (serviceRate) {
        serviceRate.textContent = `${this.value}%`;
      }
    });
  }
}

// Initialize theme toggle function
function initThemeToggle() {
  // Dark mode toggle functionality
  document.getElementById("darkModeToggle").addEventListener("change", function () {
    if (this.checked) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("darkMode", "enabled");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("darkMode", "disabled");
    }
  });
}

// Initialize member list with default members
function initializeMemberList() {
  // Clear the member list first
  const memberList = document.querySelector(".member-list");
  if (memberList) {
    memberList.innerHTML = "";

    // Add each member to the UI
    members.forEach((member) => {
      // Handle both object format and legacy string format
      if (typeof member === "object" && member.name) {
        addMemberToUI(member.name, member.avatar);
      } else {
        // For legacy data format (string), generate a consistent avatar
        const memberName = member;
        // Generate consistent avatar based on name
        const nameHash = memberName.split("").reduce((a, b) => {
          a = (a << 5) - a + b.charCodeAt(0);
          return a & a;
        }, 0);
        const avatarNumber = Math.abs(nameHash % 12) + 1;

        addMemberToUI(memberName, avatarNumber);
      }
    });
  }
}

// Add resize event listener
window.addEventListener("resize", handleResize);

// Function to create a new group with the modal
function createNewGroup() {
  showModal("createGroupModal");
}

// Show saved groups modal with available groups
function showSavedGroupsModal() {
  // Get all saved groups
  const groupsList = Object.keys(groups);
  const savedGroupsList = document.querySelector(".saved-groups-list");
  const noGroupsMessage = document.querySelector(".no-groups-message");

  // Clear previous items
  savedGroupsList.innerHTML = "";

  if (groupsList.length === 0) {
    // Show no groups message
    savedGroupsList.style.display = "none";
    noGroupsMessage.style.display = "block";
  } else {
    // Hide no groups message and show the list
    savedGroupsList.style.display = "flex";
    noGroupsMessage.style.display = "none";

    // Add each group to the list
    groupsList.forEach((groupName) => {
      const memberCount = groups[groupName].length;
      const groupItem = document.createElement("div");
      groupItem.className = "group-item";
      groupItem.innerHTML = `
        <div class="group-item-name">${groupName}</div>
        <div class="group-item-count">${memberCount} members</div>
      `;

      // Add click event to select the group
      groupItem.addEventListener("click", function () {
        // Select this group and show members
        hideModal("savedGroupsModal");
        showGroupMembersView(groupName);
      });

      savedGroupsList.appendChild(groupItem);
    });
  }

  // Show the modal
  showModal("savedGroupsModal");
}

// New function to update members in the Add Settle Item screen
function updateSettleItemMembersUI() {
  // Update members in the favorite group section
  const groupMembers = document.querySelector(".group-members");
  groupMembers.innerHTML = "";

  // Add each member to the group members area
  members.forEach((member) => {
    // Handle both object format and legacy string format
    let memberName, avatarNumber;

    if (typeof member === "object" && member.name) {
      memberName = member.name;
      avatarNumber = member.avatar;
    } else {
      memberName = member;
      // Generate consistent avatar based on name
      const nameHash = memberName.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
      avatarNumber = Math.abs(nameHash % 12) + 1;
    }

    const memberWrapper = document.createElement("div");
    memberWrapper.className = "member-avatar-wrapper sortable-item";
    memberWrapper.dataset.name = memberName;

    const memberAvatar = document.createElement("div");
    memberAvatar.className = "member-avatar";

    // Create img element for cat avatar instead of using CSS classes
    const img = document.createElement("img");
    img.src = `assets/cat-icon/cat-${avatarNumber}.svg`;
    img.alt = `Cat avatar ${avatarNumber}`;
    img.className = "cat-avatar-img";
    memberAvatar.appendChild(img);

    const memberNameDiv = document.createElement("div");
    memberNameDiv.className = "member-name";
    memberNameDiv.textContent = memberName;

    memberWrapper.appendChild(memberAvatar);
    memberWrapper.appendChild(memberNameDiv);
    groupMembers.appendChild(memberWrapper);
  });

  // Initialize drag functionality for the members
  initializeMemberDragForSettleItem();

  // Make sure the scan-item-btn is visible when entering the add settle item view
  const scanItemBtn = document.querySelector(".scan-item-btn");
  if (scanItemBtn) {
    scanItemBtn.style.display = "flex";
  }
}

// Initialize drag functionality for members in the settle item view
function initializeMemberDragForSettleItem() {
  // Make group members draggable
  const groupMembers = document.querySelector(".group-members");
  const assignedMembers = document.querySelector(".assigned-members");
  const settleEquallyCheckbox = document.getElementById("settleEqually");

  // Add event listener to the settleEqually checkbox
  settleEquallyCheckbox.addEventListener("change", function () {
    // Clear assigned members first
    assignedMembers.innerHTML = "";

    if (this.checked) {
      // When checked, add all members
      members.forEach((member) => {
        // Get member name
        const memberName = typeof member === "object" ? member.name : member;

        // Clone member element from group members
        const originalMember = Array.from(groupMembers.children).find((child) => child.dataset.name === memberName);

        if (originalMember) {
          const clonedMember = originalMember.cloneNode(true);

          // Add double-tap to remove functionality
          let tapped = false;

          clonedMember.addEventListener("touchend", function (e) {
            if (!tapped) {
              tapped = true;
              setTimeout(function () {
                tapped = false;
              }, 300);
            } else {
              // Double tap detected
              e.preventDefault();
              clonedMember.remove();
              // If member is removed, uncheck the settle equally checkbox
              settleEquallyCheckbox.checked = false;
            }
          });

          // Keep dblclick for desktop
          clonedMember.addEventListener("dblclick", function () {
            clonedMember.remove();
            // If member is removed, uncheck the settle equally checkbox
            settleEquallyCheckbox.checked = false;
          });

          assignedMembers.appendChild(clonedMember);
        }
      });
    }
  });

  // Initialize Sortable.js for the group members
  if (typeof Sortable !== "undefined") {
    Sortable.create(groupMembers, {
      group: { name: "settleMembers", pull: "clone", put: false },
      sort: false,
      animation: 150,
      onStart: function () {
        // Add visual feedback for drag start - subtle haptic feedback if supported
        if (navigator.vibrate) {
          navigator.vibrate(25);
        }
      },
    });

    Sortable.create(assignedMembers, {
      group: "settleMembers",
      animation: 150,
      onAdd: function (evt) {
        const item = evt.item;
        const memberName = item.dataset.name;

        // Check if member is already assigned to avoid duplicates
        const existingMembers = Array.from(assignedMembers.children)
          .filter((el) => el !== item) // Exclude newly added item
          .map((el) => el.dataset.name);

        if (existingMembers.includes(memberName)) {
          item.remove(); // Remove if already exists
          return;
        }

        // If a member is manually added, uncheck the settleEqually checkbox
        settleEquallyCheckbox.checked = false;

        // Double-tap to remove - more efficient implementation
        let tapped = false;

        item.addEventListener("touchend", function (e) {
          if (!tapped) {
            tapped = true;
            setTimeout(function () {
              tapped = false;
            }, 300);
          } else {
            // Double tap detected
            e.preventDefault();
            item.remove();

            // Add haptic feedback if supported
            if (navigator.vibrate) {
              navigator.vibrate(25);
            }
          }
        });

        // Keep dblclick for desktop
        item.addEventListener("dblclick", function () {
          item.remove();
        });
      },
      onStart: function () {
        // Add visual feedback for drag start - subtle haptic feedback if supported
        if (navigator.vibrate) {
          navigator.vibrate(25);
        }
      },
    });
  }
}

function copyToClipboard(url) {
  navigator.clipboard
    .writeText(url)
    .then(() => alert("Link copied to clipboard!"))
    .catch((err) => alert("Failed to copy link."));
}

// Scan item button handler
const scanItemBtn = document.querySelector(".scan-item-btn");
if (scanItemBtn) {
  scanItemBtn.addEventListener("click", function () {
    // Show the scan receipt modal
    showModal("scanReceiptModal");
  });
}

// Scan receipt button in modal handler
document.addEventListener("DOMContentLoaded", function () {
  const scanReceiptBtn = document.getElementById("scanReceiptBtn");
  if (scanReceiptBtn) {
    scanReceiptBtn.addEventListener("click", function () {
      scanReceipt();
    });
  }
});

// Function to update home page cards with latest data
function updateHomePageCards() {
  // Update Last Created Group card
  updateLastCreatedGroup();

  // Update Last Settle card
  updateLastSettle();
}

// Function to update the Last Created Group card
function updateLastCreatedGroup() {
  const groupCard = document.querySelector(".group-card:nth-child(4)");
  if (!groupCard) return;

  // Show skeleton loading
  groupCard.classList.add("loading");

  // Get all groups from localStorage
  const groups = JSON.parse(localStorage.getItem("groups") || "{}");
  const groupNames = Object.keys(groups);

  if (groupNames.length === 0) {
    // No groups found, show empty state message after loading animation
    setTimeout(() => {
      const groupHeader = groupCard.querySelector(".card-header p");
      if (groupHeader) {
        groupHeader.textContent = "No groups yet";
      }

      // Clear avatar group and add empty state message
      const avatarGroup = groupCard.querySelector(".avatar-group");
      if (avatarGroup) {
        avatarGroup.innerHTML = '<p class="empty-state-message">Create a group when you settle</p>';
      }

      // Remove loading state
      groupCard.classList.remove("loading");
    }, 800);
    return;
  }

  // Find most recent group (assuming the last one in the object is the newest)
  // In a real app with timestamps, you'd sort by creation time
  const lastGroupName = groupNames[groupNames.length - 1];
  const members = groups[lastGroupName];

  // Update content with slight delay to show the loading animation
  setTimeout(() => {
    // Update group name in header
    const groupHeader = groupCard.querySelector(".card-header p");
    if (groupHeader) {
      groupHeader.textContent = lastGroupName;
    }

    // Update avatar group with actual members
    const avatarGroup = groupCard.querySelector(".avatar-group");
    if (avatarGroup && members && members.length > 0) {
      avatarGroup.innerHTML = "";

      // Show up to 5 members
      const membersToShow = members.slice(0, 5);

      membersToShow.forEach((member) => {
        // Handle both object format and legacy string format
        let avatarNumber;

        if (typeof member === "object" && member.name) {
          avatarNumber = member.avatar;
        } else {
          // Generate consistent avatar based on name
          const nameHash = member.split("").reduce((a, b) => {
            a = (a << 5) - a + b.charCodeAt(0);
            return a & a;
          }, 0);
          avatarNumber = Math.abs(nameHash % 12) + 1;
        }

        const avatarDiv = document.createElement("div");
        avatarDiv.className = "avatar";
        avatarDiv.innerHTML = `<img class="avatar-img" src="assets/cat-icon/cat-${avatarNumber}.svg" />`;
        avatarGroup.appendChild(avatarDiv);
      });

      // Add '+' indicator if more than 5 members
      if (members.length > 5) {
        const plusIndicator = document.createElement("div");
        plusIndicator.textContent = "+";
        avatarGroup.appendChild(plusIndicator);
      }
    }

    // Remove loading state
    groupCard.classList.remove("loading");
  }, 800);
}

// Function to update the Last Settle card
function updateLastSettle() {
  const settleCard = document.querySelector(".group-card:nth-child(5)");
  if (!settleCard) return;

  // Show skeleton loading
  settleCard.classList.add("loading");

  // Get bill history IDs
  const billIds = JSON.parse(localStorage.getItem("billHistory") || "[]");

  if (billIds.length === 0) {
    // No history found, show empty state message after loading animation
    setTimeout(() => {
      // Update header to indicate empty state
      const arrowIcon = settleCard.querySelector(".arrow-icon");
      if (arrowIcon) {
        arrowIcon.style.display = "none";
      }

      // Clear existing content and add empty state message
      const settleInfo = settleCard.querySelector(".settle-info");
      if (settleInfo) {
        // Clear amount, matter, group info
        const amountEl = settleInfo.querySelector(".settle-info-amount");
        const matterEl = settleInfo.querySelector(".settle-info-matter");
        const groupEl = settleInfo.querySelector(".settle-info-group");

        if (amountEl) amountEl.textContent = "No settlements yet";
        if (matterEl) matterEl.textContent = "Start settling bills with your friends";
        if (groupEl) groupEl.textContent = "Tap 'Settle Now' to begin";
      }

      // Clear date and avatars
      const dateEl = settleCard.querySelector(".settle-info-date span");
      if (dateEl) dateEl.textContent = "";

      const avatarGroup = settleCard.querySelector(".avatar-group");
      if (avatarGroup) {
        avatarGroup.innerHTML = "";
      }

      // Remove the link behavior when there's no data
      settleCard.href = "javascript:void(0)";
      settleCard.style.cursor = "default";

      // Remove loading state
      settleCard.classList.remove("loading");
    }, 800);
    return;
  }

  // Get the most recent bill ID (last in the array)
  const lastBillId = billIds[billIds.length - 1];

  // Set the link to the result page
  settleCard.href = `/result/${lastBillId}`;
  settleCard.style.cursor = "pointer";

  // Fetch the bill data
  fetch(`/result/${lastBillId}`, {
    headers: {
      Accept: "application/json",
    },
  })
    .then((res) => {
      if (!res.ok) throw new Error("Bill not found");
      return res.json();
    })
    .then((data) => {
      // Update the card with fetched data (with slight delay to show the loading animation)
      setTimeout(() => {
        // Make sure arrow icon is visible for valid data
        const arrowIcon = settleCard.querySelector(".arrow-icon");
        if (arrowIcon) {
          arrowIcon.style.display = "";
        }

        updateSettleCardContent(settleCard, lastBillId, data);

        // Remove loading state
        settleCard.classList.remove("loading");
      }, 800);
    })
    .catch((error) => {
      console.error("Error fetching last bill:", error);

      // Show error message if fetch fails
      setTimeout(() => {
        const settleInfo = settleCard.querySelector(".settle-info");
        if (settleInfo) {
          const amountEl = settleInfo.querySelector(".settle-info-amount");
          const matterEl = settleInfo.querySelector(".settle-info-matter");

          if (amountEl) amountEl.textContent = "Could not load data";
          if (matterEl) matterEl.textContent = "Please try again later";
        }

        // Remove loading state even on error
        settleCard.classList.remove("loading");
      }, 500);
    });
}

// Helper function to update settle card content
function updateSettleCardContent(card, billId, data) {
  if (!data) return;

  // Set the link to the result page
  card.href = `/result/${billId}`;

  // Update amount
  const amountElement = card.querySelector("#lastSettle .settle-info-amount");
  if (amountElement && data.breakdown && data.breakdown.total) {
    amountElement.textContent = `$${data.breakdown.total.toFixed(2)}`;
  }

  // Update matter
  const matterElement = card.querySelector("#lastSettle .settle-info-matter");
  if (matterElement) {
    matterElement.textContent = data.settleMatter || "Settlement";
  }

  // Update group info
  const groupElement = card.querySelector("#lastSettle .settle-info-group");
  if (groupElement) {
    const memberCount = data.members ? data.members.length : 0;
    groupElement.textContent = `${memberCount} members`;
  }

  // Update date
  const dateElement = card.querySelector("#lastSettle .settle-info-date span");
  if (dateElement && data.timestamp) {
    const date = new Date(data.timestamp);
    dateElement.textContent = date.toLocaleString();
  }

  // Update avatars
  const avatarGroup = card.querySelector("#lastSettle .avatar-group");
  if (avatarGroup && data.members && data.members.length > 0) {
    avatarGroup.innerHTML = "";

    // Show up to 5 members
    const membersToShow = data.members.slice(0, 5);

    membersToShow.forEach((member) => {
      const avatarDiv = document.createElement("div");
      avatarDiv.className = "avatar";
      avatarDiv.innerHTML = `<img class="avatar-img" src="assets/cat-icon/cat-${member.avatar || 1}.svg" />`;
      avatarGroup.appendChild(avatarDiv);
    });

    // Add '+' indicator if more than 5 members
    if (data.members.length > 5) {
      const plusIndicator = document.createElement("div");
      plusIndicator.textContent = "+";
      avatarGroup.appendChild(plusIndicator);
    }
  }
}

// Call this function when the page loads
document.addEventListener("DOMContentLoaded", function () {
  updateHomePageCards();

  // Update when switching to home page
  document.getElementById("menu2").addEventListener("click", function () {
    updateHomePageCards();
  });
});

// Initialize app functionality after window loads
window.onload = function () {
  // Wait a short amount of time to ensure everything is ready
  setTimeout(() => {
    // Initialize all needed components
    document.getElementById("taxProfile").value = "singapore";
    document.getElementById("serviceRate").textContent = "10%";
    document.getElementById("gstRate").textContent = "9%";

    // Initialize page navigation
    initPageNavigation();

    // Initialize UI components
    initializeSwipeGesture();
    initializeBillSummaryDrag();
    initTaxProfileDropdown();
    initThemeToggle();

    // Get weather data
    fetchWeatherData();

    // Update home page cards
    updateHomePageCards();

    // Add animation classes after a delay for smoother experience
    setTimeout(() => {
      document.querySelectorAll(".card-widget").forEach((card, index) => {
        setTimeout(() => {
          card.classList.add("animated");
        }, index * 100); // Stagger animations
      });
    }, 100);

    // If a preloader exists, hide it
    const preloader = document.getElementById("preloader");
    if (preloader) {
      preloader.classList.add("fade-out");
      setTimeout(() => {
        if (preloader.parentNode) {
          preloader.parentNode.removeChild(preloader);
        }
      }, 500);
    }
  }, 100);
};
