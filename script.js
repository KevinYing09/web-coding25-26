// Initialize "Database" from LocalStorage
let items = JSON.parse(localStorage.getItem('schoolItems')) || [];

// --- 1. HANDLE FILE UPLOAD ---
const reportForm = document.getElementById('reportForm');
if (reportForm) {
    reportForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const file = document.getElementById('photoFile').files[0];
        const reader = new FileReader();

        reader.onloadend = function() {
            const newItem = {
                id: Date.now(),
                name: document.getElementById('itemName').value,
                location: document.getElementById('location').value,
                image: reader.result, // This is the Base64 image string
                desc: document.getElementById('description').value,
                status: 'pending'
            };
            
            items.push(newItem);
            localStorage.setItem('schoolItems', JSON.stringify(items));
            alert('Item reported successfully!');
            window.location.href = 'index.html';
        };

        if (file) {
            reader.readAsDataURL(file); // Converts image to string
        }
    });
}

// --- 2. ADMIN PASSWORD PROTECTION ---
const ADMIN_PASSWORD = "schooladmin123"; // You can change this

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
        renderAdmin(); // Call the table drawing function
    }
}

// Check session on page load
window.onload = function() {
    if (window.location.pathname.includes('admin.html')) {
        if (sessionStorage.getItem('isAdmin') === 'true') {
            showAdminPanel();
        }
    }
};

// --- REST OF YOUR PREVIOUS CODE ---
// (Include the renderItems, updateStatus, and deleteItem functions here)

// 2. Render Gallery (Only Approved Items)
const itemsGrid = document.getElementById('itemsGrid');
if (itemsGrid) {
    function renderItems(filter = '') {
        itemsGrid.innerHTML = '';
        const approvedItems = items.filter(item => 
            item.status === 'approved' && 
            item.name.toLowerCase().includes(filter.toLowerCase())
        );

        approvedItems.forEach(item => {
            itemsGrid.innerHTML += `
                <div class="card">
                    <img src="${item.image}" alt="item">
                    <div class="card-content">
                        <h3>${item.name}</h3>
                        <p>📍 ${item.location}</p>
                        <button onclick="claimItem(${item.id})">Claim Item</button>
                    </div>
                </div>
            `;
        });
    }
    renderItems();

    document.getElementById('searchInput').addEventListener('input', (e) => {
        renderItems(e.target.value);
    });
}

// 3. Admin Functionality
const adminTable = document.getElementById('adminTable');
if (adminTable) {
    function renderAdmin() {
        adminTable.innerHTML = '';
        items.forEach(item => {
            adminTable.innerHTML += `
                <tr>
                    <td>${item.name}</td>
                    <td><span class="status-${item.status}">${item.status}</span></td>
                    <td>
                        <button onclick="updateStatus(${item.id}, 'approved')">Approve</button>
                        <button style="background:red" onclick="deleteItem(${item.id})">Delete</button>
                    </td>
                </tr>
            `;
        });
    }
    renderAdmin();
}

function updateStatus(id, newStatus) {
    items = items.map(item => item.id === id ? {...item, status: newStatus} : item);
    localStorage.setItem('schoolItems', JSON.stringify(items));
    location.reload();
}

function deleteItem(id) {
    items = items.filter(item => item.id !== id);
    localStorage.setItem('schoolItems', JSON.stringify(items));
    location.reload();
}

function claimItem(id) {
    const name = prompt("Enter your name to claim this item:");
    if(name) alert(`Request sent for item #${id}. Please visit the main office.`);
}