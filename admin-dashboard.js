const ADMIN_CODE = "4567"; // change to your code

function adminLogin() {
  const input = document.getElementById("pin").value.trim();
  const errorBox = document.getElementById("error");

  if (input === ADMIN_CODE) {
    localStorage.setItem("admin-auth", "yes");
    window.location.href = "admin-dashboard.html";
  } else {
    errorBox.textContent = "Incorrect code";
  }
}

function checkAuth() {
  if (localStorage.getItem("admin-auth") !== "yes") {
    window.location.href = "admin-login.html";
  }
}

function adminLogout() {
  localStorage.removeItem("admin-auth");
  window.location.href = "admin-login.html";
}
