// ---------------- CART ----------------
let cart = JSON.parse(localStorage.getItem("cart")) || [];
const totalEl = document.getElementById("totalAmount");
const payBtnAmount = document.getElementById("payBtnAmount");
const summaryItems = document.getElementById("summaryItems");
const payBtn = document.getElementById("payNowBtn");
const deliveryFeeEl = document.getElementById("deliveryFee");

// CUSTOMER INPUTS
const stateSelect = document.getElementById("deliveryState");
const citySelect = document.getElementById("deliveryCity");
const addressField = document.getElementById("address");
const pickupInfo = document.getElementById("pickupInfo");
const deliveryFields = document.getElementById("deliveryFields");

// SHIPPING TYPE RADIO
const shippingRadios = document.querySelectorAll('input[name="shippingType"]');

// ---------------- INITIAL CART ----------------
let subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
let deliveryFee = 0;

function renderCartSummary() {
  summaryItems.innerHTML = "";
  cart.forEach(i => {
    summaryItems.innerHTML += `<p>${i.name} × ${i.qty} — ₦${(i.price*i.qty).toLocaleString()}</p>`;
  });
  updateTotals();
}

function updateTotals() {
  deliveryFeeEl.textContent = deliveryFee.toLocaleString();
  const total = subtotal + deliveryFee;
  totalEl.textContent = total.toLocaleString();
  payBtnAmount.textContent = total.toLocaleString();
}

// ---------------- LOAD STATES/CITIES ----------------
const statesData = JSON.parse(localStorage.getItem("states")) || [];
statesData.forEach((state, sIndex) => {
  const option = document.createElement("option");
  option.value = sIndex;
  option.textContent = state.name;
  stateSelect.appendChild(option);
});

stateSelect.addEventListener("change", () => {
  citySelect.innerHTML = `<option value="">Select City</option>`;
  citySelect.disabled = true;
  deliveryFee = 0;
  updateTotals();

  const stateIndex = stateSelect.value;
  if (stateIndex === "") return;

  const cities = statesData[stateIndex].cities;
  cities.forEach((city, cIndex) => {
    const option = document.createElement("option");
    option.value = cIndex;
    option.textContent = `${city.name} — ₦${city.fee.toLocaleString()}`;
    citySelect.appendChild(option);
  });

  citySelect.disabled = false;
});

citySelect.addEventListener("change", () => {
  const stateIndex = stateSelect.value;
  const cityIndex = citySelect.value;
  if (stateIndex === "" || cityIndex === "") return;

  deliveryFee = statesData[stateIndex].cities[cityIndex].fee;
  updateTotals();
});

// ---------------- SHIPPING TYPE ----------------
shippingRadios.forEach(radio => {
  radio.addEventListener("change", () => {
    if (radio.value === "pickup") {
      deliveryFee = 0;
      deliveryFields.style.display = "none";
      pickupInfo.style.display = "block";
    } else {
      deliveryFields.style.display = "block";
      pickupInfo.style.display = "none";
      stateSelect.value = "";
      citySelect.innerHTML = `<option value="">Select City</option>`;
      citySelect.disabled = true;
      addressField.value = "";
      deliveryFee = 0;
    }
    updateTotals();
  });
});

// ---------------- PAYSTACK PAYMENT ----------------
payBtn.addEventListener("click", () => {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const shippingType = document.querySelector('input[name="shippingType"]:checked').value;
  const address = addressField.value.trim();
  let stateName = "", cityName = "";

  if (!name || !email || !phone) {
    return alert("Please fill required fields");
  }

  if (shippingType === "delivery") {
    if (!stateSelect.value || !citySelect.value || !address) {
      return alert("Please select State, City and enter Address for delivery");
    }
    stateName = statesData[stateSelect.value].name;
    cityName = statesData[stateSelect.value].cities[citySelect.value].name;
  }

  const total = subtotal + deliveryFee;

  // Prepare cart for backend
  const detailedCart = cart.map(item => ({
    name: item.name,
    qty: item.qty,
    price: item.price,
    total: item.price * item.qty
  }));

  PaystackPop.setup({
    key: "pk_test_0e491cfbb7461a0ba9a0d58419cdfd6722ad5dee", 
    email,
    amount: total * 100,
    currency: "NGN",
    ref: "KL_" + Date.now(),
    callback: function (res) {
      fetch("http://localhost:4000/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference: res.reference,
          name,
          email,
          phone,
          shippingType,
          state: stateName,
          city: cityName,
          address,
          cart: detailedCart,
          deliveryFee,
          total,
          status: "Pending"
        })
      })
      .then(() => {
        localStorage.removeItem("cart");
        window.location.href = "order-success.html";
      })
      .catch(err => {
        console.error("Order submission failed:", err);
        alert("Failed to submit order. Please contact admin.");
      });
    }
  }).openIframe();
});

// ---------------- INIT ----------------
renderCartSummary();


