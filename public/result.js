// Member-specific bill data (will be populated from API)
let memberData = {};

// Function to show share modal with member-specific data
function showShareModal(memberName) {
  const modal = document.getElementById("memberbillModal");
  const overlay = document.getElementById("memberbillOverlay");
  const closeBtn = document.querySelector(".member-close-modal");
  const modalHeader = document.querySelector(".member-bill-modal .modal-header h2");
  const modalBody = document.querySelector(".member-bill-modal-body");

  // Check if modal body has content to animate out
  if (modalBody.children.length > 0) {
    // Add fade out animation
    Array.from(modalBody.children).forEach((child) => {
      child.classList.add("modal-fade-out");
    });

    // Wait for animation to complete
    setTimeout(() => {
      updateModalContent();
    }, 300);
  } else {
    updateModalContent();
  }

  function updateModalContent() {
    // Update modal title and content with member data
    if (memberName && memberData[memberName]) {
      const data = memberData[memberName];

      // Update modal title
      modalHeader.textContent = "Settle Detail";

      // Create and populate modal content
      modalBody.innerHTML = `
        <div class="member-bill-modal-details modal-fade-in">
          <div style="text-align: center;">
            <h2 class="member-bill-title">Settle Detail</h2>
            <h1 class="member-bill-amount">${data.totalAmount}</h1>
          </div>
          
          <hr class="member-bill-divider">
          
          <h3 class="member-bill-section-title">Items</h3>
          <div class="animate-staggered">
            ${data.items
              .map(
                (item, index) => `
              <div class="member-bill-item-container">
                <div class="member-bill-row">
                  <span class="member-bill-row-label">Item Name</span>
                  <span class="member-bill-row-value">${item.name}</span>
                </div>
                <div class="member-bill-row">
                  <span class="member-bill-row-label">Shared With</span>
                  <div class="shared-with-container">${item.sharedWith || "-"}</div>
                </div>
                <div class="member-bill-row">
                  <span class="member-bill-row-label">Item Price</span>
                  <span class="member-bill-row-value">${item.price}</span>
                </div>
                ${index < data.items.length - 1 ? '<hr class="member-bill-divider">' : ""}
              </div>
            `
              )
              .join("")}
          </div>
          
          <hr class="member-bill-solid-divider">
          
          <h3 class="member-bill-section-title">Amount Breakdown</h3>
          <div class="total-section animate-staggered">
            <div class="member-bill-row">
              <span class="member-bill-row-label">Subtotal</span>
              <span class="member-bill-row-value">${data.breakdown.subtotal}</span>
            </div>
            ${
              parseFloat(data.breakdown.serviceCharge.replace("$", "")) > 0
                ? `
            <div class="member-bill-row">
              <span class="member-bill-row-label">Service Charge (${data.serviceChargeRate})</span>
              <span class="member-bill-row-value">${data.breakdown.serviceCharge}</span>
            </div>
            <div class="member-bill-row">
              <span class="member-bill-row-label">After Service</span>
              <span class="member-bill-row-value">${data.breakdown.afterService}</span>
            </div>
            `
                : ""
            }
            ${
              parseFloat(data.breakdown.discount.replace("$", "")) > 0
                ? `
            <div class="member-bill-row">
              <span class="member-bill-row-label">Discount</span>
              <span class="member-bill-row-value">${data.breakdown.discount}</span>
            </div>
            <div class="member-bill-row">
              <span class="member-bill-row-label">After Discount</span>
              <span class="member-bill-row-value">${data.breakdown.afterDiscount}</span>
            </div>
            `
                : ""
            }
            ${
              parseFloat(data.breakdown.gst.replace("$", "")) > 0
                ? `
            <div class="member-bill-row">
              <span class="member-bill-row-label">GST (${
                data.taxProfile === "singapore" ? "9%" : data.taxProfile === "malaysia" ? "6%" : "9%"
              })</span>
              <span class="member-bill-row-value">${data.breakdown.gst}</span>
            </div>
            `
                : ""
            }
          </div>
        </div>
        
        <button id="showPayNowBtn" class="action-button primary-button modal-fade-in" style="animation-delay: 0.3s;">
          Show PayNow QR Code
        </button>
      `;

      // Add event listener for the PayNow button
      const payNowBtn = document.getElementById("showPayNowBtn");
      if (payNowBtn) {
        payNowBtn.addEventListener("click", () => {
          showPayNowQR(memberName);
        });
      }

      // Force reflow to ensure animations start correctly
      modal.offsetHeight;
    }
  }

  // Display the modal and overlay
  modal.classList.add("active");
  overlay.classList.add("active");

  // Make sure the close button works
  if (closeBtn) {
    closeBtn.onclick = closeShareModal;
  }

  // Close modal when clicking outside
  overlay.onclick = closeShareModal;
}

