document.addEventListener("DOMContentLoaded", () => {
  // Set copyright year
  document.getElementById("copyrightYear").textContent = new Date().getFullYear();

  // Variables to track passcode state
  let passcode = "";
  const passcodeLength = 6;
  const dots = document.querySelectorAll(".passcode-dot");
  const errorElement = document.getElementById("login-error");

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

  // Add event listeners for keypad buttons
  document.querySelectorAll(".keypad-key").forEach((key) => {
    key.addEventListener("click", (e) => {
      const keyValue = e.currentTarget.getAttribute("data-value");
      const keyAction = e.currentTarget.getAttribute("data-action");

      // Vibrate on keypad press
      vibrate(20);

      // Apply button press animation
      const keyElement = e.currentTarget;
      keyElement.classList.add("pressed");
      setTimeout(() => {
        keyElement.classList.remove("pressed");
      }, 150);

      // Handle different key actions
      if (keyValue) {
        handleNumberInput(keyValue);
      } else if (keyAction === "delete") {
        handleDelete();
      } else if (keyAction === "clear") {
        handleClear();
      }
    });
  });

  // Listen for keyboard input as well
  document.addEventListener("keydown", (e) => {
    if (e.key >= "0" && e.key <= "9") {
      handleNumberInput(e.key);
    } else if (e.key === "Backspace") {
      handleDelete();
    } else if (e.key === "Escape") {
      handleClear();
    } else if (e.key === "Enter" && passcode.length === passcodeLength) {
      validatePasscode();
    }
  });

  // Handle number input
  function handleNumberInput(number) {
    // Clear any existing error
    hideError();

    if (passcode.length < passcodeLength) {
      // Add the number to passcode
      passcode += number;

      // Update dots display
      updateDots();

      // If passcode is complete, validate it
      if (passcode.length === passcodeLength) {
        setTimeout(validatePasscode, 300);
      }
    }
  }

  // Handle delete button
  function handleDelete() {
    if (passcode.length > 0) {
      passcode = passcode.slice(0, -1);
      updateDots();
      hideError();
    }
  }

  // Handle clear button
  function handleClear() {
    passcode = "";
    updateDots();
    hideError();
  }

  // Update the visual dots to reflect current passcode
  function updateDots() {
    dots.forEach((dot, index) => {
      if (index < passcode.length) {
        dot.classList.add("filled");
      } else {
        dot.classList.remove("filled");
      }
    });
  }

  // Validate the entered passcode
  function validatePasscode() {
    // Add pulsing animation to dots to indicate validation in progress
    dots.forEach((dot) => {
      if (dot.classList.contains("filled")) {
        dot.classList.add("pulse");
      }
    });

    // Simulate network request (replace with actual validation)
    fetch("/api/validate-passcode", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ passcode }),
    })
      .then((response) => response.json())
      .then((data) => {
        // Remove pulsing animation
        dots.forEach((dot) => dot.classList.remove("pulse"));

        if (data.valid) {
          handleSuccessfulLogin();
        } else {
          handleFailedLogin(data.message || "Invalid passcode. Please try again.");
        }
      })
      .catch((error) => {
        console.error("Authentication error:", error);
        dots.forEach((dot) => dot.classList.remove("pulse"));
        handleFailedLogin("Authentication failed. Please try again.");
      });
  }

  // Handle successful login
  function handleSuccessfulLogin() {
    // Add success animation to dots
    dots.forEach((dot) => {
      dot.classList.add("success");
    });

    // Store authentication in sessionStorage
    sessionStorage.setItem("settlelah_authenticated", "true");

    // Add timestamp for session expiration (24 hours)
    const expiryTime = Date.now() + 24 * 60 * 60 * 1000;
    sessionStorage.setItem("settlelah_auth_expiry", expiryTime.toString());

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
      updateDots();
      passcodeContainer.classList.remove("shake");
      showError(message);
    }, 400);
  }

  // Show error message
  function showError(message) {
    errorElement.textContent = message;
    errorElement.classList.add("visible");
  }

  // Hide error message
  function hideError() {
    errorElement.classList.remove("visible");
  }

  // Check if user is already authenticated
  function checkAuthentication() {
    const isAuthenticated = sessionStorage.getItem("settlelah_authenticated") === "true";
    const authExpiry = parseInt(sessionStorage.getItem("settlelah_auth_expiry") || "0");

    // If authenticated and not expired, redirect to main page
    if (isAuthenticated && authExpiry > Date.now()) {
      window.location.href = "/";
    }
  }
});
