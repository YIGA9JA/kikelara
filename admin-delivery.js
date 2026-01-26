// admin-delivery.js
checkAuth(); // ✅ block access if not logged in

// Admin delivery management using localStorage

let states = JSON.parse(localStorage.getItem("states")) || [];

// UI elements
const stateList = document.getElementById("stateList");
const addStateBtn = document.getElementById("addStateBtn");
const newStateName = document.getElementById("newStateName");

// Add state
addStateBtn.addEventListener("click", () => {
  const name = newStateName.value.trim();
  if (!name) return alert("Enter state name");
  if (states.find(s => s.name.toLowerCase() === name.toLowerCase())) return alert("State exists");

  states.push({ name, cities: [] });
  saveStates();
  newStateName.value = "";
  renderStates();
});

// Save to localStorage
function saveStates() {
  localStorage.setItem("states", JSON.stringify(states));
}

// Render accordion
function renderStates() {
  stateList.innerHTML = "";
  states.forEach((state, sIndex) => {
    const acc = document.createElement("div");
    acc.className = "accordion-state";

    acc.innerHTML = `
      <div class="accordion-header">
        <span>${state.name}</span>
        <button onclick="toggleContent(${sIndex})">▼</button>
      </div>
      <div class="accordion-content" id="content-${sIndex}">
        <div id="cities-${sIndex}"></div>
        <input type="text" id="newCity-${sIndex}" placeholder="City Name">
        <input type="number" id="newFee-${sIndex}" placeholder="Delivery Fee">
        <button onclick="addCity(${sIndex})">Add City</button>
      </div>
    `;
    stateList.appendChild(acc);
    renderCities(sIndex);
  });
}

// Toggle accordion
function toggleContent(index) {
  const content = document.getElementById(`content-${index}`);
  content.style.display = content.style.display === "block" ? "none" : "block";
}

// Add city
function addCity(stateIndex) {
  const cityName = document.getElementById(`newCity-${stateIndex}`).value.trim();
  const fee = parseInt(document.getElementById(`newFee-${stateIndex}`).value);
  if (!cityName || !fee) return alert("Enter city & fee");

  const cities = states[stateIndex].cities;
  if (cities.find(c => c.name.toLowerCase() === cityName.toLowerCase())) return alert("City exists");

  cities.push({ name: cityName, fee });
  saveStates();
  renderCities(stateIndex);

  document.getElementById(`newCity-${stateIndex}`).value = "";
  document.getElementById(`newFee-${stateIndex}`).value = "";
}

// Render cities
function renderCities(stateIndex) {
  const container = document.getElementById(`cities-${stateIndex}`);
  container.innerHTML = "";
  states[stateIndex].cities.forEach((city, cIndex) => {
    const row = document.createElement("div");
    row.className = "city-row";
    row.innerHTML = `
      <span>${city.name} - ₦${city.fee.toLocaleString()}</span>
      <button onclick="editCity(${stateIndex}, ${cIndex})">Edit</button>
      <button onclick="deleteCity(${stateIndex}, ${cIndex})">Delete</button>
    `;
    container.appendChild(row);
  });
}

// Edit city
function editCity(stateIndex, cityIndex) {
  const newName = prompt("City name:", states[stateIndex].cities[cityIndex].name);
  if (!newName) return;
  const newFee = parseInt(prompt("Delivery Fee (₦):", states[stateIndex].cities[cityIndex].fee));
  if (!newFee) return;

  states[stateIndex].cities[cityIndex] = { name: newName, fee: newFee };
  saveStates();
  renderCities(stateIndex);
}

// Delete city
function deleteCity(stateIndex, cityIndex) {
  if (!confirm("Delete this city?")) return;
  states[stateIndex].cities.splice(cityIndex, 1);
  saveStates();
  renderCities(stateIndex);
}

// Initial render
renderStates();
