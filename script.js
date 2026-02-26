// 1. YOUR FIREBASE CONFIGURATION
const firebaseConfig = {
        apiKey: "AIzaSyBPfaUczJPKQQ-WYpDNWuoDC4h_7TQbzRQ",
        authDomain: "school-lost-and-found-43b02.firebaseapp.com",
        projectId: "school-lost-and-found-43b02",
        storageBucket: "school-lost-and-found-43b02.firebasestorage.app",
        messagingSenderId: "511480295301",
        appId: "1:511480295301:web:e397b7537f9e7ad06b5eec"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// 2. ADMIN SECURITY LOGIC
const ADMIN_PASSWORD = "schooladmin123"; 

function checkAdminPass() {
    const pass = document.getElementById('adminPass').value;
    if (pass === ADMIN_PASSWORD) {
        sessionStorage.setItem('isAdmin', 'true');
        showAdminPanel();
    } else {
        document.getElementById('loginError').style.display = 'block';
    }
}

function showAdminPanel() {
    const authOverlay = document.getElementById('adminAuth');
    const adminContent = document.getElementById('adminContent');
    if (authOverlay && adminContent) {
        authOverlay.style.display = 'none';
        adminContent.style.display = 'block';
        
        renderAdminTable();    // Loads the items
        renderRequestsTable(); // Loads the student claims (New!)
    }
}

// 3. STORAGE UPLOAD + BUTTON FEEDBACK LOGIC
const reportForm = document.getElementById('reportForm');
const fileInput = document.getElementById('photoFile');
const fileLabel = document.querySelector('.custom-file-upload');

// Update button text when a file is picked (for the styled button)
if (fileInput && fileLabel) {
    fileInput.addEventListener('change', function() {
        if (this.files && this.files.length > 0) {
            fileLabel.innerText = this.files[0].name;
            fileLabel.style.backgroundColor = "#2ecc71";
        }
    });
}

if (reportForm) {
    reportForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = reportForm.querySelector('button[type="submit"]');
        const file = fileInput.files[0];
        const category = document.getElementById('itemCategory').value;

        if (!file) return alert("Please select a photo.");

        submitBtn.disabled = true;
        submitBtn.innerText = "Uploading to Skyline Cloud...";

        try {
            // 1. Upload to Storage
            const fileName = Date.now() + "_" + file.name;
            const storageRef = storage.ref('item_images/' + fileName);
            const snapshot = await storageRef.put(file);
            
            // 2. Get the URL
            const downloadURL = await snapshot.ref.getDownloadURL();

            // 3. Save to Firestore
            await db.collection("items").add({
                name: document.getElementById('itemName').value,
                location: document.getElementById('location').value,
                category: category,
                description: document.getElementById('description').value,
                image: downloadURL,
                status: "pending",
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            alert("Item reported successfully!");
            reportForm.reset();
            
            fileLabel.innerText = "Upload Photo";
            fileLabel.style.backgroundColor = "#3498db"; 

        } catch (error) {
            console.error("Upload Error:", error);
            alert("Error: " + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Submit Item";
        }
    });
}

// 4. PUBLIC GALLERY LOGIC
const itemsGrid = document.getElementById('itemsGrid');
const escapeQuotes = (str) => str.replace(/'/g, "\\'");

db.collection("items")
  .where("status", "==", "approved")
  .onSnapshot((snapshot) => {
      itemsGrid.innerHTML = '';
      snapshot.forEach((doc) => {
          const item = doc.data();
          const safeName = escapeQuotes(item.name);
          const safeDesc = escapeQuotes(item.description || "No description provided.");

          // This adds the content back inside the cards
          itemsGrid.innerHTML += `
            <div class="card" data-category="${item.category}" onclick="openModal('${item.image}', '${safeName}', '${item.location}', '${safeDesc}', '${doc.id}')">
                <img src="${item.image}" alt="${item.name}">
                <div class="card-content">
                    <h3>${item.name}</h3>
                    <p>📍 ${item.location}</p>
                    <button onclick="event.stopPropagation(); claimItem('${doc.id}', '${safeName}')">Inquire / Claim</button>
                </div>
            </div>`;
      });
  });

// COMBINED SEARCH & CATEGORY FILTER
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedCategory = document.getElementById('categoryFilter').value;
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        const itemName = card.querySelector('h3').innerText.toLowerCase();
        const itemCategory = card.getAttribute('data-category');

        const matchesSearch = itemName.includes(searchTerm);
        const matchesCategory = (selectedCategory === "all" || itemCategory === selectedCategory);

        if (matchesSearch && matchesCategory) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

// Add listeners to both inputs
if(document.getElementById('searchInput')) {
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('categoryFilter').addEventListener('change', applyFilters);
}

// Modal Functions
function openModal(img, name, loc, desc, id) {
    document.getElementById('modalImage').src = img;
    document.getElementById('modalName').innerText = name;
    document.getElementById('modalLocation').innerHTML = `<strong>📍 Location:</strong> ${loc}`;
    document.getElementById('modalDescription').innerText = desc;
    
    // Add a claim button inside the modal too
    document.getElementById('modalActionArea').innerHTML = `
        <button style="margin-top:20px; width:100%;" onclick="claimItem('${id}', '${name}')">Inquire / Claim This Item</button>
    `;

    document.getElementById('itemModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('itemModal').style.display = 'none';
}

// 5. ADMIN MANAGEMENT LOGIC
function renderAdminTable() {
    const adminTable = document.getElementById('adminTable');
    if (!adminTable) return;

    db.collection("items").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        adminTable.innerHTML = '';
        snapshot.forEach((doc) => {
            const item = doc.data();
            const safeName = item.name.replace(/'/g, "\\'");
            
            // Provide a fallback if category is missing
            const itemCategory = item.category || "Uncategorized";

            adminTable.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td><img src="${item.image}" style="width:50px; height:50px; object-fit:cover; border-radius:4px;"></td>
                    <td><strong>${item.name}</strong></td>
                    <td><span class="type-badge" style="background:#95a5a6;">${itemCategory}</span></td>
                    <td>${item.status === 'approved' ? 'Approved' : 'Pending'}</td>
                    <td>
                        ${item.status === 'pending' ? 
                            `<button onclick="approveItem('${doc.id}')" style="background:#2ecc71; color:white; border:none; padding:5px 10px; border-radius:4px; margin-right:5px;">Approve</button>` 
                            : ''}
                        <button onclick="deleteItem('${doc.id}')" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px;">Delete</button>
                    </td>
                </tr>`;
        });
    });
}

async function updateStatus(id, newStatus) {
    await db.collection("items").doc(id).update({ status: newStatus });
}

async function approveItem(id) {
    try {
        await db.collection("items").doc(id).update({
            status: "approved"
        });
        alert("Item approved and added to the public gallery!");
    } catch (error) {
        console.error("Error approving item: ", error);
        alert("Failed to approve item. Check the console for errors.");
    }
}

async function deleteItem(id) {
    if(confirm("Are you sure you want to remove this listing?")) {
        await db.collection("items").doc(id).delete();
    }
}

// 6. CLAIM/INQUIRY LOGIC
function claimItem(id, name) {
    const safeName = name.replace(/\\'/g, "'"); 
    const type = prompt(`Inquiry for: ${safeName}\n\nType "1" to CLAIM this item.\nType "2" to INQUIRE (Ask a question).`);

    if (type === "1" || type === "2") {
        const studentName = prompt("Please enter your full name:");
        if (!studentName) return;

        const contactInfo = prompt("Please enter your school email or phone number:");
        if (!contactInfo) return;

        let studentMessage = "No specific question provided.";
        if (type === "2") {
            studentMessage = prompt("What is your question about this item?");
            if (!studentMessage) studentMessage = "General Inquiry";
        }

        const requestLabel = (type === "1") ? "Claim" : "Inquiry";

        saveRequestToFirestore(id, safeName, studentName, contactInfo, requestLabel, studentMessage);
        
        alert(type === "1" ? "Claim logged! Visit the Front Office." : "Inquiry sent! Staff will contact you.");
    }
}

// 7. DATABASE HELPER
async function saveRequestToFirestore(itemId, itemName, studentName, contact, requestType, message) {
    try {
        await db.collection("requests").add({
            itemId: itemId,
            itemName: itemName,
            studentName: studentName,
            contact: contact,
            type: requestType,
            message: message, // Saving the student's question
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error:", error);
    }
}

// 8. UPDATED ADMIN REQUESTS VIEWER
function renderRequestsTable() {
    const requestsTable = document.getElementById('requestsTable');
    if (!requestsTable) return;

    db.collection("requests").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        requestsTable.innerHTML = '';
        
        if (snapshot.empty) {
            requestsTable.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px;">No claims or inquiries yet.</td></tr>';
            return;
        }

        snapshot.forEach((doc) => {
            const req = doc.data();
            const date = req.timestamp ? req.timestamp.toDate().toLocaleDateString() : "Just now";

            requestsTable.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding:12px;"><strong>${req.itemName}</strong></td>
                    <td style="padding:12px;">${req.studentName}</td>
                    <td style="padding:12px;">${req.contact}</td>
                    <td style="padding:12px;"><span class="type-badge">${req.type}</span></td>
                    <td style="padding:12px;"><em>${req.message || "No message"}</em></td>
                    <td style="padding:12px;">${date}</td>
                    <td style="padding:12px;">
                        <button class="delete-btn" onclick="deleteRequest('${doc.id}')" style="background:#e74c3c; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Remove</button>
                    </td>
                </tr>`;
        });
    });
}

// Function to delete a request
async function deleteRequest(id) {
    if(confirm("Are you sure you want to remove this request?")) {
        try {
            await db.collection("requests").doc(id).delete();
        } catch (error) {
            console.error("Error deleting request:", error);
        }
    }
}

// Initialize Admin View if on admin page
window.onload = () => {
    if (window.location.pathname.includes('admin.html')) {
        if (sessionStorage.getItem('isAdmin') === 'true') {
            showAdminPanel();
        }
    }
};
