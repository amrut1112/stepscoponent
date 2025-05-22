// Shopping list functionality
const shoppingModule = (() => {
  // Get current group ID from localStorage
  const getCurrentGroupId = () => {
    return localStorage.getItem('currentGroupId');
  };

  // Format currency
  const formatCurrency = (amount) => {
    return '₹' + parseInt(amount).toLocaleString();
  };

  // Get all shopping categories
  const getShoppingCategories = async () => {
    try {
      const groupId = getCurrentGroupId();
      if (!groupId) throw new Error('No group selected');

      const { data, error } = await supabase
        .from('shopping_categories')
        .select(`
          id,
          name,
          budget_allocated,
          shopping_items (id, purchased)
        `)
        .eq('group_id', groupId);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching shopping categories:', error.message);
      throw error;
    }
  };

  // Get category spending
  const getCategorySpending = async (categoryId) => {
    try {
      const { data, error } = await supabase
        .from('shopping_items')
        .select('price, purchased')
        .eq('category_id', categoryId);

      if (error) throw error;

      // Calculate total spent (only for purchased items)
      const spent = data
        .filter(item => item.purchased)
        .reduce((total, item) => total + (item.price || 0), 0);

      return spent;
    } catch (error) {
      console.error('Error calculating category spending:', error.message);
      return 0;
    }
  };

  // Create new shopping category
  const createShoppingCategory = async (name, budget) => {
    try {
      const groupId = getCurrentGroupId();
      if (!groupId) throw new Error('No group selected');

      const { data, error } = await supabase
        .from('shopping_categories')
        .insert([
          { name, budget_allocated: budget, group_id: groupId }
        ])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error creating shopping category:', error.message);
      throw error;
    }
  };

  // Get shopping items for a category
  const getShoppingItems = async (categoryId) => {
    try {
      const { data, error } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('category_id', categoryId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching shopping items:', error.message);
      throw error;
    }
  };

  // Add shopping item
  const addShoppingItem = async (categoryId, name, price) => {
    try {
      const { data, error } = await supabase
        .from('shopping_items')
        .insert([
          { category_id: categoryId, name, price, purchased: false }
        ])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error adding shopping item:', error.message);
      throw error;
    }
  };

  // Update shopping item purchase status
  const updateItemPurchaseStatus = async (itemId, purchased) => {
    try {
      const { data, error } = await supabase
        .from('shopping_items')
        .update({ purchased })
        .eq('id', itemId)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error updating item purchase status:', error.message);
      throw error;
    }
  };

  // Delete shopping item
  const deleteShoppingItem = async (itemId) => {
    try {
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting shopping item:', error.message);
      throw error;
    }
  };

  // Render shopping categories
  const renderShoppingCategories = async () => {
    const container = document.getElementById('shopping-lists-container');
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    
    try {
      // Show loading
      loading.style.display = 'flex';
      errorMessage.style.display = 'none';
      container.innerHTML = '';
      
      // Get categories
      const categories = await getShoppingCategories();
      
      // Hide loading
      loading.style.display = 'none';
      
      if (categories.length === 0) {
        container.innerHTML = `
          <div class="card text-center p-3">
            <p>No shopping lists yet</p>
            <button id="create-first-category" class="btn mt-2">Create Your First List</button>
          </div>
        `;
        
        document.getElementById('create-first-category').addEventListener('click', () => {
          document.getElementById('add-category-modal').style.display = 'block';
        });
        
        return;
      }
      
      // Get template
      const template = document.getElementById('shopping-category-template');
      
      // Process each category
      for (const category of categories) {
        // Clone template
        const clone = document.importNode(template.content, true);
        
        // Get spending for this category
        const spent = await getCategorySpending(category.id);
        
        // Calculate progress
        const totalItems = category.shopping_items ? category.shopping_items.length : 0;
        const purchasedItems = category.shopping_items ? 
          category.shopping_items.filter(item => item.purchased).length : 0;
        
        const progressPercentage = category.budget_allocated > 0 ? 
          Math.min(100, (spent / category.budget_allocated) * 100) : 0;
        
        // Set data
        clone.querySelector('.shopping-category').dataset.id = category.id;
        clone.querySelector('.category-name').textContent = category.name;
        clone.querySelector('.category-progress').textContent = 
          `${purchasedItems}/${totalItems} items bought`;
        clone.querySelector('.category-budget').textContent = 
          `Spent: ${formatCurrency(spent)} / Allocated: ${formatCurrency(category.budget_allocated)}`;
        clone.querySelector('.progress-bar').style.width = `${progressPercentage}%`;
        
        // Set link
        const link = clone.querySelector('.view-category-link');
        link.href = `items.html?id=${category.id}`;
        
        // Append to container
        container.appendChild(clone);
      }
    } catch (error) {
      loading.style.display = 'none';
      errorMessage.textContent = error.message || 'Failed to load shopping lists';
      errorMessage.style.display = 'block';
    }
  };

  // Initialize shopping list page
  const initShoppingListPage = () => {
    // Check authentication
    window.supabaseClient.isAuthenticated().then(isLoggedIn => {
      if (!isLoggedIn) {
        window.location.href = '../login.html';
        return;
      }
      
      // Render categories
      renderShoppingCategories();
      
      // Add category button
      const addCategoryBtn = document.getElementById('add-category-btn');
      const addCategoryModal = document.getElementById('add-category-modal');
      const cancelAddCategory = document.getElementById('cancel-add-category');
      const addCategoryForm = document.getElementById('add-category-form');
      
      addCategoryBtn.addEventListener('click', () => {
        addCategoryModal.style.display = 'block';
      });
      
      cancelAddCategory.addEventListener('click', () => {
        addCategoryModal.style.display = 'none';
      });
      
      addCategoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('category-name').value;
        const budget = document.getElementById('category-budget').value;
        
        try {
          await createShoppingCategory(name, budget);
          addCategoryModal.style.display = 'none';
          addCategoryForm.reset();
          renderShoppingCategories();
        } catch (error) {
          alert('Failed to create category: ' + error.message);
        }
      });
    }).catch(error => {
      console.error('Authentication check failed:', error);
      window.location.href = '../login.html';
    });
  };

  // Return public methods
  return {
    initShoppingListPage,
    getShoppingCategories,
    getCategorySpending,
    createShoppingCategory,
    getShoppingItems,
    addShoppingItem,
    updateItemPurchaseStatus,
    deleteShoppingItem
  };
})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on the shopping list page
  if (document.getElementById('shopping-lists-container')) {
    shoppingModule.initShoppingListPage();
  }
});
