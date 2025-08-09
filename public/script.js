// JWT Token management
function getAccessToken() {
  return localStorage.getItem("settlelah_access_token");
}

function getRefreshToken() {
  return localStorage.getItem("settlelah_refresh_token");
}

function getLegacyToken() {
  return localStorage.getItem("settlelah_user_token");
}

function clearAuthTokens() {
  localStorage.removeItem("settlelah_access_token");
  localStorage.removeItem("settlelah_refresh_token");
  localStorage.removeItem("settlelah_user_token");
  localStorage.removeItem("settlelah_authenticated");
  localStorage.removeItem("settlelah_auth_expiry");
  localStorage.removeItem("settlelah_user_id");
  localStorage.removeItem("settlelah_user_name");
  localStorage.removeItem("settlelah_user_email");
}

// Check if access token is expired (basic client-side check)
function isTokenExpired(token) {
  if (!token) return true;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    console.error("Error parsing token:", error);
    return true;
  }
}

// Refresh access token using refresh token
async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken || isTokenExpired(refreshToken)) {
    console.log("No valid refresh token available");
    return null;
  }

  try {
    const response = await fetch("/api/refresh-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem("settlelah_access_token", data.accessToken);
      return data.accessToken;
    } else {
      console.error("Token refresh failed:", await response.text());
      return null;
    }
  } catch (error) {
    console.error("Error refreshing token:", error);
    return null;
  }
}

// Authentication check
function checkAuthentication() {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  const legacyAuth = localStorage.getItem("settlelah_authenticated") === "true";
  const authExpiry = parseInt(localStorage.getItem("settlelah_auth_expiry") || "0");

  // Check JWT authentication first
  if (accessToken && !isTokenExpired(accessToken)) {
    return true;
  }

  // Try to refresh token if we have a valid refresh token
  if (refreshToken && !isTokenExpired(refreshToken)) {
    // Note: This is async, but we return true optimistically
    // The actual refresh will happen in the background
    refreshAccessToken().then((newToken) => {
      if (!newToken) {
        clearAuthTokens();
        window.location.href = "/login";
      }
    });
    return true;
  }

  // Fallback to legacy authentication
  if (legacyAuth && authExpiry > Date.now()) {
    return true;
  }

  // No valid authentication found
  clearAuthTokens();
  window.location.href = "/login";
  return false;
}

// Helper function to get user ID from local storage
function getUserId() {
  return localStorage.getItem("settlelah_user_id");
}

// Enhanced fetch function with JWT support and automatic token refresh
async function fetchWithUserId(url, options = {}) {
  const userId = getUserId();

  // Initialize headers if they don't exist
  if (!options.headers) {
    options.headers = {};
  }

  // Add user ID header if available (for backward compatibility)
  if (userId) {
    options.headers["x-user-id"] = userId;
  }

  // Add JWT authorization header
  let accessToken = getAccessToken();

  // Check if access token is expired and try to refresh
  if (!accessToken || isTokenExpired(accessToken)) {
    accessToken = await refreshAccessToken();
  }

  if (accessToken) {
    options.headers["Authorization"] = `Bearer ${accessToken}`;
  } else {
    // Fallback to legacy token
    const legacyToken = getLegacyToken();
    if (legacyToken) {
      options.headers["Authorization"] = `Bearer ${legacyToken}`;
    }
  }

  // Make the request
  const response = await fetch(url, options);

  // If we get a 401, try to refresh the token once more
  if (response.status === 401 && accessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      options.headers["Authorization"] = `Bearer ${newToken}`;
      return fetch(url, options);
    } else {
      // Refresh failed, redirect to login
      clearAuthTokens();
      window.location.href = "/login";
    }
  }

  return response;
}

// Initialize pull-to-refresh functionality
function initializePullToRefresh() {
  let pullStartY = 0;
  let pullMoveY = 0;
  const pullThreshold = 80; // Minimum pull distance to trigger refresh
  const pullElement = document.querySelector(".pull-to-refresh");
  const pullText = document.querySelector(".pull-to-refresh-text");
  const containers = [
    document.getElementById("homeContainer"),
    document.getElementById("historyContainer"),
    document.getElementById("settingsContainer"),
  ];

  if (!pullElement) return; // Guard clause if element doesn't exist

  // Function to attach pull-to-refresh to each container
  const attachPullToRefresh = (container) => {
    if (!container) return;

    container.addEventListener(
      "touchstart",
      (e) => {
        // Only enable pull-to-refresh at the top of the container
        if (container.scrollTop === 0) {
          pullStartY = e.touches[0].screenY;
        }
      },
      { passive: true }
    );

    container.addEventListener(
      "touchmove",
      (e) => {
        if (pullStartY === 0) return;

        pullMoveY = e.touches[0].screenY;
        const pullDistance = pullMoveY - pullStartY;

        // Only activate if user is pulling down and we're at the top of the container
        if (pullDistance > 0 && container.scrollTop === 0) {
          const pullProgress = Math.min(pullDistance / pullThreshold, 1);
          const pullHeight = pullProgress * 40; // Max height of pull indicator

          pullElement.classList.add("visible");
          pullElement.style.transform = `translateY(${pullHeight}px)`;

          // Update text based on whether pull is enough to trigger refresh
          if (pullDistance >= pullThreshold) {
            pullText.textContent = "Release to refresh";
          } else {
            pullText.textContent = "Pull down to refresh";
          }

          // Prevent default scrolling if pull distance is significant
          if (pullDistance > 30) {
            e.preventDefault();
          }
        }
      },
      { passive: false }
    );

    container.addEventListener(
      "touchend",
      (e) => {
        const pullDistance = pullMoveY - pullStartY;

        if (pullDistance >= pullThreshold) {
          // Animate the pull element
          pullElement.style.transform = "translateY(40px)";
          pullText.textContent = "Refreshing...";

          // Add a small spinner animation to the pull element
          const spinner = document.querySelector(".pull-to-refresh-spinner");
          spinner.style.animation = "spin 1s infinite linear";

          // Trigger haptic feedback if available
          if (navigator.vibrate) {
            navigator.vibrate(30);
          }

          // Perform refresh action based on current page
          refreshCurrentPage();

          setTimeout(() => {
            pullElement.style.transform = "translateY(0)";
            pullElement.style.opacity = "0.5";

            setTimeout(() => {
              pullElement.classList.remove("visible");
              pullElement.style.transform = "translateY(-100%)";
              pullElement.style.opacity = "1";
              spinner.style.animation = "";
            }, 500);
          }, 1500);
        } else {
          // Reset without refreshing - with smooth animation
          pullElement.style.transform = "translateY(0)";
          pullElement.style.opacity = "0.5";

          setTimeout(() => {
            pullElement.classList.remove("visible");
            pullElement.style.transform = "translateY(-100%)";
            pullElement.style.opacity = "1";
          }, 500);
        }

        // Reset pull tracking
        pullStartY = 0;
        pullMoveY = 0;
      },
      { passive: false }
    );
  };

  // Attach pull-to-refresh to each container
  containers.forEach((container) => attachPullToRefresh(container));
}

// Function to refresh content based on current active page
async function refreshCurrentPage() {
  if (activePage === "home") {
    // Refresh home page
    await updateHomePageCards();
    updateLastSettle();
    fetchWeatherData();
  } else if (activePage === "history") {
    // Refresh history
    fetchHistory();
  } else if (activePage === "settings") {
    // Nothing to refresh in settings currently
  }
}

