// ===== PRODUCT STATE =====
let products = [];
let editingProductId = null;

// ===== FETCH PRODUCTS =====
async function loadProducts() {
    try {
        const res = await fetch('/data/products.js'); // update later to API endpoint
        const data = await res.json();
        products = data;
        renderProducts();
    } catch (err) {
        console.error("Failed to fetch products", err);
    }
}

// ===== DISPLAY PRODUCTS =====
function renderProducts() {
    const container = document.getElementById("products-list");
    container.innerHTML = "";

    products.forEach((p) => {
        const productCard = document.createElement("div");
        productCard.classList.add("product-card");
        productCard.innerHTML = `
            <img src="${p.image || 'placeholder.jpg'}" class="product-thumb" />
            <div class="product-info">
                <h4>${p.name}</h4>
                <p>₦${p.price.toLocaleString()}</p>
            </div>
            <div class="product-actions">
                <button class="edit-btn" onclick="editProduct('${p.id}')">Edit</button>
                <button class="delete-btn" onclick="deleteProduct('${p.id}')">Delete</button>
            </div>
        `;
        container.appendChild(productCard);
    });
}

// ===== ADD OR UPDATE PRODUCT =====
function saveProduct() {
    const name = document.getElementById("pname").value.trim();
    const price = document.getElementById("pprice").value.trim();
    const fileInput = document.getElementById("pimage");
    let image = null;

    if (!name || !price) {
        alert("Name & Price required");
        return;
    }

    if (fileInput.files && fileInput.files[0]) {
        image = URL.createObjectURL(fileInput.files[0]);
    }

    if (editingProductId) {
        let product = products.find((p) => p.id === editingProductId);
        product.name = name;
        product.price = Number(price);
        if (image) product.image = image;
        editingProductId = null;
    } else {
        products.push({
            id: Date.now().toString(),
            name,
            price: Number(price),
            image
        });
    }

    closeModal();
    renderProducts();
}

// ===== EDIT PRODUCT =====
function editProduct(id) {
    const p = products.find((x) => x.id === id);
    editingProductId = id;

    document.getElementById("pname").value = p.name;
    document.getElementById("pprice").value = p.price;
    document.getElementById("productModal").style.display = "flex";
}

// ===== DELETE PRODUCT =====
function deleteProduct(id) {
    if (confirm("Delete product?")) {
        products = products.filter((x) => x.id !== id);
        renderProducts();
    }
}

// ===== MODAL CONTROL =====
function openAddProduct() {
    editingProductId = null;
    document.getElementById("pname").value = "";
    document.getElementById("pprice").value = "";
    document.getElementById("productModal").style.display = "flex";
}

function closeModal() {
    document.getElementById("productModal").style.display = "none";
}

// ===== IMAGE PREVIEW =====
document.getElementById("pimage").addEventListener("change", function () {
    const preview = document.getElementById("previewImage");
    if (this.files && this.files[0]) {
        preview.src = URL.createObjectURL(this.files[0]);
        preview.style.display = "block";
    }
});

// RUN
loadProducts();
