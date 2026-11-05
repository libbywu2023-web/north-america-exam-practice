
const loginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-button");
const errorMessage = document.getElementById("login-error");

// If already authenticated, go to dashboard.
async function checkExistingSession() {
  try {
    const response = await fetch("/api/admin/me");

    if (response.ok) {
      window.location.href = "/admin/dashboard/";
    }
  } catch (error) {
    console.error("Session check failed:", error);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  errorMessage.textContent = "";
  loginButton.disabled = true;
  loginButton.textContent = "Signing in...";

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: passwordInput.value
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Login failed.");
    }

    window.location.href = "/admin/dashboard/";
  } catch (error) {
    errorMessage.textContent = error.message;
    passwordInput.value = "";
    passwordInput.focus();
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Sign In";
  }
});

checkExistingSession();