// Prevent zooming on iOS Safari
(function () {
  document.addEventListener(
    "touchstart",
    function (event) {
      if (event.touches.length > 1) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { passive: false }
  );

  document.addEventListener(
    "gesturestart",
    function (event) {
      event.preventDefault();
    },
    { passive: false }
  );
})();

// Run auth check when script loads (unless we're on a result page)
if (!window.location.pathname.startsWith("/result")) {
  checkAuthentication();
}

// Extend auth session when user interacts with the page
document.addEventListener("click", extendAuthSession);
document.addEventListener("keydown", extendAuthSession);

function extendAuthSession() {
  if (localStorage.getItem("settlelah_authenticated") === "true") {
    // Extend session by another 15 days from now
    const expiryTime = Date.now() + 15 * 24 * 60 * 60 * 1000;
    localStorage.setItem("settlelah_auth_expiry", expiryTime.toString());
  }
}

// Logout function
function logout() {
  // Get confirmation from user
  const confirmLogout = confirm("Are you sure you want to log out?");

  if (confirmLogout) {
    // Clear all authentication tokens and data
    clearAuthTokens();

    // Clear groups from localStorage
    localStorage.removeItem("groups");
    // Reset groups variable
    groups = {};

    // Show short feedback message
    showToast("logoutToast");

    // Wait a moment before redirecting
    setTimeout(() => {
      window.location.href = "/login";
    }, 500);
  }
}

// Original script begins here
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

// Birthday person tracking
let birthdayPerson = null;

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

function showStep(step) {
  document.querySelectorAll(".step").forEach((s) => (s.style.display = "none"));
  document.getElementById(`step${step}`).style.display = "block";
  currentStep = step;
  clearError();
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
  fetchWithUserId("/api/scan-receipt", {
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
                      // Reset scanning overlay state before showing modal
                      resetScanningOverlay();
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

      // Try to get avatar from localStorage groups first
      let foundInGroups = false;
      const storedGroups = JSON.parse(localStorage.getItem("groups")) || {};

      // Search through all groups for this member
      Object.values(storedGroups).forEach((groupMembers) => {
        groupMembers.forEach((groupMember) => {
          // If we find a matching name and it has an avatar
          if (typeof groupMember === "object" && groupMember.name === memberName && groupMember.avatar) {
            avatarNumber = groupMember.avatar;
            foundInGroups = true;
          }
        });
      });

      // If not found in groups, generate a consistent avatar based on name
      if (!foundInGroups) {
        const nameHash = memberName.split("").reduce((a, b) => {
          a = (a << 5) - a + b.charCodeAt(0);
          return a & a;
        }, 0);
        avatarNumber = Math.abs(nameHash % 20) + 1;
      }
    }

    const memberWrapper = document.createElement("div");
    memberWrapper.className = "member-avatar-wrapper sortable-item";
    memberWrapper.dataset.name = memberName;

    const memberAvatar = document.createElement("div");
    memberAvatar.className = "member-avatar";

    // Create img element for cat avatar
    const img = document.createElement("img");
    img.src = `assets/cat-icon/cat-${avatarNumber}.svg`;
    img.alt = `Cat avatar ${memberName}`;
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

  // dishes.splice(index, 1);
  deleteDish(index);
  updateDishList();
  clearError();
  closeBillSummaryModal();

  // Ensure modal is peeking after any possible reflows
  setTimeout(() => {
    const modal = document.getElementById("billSummaryModal");
    modal.classList.remove("fully-open", "half-open");
    modal.classList.add("peeking");
  }, 50);
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

    // If on finalise screen, make it peek, otherwise follow normal behavior
    if (currentSettleView === "finaliseSettleBillScreen") {
      // Hide the confirm button if no dishes or if on finalise screen
      modal.classList.add("is-finalise-bill");
      // Ensure it's at least in peeking mode
      if (!modal.classList.contains("fully-open") && !modal.classList.contains("half-open")) {
        modal.classList.add("peeking");
      }
      document.querySelector(".bill-summary-footer").style.display = "none";
    } else {
      modal.classList.add("peeking");
      modal.classList.remove("fully-open", "half-open");
      document.querySelector(".bill-summary-footer").style.display = "flex";
      modal.classList.remove("is-finalise-bill");
    }

    overlay.classList.remove("active");
  } else {
    modal.classList.remove("peeking", "half-open", "fully-open");
    overlay.classList.remove("active");
  }
}

function updateDishSummary() {
  const container = document.getElementById("dishSummaryContainer");
  if (!container) return;

  container.innerHTML = "";

  if (!dishes || dishes.length === 0) {
    // Show toast notification using showToast function
    showToast("noItemsAddedToast");

    // Clear the subtotal
    const subtotalElement = document.getElementById("billSubtotal");
    if (subtotalElement) {
      subtotalElement.textContent = "$0.00";
    }

    // Clear the item count
    const itemCountElement = document.getElementById("billItemCount");
    if (itemCountElement) {
      itemCountElement.textContent = "0";
    }

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
    dividerText.textContent = `Split Among (${dish.members.length})`;
    divider.appendChild(dividerText);

    // Dish members
    const dishMembers = document.createElement("div");
    dishMembers.className = "dish-members";

    dish.members.forEach((member) => {
      const memberPill = document.createElement("div");
      memberPill.className = "dish-member-pill";

      // Check if member is an object (new format) or string (old format)
      const memberName = typeof member === "object" ? member.name : member;
      memberPill.textContent = memberName;

      dishMembers.appendChild(memberPill);
    });

    // Action buttons
    const actions = document.createElement("div");
    actions.className = "dish-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "dish-action-btn";
    editBtn.innerHTML = '<img class="group-action-btn-img" src="assets/edit.svg" alt="Edit" />';
    editBtn.onclick = () => editDish(index);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "dish-action-btn";
    deleteBtn.innerHTML = '<img class="group-action-btn-img" src="assets/bin.svg" alt="Delete" />';
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

  // Calculate and update the subtotal
  const subtotal = dishes.reduce((sum, dish) => sum + parseFloat(dish.cost), 0);
  const subtotalElement = document.getElementById("billSubtotal");
  if (subtotalElement) {
    subtotalElement.textContent = `$${subtotal.toFixed(2)}`;
  }

  // Update the item count
  const itemCount = dishes.length;
  const itemCountElement = document.getElementById("billItemCount");
  if (itemCountElement) {
    itemCountElement.textContent = itemCount.toString();
  }

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

      // Scroll the addSettleItemView container to the bottom
      const addSettleItemView = document.querySelector(".add-settle-item-container");
      if (addSettleItemView) {
        // Use smooth scrolling for better UX
        setTimeout(() => {
          addSettleItemView.scrollTo({
            top: 0,
            behavior: "smooth",
          });
        }, 100);
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

  // Set up the PayNow name selection handling
  setupPaynowMemberSelection();

  // Add event listener to the Settle Lah button
  const settleLahButton = finaliseScreen.querySelector(".settle-lah-btn");
  if (settleLahButton) {
    settleLahButton.onclick = function () {
      showLoadingScreen();
    };
  }

  // Remove all alphabetic characters from discountValue input on blur for smooth UX
  const discountValueInput = document.getElementById("discountValue");
  if (discountValueInput) {
    discountValueInput.addEventListener("blur", function () {
      // Only allow numbers, dot, and optional trailing %
      let value = discountValueInput.value;
      // Remove all alphabetic characters except for a trailing %
      value = value.replace(/[a-zA-Z]+/g, "");
      // If more than one %, keep only the last one
      const percentMatch = value.match(/%/g);
      if (percentMatch && percentMatch.length > 1) {
        // Remove all % except the last one
        value = value.replace(/%/g, "");
        value += "%";
      }
      discountValueInput.value = value;
    });
  }

  function showLoadingScreen() {
    // Get input values first for validation
    const paynowNameCheck = document.getElementById("paynowName").value.trim();
    const paynowPhoneCheck = document.getElementById("paynowPhone").value.trim();

    // Validate required PayNow fields
    let isValid = true;

    // Check PayNow Name
    const paynowNameError = document.getElementById("paynowNameError");
    if (!paynowNameCheck) {
      paynowNameError.style.display = "block";
      document.getElementById("paynowName").classList.add("error");
      isValid = false;
    } else {
      paynowNameError.style.display = "none";
      document.getElementById("paynowName").classList.remove("error");
    }

    // Check PayNow Phone
    const paynowPhoneError = document.getElementById("paynowPhoneError");
    if (!paynowPhoneCheck) {
      paynowPhoneError.style.display = "block";
      document.getElementById("paynowPhone").classList.add("error");
      isValid = false;
    } else {
      paynowPhoneError.style.display = "none";
      document.getElementById("paynowPhone").classList.remove("error");
    }

    // Return early if validation fails
    if (!isValid) {
      return;
    }

    if (billSummaryModal) {
      billSummaryModal.style.display = "none";
      if (overlay) {
        overlay.classList.remove("active");
      }
    }

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
      birthdayPerson,
    };

    fetchWithUserId("/calculate", {
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
          discountInput: result.billData.discount || "", // Original discount input value
          afterDiscount: `$${result.billData.breakdown.afterDiscount.toFixed(2)}`,
          gst: `$${result.billData.breakdown.gst.toFixed(2)}`,
          gstRate: result.billData.gstRate || "9%", // Add GST rate
          totalAmount: `$${result.billData.breakdown.total.toFixed(2)}`,
          payer: result.billData.payer || { name: result.billData.paynowName },
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
                  href="https://wa.me/?text=Let%27s%20settle%20our%20bill%20on%20SettleLah!%20${result.link}"
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
                  href="https://twitter.com/intent/tweet?text=Let%27s%20settle%20our%20bill%20on%20SettleLah!&url=${result.link}"
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
                  href="https://t.me/share/url?url=${result.link}&text=Let%27s%20settle%20our%20bill%20on%20SettleLah!"
                  target="_blank"
                >
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/telegram.svg" alt="Telegram" />
                  <span class="share-btn-span">Telegram</span>
                </a>

                <a
                  id="shareEmailBtn"
                  class="share-btn"
                  href="mailto:?subject=Let%27s%20settle%20our%20bill%20on%20SettleLah!&body=Here%27s%20the%20link%20to%20our%20bill:%20${result.link}"
                  target="_blank"
                >
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/maildotru.svg" alt="Email" />
                  <span class="share-btn-span">Email</span>
                </a>

                <a
                  id="shareSmsBtn"
                  class="share-btn"
                  href="sms:?&body=Let%27s%20settle%20our%20bill%20on%20SettleLah!%20${result.link}"
                >
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/signal.svg" alt="SMS" />
                  <span class="share-btn-span">SMS</span>
                </a>

                <button class="share-btn" onclick="copyToClipboard('Lets Settle Our Bill On SettleLah! ${result.link}')">
                  <img src="https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/linktree.svg" alt="Copy" />
                  <span class="share-btn-span">Copy Link</span>
                </button>
              </div>
      `;

        // Add reveal bill button and set the link to the result page
        const revealBtn = document.querySelector(".reveal-bill-btn");
        revealBtn.onclick = function () {
          window.open(result.link, "_blank");
          window.location.href = "/";
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

        // Add bill to history in Firebase (no localStorage needed)
        addBillToHistory(result.id, result.billData);
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

// Function to populate the PayNow name select with members
function populatePaynowNameSelect() {
  const paynowNameSelect = document.getElementById("paynowNameSelect");
  // Clear existing options except the first two (placeholder and custom)
  while (paynowNameSelect.options.length > 2) {
    paynowNameSelect.remove(2);
  }

  // Add members as options
  if (members && members.length > 0) {
    members.forEach((member) => {
      const option = document.createElement("option");
      option.value = member.name;
      option.textContent = member.name;
      paynowNameSelect.appendChild(option);
    });
  }
}

// Function to set up the PayNow name selection handling
function setupPaynowNameSelection() {
  setupPaynowMemberSelection();
}

// Function to show the PayNow member selection modal
function showPaynowMemberModal() {
  showModal("paynowMemberModal");
  const membersList = document.getElementById("paynowMembersList");
  const customNameInput = document.getElementById("customPaynowName");
  const paynowNameInput = document.getElementById("paynowName");
  const paynowNameSelection = document.querySelector(".paynow-name-selection");
  const selectBtn = document.getElementById("selectPaynowMemberBtn");
  const groupMembersDiv = document.getElementById("groupMembers");
  const confirmBtn = document.getElementById("confirmPaynowMemberBtn");

  // Clear previous content
  membersList.innerHTML = "";
  customNameInput.value = "";

  // Get members from the groupMembers div
  const memberElements = groupMembersDiv.querySelectorAll(".member-avatar-wrapper");

  // Add members to the modal
  memberElements.forEach((memberElement) => {
    const memberName = memberElement.getAttribute("data-name");
    const catIconImg = memberElement.querySelector(".cat-avatar-img").src;

    const memberDiv = document.createElement("div");
    memberDiv.className = "member-avatar-wrapper";
    memberDiv.setAttribute("data-name", memberName);

    // Check if this member is currently selected
    if (paynowNameInput.value === memberName) {
      memberDiv.classList.add("selected");
    }

    memberDiv.innerHTML = `
      <div class="member-avatar">
        <img src="${catIconImg}" alt="Cat avatar" class="cat-avatar-img">
      </div>
      <div class="member-name">${memberName}</div>
    `;

    memberDiv.addEventListener("click", () => {
      // Remove selected class from all members
      document
        .querySelectorAll("#paynowMembersList .member-avatar-wrapper")
        .forEach((m) => m.classList.remove("selected"));
      // Add selected class to clicked member
      memberDiv.classList.add("selected");
    });

    membersList.appendChild(memberDiv);
  });

  // Handle custom name input
  customNameInput.addEventListener("input", () => {
    // Remove selected class from all members
    document
      .querySelectorAll("#paynowMembersList .member-avatar-wrapper")
      .forEach((m) => m.classList.remove("selected"));
  });

  // Handle confirm button click
  confirmBtn.addEventListener("click", () => {
    let selectedName = "";
    const selectedMember = membersList.querySelector(".member-avatar-wrapper.selected");

    if (selectedMember) {
      selectedName = selectedMember.getAttribute("data-name");
      paynowNameSelection.classList.add("member-selected");
    } else if (customNameInput.value.trim()) {
      selectedName = customNameInput.value.trim();
      paynowNameSelection.classList.remove("member-selected");
    }

    if (selectedName) {
      paynowNameInput.value = selectedName;
      selectBtn.querySelector(".btn-text").textContent = selectedName;
      closePaynowMemberModal();
    }
  });
}

// Function to close the PayNow member selection modal
function closePaynowMemberModal() {
  hideModal("paynowMemberModal");
}

// Function to set up the PayNow member selection
function setupPaynowMemberSelection() {
  const selectBtn = document.getElementById("selectPaynowMemberBtn");
  const closeBtn = document.getElementById("paynowMemberModal").querySelector(".close-modal");
  const cancelBtn = document.getElementById("paynowMemberModal").querySelector(".cancel-btn");

  selectBtn.addEventListener("click", () => {
    showPaynowMemberModal();
  });

  closeBtn.addEventListener("click", closePaynowMemberModal);
  cancelBtn.addEventListener("click", closePaynowMemberModal);
}

function showSuccessScreen() {
  // Update avatar group with actual members
  const avatarGroup = document.querySelector(".success-footer .avatar-group");

  // Check if we're in desktop mode
  const isDesktopMode = window.matchMedia("(min-width: 1100px)").matches;

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

    // Determine avatar number based on member format
    let avatarNumber;

    if (typeof member === "object" && member.avatar) {
      // Use the member's avatar if it's in object format
      avatarNumber = member.avatar;
    } else {
      // For string format members, try to find their avatar in localStorage groups
      const memberName = typeof member === "object" ? member.name : member;
      let foundInGroups = false;
      const storedGroups = JSON.parse(localStorage.getItem("groups")) || {};

      // Search through all groups for this member
      Object.values(storedGroups).forEach((groupMembers) => {
        groupMembers.forEach((groupMember) => {
          // If we find a matching name and it has an avatar
          if (typeof groupMember === "object" && groupMember.name === memberName && groupMember.avatar) {
            avatarNumber = groupMember.avatar;
            foundInGroups = true;
          }
        });
      });

      // If not found in groups, fallback to index-based avatar or generate a consistent one
      if (!foundInGroups) {
        if (typeof member === "object" && member.name) {
          // Generate consistent avatar based on name
          const nameHash = member.name.split("").reduce((a, b) => {
            a = (a << 5) - a + b.charCodeAt(0);
            return a & a;
          }, 0);
          avatarNumber = Math.abs(nameHash % 20) + 1;
        } else {
          // Simple index-based fallback for string members
          avatarNumber = (index % 20) + 1;
        }
      }
    }

    avatarImg.src = `assets/cat-icon/cat-${avatarNumber}.svg`;

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
  const shareModal = document.getElementById("shareBillModal");

  if (!shareModal.classList.contains("active") && isDesktopMode) {
    // Display the modal and overlay
    shareModal.classList.add("active");
  }

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

  // Check if we're in desktop mode
  const isDesktopMode = window.matchMedia("(min-width: 1100px)").matches;

  // Only show if not already active (prevents animation restart in desktop)
  if (!modal.classList.contains("active")) {
    // Display the modal and overlay
    modal.classList.add("active");
    overlay.classList.add("active");
  }

  // Make sure the close button works
  if (closeBtn) {
    closeBtn.onclick = closeShareModal;
  }

  // In mobile mode, allow closing by clicking overlay
  if (!isDesktopMode) {
    overlay.onclick = closeShareModal;
  }
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
}

// Initialize drag functionality for the bill summary modal
function initializeBillSummaryDrag() {
  const modal = document.getElementById("billSummaryModal");
  const overlay = document.getElementById("billSummaryOverlay");
  const dragHandle = document.querySelector(".bill-summary-drag-handle");
  let startY = 0;
  let startTop = 0;
  let currentState = "peeking";
  let isDragging = false;
  let isMouseDrag = false;

  function handleDragStart(e) {
    if (e.type === "mousedown" && e.button !== 0) return; // Only process left mouse button

    isDragging = true;
    isMouseDrag = e.type === "mousedown";
    startY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;

    // Get the current position from the transform
    const style = window.getComputedStyle(modal);
    startTop = parseInt(style.bottom);

    if (e.type === "mousedown") {
      e.preventDefault();
    }
  }

  function handleDragMove(e) {
    if (!isDragging) return;

    // For mouse events, only process if this is an active mouse drag
    if (e.type === "mousemove" && !isMouseDrag) return;

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
    // For mouse events, only process if this is an active mouse drag
    if (e.type === "mouseup" && !isMouseDrag) return;

    if (!isDragging) return;
    isDragging = false;
    isMouseDrag = false;

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

  // Touch event handlers for the drag handle
  dragHandle.addEventListener("touchstart", handleDragStart);
  dragHandle.addEventListener("touchmove", handleDragMove);
  dragHandle.addEventListener("touchend", handleDragEnd);

  // Mouse event handlers for desktop
  dragHandle.addEventListener("mousedown", handleDragStart);
  document.addEventListener("mousemove", handleDragMove);
  document.addEventListener("mouseup", handleDragEnd);

  // Overlay click handler to close the modal
  overlay.addEventListener("click", function () {
    // Just minimize to peeking state, don't hide completely
    modal.classList.remove("fully-open", "half-open");
    modal.classList.add("peeking");
    overlay.classList.remove("active");
  });
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
  // Get elements once
  const addSettleItemView = document.getElementById("bill-summary-handle");

  // Exit early if elements don't exist
  if (!addSettleItemView) return;

  // Constants for swipe detection - moved outside handler for better performance
  const SWIPE_THRESHOLD = 80; // Minimum distance for swipe
  const MIN_VELOCITY = 0.6; // Minimum velocity (px/ms)
  const MIN_ANGLE = 45; // Minimum vertical angle (degrees)
  const MAX_HORIZONTAL_RATIO = 0.8; // Maximum horizontal/vertical ratio
  const DEBOUNCE_TIMEOUT = 400; // Debounce timeout (ms)
  const MIN_TOUCH_DURATION = 100; // Minimum touch duration (ms)
  const MAX_TOUCH_DURATION = 1300; // Maximum touch duration (ms)

  // Touch tracking variables
  let touchData = {
    startY: 0,
    startX: 0,
    startTime: 0,
    isProcessingGesture: false,
    isScrolling: false,
  };

  // Trigger haptic feedback - moved outside handlers
  const triggerHapticFeedback = () => {
    if (navigator.vibrate) {
      navigator.vibrate(10); // Short, subtle vibration
    }
  };

  // Handle touch start
  const handleTouchStart = function (e) {
    // Reset tracking state
    touchData.isScrolling = false;
    touchData.isProcessingGesture = false;

    // Store initial touch position and time
    touchData.startY = e.touches[0].clientY;
    touchData.startX = e.touches[0].clientX;
    touchData.startTime = performance.now(); // More accurate than Date.getTime()
  };

  // Handle touch move to detect scrolling
  const handleTouchMove = function (e) {
    // Skip if already detected as scrolling
    if (touchData.isScrolling || touchData.isProcessingGesture) return;

    const deltaY = Math.abs(e.touches[0].clientY - touchData.startY);

    // If significant vertical movement and the element can scroll
    const element = e.currentTarget;
    if (deltaY > 10 && element.scrollTop > 0) {
      touchData.isScrolling = true;
    }
  };

  // Handle touch end
  const handleTouchEnd = function (e) {
    // Skip if already processing a gesture or detected scrolling
    if (touchData.isProcessingGesture || touchData.isScrolling) return;

    const endY = e.changedTouches[0].clientY;
    const endX = e.changedTouches[0].clientX;
    const endTime = performance.now();
    const touchDuration = endTime - touchData.startTime;

    // Early return if touch duration is outside desired range
    if (touchDuration < MIN_TOUCH_DURATION || touchDuration > MAX_TOUCH_DURATION) return;

    // Calculate swipe metrics
    const deltaY = touchData.startY - endY;
    const deltaX = Math.abs(touchData.startX - endX);
    const velocity = Math.abs(deltaY) / touchDuration;
    const angle = (Math.atan2(Math.abs(deltaY), deltaX) * 180) / Math.PI;

    // Check if this is a valid upward swipe
    if (
      deltaY > SWIPE_THRESHOLD &&
      velocity > MIN_VELOCITY &&
      angle > MIN_ANGLE &&
      deltaX < deltaY * MAX_HORIZONTAL_RATIO
    ) {
      touchData.isProcessingGesture = true;

      // Provide feedback and show summary
      triggerHapticFeedback();
      requestAnimationFrame(() => showSummary("fully-open"));

      // Reset processing flag after timeout
      setTimeout(() => {
        touchData.isProcessingGesture = false;
      }, DEBOUNCE_TIMEOUT);
    }
  };

  // Handle touch cancel (e.g. system interruptions)
  const handleTouchCancel = function () {
    touchData.isProcessingGesture = false;
    touchData.isScrolling = false;
  };

  // Attach events with options object - reuse for multiple elements
  const touchOptions = { passive: true };

  // Helper to attach events to an element
  const attachSwipeEvents = (element) => {
    element.addEventListener("touchstart", handleTouchStart, touchOptions);
    element.addEventListener("touchmove", handleTouchMove, touchOptions);
    element.addEventListener("touchend", handleTouchEnd);
    element.addEventListener("touchcancel", handleTouchCancel);
  };

  // Attach events to both screens
  attachSwipeEvents(addSettleItemView);

  // Initialize bill summary drag functionality
  initializeBillSummaryDrag();
}

function editMember(index) {
  editingIndex = index;
  document.getElementById("editMemberName").value = members[index];
  document.getElementById("editMemberPopup").style.display = "block";
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

  // Update the dish assignment UI if we're in that view
  if (currentSettleView === "addSettleItemView") {
    updateSettleItemMembersUI();
  }

  // Close the modal
  hideModal("editMemberModal");
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

function fetchHistory() {
  const historyList = document.querySelector(".history-list");
  const historyLoading = document.querySelector(".history-loading");

  // Show loading spinner
  if (historyLoading) {
    historyLoading.classList.add("active");
  }

  // Clear previous content
  historyList.innerHTML = "";

  // Show skeleton loading placeholders - default to 3
  const placeholdersCount = 3;

  for (let i = 0; i < placeholdersCount; i++) {
    const placeholder = document.createElement("div");
    placeholder.className = "loading-placeholder";
    historyList.appendChild(placeholder);
  }

  // Fetch bills directly from Firebase
  fetchWithUserId("/api/history", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      // Add slight delay for better UX
      setTimeout(() => {
        // Hide loading spinner
        if (historyLoading) {
          historyLoading.classList.remove("active");
        }

        // Clear skeleton loaders
        historyList.innerHTML = "";

        // Check if we have any bills
        if (!data || !data.bills || data.bills.length === 0) {
          historyList.innerHTML = "<p class='no-history'>No history yet.</p>";
          document.getElementById("clearHistoryBtn").style.display = "none";
          return;
        }

        // Show clear history button if we have bills
        document.getElementById("clearHistoryBtn").style.display = "block";

        // Process the bills
        data.bills
          .sort((a, b) => b.timestamp - a.timestamp) // Newest first
          .forEach((bill) => {
            // Create a settle item that matches the design
            const settleItem = document.createElement("a");
            settleItem.href = `/bill/${bill.id}`;
            settleItem.target = "_blank";
            settleItem.className = "settle-item";

            // Format date
            const date = new Date(bill.timestamp);
            const formattedDate = date.toLocaleString();

            // Get total amount from the breakdown
            const total = bill.breakdown?.total || 0;
            // Apply rounding to the final total amount only
            const formattedTotal = `$${roundToNearest5Cents(total)}`;

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
                <div class="settle-delete">
                  <button class="delete-history-btn" data-bill-id="${bill.id}" title="Delete">
                    <img src="assets/bin.svg" alt="Delete" />
                  </button>
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

            // After historyList.appendChild(settleItem);
            const deleteBtn = settleItem.querySelector(".delete-history-btn");
            if (deleteBtn) {
              deleteBtn.addEventListener("click", function (e) {
                e.preventDefault();
                e.stopPropagation(); // Prevent opening the bill link

                const billId = this.getAttribute("data-bill-id");
                if (confirm("Are you sure you want to delete this record?")) {
                  deleteHistoryRecord(billId, settleItem);
                }
              });
            }
          });
      }, 800); // Delay for better UX
    })
    .catch((error) => {
      console.error("Error fetching history:", error);
      historyList.innerHTML = "<p class='error'>Failed to load history. Please try again later.</p>";
      if (historyLoading) {
        historyLoading.classList.remove("active");
      }
    });
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

  // Update PayNow labels based on profile
  updatePaymentLabels(profile);

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

// Update the PayNow labels based on the selected tax profile
function updatePaymentLabels(profile) {
  const paynowNameLabel = document.querySelector('label[for="paynowName"]');
  const paynowPhoneLabel = document.querySelector('label[for="paynowPhone"]');
  const paynowNameInput = document.getElementById("paynowName");
  const paynowPhoneInput = document.getElementById("paynowPhone");
  const paynowNameHelper = paynowNameInput?.parentElement.querySelector(".helper-text");
  const paynowPhoneHelper = paynowPhoneInput?.parentElement.querySelector(".helper-text");
  const paynowNameError = document.getElementById("paynowNameError");
  const paynowPhoneError = document.getElementById("paynowPhoneError");

  if (paynowNameLabel && paynowPhoneLabel) {
    if (profile === "malaysia") {
      // Update labels
      paynowNameLabel.textContent = "Pay to";
      paynowPhoneLabel.textContent = "Payee Phone Number";

      // Update placeholders
      if (paynowNameInput) {
        paynowNameInput.placeholder = "Enter recipient name";
      }

      if (paynowPhoneInput) {
        paynowPhoneInput.placeholder = "Enter payee phone number";
        // Remove pattern validation for Malaysia
        paynowPhoneInput.removeAttribute("pattern");
        paynowPhoneInput.removeAttribute("title");
      }

      // Update helper text
      if (paynowNameHelper) {
        paynowNameHelper.textContent = "Enter the name of payment recipient";
      }

      if (paynowPhoneHelper) {
        paynowPhoneHelper.textContent = "Enter the payee phone number";
      }

      // Update error messages
      if (paynowNameError) {
        paynowNameError.textContent = "Please enter recipient name";
      }

      if (paynowPhoneError) {
        paynowPhoneError.textContent = "Please enter a valid phone number";
      }
    } else {
      // Default Singapore labels
      paynowNameLabel.textContent = "PayNow Name";
      paynowPhoneLabel.textContent = "PayNow Phone Number";

      // Default Singapore placeholders
      if (paynowNameInput) {
        paynowNameInput.placeholder = "Enter name";
      }

      if (paynowPhoneInput) {
        paynowPhoneInput.placeholder = "Enter phone number (e.g., 8XXX XXXX)";
        // Add back Singapore phone validation
        paynowPhoneInput.setAttribute("pattern", "[89]\\d{7}");
        paynowPhoneInput.setAttribute(
          "title",
          "Please enter a valid Singapore phone number starting with 8 or 9, followed by 7 digits"
        );
      }

      // Update helper text
      if (paynowNameHelper) {
        paynowNameHelper.textContent = "Enter the name of PayNow account";
      }

      if (paynowPhoneHelper) {
        paynowPhoneHelper.textContent = "Enter the payer phone number to generate PayNow QR";
      }

      // Update error messages
      if (paynowNameError) {
        paynowNameError.textContent = "Please enter PayNow name";
      }

      if (paynowPhoneError) {
        paynowPhoneError.textContent = "Please enter a valid PayNow phone number";
      }
    }
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
    modal.classList.remove("peeking", "half-open", "fully-open");
  }

  // Hide the overlay
  const overlay = document.getElementById("billSummaryOverlay");
  if (overlay) {
    overlay.classList.remove("active");
  }

  updateHomePageCards();
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
    showSuccessScreen();
    setTimeout(() => {
      loadingScreen.classList.remove("active");
      loadingScreen.classList.add("inactive");
    }, 2000);
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
  const billSummaryModal = document.getElementById("billSummaryModal");
  if (currentSettleView === "settleChoiceView") {
    // If on main settle screen, go back to home
    hideSettleNowScreen();
    if (billSummaryModal) {
      billSummaryModal.style.display = "none";
    }
  } else if (currentSettleView === "newGroupMembersView") {
    // Reset birthday person selection when going back
    birthdayPerson = null;

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
    if (billSummaryModal) {
      billSummaryModal.style.display = "none";
    }
  } else if (currentSettleView === "addSettleItemView") {
    showModal("backConfirmModal");
  } else if (currentSettleView === "savedGroupsView") {
    // Reset birthday person selection when going back
    birthdayPerson = null;

    // If on saved groups view, go back to settle choice

    // Check if there are any saved groups before showing settleChoiceView
    const hasSavedGroups = Object.keys(groups).length > 0;

    // Update the UI based on whether we have saved groups
    if (!hasSavedGroups) {
      document.querySelector(".saved-group-option").style.display = "none";
      document.querySelector(".or-divider").style.display = "none";
      document.querySelector(".new-group-option").classList.add("selected");
    } else {
      document.querySelector(".saved-group-option").style.display = "flex";
      document.querySelector(".or-divider").style.display = "flex";

      // Make sure the Get Started button is enabled
      document.querySelector(".get-started-btn").disabled = false;
      settleChoiceError.style.display = "none";
    }

    showSettleView("settleChoiceView");

    if (billSummaryModal) {
      billSummaryModal.style.display = "none";
    }
  } else if (currentSettleView === "finaliseSettleBillScreen") {
    hideFinaliseSettleBillScreen();
  }
}

// Function to load and render saved groups
function loadSavedGroups() {
  // First load from localStorage
  const localGroups = JSON.parse(localStorage.getItem("groups")) || {};

  // Initialize groups with local data
  groups = { ...localGroups };

  showSettleView("savedGroupsView");

  // Show loading state on Get Started button
  const savedGroupsLoading = document.querySelector(".saved-groups-loading");
  savedGroupsLoading.classList.add("active");
  savedGroupsLoading.disabled = true;

  // Then try to fetch from Firebase and merge
  fetchGroupsFromFirebase()
    .then(() => {
      renderSavedGroups();
    })
    .catch((error) => {
      console.error("Error fetching groups from Firebase:", error);
      // Continue with local groups only
      renderSavedGroups();
    })
    .finally(() => {
      // Remove loading state from button
      if (savedGroupsLoading) {
        savedGroupsLoading.classList.remove("active");
        savedGroupsLoading.disabled = false;
      }
    });
}

// Function to fetch groups from Firebase
async function fetchGroupsFromFirebase() {
  try {
    // Use fetchWithUserId to handle the API call
    const response = await fetchWithUserId("/api/groups");

    if (!response.ok) {
      throw new Error(`Failed to fetch groups from Firebase: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.groups) {
      // Merge Firebase groups with local groups (Firebase takes precedence)
      groups = { ...groups, ...data.groups };
      // Save the merged groups to localStorage for offline access
      localStorage.setItem("groups", JSON.stringify(groups));
      // console.log(`Fetched ${Object.keys(data.groups).length} groups from Firebase`);
    }
  } catch (error) {
    console.error("Error fetching groups from Firebase:", error);
    // Rethrow the error to be handled by the caller
    throw error;
  }
}

// Function to render the saved groups UI
function renderSavedGroups() {
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
      avatarNumber = member.avatar || Math.floor(Math.random() * 20) + 1;
    } else {
      memberName = member;
      // For backward compatibility with old format, generate a consistent avatar
      // based on the member's name string
      const nameHash = memberName.split("").reduce((a, b) => {
        a = (a << 5) - a + b.charCodeAt(0);
        return a & a;
      }, 0);
      avatarNumber = Math.abs(nameHash % 20) + 1;
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
  document.querySelector(".new-group-members-container h2").textContent = "Edit Group";

  // Change the Next button text to Done
  document.querySelector(".next-btn").textContent = "Done";

  // Show and populate the group name input field
  const groupNameContainer = document.querySelector(".edit-group-name-container");
  const groupNameInput = document.getElementById("editGroupName");
  if (groupNameContainer && groupNameInput) {
    groupNameContainer.style.display = "block";
    groupNameInput.value = groupName;

    // Clear any existing error message
    const errorElement = groupNameInput.parentElement.querySelector(".error-message");
    if (errorElement) {
      errorElement.style.display = "none";
      errorElement.textContent = "Please enter group's name";
    }
  }

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
      // Focus the first input field in the modal
      const firstInput = modal.querySelector("input");
      if (firstInput) {
        setTimeout(() => {
          // Force keyboard to appear on iOS devices
          firstInput.focus();
          // Add a slight delay and then focus again to ensure keyboard appears on iOS
          setTimeout(() => {
            firstInput.click();
            firstInput.focus();
          }, 100);
        }, 300); // Wait for modal animation to complete
      }
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

  // Reset birthday person selection when loading a group
  birthdayPerson = null;

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
    let groupNameToSave = currentGroup;

    // If we're editing a group, check if the name has changed
    if (isEditingGroup) {
      const groupNameInput = document.getElementById("editGroupName");
      if (groupNameInput) {
        const newGroupName = groupNameInput.value.trim();
        const errorElement = groupNameInput.parentElement.querySelector(".error-message");

        // Validate that the group name is not empty
        if (!newGroupName) {
          if (errorElement) {
            errorElement.textContent = "Please enter group's name";
            errorElement.style.display = "block";
          }
          return; // Don't save if name is empty
        }

        // If the name has changed, we need to delete the old group and create a new one
        if (newGroupName !== currentGroup) {
          // Validate that the new name doesn't already exist
          if (groups[newGroupName]) {
            // Show error - group name already exists
            if (errorElement) {
              errorElement.textContent = "A group with this name already exists";
              errorElement.style.display = "block";
            }
            return; // Don't save if name conflicts
          }

          // Remove the old group from local storage
          delete groups[currentGroup];

          // Also delete the old group from Firebase
          deleteGroupFromFirebase(currentGroup);

          // Update the current group name
          groupNameToSave = newGroupName;
          currentGroup = newGroupName;

          // console.log(`Renamed group to "${newGroupName}"`);
        }

        // Clear any error messages if validation passed
        if (errorElement) {
          errorElement.style.display = "none";
        }
      }
    }

    groups[groupNameToSave] = [...members];
    localStorage.setItem("groups", JSON.stringify(groups));
    // console.log(`Saved group "${groupNameToSave}" with ${members.length} members`);

    // Also save to Firebase
    saveGroupToFirebase(groupNameToSave, [...members]);
  }
}

// Function to save the group to Firebase
async function saveGroupToFirebase(groupName, groupMembers) {
  try {
    // Get user ID for ownership tracking
    const userId = await getUserId();

    const groupData = {
      name: groupName,
      members: groupMembers,
      timestamp: Date.now(),
      userId: userId || null,
    };

    // Use fetchWithUserId to handle the API call
    const response = await fetchWithUserId("/api/groups/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        groupName: groupName,
        groupData: groupData,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save group to Firebase: ${response.statusText}`);
    }

    const result = await response.json();
    // console.log(`Group "${groupName}" saved to Firebase successfully`, result);
  } catch (error) {
    console.error(`Error saving group "${groupName}" to Firebase:`, error);
    // Continue silently - the group is still saved in localStorage
  }
}

// Function to delete a group from Firebase
async function deleteGroupFromFirebase(groupName) {
  try {
    const response = await fetchWithUserId(`/api/groups/${encodeURIComponent(groupName)}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      // console.error(`Failed to delete group from Firebase: ${response.statusText}`);
    } else {
      // console.log(`Group "${groupName}" deleted from Firebase successfully`);
    }
  } catch (error) {
    // console.error(`Error deleting group "${groupName}" from Firebase:`, error);
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

  // Update the dish assignment UI if we're in that view
  if (currentSettleView === "addSettleItemView") {
    setTimeout(() => {
      updateSettleItemMembersUI();
    }, 350); // Wait for fade-out animation to complete
  }

  // Close the modal
  hideModal("editMemberModal");
}

// Add a new member
function addNewMember() {
  const memberNameInput = document.getElementById("memberName");
  const memberName = memberNameInput.value.trim();
  const inputField = memberNameInput.closest(".input-field");
  const errorMessage = inputField.querySelector(".error-message");

  // Check if we've reached the maximum number of members (20)
  if (members.length >= 20) {
    inputField.classList.add("error");
    errorMessage.classList.add("visible");
    errorMessage.textContent = "Maximum of 20 members allowed";
    return;
  }

  // Validate input
  if (!memberName) {
    inputField.classList.add("error");
    errorMessage.classList.add("visible");
    errorMessage.textContent = "Please enter a name";
    return;
  }

  // Check if the name already exists
  if (members.some((member) => (typeof member === "object" ? member.name === memberName : member === memberName))) {
    inputField.classList.add("error");
    errorMessage.textContent = "This name already exists";
    errorMessage.classList.add("visible");
    return;
  }

  // Get all used avatar numbers
  const usedAvatars = members
    .filter((member) => typeof member === "object" && member.avatar)
    .map((member) => member.avatar);

  // Generate a list of available avatars (1-20)
  const allAvatars = Array.from({ length: 20 }, (_, i) => i + 1);
  const availableAvatars = allAvatars.filter((num) => !usedAvatars.includes(num));

  // If all avatars are used, just pick a random one
  // Otherwise, use an avatar that hasn't been used yet
  const avatarNumber =
    availableAvatars.length > 0
      ? availableAvatars[Math.floor(Math.random() * availableAvatars.length)]
      : Math.floor(Math.random() * 20) + 1;

  // Add the member to the array as an object with name and avatar
  members.push({
    name: memberName,
    avatar: avatarNumber,
  });

  // Create and add the member to the UI
  addMemberToUI(memberName, avatarNumber);

  // Update the dish assignment UI if we're in that view
  if (currentSettleView === "addSettleItemView") {
    updateSettleItemMembersUI();
  }

  // Clear the input field
  memberNameInput.value = "";
  inputField.classList.remove("error");
  errorMessage.classList.remove("visible");

  // Hide the modal
  hideModal("addMemberModal");
}

function clearHistory() {
  // Show the confirmation modal
  showModal("clearHistoryConfirmModal");
}

// Function to actually clear the history after confirmation
function confirmClearHistory() {
  // Show loading in the history list
  const historyList = document.querySelector(".history-list");
  if (historyList) {
    historyList.innerHTML = "<p class='no-history'>Clearing history...</p>";
  }

  // Call the API to clear history from Firebase
  fetchWithUserId("/api/history/clear", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed to clear history from server");
      }
      return response.json();
    })
    .then((data) => {
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
}

// Function to show a toast notification
function showToast(toastId) {
  const toast = document.getElementById(toastId);
  if (toast) {
    toast.classList.add("show");

    // Store the timeout ID so we can clear it if the toast is manually dismissed
    const timeoutId = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000); // Hide after 3 seconds

    // Add touch/click event to dismiss the toast
    toast.addEventListener("click", function dismissToast() {
      clearTimeout(timeoutId);
      toast.classList.remove("show");
      toast.removeEventListener("click", dismissToast);

      // Add subtle haptic feedback if available
      if (window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(5); // Light vibration for feedback
      }
    });
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
    const errorMessage = document.querySelector(".new-group-error-message");

    errorMessage.style.display = "none";

    if (savedGroupSelected) {
      // Check if we have saved groups
      if (Object.keys(groups).length > 0) {
        // Load and show saved groups view with loading indicator
        loadSavedGroups();
      } else {
        // No saved groups, show message
        alert("No saved groups found. Please create a new group first.");
        document.querySelector(".new-group-option").click();
      }
    } else if (newGroupSelected) {
      // Start with empty members
      members = [];
      currentGroup = "";

      // Reset birthday person selection for new group
      birthdayPerson = null;

      // Make sure Next button says "Next"
      const nextBtn = document.querySelector(".next-btn");
      if (nextBtn) nextBtn.textContent = "Next";

      // Make sure title is correct
      const title = document.querySelector(".new-group-members-container h2");
      if (title) title.textContent = "Settle With New Group";

      // Hide the group name input field for new groups
      const groupNameContainer = document.querySelector(".edit-group-name-container");
      if (groupNameContainer) {
        groupNameContainer.style.display = "none";
      }

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
  document.querySelectorAll(".next-btn, .new-group-next-btn").forEach((button) => {
    button.addEventListener("click", function () {
      // If we're editing a group, save changes before proceeding
      if (isEditingGroup && currentGroup) {
        // Save the updated members to the group
        saveGroupToStorage();

        // Store the group name for the confirmation
        document.getElementById("groupUpdatedModal").dataset.groupName = currentGroup;

        // Show the group updated modal
        showModal("groupUpdatedModal");

        // Important: Return early to prevent further execution
        return;
      }

      // Only proceed to add settle item if NOT editing a group
      // Check if we have members
      if (members.length === 0 || members.length < 2) {
        const errorMessage = document.querySelector(".new-group-error-message");
        errorMessage.style.display = "block";
        return;
      } else {
        const errorMessage = document.querySelector(".new-group-error-message");
        errorMessage.style.display = "none";
      }

      // Set the previous view to newGroupMembersView so user can edit members
      previousView = "newGroupMembersView";

      // Ensure the New favourite group button is visible since we're coming from new group
      const newFavouriteGroupBtn = document.querySelector(".new-favourite-group-btn");
      const successMessage = document.querySelector(".group-success-message");

      if (newFavouriteGroupBtn && successMessage) {
        newFavouriteGroupBtn.style.display = "flex";
        successMessage.classList.remove("visible");
      }

      // Navigate to add settle item view
      showSettleView("addSettleItemView");

      // Scroll the addSettleItemView container to the top
      const addSettleItemView = document.getElementById("addSettleItemView");
      if (addSettleItemView) {
        addSettleItemView.scrollTop = 0;
      }

      // Load members into the UI
      updateSettleItemMembersUI();
    });
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

  // Handle input in group name field to clear error messages
  document.getElementById("editGroupName").addEventListener("input", function () {
    const errorElement = this.parentElement.querySelector(".error-message");
    if (errorElement && errorElement.style.display !== "none") {
      errorElement.style.display = "none";
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

    // Scroll the dishSummaryContainer container to the bottom
    const dishSummaryContainer = document.getElementById("dishSummaryContainer");
    if (dishSummaryContainer) {
      // Use smooth scrolling for better UX
      setTimeout(() => {
        dishSummaryContainer.scrollTo({
          top: dishSummaryContainer.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    }
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

// Save group button handler (in member editing view)
const saveGroupBtn = document.querySelector(".save-group-btn");
if (saveGroupBtn) {
  saveGroupBtn.addEventListener("click", function () {
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

    // Also save to Firebase
    saveGroupToFirebase(currentGroup, [...members]);

    // Hide the modal
    hideModal("createGroupModal");

    // Show success message
    const successMessage = document.querySelector(".group-success-message");
    const groupNameDisplay = document.querySelector(".group-name-display");
    const newGroupBtn = document.querySelector(".new-favourite-group-btn");
    const saveGroupSection = document.querySelector(".save-group-section");

    if (successMessage && groupNameDisplay) {
      // Update group name in success message and show it
      groupNameDisplay.textContent = `Group "${groupName}" created`;
      successMessage.classList.add("visible");

      // Hide the "New favourite group?" button temporarily
      if (newGroupBtn) {
        newGroupBtn.style.display = "none";
      }

      // Hide the save group button if visible
      if (saveGroupSection) {
        saveGroupSection.style.display = "none";
      }

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
  deleteConfirmBtn.addEventListener("click", async function () {
    const modal = document.getElementById("deleteGroupModal");
    const groupName = modal.dataset.groupName;

    if (groupName) {
      // First delete from local storage
      delete groups[groupName];
      localStorage.setItem("groups", JSON.stringify(groups));

      // Then try to delete from Firebase
      try {
        const response = await fetchWithUserId(`/api/groups/${encodeURIComponent(groupName)}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          console.error(`Failed to delete group from Firebase: ${response.statusText}`);
          // Continue with the UI update even if Firebase delete fails
        } else {
          // console.log(`Group "${groupName}" deleted from Firebase successfully`);
        }
      } catch (error) {
        console.error(`Error deleting group "${groupName}" from Firebase:`, error);
        // Continue with the UI update even if Firebase delete fails
      }

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
    const billSummaryModal = document.getElementById("billSummaryModal");
    if (billSummaryModal) {
      billSummaryModal.style.display = "none";
    }
    document.querySelector(".assigned-members").innerHTML = "";
    document.getElementById("dishSummaryContainer").innerHTML = "";
    document.getElementById("itemName").value = "";
    document.getElementById("itemPrice").value = "";
    document.getElementById("settleEqually").checked = false;

    // Clear dishes array and update the dish list
    dishes = [];

    // Reset birthday person selection when going back
    birthdayPerson = null;

    // Close the bill summary if it's open
    closeSummary();

    // Navigate back to the appropriate view based on previousView
    showSettleView(previousView);
    // console.log(previousView);

    // Update the header text
    updateSettleNowHeader();

    // Clear receipt file input
    const receiptFileInput = document.getElementById("receiptImage");
    if (receiptFileInput) {
      receiptFileInput.value = "";
      // Reset upload text
      const uploadTextElement = document.querySelector(".upload-text");
      if (uploadTextElement) {
        uploadTextElement.textContent = "Choose File";
      }
    }

    // If going back to newGroupMembersView, ensure the title is correct
    if (previousView === "newGroupMembersView") {
      // Update title if we're editing a group
      if (isEditingGroup) {
        document.querySelector(".new-group-members-container h2").textContent = "Edit Group Members";
      } else {
        document.querySelector(".new-group-members-container h2").textContent = "Settle With New Group";
      }
    } else if (previousView === "settleChoiceView") {
      // Check if there are any saved groups
      const hasSavedGroups = Object.keys(groups).length > 0;

      // If no saved groups, hide the saved group option and select new group
      if (!hasSavedGroups) {
        document.querySelector(".saved-group-option").style.display = "none";
        document.querySelector(".or-divider").style.display = "none";
        document.querySelector(".new-group-option").classList.add("selected");
      } else {
        document.querySelector(".saved-group-option").style.display = "flex";
        document.querySelector(".or-divider").style.display = "flex";
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
  // Initialize dishes array if it doesn't exist
  if (typeof dishes === "undefined") {
    window.dishes = [];
  }

  // Update welcome message with user's name from localStorage
  const welcomeHeading = document.querySelector(".welcome-section h1");
  if (welcomeHeading) {
    const userName = localStorage.getItem("settlelah_user_name");
    if (userName) {
      welcomeHeading.textContent = `Welcome back, ${userName}!`;
    } else {
      welcomeHeading.textContent = "Welcome back!";
    }
  }

  // Initialize the tax profile dropdown
  initTaxProfileDropdown();

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
    // console.log(`Tax profile changed to: ${taxProfile}`);
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
    // Sync the dropdown with localStorage on initialization
    syncTaxProfileDropdown();

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
        const avatarNumber = Math.abs(nameHash % 20) + 1;

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
  const noGroupsMessage = document.querySelector(".no-saved-groups");

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
      avatarNumber = Math.abs(nameHash % 20) + 1;
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

  // Show birthday person button if we have members
  updateBirthdayPersonButton();

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

// Function to reset scanning overlay state
function resetScanningOverlay() {
  const scanOverlay = document.querySelector(".scan-receipt-overlay");
  const scanningText = document.querySelector(".scanning-text");
  const scanButton = document.getElementById("scanReceiptBtn");

  if (scanOverlay) {
    scanOverlay.classList.remove("active");
    scanOverlay.style.transition = "";
    scanOverlay.style.opacity = "";
  }

  if (scanningText) {
    scanningText.textContent = "Scanning your receipt...";
    scanningText.style.animation = "";
    scanningText.style.color = "";
  }

  if (scanButton) {
    scanButton.disabled = false;
    scanButton.textContent = "Scan Receipt";
  }
}

// Scan item button handler
const scanItemBtn = document.querySelector(".scan-item-btn");
if (scanItemBtn) {
  scanItemBtn.addEventListener("click", function () {
    // Reset scanning overlay state before showing modal
    resetScanningOverlay();
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
async function updateHomePageCards() {
  // Update Last Created Group card (now async)
  await updateLastCreatedGroup();

  // Update Last Settle card
  updateLastSettle();
}

// Function to update the Last Created Group card
async function updateLastCreatedGroup() {
  const groupCard = document.querySelector(".group-card:nth-child(4)");
  if (!groupCard) return;

  // Show skeleton loading
  groupCard.classList.add("loading");

  let groups = {};
  let fromFirebase = false;

  try {
    // First try to fetch from Firebase
    const response = await fetchWithUserId("/api/groups");

    if (response.ok) {
      const data = await response.json();
      if (data.groups) {
        groups = data.groups;
        fromFirebase = true;
        // Update localStorage with latest Firebase data
        localStorage.setItem("groups", JSON.stringify(groups));
      }
    } else {
      throw new Error(`Firebase fetch failed: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error fetching groups from Firebase, falling back to localStorage:", error);
    // Fallback to localStorage
    groups = JSON.parse(localStorage.getItem("groups") || "{}");
    fromFirebase = false;
  }

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

      // Remove loading state and show the element
      groupCard.classList.remove("loading");
      groupCard.style.display = "block";
    }, 2000);
    return;
  }

  // Find most recent group (assuming the last one in the object is the newest)
  // In a real app with timestamps, you'd sort by creation time
  const lastGroupName = groupNames[0];
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
          avatarNumber = Math.abs(nameHash % 20) + 1;
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

    // Remove loading state and show the element
    groupCard.classList.remove("loading");
    groupCard.style.display = "block";
  }, 2000);
}

// Function to update the Last Settle card
function updateLastSettle() {
  const settleCard = document.querySelector(".group-card:nth-child(5)");
  if (!settleCard) return;

  // Show skeleton loading
  settleCard.classList.add("loading");

  // Fetch the most recent bill from Firebase
  fetchWithUserId("/api/history/latest", {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      // Add slight delay to show the loading animation
      setTimeout(() => {
        // Remove loading state and show the element
        settleCard.classList.remove("loading");
        settleCard.style.display = "block";

        // If no bill found
        if (!data || !data.bill) {
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
          return;
        }

        // Update the card with the latest bill data
        const bill = data.bill;
        updateSettleCardContent(settleCard, bill.id, bill);
      }, 300);
    })
    .catch((error) => {
      console.error("Error fetching latest settlement:", error);
      settleCard.classList.remove("loading");
      settleCard.style.display = "block";

      // Show error state
      const settleInfo = settleCard.querySelector(".settle-info");
      if (settleInfo) {
        const amountEl = settleInfo.querySelector(".settle-info-amount");
        if (amountEl) amountEl.textContent = "Error loading";
      }
    });
}

// Helper function to update settle card content
function updateSettleCardContent(card, billId, data) {
  if (!data) return;

  // Set the link to the result page
  card.href = `/bill/${billId}`;
  card.target = "_blank";

  // Update amount
  const amountElement = card.querySelector("#lastSettle .settle-info-amount");
  if (amountElement && data.breakdown && data.breakdown.total) {
    // Apply rounding to the final total amount only
    amountElement.textContent = `$${roundToNearest5Cents(data.breakdown.total)}`;
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

// Function to round amounts to the nearest 0.05
function roundToNearest5Cents(value) {
  if (typeof value === "string") {
    value = parseFloat(value);
  }

  //two decimal places
  value = parseFloat(value.toFixed(2));

  // Get decimal part (cents)
  const wholePart = Math.floor(value);
  const decimalPart = value - wholePart;
  const centsfinal = Math.round(decimalPart * 100);
  const cents = centsfinal % 10;

  // Handle special cases
  if (cents < 5) {
    const finalValue = value - cents / 100;
    return finalValue.toFixed(2);
  } else if (cents === 5) {
    return value.toFixed(2);
  } else {
    const roundedUp = Math.ceil(centsfinal / 10) * 10;
    const centsToAdd = (roundedUp - centsfinal) / 100;
    const finalValue = value + centsToAdd;
    return finalValue.toFixed(2);
  }
}

// Show a notification to the user
function showNotification(message) {
  // Create and show a toast notification
  const toast = document.createElement("div");
  toast.className = "toast-notification";
  toast.textContent = message;

  document.body.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.add("show");
  }, 10);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Function to sync the tax profile dropdown with localStorage value
function syncTaxProfileDropdown() {
  const taxProfileDropdown = document.getElementById("taxProfile");
  const savedTaxProfile = localStorage.getItem("taxProfile") || "singapore";

  if (taxProfileDropdown) {
    // Set the dropdown value to match localStorage
    taxProfileDropdown.value = savedTaxProfile;

    // Update the UI based on the selected profile
    updateTaxRates(savedTaxProfile);
  }
}

// Add a window.onload handler to ensure tax profile syncs even if user refreshes
window.addEventListener("load", function () {
  // Sync the tax profile dropdown with localStorage
  syncTaxProfileDropdown();
});

// Prevent number inputs from changing on scroll
document.addEventListener("DOMContentLoaded", function () {
  // Select all numeric inputs
  const numberInputs = document.querySelectorAll('input[type="number"]');

  numberInputs.forEach((input) => {
    input.addEventListener(
      "wheel",
      function (e) {
        // Prevent the default behavior (value change) when scrolling
        e.preventDefault();
      },
      { passive: false }
    ); // Must use passive: false to allow preventDefault
  });
});

// Add this function at the top of the file, after the other utility functions

// Validate a bill ID format on the client side
function isValidBillId(id) {
  // Check if the ID follows our secure format pattern
  // Format: timestamp-randomBytes-matterHash
  const pattern = /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/i;

  // For backward compatibility, also accept the old format (6 alphanumeric chars)
  const oldPattern = /^[a-z0-9]{6}$/i;

  return pattern.test(id) || oldPattern.test(id);
}

// Update the bill history storage to include validation
function addBillToHistory(id, data) {
  // Validate ID before storing
  if (!isValidBillId(id)) {
    console.warn(`Attempted to store invalid bill ID: ${id}`);
    return;
  }

  // No need to store in localStorage anymore as data is already in Firebase
  // The bill data is saved to Firebase in the /calculate endpoint
  // console.log(`Bill ${id} added to history in Firebase`);
}

// Update this function for handling bill history loading
function loadBillHistory() {
  // No need to load from localStorage anymore
  // Data will be fetched directly from Firebase when needed
  // console.log("Bill history will be loaded from Firebase when needed");
}

// Function to synchronize data from Firebase to localStorage on page load
async function syncDataFromFirebase() {
  try {
    // Show subtle loading indicator or handle in a non-blocking way
    // console.log("Syncing data from Firebase...");

    // Fetch groups from Firebase
    await fetchGroupsFromFirebase();

    // console.log("Firebase sync complete");
  } catch (error) {
    console.error("Error syncing data from Firebase:", error);
  }
}

// Check if the app is running as a PWA
function isRunningAsPWA() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// Initialize app functionality after window loads
window.onload = async function () {
  if (isRunningAsPWA()) {
    // PWA-specific logic here
    document.body.style.height = "100vh";
    document.body.classList.add("pwa-mode");
  }

  // First sync data from Firebase to localStorage
  await syncDataFromFirebase().then(() => {
    console.log("Data synchronization complete");
  });

  // Update home page cards after sync
  await updateHomePageCards();

  // Wait a short amount of time to ensure everything is ready
  setTimeout(async () => {
    // Initialize pull-to-refresh functionality
    initializePullToRefresh();

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

    // Update home page cards again to ensure latest data
    await updateHomePageCards();

    // Add animation classes after a delay for smoother experience
    setTimeout(() => {
      document.querySelectorAll(".card-widget").forEach((card, index) => {
        setTimeout(() => {
          card.classList.add("animated");
        }, index * 100); // Stagger animations
      });
    }, 100);

    setTimeout(() => {
      document.querySelectorAll(".group-card").forEach((card, index) => {
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

function deleteHistoryRecord(billId, itemElement) {
  fetchWithUserId(`/api/history/${encodeURIComponent(billId)}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) throw new Error("Failed to delete record");
      // Remove the item from the UI with animation
      if (itemElement && itemElement.parentNode) {
        // Add fade out animation before removing
        itemElement.style.transition = "all 0.3s ease";
        itemElement.style.opacity = "0";
        itemElement.style.transform = "translateX(-100%)";

        setTimeout(() => {
          if (itemElement.parentNode) {
            itemElement.parentNode.removeChild(itemElement);
          }
        }, 300);
      }

      // Show success toast
      showToast("itemDeletedToast");
    })
    .catch((err) => {
      alert("Error deleting record. Please try again.");
      console.error(err);
    });
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
  const discountRate = receiptContainer.querySelector(".discount-rate");
  const afterDiscountEl = receiptContainer.querySelector(".successAfterDiscount");
  const afterDiscountRow = receiptContainer.querySelector(".afterDiscountRow");
  const gstEl = receiptContainer.querySelector(".successGST");
  const gstRow = receiptContainer.querySelector(".gstRow");
  const gstRate = receiptContainer.querySelector(".gstRate");
  const amountEl = receiptContainer.querySelector(".successAmount");
  const originalAmountEl = receiptContainer.querySelector(".successOriginalAmount");
  const originalAmountRow = receiptContainer.querySelector(".originalAmountRow");
  const payerEl = receiptContainer.querySelector(".successPayer");

  // Update the text content if elements exist
  if (settleMatterEl) settleMatterEl.textContent = data.settleMatter || "No one ask!";
  if (dateEl) dateEl.textContent = data.dateString;
  if (timeEl) timeEl.textContent = data.timeString;
  if (itemCountEl) itemCountEl.textContent = data.itemCount;
  if (subtotalEl) subtotalEl.textContent = data.subtotal;

  // Update payer information if available
  if (payerEl && data.payer) {
    payerEl.textContent = data.payer.name;
  } else if (payerEl) {
    payerEl.textContent = data.paynowName || "Not specified";
  }

  // Handle Service Charge
  if (serviceChargeEl && serviceChargeRow) {
    const serviceChargeValue = parseFloat(data.serviceCharge.replace("$", ""));
    if (serviceChargeValue > 0) {
      serviceChargeEl.textContent = `$${serviceChargeValue.toFixed(2)}`;
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
      discountEl.textContent = `$${discountValue.toFixed(2)}`;
      // Update discount rate display with original input
      if (discountRate && data.discountInput) {
        discountRate.textContent = `(${data.discountInput})`;
      }
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
      gstEl.textContent = `$${gstValue.toFixed(2)}`;
      gstRow.style.display = "";

      // Set GST rate
      if (gstRate) {
        gstRate.textContent = data.gstRate || "9%";
      }
    } else {
      gstRow.style.display = "none";
    }
  }

  // Display both original and rounded amounts for final total
  if (originalAmountEl && originalAmountRow && amountEl) {
    const totalValue = parseFloat(data.totalAmount.replace("$", ""));
    const roundedTotal = roundToNearest5Cents(totalValue);

    // Show original amount row only if rounding was applied
    if (Math.abs(totalValue - roundedTotal) > 0.001) {
      // Using a small epsilon for float comparison
      originalAmountEl.textContent = `$${totalValue.toFixed(2)}`;
      originalAmountRow.style.display = "";
      // Show the rounded amount
      amountEl.textContent = `$${roundedTotal}`;
    } else {
      // No rounding needed, hide original amount row
      originalAmountRow.style.display = "none";
      amountEl.textContent = `$${totalValue.toFixed(2)}`;
    }
  } else if (amountEl) {
    // Fallback if original amount elements don't exist
    const totalValue = parseFloat(data.totalAmount.replace("$", ""));
    const roundedTotal = roundToNearest5Cents(totalValue);
    amountEl.textContent = `$${roundedTotal}`;
  }
}

// ===== Birthday Person Functions =====

// Function to update birthday person button visibility and state
function updateBirthdayPersonButton() {
  const birthdayBtn = document.getElementById("birthdayPersonBtn");
  if (!birthdayBtn) return;

  // Show button only if we have 2 or more members
  if (members.length >= 2) {
    birthdayBtn.style.display = "flex";

    // Update button state based on whether birthday person is selected
    if (birthdayPerson) {
      birthdayBtn.classList.add("has-birthday-person");
      birthdayBtn.querySelector(
        ".birthday-text"
      ).innerHTML = `<span class="birthday-icon">🎂</span> ${birthdayPerson} (Birthday)`;
    } else {
      birthdayBtn.classList.remove("has-birthday-person");
      birthdayBtn.querySelector(".birthday-text").innerHTML = "<span class='birthday-icon'>🎂</span> Someone Birthday?";
    }
  } else {
    birthdayBtn.style.display = "none";
  }
}

// Function to show birthday person modal
function showBirthdayPersonModal() {
  const modal = document.getElementById("birthdayPersonModal");
  const membersList = document.getElementById("birthdayMembersList");
  const statusDisplay = document.querySelector(".birthday-status-display");
  const statusMemberName = document.querySelector(".birthday-member-name");
  const confirmBtn = document.getElementById("confirmBirthdayPersonBtn");
  const clearBtn = document.getElementById("clearBirthdayPersonBtn");

  // Clear previous content
  membersList.innerHTML = "";

  // Create member options using same structure as paynowMembersList
  members.forEach((member) => {
    const memberName = typeof member === "object" ? member.name : member;
    const avatarNumber =
      typeof member === "object"
        ? member.avatar
        : Math.abs(
            memberName.split("").reduce((a, b) => {
              a = (a << 5) - a + b.charCodeAt(0);
              return a & a;
            }, 0) % 20
          ) + 1;

    const memberDiv = document.createElement("div");
    memberDiv.className = "member-avatar-wrapper";
    memberDiv.setAttribute("data-name", memberName);

    if (birthdayPerson === memberName) {
      memberDiv.classList.add("selected");
    }

    memberDiv.innerHTML = `
      <div class="member-avatar">
        <img src="assets/cat-icon/cat-${avatarNumber}.svg" alt="Cat avatar" class="cat-avatar-img">
      </div>
      <div class="member-name">${memberName}</div>
    `;

    // Add click handler
    memberDiv.addEventListener("click", function () {
      // Remove selected class from all members
      document.querySelectorAll("#birthdayMembersList .member-avatar-wrapper").forEach((m) => {
        m.classList.remove("selected");
      });

      // Add selected class to this member
      this.classList.add("selected");

      // Update status display
      statusDisplay.style.display = "block";
      statusMemberName.textContent = memberName;

      // Show clear button if this person was already selected
      if (birthdayPerson === memberName) {
        clearBtn.style.display = "inline-block";
      } else {
        clearBtn.style.display = "none";
      }
    });

    membersList.appendChild(memberDiv);
  });

  // Show/hide status display based on current selection
  if (birthdayPerson) {
    statusDisplay.style.display = "block";
    statusMemberName.textContent = birthdayPerson;
    clearBtn.style.display = "inline-block";

    // Pre-select the current birthday person
    const currentOption = membersList.querySelector(`[data-name="${birthdayPerson}"]`);
    if (currentOption) {
      currentOption.classList.add("selected");
    }
  } else {
    statusDisplay.style.display = "none";
    clearBtn.style.display = "none";
  }

  // Show modal
  showModal("birthdayPersonModal");
}

// Function to handle birthday person confirmation
function confirmBirthdayPerson() {
  const selectedOption = document.querySelector("#birthdayMembersList .member-avatar-wrapper.selected");

  if (selectedOption) {
    const selectedMember = selectedOption.getAttribute("data-name");
    birthdayPerson = selectedMember;

    // Update visual indicators
    updateBirthdayPersonVisuals();
    updateBirthdayPersonButton();

    // Show success feedback
    showToast("birthdayPersonToast");

    // Update toast message
    const toast = document.getElementById("birthdayPersonToast");
    if (toast) {
      const messageEl = toast.querySelector(".toast-message");
      if (messageEl) {
        messageEl.textContent = `🎂 ${birthdayPerson} is the birthday person!`;
      }
    }
  }

  // Hide modal
  hideModal("birthdayPersonModal");
}

// Function to clear birthday person
function clearBirthdayPerson() {
  birthdayPerson = null;

  // Update visual indicators
  updateBirthdayPersonVisuals();
  updateBirthdayPersonButton();

  // Show feedback
  showToast("birthdayPersonClearedToast");

  // Hide modal
  hideModal("birthdayPersonModal");
}

// Function to update visual indicators for birthday person
function updateBirthdayPersonVisuals() {
  // Update member avatars in the group members section
  const groupMembers = document.querySelectorAll(".group-members .member-avatar-wrapper");

  groupMembers.forEach((wrapper) => {
    const memberName = wrapper.dataset.name;
    const avatar = wrapper.querySelector(".member-avatar");
    const nameDiv = wrapper.querySelector(".member-name");

    if (memberName === birthdayPerson) {
      // Add birthday person styling
      avatar.classList.add("birthday-person");
      nameDiv.classList.add("birthday-person");
    } else {
      // Remove birthday person styling
      avatar.classList.remove("birthday-person");
      nameDiv.classList.remove("birthday-person");
    }
  });
}

// Initialize birthday person functionality
document.addEventListener("DOMContentLoaded", function () {
  // Birthday person button click handler
  const birthdayBtn = document.getElementById("birthdayPersonBtn");
  if (birthdayBtn) {
    birthdayBtn.addEventListener("click", showBirthdayPersonModal);
  }

  // Birthday modal confirm button
  const confirmBtn = document.getElementById("confirmBirthdayPersonBtn");
  if (confirmBtn) {
    confirmBtn.addEventListener("click", confirmBirthdayPerson);
  }

  // Birthday modal clear button
  const clearBtn = document.getElementById("clearBirthdayPersonBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", clearBirthdayPerson);
  }
});
