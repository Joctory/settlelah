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

// Dark mode detection and application
(function () {
  // Check if user prefers dark mode
  const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

  // Get stored user preference or use system default
  const storedTheme = localStorage.getItem("theme");
  let currentTheme = storedTheme || (prefersDarkScheme.matches ? "dark" : "light");

  // Function to toggle dark mode based on theme
  const applyTheme = (theme) => {
    const isDark = theme === "dark";
    if (isDark) {
      document.body.classList.add("dark-mode");
      document.documentElement.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
      document.documentElement.classList.remove("dark-mode");
    }

    // Store user preference
    localStorage.setItem("theme", theme);
    currentTheme = theme;
  };

  // Apply initial theme based on stored preference or system default
  applyTheme(currentTheme);

  // Listen for changes in system color scheme preference (only if no user preference is set)
  prefersDarkScheme.addEventListener("change", (e) => {
    if (!localStorage.getItem("theme")) {
      applyTheme(e.matches ? "dark" : "light");
    }
  });

  // Create and add theme toggle button
  document.addEventListener("DOMContentLoaded", function () {
    // Create toggle button
    const themeToggle = document.createElement("button");
    themeToggle.setAttribute("id", "theme-toggle");
    themeToggle.setAttribute("aria-label", "Toggle dark mode");

    // Set initial icon based on current theme
    updateToggleIcon();

    // Function to update button icon based on current theme
    function updateToggleIcon() {
      themeToggle.innerHTML =
        currentTheme === "dark"
          ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16ZM12 18C15.3137 18 18 15.3137 18 12C18 8.68629 15.3137 6 12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18Z" fill="currentColor"/>
            <path fill-rule="evenodd" clip-rule="evenodd" d="M11 0H13V4.06189C12.6724 4.02104 12.3387 4 12 4C11.6613 4 11.3276 4.02104 11 4.06189V0ZM7.0943 5.68018L4.22173 2.80761L2.80752 4.22183L5.68008 7.09439C6.07016 6.55685 6.55674 6.07027 7.0943 5.68018ZM4.06189 11H0V13H4.06189C4.02104 12.6724 4 12.3387 4 12C4 11.6613 4.02104 11.3276 4.06189 11ZM5.68008 16.9056L2.80751 19.7782L4.22173 21.1924L7.0943 18.3198C6.55674 17.9297 6.07016 17.4431 5.68008 16.9056ZM11 19.9381V24H13V19.9381C12.6724 19.979 12.3387 20 12 20C11.6613 20 11.3276 19.979 11 19.9381ZM16.9056 18.3199L19.7781 21.1924L21.1923 19.7782L18.3198 16.9057C17.9297 17.4432 17.4431 17.9298 16.9056 18.3199ZM19.9381 13H24V11H19.9381C19.979 11.3276 20 11.6613 20 12C20 12.3387 19.979 12.6724 19.9381 13ZM18.3198 7.0943L21.1923 4.22183L19.7781 2.80762L16.9056 5.68008C17.4431 6.07016 17.9297 6.55674 18.3198 7.0943Z" fill="currentColor"/>
           </svg>`
          : `<img src="/assets/moon.svg" alt="Moon" width="20" height="20">`;
    }

    // Add click event to toggle theme
    themeToggle.addEventListener("click", function () {
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      applyTheme(newTheme);
      updateToggleIcon();
    });

    // Add to document
    document.body.appendChild(themeToggle);
  });
})();

// Member-specific bill data (will be populated from API)
let memberData = {};

// Function to check if the user is on desktop mode
function isDesktopMode() {
  return window.matchMedia("(min-width: 1100px)").matches;
}

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

  //when window resize, update modal content
  window.addEventListener("resize", updateModalContent);

  function updateModalContent() {
    // Update modal title and content with member data
    if (memberName && memberData[memberName]) {
      const data = memberData[memberName];
      const desktop = isDesktopMode();

      // Update modal title
      modalHeader.textContent = `Settle Detail - ${memberName}`;

      if (desktop) {
        // In desktop mode, show both details and PayNow QR side by side
        modal.classList.add("desktop-mode");

        // Check tax profile to determine whether to show PayNow QR
        const isSingapore = data.taxProfile === "singapore";

        // Create and populate modal content with a two-column layout
        modalBody.innerHTML = `
          <div class="desktop-layout">
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
                    <div class="member-bill-row">
                      <span class="member-bill-row-label">Price Per Person</span>
                      <span class="member-bill-row-value">
                        ${(() => {
                          // Calculate number of people sharing this item
                          const numPeople = item.sharedWith
                            ? (item.sharedWith.match(/<span class="shared-member">/g) || []).length + 1
                            : 1;
                          // Extract price value from string, remove "$" and convert to number
                          const price = parseFloat(item.price.replace("$", ""));
                          // Calculate price per person
                          const pricePerPerson = (price / numPeople).toFixed(2);
                          // Format with animation
                          return numPeople === 1
                            ? `$${pricePerPerson}`
                            : `$${pricePerPerson} <span class="people-count">(÷${numPeople} Incl. You)</span>`;
                        })()}
                      </span>
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
            
            <div class="paynow-section modal-fade-in">
              <h2 class="paynow-title">Please Transfer to</h2>
              ${
                isSingapore
                  ? `
                <div class="paynow-qr-container" id="paynow-qr-container">
                  <img src="https://www.sgqrcode.com/paynow?mobile=${
                    data.paymentInfo.phoneNumber
                  }&uen=&editable=1&amount=${data.paymentInfo.amount.replace("$", "")}&expiry=${new Date()
                      .toISOString()
                      .split("T")[0]
                      .replace(/-/g, "%2F")}%2023%3A59&ref_id=SettleLah-${
                      data.paymentInfo.name + "%20" + data.paymentInfo.settleMatter || "SettleLah"
                    }&company=" alt="PayNow QR Code" class="desktop-qr-code">
                </div>
                
                <div class="paynow-instructions">
                  <p>Please pay <b class="paynow-amount">${data.paymentInfo.amount}</b> to <b class="paynow-name">${
                      data.paymentInfo.name
                    } (${data.paymentInfo.phoneNumber})</b>.</p>
                  <p>Scan the QR code to complete transfer or copy the phone number to start transfer.</p>
                </div>
                
                <button id="copyPhoneBtn" class="action-button secondary-button">
                  Copy Phone Number
                </button>
                `
                  : `
                <div class="paynow-instructions">
                  <p>Please pay <b class="paynow-amount">${data.paymentInfo.amount}</b> to <b class="paynow-name">${data.paymentInfo.name} (${data.paymentInfo.phoneNumber})</b> using DuitNow payment method.</p>
                </div>
                
                <button id="copyPhoneBtn" class="action-button secondary-button">
                  Copy Phone Number
                </button>
                `
              }
            </div>
          </div>
        `;

        // Add event listener for the copy phone button
        const copyPhoneBtn = document.getElementById("copyPhoneBtn");
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
      } else {
        // On mobile, keep the original behavior with separate views
        modal.classList.remove("desktop-mode");

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
                  <div class="member-bill-row">
                    <span class="member-bill-row-label">Price Per Person</span>
                    <span class="member-bill-row-value">
                      ${(() => {
                        // Calculate number of people sharing this item
                        const numPeople = item.sharedWith
                          ? (item.sharedWith.match(/<span class="shared-member">/g) || []).length + 1
                          : 1;
                        // Extract price value from string, remove "$" and convert to number
                        const price = parseFloat(item.price.replace("$", ""));
                        // Calculate price per person
                        const pricePerPerson = (price / numPeople).toFixed(2);
                        // Format with animation
                        return numPeople === 1
                          ? `$${pricePerPerson}`
                          : `$${pricePerPerson} <span class="people-count">(÷${numPeople} Incl. You)</span>`;
                      })()}
                    </span>
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

// Function to show PayNow QR code (used only in mobile mode)
function showPayNowQR(memberName) {
  // Skip if desktop mode
  if (isDesktopMode()) return;

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
    modalHeader.textContent = `PayNow - ${memberName}`;

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
                .replace(/-/g, "%2F")}%2023%3A59&ref_id=${
                memberName + "%20-%20SettleLah!%20Bill"
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
    showError("No bill ID found in URL", "invalid");
    return;
  }

  // Basic client-side validation of bill ID format before making request
  const validIdPattern = /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/i;
  if (!validIdPattern.test(billId)) {
    showError("Invalid bill ID format", "invalid");
    return;
  }

  // Fetch bill data from the API
  fetch(`/result/${billId}`, {
    headers: {
      Accept: "application/json",
    },
  })
    .then((response) => {
      if (response.status === 410) {
        throw new Error("This bill has expired", { cause: "expired" });
      }
      if (response.status === 400) {
        throw new Error("Invalid bill ID format", { cause: "invalid" });
      }
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
      // Pass error type for specific handling
      const errorType = error.cause || "generic";
      showError(error.message, errorType);
    });

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

// Function to render bill data
function renderBillData(data) {
  // Format currency values
  const formatCurrency = (value, isFinalTotal = false, shouldRound = true) => {
    // Convert to number if it's a string
    const numValue = typeof value === "number" ? value : parseFloat(value);

    // Apply rounding only if shouldRound is true and it's a final total
    if (isFinalTotal && shouldRound) {
      return `$${roundToNearest5Cents(numValue)}`;
    } else {
      return `$${numValue.toFixed(2)}`;
    }
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
  const originalAmountEl = document.querySelector(".successOriginalAmount");
  const originalAmountRow = document.querySelector(".originalAmountRow");

  // Update the text content if elements exist
  if (settleMatterEl) settleMatterEl.textContent = data.settleMatter ? data.settleMatter : "No One Ask!";
  if (dateTimeEl) dateTimeEl.textContent = dateString + " " + timeString;
  if (itemCountEl) itemCountEl.textContent = data.dishes ? data.dishes.length : 0;
  if (subtotalEl) subtotalEl.textContent = formatCurrency(data.breakdown.subtotal);

  // Set page title based on URL parameters
  if (data.settleMatter) {
    document.title = `SettleLah - ${data.settleMatter} Bill Details`;
  } else {
    document.title = `SettleLah - No One Ask! Bill Details`;
  }

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

  // Display both original unrounded amount and final rounded amount
  if (originalAmountEl && originalAmountRow && amountEl) {
    const totalValue = data.breakdown.total.toFixed(2);
    const roundedTotal = roundToNearest5Cents(totalValue);

    // Show original amount row if rounding was applied
    if (totalValue !== roundedTotal) {
      originalAmountEl.textContent = `$${totalValue}`;
      originalAmountRow.style.display = "";
      // Show the rounded amount
      amountEl.textContent = roundedTotal;
    } else {
      // No rounding needed, hide original amount row
      originalAmountRow.style.display = "none";
      amountEl.textContent = roundedTotal;
    }
  } else if (amountEl) {
    // Fallback if original amount elements don't exist
    amountEl.textContent = roundedTotal;
  }

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
  const formatCurrency = (value, isFinalTotal = false, shouldRound = false) => {
    // Convert to number if it's a string
    const numValue = typeof value === "number" ? value : parseFloat(value);

    // Apply rounding only if shouldRound is true and it's a final total
    if (isFinalTotal && shouldRound) {
      return `$${roundToNearest5Cents(numValue)}`;
    } else {
      return `$${numValue.toFixed(2)}`;
    }
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

    // Get total amount and its rounded value
    const totalValue = data.totals[name];
    const roundedTotal = roundToNearest5Cents(totalValue);
    const isRounded = totalValue !== roundedTotal;

    memberData[name] = {
      taxProfile: data.taxProfile || "singapore", // Default to singapore if not specified
      serviceChargeRate: data.serviceChargeRate || "10%", // Add service charge rate
      // Original unrounded amount
      originalAmount: isRounded ? formatCurrency(totalValue) : null,
      // Final rounded amount
      totalAmount: formatCurrency(totalValue, true),
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
        // Include both original and rounded amounts
        originalAmount: isRounded ? formatCurrency(totalValue) : null,
        amount: formatCurrency(totalValue, true), // Apply rounding to the final total amount
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
        const successScreen = document.getElementById("bill-content");
        // Make content visible with animation
        if (billContent) {
          billContent.classList.add("visible");
          // Add a class after 5 seconds
          setTimeout(() => {
            if (successScreen) {
              successScreen.classList.add("ready");
            }
          }, 4500);
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

// Update copyright year
document.addEventListener("DOMContentLoaded", function () {
  const copyrightYear = document.querySelector(".copyrightYear");
  if (copyrightYear) {
    copyrightYear.textContent = new Date().getFullYear();
  }
});

// Enhanced function to show error message with specific error handling
function showError(message, errorType = "generic") {
  // Hide loading with animation using classes
  const loadingElement = document.getElementById("loading");
  loadingElement.classList.add("fade-out");

  // Wait for animation to complete
  setTimeout(() => {
    loadingElement.classList.add("hidden");

    // Update error message
    const errorMessage = document.getElementById("error-message");
    errorMessage.textContent = message;

    // Add specific error handling based on error type
    const retryBtn = document.getElementById("error-retry-btn");

    if (errorType === "expired") {
      // For expired bills, change button text
      retryBtn.textContent = "Return to Home";
      retryBtn.onclick = () => (window.location.href = "/");
    } else if (errorType === "invalid") {
      // For invalid IDs, change button text
      retryBtn.textContent = "Return to Home";
      retryBtn.onclick = () => (window.location.href = "/");
    } else {
      // Default behavior for other errors
      retryBtn.textContent = "Try Again";
      retryBtn.onclick = () => window.location.reload();
    }

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