// Function to show PayNow QR code
function showPayNowQR(memberName) {
  const modalBody = document.querySelector(".member-bill-modal-body");
  const modalHeader = document.querySelector(".member-bill-modal .modal-header h2");
  const data = memberData[memberName];

  // Fade out current content
  Array.from(modalBody.children).forEach((child) => {
    child.classList.add("modal-fade-out");
  });

  // Wait for animation to complete before switching content
  setTimeout(() => {
    // Update modal title with animation
    modalHeader.textContent = "PayNow";

    // Check tax profile to determine whether to show PayNow QR
    const isSingapore = data.taxProfile === "singapore";

    // Create PayNow QR view - conditional on tax profile
    modalBody.innerHTML = `
      <div class="paynow-container modal-fade-in">
        ${
          isSingapore
            ? `
        <div class="paynow-qr-container" id="paynow-qr-container">
          <!-- QR code will be generated here -->
          <img src="https://www.sgqrcode.com/paynow?mobile=${
            data.paymentInfo.phoneNumber
          }&uen=&editable=1&amount=${data.paymentInfo.amount.replace("$", "")}&expiry=${new Date()
                .toISOString()
                .split("T")[0]
                .replace(/-/g, "%2F")}%2023%3A59&ref_id=SettleLah-${
                data.paymentInfo.name + "%20" + data.paymentInfo.settleMatter || "SettleLah"
              }&company=" alt="PayNow QR Code">
        </div>
        
        <div class="paynow-instructions" style="animation-delay: 0.2s;">
          <p> Please pay <b class="paynow-amount">${data.paymentInfo.amount}</b> to <b class="paynow-name" >${
                data.paymentInfo.name
              } (${data.paymentInfo.phoneNumber})</b>.</p>
          <p>Scan the QR code to complete transfer or copy the phone number to start transfer.</p>
        </div>
        
        <button id="copyPhoneBtn" class="action-button secondary-button modal-fade-in" style="animation-delay: 0.3s;">
          Copy Phone Number
        </button>
        `
            : `
        <div class="paynow-instructions" style="animation-delay: 0.2s;">
          <p>PayNow is only available in Singapore.</p>
          <p>Please pay <b class="paynow-amount">${data.paymentInfo.amount}</b> to <b class="paynow-name" >${data.paymentInfo.name} (${data.paymentInfo.phoneNumber})</b> using another payment method.</p>
        </div>
        
        <button id="copyPhoneBtn" class="action-button secondary-button modal-fade-in" style="animation-delay: 0.3s;">
          Copy Phone Number
        </button>
        `
        }
      </div>
      
      <button id="backToDetailBtn" class="action-button primary-button margin-top modal-fade-in" style="animation-delay: 0.4s;">
        Back to Detail
      </button>
    `;

    // Add event listeners for the buttons
    const copyPhoneBtn = document.getElementById("copyPhoneBtn");
    const backToDetailBtn = document.getElementById("backToDetailBtn");

    if (copyPhoneBtn) {
      copyPhoneBtn.addEventListener("click", () => {
        navigator.clipboard
          .writeText(data.paymentInfo.phoneNumber)
          .then(() => {
            // Show a toast notification using CSS classes
            const notification = document.createElement("div");
            notification.textContent = "Phone number copied!";
            notification.className = "toast-notification";

            document.body.appendChild(notification);

            setTimeout(() => {
              notification.classList.add("toast-fadeout");
              setTimeout(() => {
                document.body.removeChild(notification);
              }, 500);
            }, 2000);
          })
          .catch((err) => {
            console.error("Failed to copy phone number: ", err);
          });
      });
    }

    if (backToDetailBtn) {
      backToDetailBtn.addEventListener("click", () => {
        showShareModal(memberName);
      });
    }
  }, 300); // Match the fade-out duration
}

// Function to close share modal
function closeShareModal() {
  const modal = document.getElementById("memberbillModal");
  const overlay = document.getElementById("memberbillOverlay");

  // Add closing animation
  modal.style.transition = "bottom 0.3s ease-in";
  modal.style.bottom = "-100%";

  overlay.style.transition = "opacity 0.3s ease-in";
  overlay.style.opacity = "0";

  // Wait for animation to complete before removing classes
  setTimeout(() => {
    modal.classList.remove("active");
    overlay.classList.remove("active");
    // Reset styles
    modal.style.transition = "";
    modal.style.bottom = "";
    overlay.style.transition = "";
    overlay.style.opacity = "";
  }, 300);
}

