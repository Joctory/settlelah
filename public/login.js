document.addEventListener("DOMContentLoaded", () => {
  // Set copyright year
  document.getElementById("copyrightYear").textContent = new Date().getFullYear();

  // Prevent zooming on iOS Safari
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

  // Variables to track passcode state
  let passcode = "";
  const passcodeLength = 6;
  const dots = document.querySelectorAll(".passcode-dot");
  const errorElement = document.getElementById("login-error");
  const emailInput = document.getElementById("loginEmail");
  const emailError = document.getElementById("email-error");
  const continueBtn = document.getElementById("continueBtn");
  const authStepEmail = document.querySelector(".auth-step-email");
  const authStepPasscode = document.querySelector(".auth-step-passcode");
  const displayedEmail = document.getElementById("displayedEmail");
  const changeEmailBtn = document.getElementById("changeEmailBtn");
  let isProcessingInput = false; // Flag to track if we're processing input

  // Initially ensure the passcode step is hidden
  // (We also have CSS and inline styles as fallbacks)
  authStepPasscode.style.display = "none";
  authStepPasscode.style.opacity = "0";

  // Listen for email input changes
  emailInput.addEventListener("input", validateEmail);
  emailInput.addEventListener("blur", validateEmailOnBlur);
  emailInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && isValidEmail(emailInput.value.trim())) {
      proceedToPasscode();
    }
  });

  // Continue button
  continueBtn.addEventListener("click", proceedToPasscode);

  // Change Email button
  changeEmailBtn.addEventListener("click", switchToEmailInput);

  // Function to validate email as user types
  function validateEmail() {
    const email = emailInput.value.trim();

    // Update continue button state
    continueBtn.disabled = !isValidEmail(email);

    // Just visual validation feedback while typing
    if (email !== "" && !isValidEmail(email)) {
      emailInput.classList.add("invalid-email");
      emailInput.classList.remove("valid-email");
    } else {
      emailInput.classList.remove("invalid-email");
      if (isValidEmail(email)) {
        emailInput.classList.add("valid-email");
      } else {
        emailInput.classList.remove("valid-email");
      }
    }
  }

  // Function to validate email when focus leaves the field
  function validateEmailOnBlur() {
    const email = emailInput.value.trim();

    if (email !== "" && !isValidEmail(email)) {
      showEmailError("Please enter a valid email address");
    } else {
      hideError();
    }
  }

  // Function to proceed to passcode step
  function proceedToPasscode() {
    const email = emailInput.value.trim();

    if (!isValidEmail(email)) {
      showEmailError("Please enter a valid email address");
      return;
    }

    // Update displayed email
    displayedEmail.textContent = email;

    // Update subtitle
    document.querySelector(".login-subtitle").textContent = "Enter your 6-digit passcode";

    // Switch to passcode step with animation
    authStepEmail.classList.remove("active");

    // Small delay before showing passcode step for smoother animation
    setTimeout(() => {
      // First make it display: flex before animating
      authStepPasscode.style.display = "flex";

      // Force a reflow to ensure the browser registers the display change
      void authStepPasscode.offsetWidth;

      // Then add active class to trigger animation
      authStepPasscode.classList.add("active");

      // Apply staggered animation to dots
      dots.forEach((dot, index) => {
        setTimeout(() => {
          dot.classList.add("bounce");
          setTimeout(() => dot.classList.remove("bounce"), 400);
        }, 100 + index * 60);
      });

      // Animate in the keys with staggered timing
      document.querySelectorAll(".keypad-key").forEach((key, index) => {
        key.style.opacity = "0";
        key.style.transform = "translateY(8px)";

        setTimeout(() => {
          key.style.opacity = "1";
          key.style.transform = "translateY(0)";
        }, 300 + index * 40);
      });

      // Clear any errors
      hideError();
    }, 250);
  }

  // Function to switch back to email input
  function switchToEmailInput() {
    // Hide passcode step first
    authStepPasscode.classList.remove("active");

    // After animation completes, actually hide the element and show email step
    setTimeout(() => {
      authStepPasscode.style.display = "none";
      authStepEmail.classList.add("active");

      // Focus the email input
      emailInput.focus();

      // Reset subtitle
      document.querySelector(".login-subtitle").textContent = "Enter your email to continue";

      // Clear passcode
      handleClear();
    }, 300);
  }

  // Check for "registered=true" parameter in URL
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("registered") === "true") {
    // Show success message
    showLoginMessage("Registration successful! Please log in with your email and passcode.", "success");
  }

  // Vibration utility function
  function vibrate(pattern) {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }

  // Hide preloader after page loads
  const preloader = document.getElementById("preloader");
  if (preloader) {
    setTimeout(() => {
      preloader.classList.add("fade-out");
      setTimeout(() => {
        preloader.style.display = "none";
      }, 500);
    }, 800);
  }

  // Check if user is already authenticated
  checkAuthentication();

  // Optimize key press handling with both click and touch events
  const keypadKeys = document.querySelectorAll(".keypad-key");

  keypadKeys.forEach((key) => {
    // Optimized handler for both touch and click events
    const handleKeyPress = (e) => {
      e.preventDefault(); // Prevent default behavior

      const keyValue = key.getAttribute("data-value");
      const keyAction = key.getAttribute("data-action");

      // Immediate visual feedback
      key.classList.add("pressed");

      // Vibrate on keypad press - keep it short
      vibrate(10);

      // Process the input immediately
      if (keyValue) {
        handleNumberInput(keyValue);
      } else if (keyAction === "delete") {
        handleDelete();
      } else if (keyAction === "clear") {
        handleClear();
      }

      // Remove the pressed class after a short delay
      // Shorter animation for more responsive feel
      setTimeout(() => {
        key.classList.remove("pressed");
      }, 80);
    };

    // Use touchstart for mobile - it's faster than click
    key.addEventListener("touchstart", handleKeyPress, { passive: false });

    // Keep click for desktop compatibility
    key.addEventListener("click", (e) => {
      // Only process click if it wasn't already handled by touch
      if (!e.defaultPrevented) {
        handleKeyPress(e);
      }
    });

    // Add active state handling for better feedback
    key.addEventListener("touchend", () => key.classList.remove("pressed"));
    key.addEventListener("touchcancel", () => key.classList.remove("pressed"));
  });

  // Listen for keyboard input as well
  document.addEventListener("keydown", (e) => {
    // Only process keyboard input if the passcode screen is shown
    if (!authStepPasscode.classList.contains("active")) {
      return;
    }

    if (e.key >= "0" && e.key <= "9") {
      // Visual feedback for keyboard presses
      const keyElement = document.querySelector(`.keypad-key[data-value="${e.key}"]`);
      if (keyElement) {
        keyElement.classList.add("pressed");
        setTimeout(() => keyElement.classList.remove("pressed"), 80);
      }
      handleNumberInput(e.key);
    } else if (e.key === "Backspace") {
      const keyElement = document.querySelector('.keypad-key[data-action="delete"]');
      if (keyElement) {
        keyElement.classList.add("pressed");
        setTimeout(() => keyElement.classList.remove("pressed"), 80);
      }
      handleDelete();
    } else if (e.key === "Escape") {
      const keyElement = document.querySelector('.keypad-key[data-action="clear"]');
      if (keyElement) {
        keyElement.classList.add("pressed");
        setTimeout(() => keyElement.classList.remove("pressed"), 80);
      }
      handleClear();
    } else if (e.key === "Enter" && passcode.length === passcodeLength) {
      validatePasscode();
    }
  });

  // Handle number input - optimized for responsiveness
  function handleNumberInput(number) {
    // Skip if already at max length
    if (passcode.length >= passcodeLength) return;

    // Clear any existing error
    hideError();

    // Add the number to passcode
    passcode += number;

    // Update dots display - directly manipulate the specific dot for performance
    const currentDot = dots[passcode.length - 1];
    if (currentDot) {
      currentDot.classList.add("filled");

      // Add a small bounce animation
      currentDot.classList.add("bounce");
      setTimeout(() => currentDot.classList.remove("bounce"), 300);
    }

    // If passcode is complete, validate it with a slight delay
    if (passcode.length === passcodeLength) {
      setTimeout(validatePasscode, 300);
    }
  }

  // Handle delete button - optimized
  function handleDelete() {
    if (passcode.length > 0) {
      // Clear the last dot
      const dotToEmpty = dots[passcode.length - 1];
      if (dotToEmpty) dotToEmpty.classList.remove("filled");

      // Remove the last character
      passcode = passcode.slice(0, -1);
      hideError();
    }
  }

  // Handle clear button - optimized
  function handleClear() {
    passcode = "";
    // Directly update all dots for better performance
    dots.forEach((dot) => dot.classList.remove("filled"));
    hideError();
  }

  // Validate the entered passcode
  function validatePasscode() {
    // Get the email from the displayed field
    const email = displayedEmail.textContent;
    if (!isValidEmail(email)) {
      switchToEmailInput();
      showEmailError("Please enter a valid email address");
      return;
    }

    // Add pulsing animation to dots to indicate validation in progress
    dots.forEach((dot) => {
      if (dot.classList.contains("filled")) {
        dot.classList.add("pulse");
      }
    });

    // Send both email and passcode to server
    fetch("/api/validate-passcode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, passcode }),
    })
      .then((response) => response.json())
      .then((data) => {
        // Remove pulsing animation
        dots.forEach((dot) => dot.classList.remove("pulse"));

        if (data.valid) {
          // Store user info in localStorage if available
          if (data.userId) {
            localStorage.setItem("settlelah_user_id", data.userId);
          }
          if (data.name) {
            localStorage.setItem("settlelah_user_name", data.name);
          }
          if (data.token) {
            localStorage.setItem("settlelah_user_token", data.token);
          }

          handleSuccessfulLogin();
        } else {
          handleFailedLogin(data.message || "Invalid email or passcode. Please try again.");
        }
      })
      .catch((error) => {
        console.error("Authentication error:", error);
        dots.forEach((dot) => dot.classList.remove("pulse"));
        handleFailedLogin("Authentication failed. Please try again.");
      });
  }

  // Helper function to validate email format
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Show email-specific error
  function showEmailError(message) {
    emailError.textContent = message;
    emailError.classList.add("visible");
    emailInput.style.borderColor = "var(--error-color)";
    emailInput.classList.add("invalid-email");
    emailInput.classList.remove("valid-email");

    // Vibrate with a pattern for error feedback
    vibrate([50, 50, 50]);
  }

  // Show a message above the login form
  function showLoginMessage(message, type) {
    // Create message element if it doesn't exist
    let messageElement = document.querySelector(".login-message");

    if (!messageElement) {
      messageElement = document.createElement("div");
      messageElement.classList.add("login-message");
      const container = document.querySelector(".login-container");
      container.insertBefore(messageElement, container.firstChild);
    }

    // Set message content and style
    messageElement.textContent = message;
    messageElement.className = "login-message";

    if (type === "success") {
      messageElement.classList.add("success");
    } else if (type === "error") {
      messageElement.classList.add("error");
    }

    // Show the message
    messageElement.style.display = "block";

    // Hide after 5 seconds
    setTimeout(() => {
      messageElement.style.opacity = "0";
      setTimeout(() => {
        messageElement.style.display = "none";
      }, 300);
    }, 5000);
  }

  // Handle successful login
  function handleSuccessfulLogin() {
    // Add success animation to dots
    dots.forEach((dot) => {
      dot.classList.add("success");
    });

    // Store authentication in localStorage instead of sessionStorage for persistence
    localStorage.setItem("settlelah_authenticated", "true");

    // Add timestamp for session expiration (15 days)
    const expiryTime = Date.now() + 15 * 24 * 60 * 60 * 1000;
    localStorage.setItem("settlelah_auth_expiry", expiryTime.toString());

    // Redirect to main page after animation
    setTimeout(() => {
      window.location.href = "/";
    }, 800);
  }

  // Handle failed login
  function handleFailedLogin(message) {
    // Vibrate with a more intense pattern for error
    vibrate([100, 50, 100, 50, 100]);

    // Shake the passcode container
    const passcodeContainer = document.querySelector(".passcode-dots");
    passcodeContainer.classList.add("shake");

    // Clear the passcode
    setTimeout(() => {
      passcode = "";
      dots.forEach((dot) => dot.classList.remove("filled"));
      passcodeContainer.classList.remove("shake");
      showError(message);
    }, 600);
  }

  // Show error message
  function showError(message) {
    errorElement.textContent = message;
    errorElement.classList.add("visible");
  }

  // Hide error message
  function hideError() {
    errorElement.classList.remove("visible");
    emailError.classList.remove("visible");
    emailInput.style.borderColor = "";
    emailInput.classList.remove("invalid-email");
  }

  // Check if user is already authenticated
  function checkAuthentication() {
    const isAuthenticated = localStorage.getItem("settlelah_authenticated") === "true";
    const authExpiry = parseInt(localStorage.getItem("settlelah_auth_expiry") || "0");
    if (isAuthenticated && authExpiry > Date.now()) {
      window.location.href = "/";
    }
  }
});

function isRunningAsPWA() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// Initialize app functionality after window loads
window.onload = function () {
  if (isRunningAsPWA()) {
    // PWA-specific logic here
    document.body.style.height = "100vh";
    document.documentElement.style.height = "100vh";
  }
};
