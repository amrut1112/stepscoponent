// Shopping items functionality
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication and group context
    try {
        const isLoggedIn = await window.supabaseClient.isAuthenticated();
        if (!isLoggedIn) {
            window.location.href = '../login.html';
            return;
        }

        const currentGroupId = localStorage.getItem('currentGroupId');
        if (!currentGroupId) {
            window.location.href = '../index.html';
            return;
        }

        // Get category ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const categoryId = urlParams.get('id');

        if (!categoryId) {
            console.error('No category ID provided in URL');
            // Redirect back to categories or show an error
            window.location.href = 'index.html';
            return;
        }

        // Load category name and items
        await loadCategoryAndItems(categoryId);

        // Add item form submission (modal)
        const addItemForm = document.getElementById('add-item-form');
        const addItemModal = document.getElementById('add-item-modal');
        const cancelAddItem = document.getElementById('cancel-add-item');
        const errorMessage = document.getElementById('error-message');
        const addItemBtn = document.getElementById('add-item-btn');

        addItemBtn.addEventListener('click', () => {
            addItemModal.style.display = 'block';
        });

        cancelAddItem.addEventListener('click', () => {
            addItemModal.style.display = 'none';
            addItemForm.reset();
        });

        addItemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const itemName = document.getElementById('item-name').value;
            const currentGroupId = localStorage.getItem('currentGroupId'); // Get group ID again
            const urlParams = new URLSearchParams(window.location.search);
            const categoryId = urlParams.get('id'); // Get category ID again

            if (!currentGroupId || !categoryId) {
                errorMessage.textContent = 'Group or category not selected.';
                errorMessage.style.display = 'block';
                return;
            }

            try {
                errorMessage.style.display = 'none';
                // Add item with default price 0 for now
                // The addShoppingItem function now gets user_id and group_id internally
                await window.supabaseClient.addShoppingItem(categoryId, itemName, 0);
                addItemModal.style.display = 'none';
                addItemForm.reset();
                // Real-time subscription will handle updating the list
                // await loadShoppingItems(categoryId); // No longer need to manually reload
            } catch (error) {
                console.error('Error adding shopping item:', error);
                errorMessage.textContent = error.message || 'Failed to add shopping item';
                errorMessage.style.display = 'block';
            }
        });

        // Delegate delete item clicks to the container
        const shoppingItemsContainer = document.getElementById('shopping-items-container');
        if (shoppingItemsContainer) {
            shoppingItemsContainer.addEventListener('click', handleDeleteItem);
        }

    } catch (error) {
        console.error('Initialization error:', error);
        window.location.href = '../login.html';
    }
});

let shoppingItemsSubscription = null; // Variable to hold the subscription

async function loadCategoryAndItems(categoryId) {
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    const categoryNameElement = document.getElementById('category-name');

    try {
        loading.style.display = 'flex';
        errorMessage.style.display = 'none';

        // Fetch category details to get name
        const { data: category, error: categoryError } = await supabase
            .from('shopping_categories')
            .select('name')
            .eq('id', categoryId)
            .single();

        if (categoryError) throw categoryError;
        categoryNameElement.textContent = category.name;

        // Load shopping items for this category and set up real-time subscription
        await loadShoppingItems(categoryId);

    } catch (error) {
        console.error('Error loading category and items:', error);
        loading.style.display = 'none';
        errorMessage.textContent = error.message || 'Failed to load category details';
        errorMessage.style.display = 'block';
    }
}

async function loadShoppingItems(categoryId) {
    const container = document.getElementById('shopping-items-container');
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    const currentGroupId = localStorage.getItem('currentGroupId'); // Get group ID

    if (!currentGroupId) {
        console.error('No group ID found in localStorage');
        errorMessage.textContent = 'Could not load shopping items: Group not selected.';
        errorMessage.style.display = 'block';
        return;
    }

    try {
        loading.style.display = 'flex';
        errorMessage.style.display = 'none';
        container.innerHTML = ''; // Clear previous items

        // Unsubscribe from previous subscription if it exists
        if (shoppingItemsSubscription) {
            await shoppingItemsSubscription.unsubscribe();
        }

        // Fetch initial shopping items
        const { data: items, error: itemsError } = await supabase
            .from('shopping_items')
            .select(`
                *
            `)
            .eq('category_id', categoryId)
            .eq('group_id', currentGroupId)
            .order('created_at', { ascending: false });

        if (itemsError) throw itemsError;

        loading.style.display = 'none';

        if (items.length === 0) {
            container.innerHTML = '<p class="text-center">No items in this list yet.</p>';
        } else {
            // Render initial items
            items.forEach(item => renderShoppingItem(item, container));
        }

        // Set up real-time subscription
        shoppingItemsSubscription = supabase
            .channel(`shopping_items:category_id=eq.${categoryId}:group_id=eq.${currentGroupId}`)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'shopping_items', 
                  filter: `category_id=eq.${categoryId}&&group_id=eq.${currentGroupId}` },
                (payload) => handleRealtimeUpdate(payload, container)
            )
            .subscribe();

    } catch (error) {
        console.error('Error loading shopping items:', error);
        console.error('Full error object:', error);
        loading.style.display = 'none';
        errorMessage.textContent = error.message || 'Failed to load shopping items';
        errorMessage.style.display = 'block';
    }
}