// Add event listeners to member avatars with animation
document.addEventListener("DOMContentLoaded", function () {
  // Hide error container initially
  document.getElementById("error-container").classList.remove("visible");

  // Show loading spinner
  document.getElementById("loading").classList.remove("hidden");

  // Extract bill ID from URL path
  const pathParts = window.location.pathname.split("/");
  const billId = pathParts[pathParts.length - 1];

  if (!billId) {
    showError("No bill ID found in URL");
    return;
  }

  // Fetch bill data from the API
  fetch(`/result/${billId}`, {
    headers: {
      Accept: "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Bill not found or error fetching data");
      }
      return response.json();
    })
    .then((data) => {
      // Wait for animation to complete before hiding
      setTimeout(() => {
        // Display bill data
        renderBillData(data);
      }, 300);
    })
    .catch((error) => {
      showError(error.message);
    });

  // Add event listener for retry button
  document.getElementById("error-retry-btn").addEventListener("click", function () {
    // Hide error and restart the process
    document.getElementById("error-container").classList.remove("visible");

    // Show loading
    const loadingElement = document.getElementById("loading");
    loadingElement.classList.remove("hidden");
    loadingElement.classList.remove("fade-out");

    // Reload the page to retry
    window.location.reload();
  });

  // Function to show error message
  function showError(message) {
    // Hide loading with animation using classes
    const loadingElement = document.getElementById("loading");
    loadingElement.classList.add("fade-out");

    // Wait for animation to complete
    setTimeout(() => {
      loadingElement.classList.add("hidden");

      // Update error message
      document.getElementById("error-message").textContent = message;

      // Show error container using class
      const errorContainer = document.getElementById("error-container");
      errorContainer.classList.add("visible");

      // Hide any content that might be visible
      const billContent = document.getElementById("bill-content");
      const billContentFooter = document.getElementById("bill-content-footer");

      if (billContent && billContent.classList.contains("visible")) {
        billContent.classList.remove("visible");
      }

      if (billContentFooter && billContentFooter.classList.contains("visible")) {
        billContentFooter.classList.remove("visible");
      }
    }, 300);
  }

  const memberAvatars = document.querySelectorAll(".member-avatar-wrapper");
  const dragInstructions = document.querySelector(".drag-instructions");

  // Add pulse animation to instructions but not with a dramatic effect
  if (dragInstructions) {
    dragInstructions.classList.remove("animate-pulse");
  }

  memberAvatars.forEach((avatar) => {
    avatar.addEventListener("click", function () {
      const memberName = this.getAttribute("data-name");
      showShareModal(memberName);
    });
  });
});

// Function to round amounts to the nearest 0.05
// Values below 0.05 round to 0, values above 0.05 round to nearest 0.05
// Exact 0.05 values stay as 0.05
function roundToNearest5Cents(value) {
  if (typeof value === "string") {
    value = parseFloat(value);
  }

  // Get decimal part (cents)
  const wholePart = Math.floor(value);
  const decimalPart = value - wholePart;
  const cents = Math.round(decimalPart * 100);

  // Handle special cases
  if (cents < 5) {
    return wholePart;
  } else if (cents === 5) {
    return wholePart + 0.05;
  } else {
    // Round to nearest 0.05
    const roundedCents = Math.round(cents / 5) * 5;
    return wholePart + roundedCents / 100;
  }
}

