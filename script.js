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

// 3. REPORT FORM LOGIC (Upload to Cloud)

const reportForm = document.getElementById('reportForm');
if (reportForm) {
    reportForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const fileInput = document.getElementById('photoFile');
        const file = fileInput.files[0];
        
        if (!file) {
            alert("Please select a photo.");
            return;
        }

        const reader = new FileReader();
        const submitBtn = e.target.querySelector('button');
        submitBtn.disabled = true;
        submitBtn.innerText = "Saving to Database...";

    reader.onloadend = function() {
      const img = new Image();
      img.src = reader.result;
      
      img.onload = async function() {
          // 1. Create a canvas to resize the image
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 600; // Resizes the width to 600px
          const scaleSize = MAX_WIDTH / img.width;
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // 2. Convert to a compressed JPEG string (quality set to 0.7)
          const shrunkImage = canvas.toDataURL('image/jpeg', 0.7); 

          try {
              await db.collection("items").add({
                  name: document.getElementById('itemName').value,
                  location: document.getElementById('location').value,
                  description: document.getElementById('description').value,
                  image: shrunkImage, 
                  status: 'pending',
                  createdAt: firebase.firestore.FieldValue.serverTimestamp()
              });

              alert('Item reported successfully! (Image resized for storage)');
              window.location.href = 'index.html';
          } catch (error) {
              console.error("Actual Firebase Error:", error);
              alert("Upload failed. Open the 'Inspect' console to see the real error.");
              submitBtn.disabled = false;
              submitBtn.innerText = "Submit Item";
          }
      };
};
        // This line triggers the conversion
        reader.readAsDataURL(file);
    });
}

// 4. PUBLIC GALLERY LOGIC (Real-time)
const itemsGrid = document.getElementById('itemsGrid');
// Add this small helper function at the top of Section 4
const escapeQuotes = (str) => str.replace(/'/g, "\\'");

// 4. PUBLIC GALLERY LOGIC
db.collection("items")
  .where("status", "==", "approved")
  .onSnapshot((snapshot) => {
      itemsGrid.innerHTML = '';
      snapshot.forEach((doc) => {
          const item = doc.data();
          const safeName = escapeQuotes(item.name);
          const safeDesc = escapeQuotes(item.description || "No description provided.");

          itemsGrid.innerHTML += `
            <div class="card" onclick="openModal('${item.image}', '${safeName}', '${item.location}', '${safeDesc}', '${doc.id}')">
                <img src="${item.image}" alt="${item.name}">
                <div class="card-content">
                    <h3>${item.name}</h3>
                    <p>📍 ${item.location}</p>
                    <button onclick="event.stopPropagation(); claimItem('${doc.id}', '${safeName}')">Inquire / Claim</button>
                </div>
            </div>`;
      });
  });

// SEARCH FUNCTIONALITY
document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        // Get the text from the h3 (name) and p (description)
        const itemName = card.querySelector('h3').innerText.toLowerCase();
        // Since description is in the modal, we'll check the card content
        const cardText = card.innerText.toLowerCase();

        if (itemName.includes(searchTerm) || cardText.includes(searchTerm)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
});

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

    db.collection("items").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
        adminTable.innerHTML = '';
        snapshot.forEach((doc) => {
            const item = doc.data();
            adminTable.innerHTML += `
                <tr>
                    <td><img src="${item.image}" width="50"></td>
                    <td>${item.name}</td>
                    <td><span class="status-${item.status}">${item.status}</span></td>
                    <td>
                        ${item.status === 'pending' ? 
                          `<button onclick="updateStatus('${doc.id}', 'approved')">Approve</button>` : ''}
                        <button style="background:red" onclick="deleteItem('${doc.id}')">Delete</button>
                    </td>
                </tr>`;
        });
    });
}

async function updateStatus(id, newStatus) {
    await db.collection("items").doc(id).update({ status: newStatus });
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

// 8. ADMIN REQUESTS VIEWER
function renderRequestsTable() {
    const requestsTable = document.getElementById('requestsTable');
    if (!requestsTable) return;

    db.collection("requests").onSnapshot((snapshot) => {
        requestsTable.innerHTML = '';
        snapshot.forEach((doc) => {
            const req = doc.data();
            const date = req.timestamp ? req.timestamp.toDate().toLocaleDateString() : "Pending...";

            requestsTable.innerHTML += `
                <tr>
                    <td><strong>${req.itemName}</strong></td>
                    <td>${req.studentName}</td>
                    <td>${req.contact}</td>
                    <td><span class="type-badge">${req.type}</span></td>
                    <td><em>${req.message || 'N/A'}</em></td>
                    <td>${date}</td>
                    <td>
                        <button style="background:#e74c3c; padding: 5px 10px;" 
                                onclick="deleteRequest('${doc.id}')">Remove</button>
                    </td>
                </tr>`;
        });
    });
}

// Function to delete a request
async function deleteRequest(id) {
    if(confirm("Mark this request as resolved and remove it?")) {
        await db.collection("requests").doc(id).delete();
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