// Function to render a single shopping item element
function renderShoppingItem(item, container) {
    const itemElement = document.createElement('div');
    itemElement.className = 'card mb-3 shopping-item'; // Add shopping-item class for easy selection
    itemElement.dataset.itemId = item.id; // Store item ID on the element
    itemElement.innerHTML = `
        <div class="flex justify-between items-center">
            <h3>${item.name}</h3>
            <div>
                <input type="checkbox" class="mark-purchased" data-item-id="${item.id}" ${item.is_purchased ? 'checked' : ''}>
                <button class="btn btn-danger btn-sm delete-item" data-item-id="${item.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        <p>${item.is_purchased ? 'Purchased' : 'Not Purchased'}</p>
        ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}" style="max-width: 100%; height: auto; margin-bottom: 10px;">` : ''}
        
        <!-- Image Upload -->
        <div class="form-group mt-2">
            <label for="image-upload-${item.id}" class="form-label">Upload Image</label>
            <input type="file" id="image-upload-${item.id}" class="form-control" accept="image/*" data-item-id="${item.id}">
        </div>
    `;

    // Add event listeners after rendering
    // itemElement.querySelector('.add-comment-form').addEventListener('submit', handleAddComment);
    itemElement.querySelector('.mark-purchased').addEventListener('change', handleMarkPurchased);
    itemElement.querySelector('.delete-item').addEventListener('click', handleDeleteItem);
    const imageUploadInput = itemElement.querySelector(`#image-upload-${item.id}`);
    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', handleImageUpload);
    }

    // Append to container (for initial load)
    // Realtime updates will handle insertion/removal at specific positions if needed
    container.appendChild(itemElement);
}

// Handle real-time updates from Supabase
async function handleRealtimeUpdate(payload, container) {
    console.log('Realtime update received:', payload);
    console.log('Event type:', payload.eventType);
    console.log('New data:', payload.new);
    console.log('Old data:', payload.old);
    const item = payload.new || payload.old; // New data for INSERT/UPDATE, old data for DELETE

    // Fetch the full item data including comments and user info for display
    // This is needed because realtime payload might not include joined data
    if (payload.eventType !== 'DELETE') {
        const { data: fullItem, error: fetchError } = await supabase
            .from('shopping_items')
            .select(`
                *
            `)
            .eq('id', item.id)
            .single();

        if (fetchError) {
            console.error('Error fetching full item data for realtime update:', fetchError);
            return;
        }
        // item.shopping_item_comments = fullItem.shopping_item_comments; // Attach comments to the item object
    }


    const existingItemElement = container.querySelector(`.shopping-item[data-item-id="${item.id}"]`);

    switch (payload.eventType) {
        case 'INSERT':
            if (!existingItemElement) {
                // Add the new item to the top of the list
                const newItemElement = document.createElement('div');
                newItemElement.className = 'card mb-3 shopping-item';
                newItemElement.dataset.itemId = item.id;
                 // Re-render the new item including its comments and event listeners
                renderShoppingItem(item, newItemElement); // Render into a temporary element first
                container.prepend(newItemElement); // Add to the top
                 // Re-attach event listeners after adding to DOM
                 // newItemElement.querySelector('.add-comment-form').addEventListener('submit', handleAddComment);
                 newItemElement.querySelector('.mark-purchased').addEventListener('change', handleMarkPurchased);
                 newItemElement.querySelector('.delete-item').addEventListener('click', handleDeleteItem);
                 const imageUploadInput = newItemElement.querySelector(`#image-upload-${item.id}`);
                 if (imageUploadInput) {
                     imageUploadInput.addEventListener('change', handleImageUpload);
                 }

                if (container.querySelector('.text-center') && container.querySelector('.text-center').textContent === 'No items in this list yet.') {
                     container.querySelector('.text-center').remove(); // Remove the 'No items' message
                }
            }
            break;
        case 'UPDATE':
            if (existingItemElement) {
                // Update the existing item in place
                 // Temporarily remove event listeners before updating innerHTML
                 // existingItemElement.querySelector('.add-comment-form').removeEventListener('submit', handleAddComment);
                 existingItemElement.querySelector('.mark-purchased').removeEventListener('change', handleMarkPurchased);
                 existingItemElement.querySelector('.delete-item').removeEventListener('click', handleDeleteItem);
                 const existingImageUploadInput = existingItemElement.querySelector(`#image-upload-${item.id}`);
                 if (existingImageUploadInput) {
                    existingImageUploadInput.removeEventListener('change', handleImageUpload);
                 }

                const tempContainer = document.createElement('div');
                renderShoppingItem(item, tempContainer);
                existingItemElement.innerHTML = tempContainer.innerHTML;

                 // Re-attach event listeners after updating innerHTML
                 // existingItemElement.querySelector('.add-comment-form').addEventListener('submit', handleAddComment);
                 existingItemElement.querySelector('.mark-purchased').addEventListener('change', handleMarkPurchased);
                 existingItemElement.querySelector('.delete-item').addEventListener('click', handleDeleteItem);
                 const imageUploadInput = existingItemElement.querySelector(`#image-upload-${item.id}`);
                 if (imageUploadInput) {
                     imageUploadInput.addEventListener('change', handleImageUpload);
                 }
            }
            break;
        case 'DELETE':
            if (existingItemElement) {
                // Remove the item element from the DOM
                existingItemElement.remove();

                // If no items left, show the 'No items' message
                if (container.children.length === 0) {
                     container.innerHTML = '<p class="text-center">No items in this list yet.</p>';
                }
            }
            break;
    }
}

