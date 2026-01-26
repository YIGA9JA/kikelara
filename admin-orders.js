// admin-orders.js
checkAuth(); // ✅ block access if not logged in

const ordersContainer = document.getElementById("ordersContainer");

// Fetch all orders from backend
async function loadOrders() {
  try {
    const res = await fetch("http://localhost:4000/orders");
    const orders = await res.json();

    ordersContainer.innerHTML = "";
    orders.reverse().forEach(order => {
      const orderDiv = document.createElement("div");
      orderDiv.classList.add("order-card");

      const subtotal = order.cart.reduce((sum, i) => sum + i.total, 0);

      orderDiv.innerHTML = `
        <h3>Order #${order.reference}</h3>
        <p><strong>Name:</strong> ${order.name}</p>
        <p><strong>Phone:</strong> ${order.phone}</p>
        <p><strong>Email:</strong> ${order.email}</p>
        <p><strong>Shipping:</strong> ${order.shippingType === "pickup" ? "Pickup" : `${order.state}, ${order.city}`}</p>
        <p><strong>Address:</strong> ${order.address || "-"}</p>

        <p><strong>Items:</strong></p>
        <ul>
          ${order.cart.map(i => `<li>${i.name} × ${i.qty} — ₦${i.total.toLocaleString()}</li>`).join("")}
        </ul>

        <p><strong>Subtotal:</strong> ₦${subtotal.toLocaleString()}</p>
        <p><strong>Delivery Fee:</strong> ₦${order.deliveryFee.toLocaleString()}</p>
        <p><strong>Total:</strong> ₦${order.total.toLocaleString()}</p>

        <p><strong>Status:</strong>
          <select id="status-${order.id}">
            <option value="Pending" ${order.status==="Pending" ? "selected":""}>Pending</option>
            <option value="Confirmed" ${order.status==="Confirmed" ? "selected":""}>Confirmed</option>
            <option value="Shipped" ${order.status==="Shipped" ? "selected":""}>Shipped</option>
            <option value="Delivered" ${order.status==="Delivered" ? "selected":""}>Delivered</option>
          </select>
          <button onclick="updateStatus(${order.id})">Update</button>
        </p>
      `;
      ordersContainer.appendChild(orderDiv);
    });

  } catch (err) {
    console.error(err);
    ordersContainer.innerHTML = "<p>Failed to load orders.</p>";
  }
}

// Update order status
async function updateStatus(orderId) {
  const select = document.getElementById(`status-${orderId}`);
  const newStatus = select.value;

  try {
    const res = await fetch(`http://localhost:4000/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });

    const result = await res.json();
    alert(`Status updated to "${result.order.status}"`);
    loadOrders();
  } catch (err) {
    console.error(err);
    alert("Failed to update status");
  }
}

// Initial load
loadOrders();
