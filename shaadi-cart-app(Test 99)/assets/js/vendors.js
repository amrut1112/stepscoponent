document.addEventListener('DOMContentLoaded', async () => {
    console.log('Vendors page loaded');
    // Check authentication and group context
    try {
        const isLoggedIn = await window.supabaseClient.isAuthenticated();
        console.log('Is logged in:', isLoggedIn);
        if (!isLoggedIn) {
            window.location.href = 'login.html';
            return;
        }

        const currentGroupId = localStorage.getItem('currentGroupId');
        console.log('Current group ID:', currentGroupId);
        if (!currentGroupId) {
            window.location.href = 'index.html';
            return;
        }

        // Initialize vendor list
        await loadVendors();

        // Add vendor form submission
        const addVendorForm = document.getElementById('add-vendor-form');
        const errorMessage = document.getElementById('error-message');

        addVendorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Form submitted');
            
            const vendorData = {
                name: document.getElementById('vendor-name').value,
                type: document.getElementById('vendor-type').value,
                contact: document.getElementById('vendor-contact').value,
                email: document.getElementById('vendor-email').value || null,
                address: document.getElementById('vendor-address').value || null,
                group_id: currentGroupId
            };
            console.log('Vendor data:', vendorData);

            try {
                errorMessage.style.display = 'none';
                const result = await window.supabaseClient.addVendor(vendorData);
                console.log('Vendor added:', result);
                addVendorForm.reset();
                await loadVendors();
            } catch (error) {
                console.error('Error adding vendor:', error);
                errorMessage.textContent = error.message || 'Failed to add vendor. Please try again.';
                errorMessage.style.display = 'block';
            }
        });

    } catch (error) {
        console.error('Initialization error:', error);
        window.location.href = 'login.html';
    }
});

async function loadVendors() {
    try {
        const currentGroupId = localStorage.getItem('currentGroupId');
        console.log('Loading vendors for group:', currentGroupId);
        const vendors = await window.supabaseClient.getVendors(currentGroupId);
        console.log('Loaded vendors:', vendors);
        const vendorList = document.getElementById('vendor-list');
        
        if (vendors.length === 0) {
            vendorList.innerHTML = '<p class="text-center">No vendors added yet.</p>';
            return;
        }

        vendorList.innerHTML = vendors.map(vendor => `
            <div class="vendor-item card mb-2">
                <div class="flex justify-between items-center">
                    <div>
                        <h3>${vendor.name}</h3>
                        <p class="text-light" style="text-transform: capitalize;">Type: ${vendor.type}</p>
                        ${vendor.contact ? `
                            <p>
                                <i class="fas fa-phone"></i> ${vendor.contact}
                                <a href="tel:${vendor.contact}" style="margin-left: 10px; color: var(--primary); text-decoration: none;">
                                    <i class="fas fa-phone-alt"></i> Call
                                </a>
                                <a href="https://wa.me/${vendor.contact}" target="_blank" style="margin-left: 10px; color: var(--success); text-decoration: none;">
                                    <i class="fab fa-whatsapp"></i> WhatsApp
                                </a>
                            </p>
                        ` : ''}
                        ${vendor.email ? `
                            <p>
                                <i class="fas fa-envelope"></i> ${vendor.email}
                                <a href="mailto:${vendor.email}" style="margin-left: 10px; color: var(--primary); text-decoration: none;">
                                    <i class="fas fa-envelope-open"></i> Email
                                </a>
                            </p>
                        ` : ''}
                        ${vendor.address ? `
                            <p>
                                <i class="fas fa-map-marker-alt"></i> ${vendor.address}
                                <a href="https://maps.google.com/?q=${encodeURIComponent(vendor.address)}" target="_blank" style="margin-left: 10px; color: var(--primary); text-decoration: none;">
                                    <i class="fas fa-map"></i> Map
                                </a>
                            </p>
                        ` : ''}
                    </div>
                    <button class="btn btn-danger delete-vendor" data-vendor-id="${vendor.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Add delete event listeners
        document.querySelectorAll('.delete-vendor').forEach(button => {
            button.addEventListener('click', async (e) => {
                if (confirm('Are you sure you want to delete this vendor?')) {
                    const vendorId = e.currentTarget.dataset.vendorId;
                    console.log('Deleting vendor:', vendorId);
                    try {
                        await window.supabaseClient.deleteVendor(vendorId);
                        await loadVendors();
                    } catch (error) {
                        console.error('Error deleting vendor:', error);
                        const errorMessage = document.getElementById('error-message');
                        errorMessage.textContent = 'Failed to delete vendor. Please try again.';
                        errorMessage.style.display = 'block';
                    }
                }
            });
        });

    } catch (error) {
        console.error('Error loading vendors:', error);
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = 'Failed to load vendors. Please refresh the page.';
        errorMessage.style.display = 'block';
    }
} 