// Placeholder function for adding comment (will implement logic later)
/*
async function handleAddComment(e) {
    e.preventDefault();
    // Logic to add comment
    const itemId = e.target.dataset.itemId;
    const commentInput = e.target.querySelector('input[type="text"]');
    const commentText = commentInput.value.trim();
    const currentUser = await supabase.auth.getUser();
    const userId = currentUser.data.user.id;

    if (!commentText || !userId) return;

    try {
        await window.supabaseClient.addShoppingItemComment(itemId, userId, commentText);
        commentInput.value = ''; // Clear input
        // Realtime subscription will update the comments list
    } catch (error) {
        console.error('Error adding comment:', error);
        alert('Failed to add comment: ' + error.message);
    }
}
*/

// Placeholder functions for item actions
async function handleMarkPurchased(e) {
    const itemId = e.target.dataset.itemId;
    const isPurchased = e.target.checked;
    console.log(`Item ${itemId} marked as purchased: ${isPurchased}`);

    try {
        await window.supabaseClient.updateItemPurchaseStatus(itemId, isPurchased);
        // Optionally update just this item's display instead of reloading all
        // For now, let's reload to keep it simple
        const urlParams = new URLSearchParams(window.location.search);
        const categoryId = urlParams.get('id');
        await loadShoppingItems(categoryId);
    } catch (error) {
        console.error('Error marking item as purchased:', error);
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = error.message || 'Failed to update item status.';
        errorMessage.style.display = 'block';
        // Revert checkbox state if update failed
        e.target.checked = !isPurchased;
    }
}

async function handleDeleteItem(e) {
    const deleteButton = e.target.closest('.delete-item');
    if (!deleteButton) return; // Not a delete button click

    const itemId = deleteButton.dataset.itemId;
    console.log(`Deleting item: ${itemId}`);

    if (confirm('Are you sure you want to delete this item?')) {
        try {
            const errorMessage = document.getElementById('error-message');
            errorMessage.style.display = 'none';
            await window.supabaseClient.deleteShoppingItem(itemId);
            // Remove the item element from the DOM
            deleteButton.closest('.card').remove();
            console.log('Item deleted successfully');
            // Optionally reload or update category progress on index page if needed
        } catch (error) {
            console.error('Error deleting item:', error);
            const errorMessage = document.getElementById('error-message');
            errorMessage.textContent = error.message || 'Failed to delete item.';
            errorMessage.style.display = 'block';
        }
    }
}

async function handleImageUpload(e) {
    const itemId = e.target.dataset.itemId;
    const file = e.target.files[0];

    if (!file) {
        return; // No file selected
    }

    console.log(`Uploading image for item ${itemId}:`, file);

    try {
        const errorMessage = document.getElementById('error-message');
        errorMessage.style.display = 'none';
        
        // Display a loading indicator if desired
        // e.target.disabled = true;

        await window.supabaseClient.uploadShoppingItemImage(itemId, file);
        console.log('Image upload successful');

        // Reload items to display the new image
        const urlParams = new URLSearchParams(window.location.search);
        const categoryId = urlParams.get('id');
        await loadShoppingItems(categoryId);

    } catch (error) {
        console.error('Error uploading image:', error);
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = error.message || 'Failed to upload image.';
        errorMessage.style.display = 'block';
        // Re-enable input if desired
        // e.target.disabled = false;
    }
} 