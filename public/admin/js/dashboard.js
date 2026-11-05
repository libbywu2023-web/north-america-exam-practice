
const logoutButton = document.getElementById("logout-button");

async function verifyAdminSession() {
  try {
    const response = await fetch("/api/admin/me");

    if (!response.ok) {
      window.location.replace("/admin/");
      return false;
    }

    return true;
  } catch (error) {
    console.error("Unable to verify admin session:", error);
    window.location.replace("/admin/");
    return false;
  }
}

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = "Signing out...";

  try {
    const response = await fetch("/api/admin/logout", {
      method: "POST"
    });

    if (!response.ok) {
      throw new Error("Logout failed.");
    }

    window.location.replace("/admin/");
  } catch (error) {
    console.error(error);
    logoutButton.disabled = false;
    logoutButton.textContent = "Sign Out";
    alert("Unable to sign out. Please try again.");
  }
});

verifyAdminSession();
