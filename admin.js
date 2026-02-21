let items = JSON.parse(localStorage.getItem("foundItems")) || [];

function displayAdminItems() {
  const container = document.getElementById("adminItemsContainer");
  container.innerHTML = "";

  if (items.length === 0) {
    container.innerHTML = "<p>No items reported yet.</p>";
    return;
  }

  items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "item-card";

    const img = document.createElement("img");
    img.src = item.photo || "https://via.placeholder.com/150";
    card.appendChild(img);

    const title = document.createElement("h3");
    title.textContent = item.name;
    card.appendChild(title);

    const desc = document.createElement("p");
    desc.textContent = item.desc;
    card.appendChild(desc);

    const status = document.createElement("p");
    status.innerHTML = `<strong>Status:</strong> ${item.approved ? "✅ Approved" : "⏳ Pending"}`;
    card.appendChild(status);

    const approveBtn = document.createElement("button");
    approveBtn.textContent = "Approve";
    approveBtn.style.background = "green";
    approveBtn.onclick = () => {
      items[index].approved = true;
      localStorage.setItem("foundItems", JSON.stringify(items));
      displayAdminItems();
    };
    card.appendChild(approveBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.style.background = "red";
    deleteBtn.onclick = () => {
      if (confirm("Are you sure you want to delete this item?")) {
        items.splice(index, 1);
        localStorage.setItem("foundItems", JSON.stringify(items));
        displayAdminItems();
      }
    };
    card.appendChild(deleteBtn);

    container.appendChild(card);
  });
}

displayAdminItems();