// Function to render bill data
function renderBillData(data) {
  // Format currency values
  const formatCurrency = (value) => {
    if (typeof value === "number") {
      return `$${roundToNearest5Cents(value).toFixed(2)}`;
    }
    return `$${roundToNearest5Cents(parseFloat(value)).toFixed(2)}`;
  };

  // Format timestamp to date and time strings
  const timestamp = data.timestamp;
  const date = new Date(timestamp);
  const dateString = date.toLocaleDateString("en-SG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeString = date.toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  // Get the receipt container
  const receiptContainer = document.getElementById("successReceipt");
  if (!receiptContainer) return;

  // Find all detail elements by their class names
  const settleMatterEl = document.querySelector(".successSettleMatter");
  const dateTimeEl = document.querySelector(".successDateTime");
  const itemCountEl = document.querySelector(".successItemCount");
  const subtotalEl = document.querySelector(".successSubtotal");
  const serviceChargeEl = document.querySelector(".successServiceCharge");
  const serviceChargeRow = document.querySelector(".serviceChargeRow");
  const serviceChargeRate = document.querySelector(".serviceChargeRate");
  const afterServiceEl = document.querySelector(".successAfterService");
  const afterServiceRow = document.querySelector(".afterServiceRow");
  const discountEl = document.querySelector(".successDiscount");
  const discountRow = document.querySelector(".discountRow");
  const afterDiscountEl = document.querySelector(".successAfterDiscount");
  const afterDiscountRow = document.querySelector(".afterDiscountRow");
  const gstEl = document.querySelector(".successGST");
  const gstRow = document.querySelector(".gstRow");
  const gstRate = document.querySelector(".gstRate");
  const amountEl = document.querySelector(".successAmount");

  // Update the text content if elements exist
  if (settleMatterEl) settleMatterEl.textContent = data.settleMatter ? data.settleMatter : "No One Ask!";
  if (dateTimeEl) dateTimeEl.textContent = dateString + " " + timeString;
  if (itemCountEl) itemCountEl.textContent = data.dishes ? data.dishes.length : 0;
  if (subtotalEl) subtotalEl.textContent = formatCurrency(data.breakdown.subtotal);

  // Handle Service Charge
  if (serviceChargeEl && serviceChargeRow) {
    if (data.breakdown.serviceCharge > 0) {
      serviceChargeEl.textContent = formatCurrency(data.breakdown.serviceCharge);
      serviceChargeRow.style.display = "";

      // Set service charge rate
      if (serviceChargeRate) {
        serviceChargeRate.textContent = data.serviceChargeRate;
      }
    } else {
      serviceChargeRow.style.display = "none";
    }
  }

  // Handle After Service
  if (afterServiceEl && afterServiceRow) {
    if (data.breakdown.serviceCharge > 0) {
      afterServiceEl.textContent = formatCurrency(data.breakdown.afterService);
      afterServiceRow.style.display = "";
    } else {
      afterServiceRow.style.display = "none";
    }
  }

  // Handle Discount
  if (discountEl && discountRow) {
    if (data.breakdown.discountAmount > 0) {
      discountEl.textContent = formatCurrency(data.breakdown.discountAmount);
      discountRow.style.display = "";
    } else {
      discountRow.style.display = "none";
    }
  }

  // Handle After Discount
  if (afterDiscountEl && afterDiscountRow) {
    if (data.breakdown.discountAmount > 0) {
      afterDiscountEl.textContent = formatCurrency(data.breakdown.afterDiscount);
      afterDiscountRow.style.display = "";
    } else {
      afterDiscountRow.style.display = "none";
    }
  }

  // Handle GST
  if (gstEl && gstRow) {
    if (data.breakdown.gst > 0) {
      gstEl.textContent = formatCurrency(data.breakdown.gst);
      gstRow.style.display = "";

      // Set GST rate
      if (gstRate) {
        gstRate.textContent = data.gstRate || "9%";
      }
    } else {
      gstRow.style.display = "none";
    }
  }

  if (amountEl) amountEl.textContent = formatCurrency(data.breakdown.total);

  // Create memberData for the modal
  createMemberData(data);

  // Update group members display
  if (data.members && Array.isArray(data.members)) {
    updateGroupMembers(data.members);
  }
}

// Function to create memberData object from API data
function createMemberData(data) {
  memberData = {};

  if (!data.members || !data.perPersonBreakdown || !data.dishes) return;

  // Format currency values
  const formatCurrency = (value) => {
    if (typeof value === "number") {
      return `$${roundToNearest5Cents(value).toFixed(2)}`;
    }
    return `$${roundToNearest5Cents(parseFloat(value)).toFixed(2)}`;
  };

  // Create member data for each member
  data.members.forEach((member) => {
    const name = member.name;
    const breakdown = data.perPersonBreakdown[name];

    if (!breakdown) return;

    // Get dishes for this member
    const memberItems = data.dishes
      .filter((dish) => dish.members.includes(name))
      .map((dish) => ({
        name: dish.name,
        price: formatCurrency(dish.cost),
        sharedWith: dish.members
          .filter((m) => m !== name)
          .map((m) => `<span class="shared-member">${m}</span>`)
          .join(""),
      }));

    memberData[name] = {
      taxProfile: data.taxProfile || "singapore", // Default to singapore if not specified
      serviceChargeRate: data.serviceChargeRate || "10%", // Add service charge rate
      totalAmount: formatCurrency(data.totals[name]),
      items: memberItems,
      breakdown: {
        subtotal: formatCurrency(breakdown.subtotal),
        serviceCharge: formatCurrency(breakdown.serviceCharge),
        afterService: formatCurrency(breakdown.afterService),
        discount: formatCurrency(breakdown.discountAmount),
        afterDiscount: formatCurrency(breakdown.afterDiscount),
        gst: formatCurrency(breakdown.gst),
      },
      paymentInfo: {
        amount: formatCurrency(data.totals[name]),
        phoneNumber: data.paynowID || "",
        name: data.paynowName || "",
        settleMatter: data.settleMatter || "",
        uen: "N/A", // Include UEN for PayNow QR
      },
    };
  });
}

// Function to update group members
function updateGroupMembers(members) {
  const groupMembersContainer = document.getElementById("groupMembers");
  if (!groupMembersContainer) return;

  // Clear existing members
  groupMembersContainer.innerHTML = "";

  // Hide the entire container initially
  const groupSection = document.querySelector(".favourite-group-section");
  if (groupSection) {
    groupSection.style.opacity = "0";
  }

  // Track image loading
  let imagesLoading = members.length;

  // Add member avatars with proper data attributes
  members.forEach((member, index) => {
    const memberAvatar = document.createElement("div");
    memberAvatar.className = "member-avatar-wrapper";
    memberAvatar.setAttribute("data-name", member.name);

    // Calculate animation delay based on index (0.2s increment for each member)
    const animationDelay = 0.4 + index * 0.2;
    memberAvatar.style.animation = `fadeInUp 0.4s ${animationDelay}s ease forwards`;

    // Use the avatar from data or fallback to index
    const avatarIndex = member.avatar || Math.floor(Math.random() * 9) + 1;

    memberAvatar.innerHTML = `
      <div class="member-avatar">
        <img src="/assets/cat-icon/cat-${avatarIndex}.svg" alt="Cat avatar" class="cat-avatar-img" />
      </div>
      <div class="member-name">${member.name}</div>
    `;

    // Preload the image to track when it's loaded
    const img = new Image();
    img.onload = imageLoaded;
    img.onerror = imageLoaded; // Count errors as "loaded" to avoid blocking
    img.src = `/assets/cat-icon/cat-${avatarIndex}.svg`;

    // Add click event for member avatar
    memberAvatar.addEventListener("click", function () {
      showShareModal(member.name);
    });

    groupMembersContainer.appendChild(memberAvatar);
  });

  // Function to track when all images are loaded
  function imageLoaded() {
    imagesLoading--;

    // When all images are loaded, show the container
    if (imagesLoading === 0) {
      if (groupSection) {
        groupSection.style.opacity = "1";
        groupSection.style.transition = "opacity 0.5s ease";
        const billContent = document.getElementById("bill-content");
        // Make content visible with animation
        if (billContent) {
          billContent.classList.add("visible");
        }

        // Hide loading and show content with animation using classes
        const loadingElement = document.getElementById("loading");

        // Add fade-out class instead of inline styles
        loadingElement.classList.add("fade-out");
        // Add hidden class instead of inline display style
        loadingElement.classList.add("hidden");
      }
    }
  }
}

// Wait for all images and resources to load before showing content
window.onload = function () {
  // Get elements
  const terminalImg = document.querySelector(".terminal-img");
  const terminalImgTop = document.querySelector(".terminal-img-top");
  const successReceipt = document.getElementById("successReceipt");
  const groupSection = document.querySelector(".favourite-group-section");
  const titleElement = document.querySelector(".success-footer-text-title");
  const footerElement = document.querySelector(".settings-footer");

  // Start animations for receipt in sequence
  if (successReceipt) {
    // The receipt animation will start after a delay
    successReceipt.style.animation = "receipt 3s ease both";
  }

  // Make terminal images visible
  if (terminalImg) {
    terminalImg.style.animation = "slideup 0.5s 4s ease both";
  }

  if (terminalImgTop) {
    terminalImgTop.style.animation = "slideup 0.5s 4s ease both";
  }

  // Make group section visible
  if (groupSection) {
    groupSection.style.opacity = "1";
  }

  // Apply animations to footer elements
  if (titleElement) {
    titleElement.style.animation = "fadeInUp 0.5s 0.2s ease forwards";
  }

  if (footerElement) {
    footerElement.style.animation = "fadeInUp 0.5s 0.4s ease forwards";
  }

  // Apply staggered fade-in for member avatars
  const memberAvatars = document.querySelectorAll(".member-avatar-wrapper");
  memberAvatars.forEach((avatar, index) => {
    // Ensure animation is applied with the correct delay
    avatar.style.animation = `fadeInUp 0.4s ${0.4 + index * 0.2}s ease forwards`;
  });
};
