// Budget tracking functionality
const budgetModule = (() => {
  // Get current group ID from localStorage
  const getCurrentGroupId = () => {
    return localStorage.getItem('currentGroupId');
  };

  // Format currency
  const formatCurrency = (amount) => {
    return '₹' + parseInt(amount).toLocaleString();
  };

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  // Get budget summary
  const getBudgetSummary = async () => {
    try {
      const groupId = getCurrentGroupId();
      if (!groupId) throw new Error('No group selected');

      // Get budget record
      const { data: budgetData, error: budgetError } = await supabase
        .from('budget')
        .select('*')
        .eq('group_id', groupId)
        .single();

      if (budgetError && budgetError.code !== 'PGRST116') throw budgetError;

      // Get all categories
      const { data: categories, error: categoriesError } = await supabase
        .from('shopping_categories')
        .select('id, name, budget_allocated')
        .eq('group_id', groupId);

      if (categoriesError) throw categoriesError;

      // Get all transactions
      const { data: transactions, error: transactionsError } = await supabase
        .from('transactions')
        .select('*')
        .eq('group_id', groupId);

      if (transactionsError) throw transactionsError;

      // Calculate total allocated and spent
      const totalAllocated = categories.reduce((sum, category) => sum + (category.budget_allocated || 0), 0);
      const totalSpent = transactions.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);

      return {
        totalAllocated,
        totalSpent,
        remaining: totalAllocated - totalSpent,
        percentageSpent: totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0,
        categories,
        transactions
      };
    } catch (error) {
      console.error('Error fetching budget summary:', error.message);
      throw error;
    }
  };

  // Get category spending
  const getCategorySpending = async (categoryId) => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('amount')
        .eq('category_id', categoryId);

      if (error) throw error;

      // Calculate total spent
      const spent = data.reduce((total, transaction) => total + (transaction.amount || 0), 0);

      return spent;
    } catch (error) {
      console.error('Error calculating category spending:', error.message);
      return 0;
    }
  };

  // Add new expense
  const addExpense = async (categoryId, amount, description, date) => {
    try {
      const groupId = getCurrentGroupId();
      if (!groupId) throw new Error('No group selected');

      const { data, error } = await supabase
        .from('transactions')
        .insert([
          { 
            group_id: groupId, 
            category_id: categoryId, 
            amount, 
            description, 
            date 
          }
        ])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Error adding expense:', error.message);
      throw error;
    }
  };

  // Render budget summary
  const renderBudgetSummary = async () => {
    const budgetSummary = document.getElementById('budget-summary');
    const loading = document.getElementById('loading');
    const errorMessage = document.getElementById('error-message');
    
    try {
      // Show loading
      loading.style.display = 'flex';
      errorMessage.style.display = 'none';
      budgetSummary.style.display = 'none';
      
      // Get budget data
      const data = await getBudgetSummary();
      
      // Hide loading
      loading.style.display = 'none';
      
      // Update summary
      document.getElementById('total-allocated').textContent = formatCurrency(data.totalAllocated);
      document.getElementById('total-spent').textContent = formatCurrency(data.totalSpent);
      document.getElementById('remaining').textContent = formatCurrency(data.remaining);
      document.getElementById('overall-progress').style.width = `${data.percentageSpent}%`;
      document.getElementById('percentage-spent').textContent = `${data.percentageSpent}% Spent`;
      
      // Show summary
      budgetSummary.style.display = 'block';
      
      // Render categories
      await renderCategoryBreakdown(data.categories);
      
      // Render transactions
      renderTransactions(data.transactions);
      
      // Render pie chart
      renderCategoryPieChart(data.categories, data.transactions);
      
      // Update expense form categories
      updateExpenseFormCategories(data.categories);
    } catch (error) {
      loading.style.display = 'none';
      errorMessage.textContent = error.message || 'Failed to load budget data';
      errorMessage.style.display = 'block';
    }
  };

  // Render category breakdown
  const renderCategoryBreakdown = async (categories) => {
    const container = document.getElementById('category-items-container'); // Target the new container for items
    container.innerHTML = ''; // Clear only the items container
    
    const pieChartCanvas = document.getElementById('category-pie-chart');

    if (categories.length === 0) {
      // Add message to the items container
      container.innerHTML = '<p class="text-center">No budget categories yet</p>'; 
      // Also hide the pie chart canvas if there are no categories
      if (pieChartCanvas) {
          pieChartCanvas.style.display = 'none';
           // Clear the chart data if no categories
            if (categoryPieChart) {
                categoryPieChart.data.labels = [];
                categoryPieChart.data.datasets[0].data = [];
                categoryPieChart.update();
            }
      }
      return;
    } else {
         if (pieChartCanvas) {
             pieChartCanvas.style.display = 'block';
         }
    }

    // Get template
    const template = document.getElementById('category-item-template');
    
    // Process each category
    for (const category of categories) {
      // Clone template
      const clone = document.importNode(template.content, true);
      
      // Get spending for this category
      const spent = await getCategorySpending(category.id);
      
      // Calculate progress
      const progressPercentage = category.budget_allocated > 0 ? 
        Math.min(100, (spent / category.budget_allocated) * 100) : 0;
      
      // Set data
      clone.querySelector('.category-item').dataset.id = category.id;
      clone.querySelector('.category-name').textContent = category.name;
      // Update to show both spent and allocated amounts
      clone.querySelector('.category-amounts').innerHTML = 
        `Spent: <strong>${formatCurrency(spent)}</strong> of <strong>${formatCurrency(category.budget_allocated || 0)}</strong>`;
      clone.querySelector('.progress-bar').style.width = `${progressPercentage}%`;
      
      // Append to container
      container.appendChild(clone);
    }
  };

  // Render transactions
  const renderTransactions = (transactions) => {
    const container = document.getElementById('recent-transactions');
    container.innerHTML = '';
    
    if (transactions.length === 0) {
      container.innerHTML = '<p class="text-center">No transactions yet</p>';
      return;
    }
    
    // Sort transactions by date (newest first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Limit to 10 most recent
    const recentTransactions = transactions.slice(0, 10);
    
    // Get template
    const template = document.getElementById('transaction-item-template');
    
    if (!template) {
        console.error('Transaction item template not found.');
        return;
    }
    
    // Process each transaction
    for (const transaction of recentTransactions) {
      // Clone template
      const clone = document.importNode(template.content, true);
      
      // Set data
      const transactionItemElement = clone.querySelector('.transaction-item');
      if (transactionItemElement) {
        transactionItemElement.dataset.id = transaction.id;
      } else {
          console.warn('Transaction item element not found for transaction:', transaction);
      }

      const transactionDateElement = clone.querySelector('.transaction-date');
      if (transactionDateElement) {
        transactionDateElement.textContent = formatDate(transaction.date);
      } else {
          console.warn('Transaction date element not found for transaction:', transaction);
      }

      const transactionDescriptionElement = clone.querySelector('.transaction-description');
      if (transactionDescriptionElement) {
        transactionDescriptionElement.textContent = transaction.description;
      } else {
          console.warn('Transaction description element not found for transaction:', transaction);
      }

      const transactionAmountElement = clone.querySelector('.transaction-amount');
      if (transactionAmountElement) {
        transactionAmountElement.textContent = formatCurrency(transaction.amount);
      } else {
          console.warn('Transaction amount element not found for transaction:', transaction);
      }
      
      // Get category name and update the element safely
      getCategoryName(transaction.category_id).then(categoryName => {
        const categoryElement = clone.querySelector('.transaction-category');
        if (categoryElement) {
            categoryElement.textContent = categoryName;
        } else {
            console.warn('Transaction category element not found for transaction:', transaction);
        }
      });
      
      // Append to container
      container.appendChild(clone);
    }
  };

  // Get category name
  const getCategoryName = async (categoryId) => {
    try {
      const { data, error } = await supabase
        .from('shopping_categories')
        .select('name')
        .eq('id', categoryId)
        .single();

      if (error) throw error;
      return data.name;
    } catch (error) {
      console.error('Error getting category name:', error.message);
      return 'Unknown';
    }
  };

  // Update expense form categories
  const updateExpenseFormCategories = (categories) => {
    const select = document.getElementById('expense-category');
    select.innerHTML = '';
    
    categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      select.appendChild(option);
    });
  };

  // Initialize budget page
  const initBudgetPage = () => {
    // Check authentication
    window.supabaseClient.isAuthenticated().then(isLoggedIn => {
      if (!isLoggedIn) {
        window.location.href = '../login.html';
        return;
      }
      
      // Set today's date as default for expense form
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('expense-date').value = today;
      
      // Render budget data
      renderBudgetSummary();
      
      // Add expense button
      const addExpenseBtn = document.getElementById('add-expense-btn');
      const addExpenseModal = document.getElementById('add-expense-modal');
      const cancelAddExpense = document.getElementById('cancel-add-expense');
      const addExpenseForm = document.getElementById('add-expense-form');
      
      addExpenseBtn.addEventListener('click', () => {
        addExpenseModal.style.display = 'block';
      });
      
      cancelAddExpense.addEventListener('click', () => {
        addExpenseModal.style.display = 'none';
      });
      
      addExpenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const categoryId = document.getElementById('expense-category').value;
        const amount = document.getElementById('expense-amount').value;
        const description = document.getElementById('expense-description').value;
        const date = document.getElementById('expense-date').value;
        
        try {
          await addExpense(categoryId, amount, description, date);
          addExpenseModal.style.display = 'none';
          addExpenseForm.reset();
          document.getElementById('expense-date').value = today;
          renderBudgetSummary();
        } catch (error) {
          alert('Failed to add expense: ' + error.message);
        }
      });
    }).catch(error => {
      console.error('Authentication check failed:', error);
      window.location.href = '../login.html';
    });
  };

  // Render category pie chart
  let categoryPieChart = null; // To store the chart instance

  const renderCategoryPieChart = (categories, transactions) => {
      console.log('Rendering pie chart...');
      console.log('Categories:', categories);
      console.log('Transactions:', transactions);

      const canvas = document.getElementById('category-pie-chart');
      if (!canvas) {
          console.error('Pie chart canvas element not found.');
          return; // Exit if canvas is not found
      }
      console.log('Canvas element found:', canvas);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
           console.error('Could not get 2D context for canvas.');
           return; // Exit if context is not found
      }
      console.log('Canvas 2D context obtained.');
      
      // Calculate spent amount per category
      const categorySpending = categories.map(category => {
          const spent = transactions
              .filter(transaction => transaction.category_id === category.id)
              .reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
          return { name: category.name, spent: spent };
      });

      // Filter out categories with zero spending if desired, or include them with zero
      // const chartData = categorySpending.filter(item => item.spent > 0);
      const chartData = categorySpending;

      const labels = chartData.map(item => item.name);
      const data = chartData.map(item => item.spent);
      const colors = generateColors(labels.length); // Helper to generate distinct colors

      console.log('Chart Labels:', labels);
      console.log('Chart Data:', data);
      console.log('Chart Colors:', colors);

      if (categoryPieChart) {
          console.log('Updating existing chart.');
          // Update existing chart
          categoryPieChart.data.labels = labels;
          categoryPieChart.data.datasets[0].data = data;
          categoryPieChart.data.datasets[0].backgroundColor = colors;
          categoryPieChart.update();
          console.log('Chart updated.');
      } else {
          console.log('Creating new chart.');
          // Create new chart
          categoryPieChart = new Chart(ctx, {
              type: 'pie',
              data: {
                  labels: labels,
                  datasets: [{
                      data: data,
                      backgroundColor: colors,
                      borderColor: '#fff',
                      borderWidth: 2
                  }]
              },
              options: {
                  responsive: true,
                  maintainAspectRatio: false, // Allow canvas to resize
                  plugins: {
                      legend: {
                          position: 'top',
                      },
                      title: {
                          display: true,
                          text: 'Spending Distribution by Category'
                      }
                  }
              }
          });
           console.log('New chart created.', categoryPieChart);
      }
  };

  // Helper function to generate distinct colors
  const generateColors = (numColors) => {
      const colors = [];
      const hueStep = 360 / numColors;
      for (let i = 0; i < numColors; i++) {
          const hue = i * hueStep;
          colors.push(`hsl(${hue}, 70%, 60%)`); // Using HSL for distinct colors
      }
      return colors;
  };

  // Return public methods
  return {
    initBudgetPage,
    getBudgetSummary,
    getCategorySpending,
    addExpense
  };
})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Check if we're on the budget page
  if (document.getElementById('budget-summary')) {
    budgetModule.initBudgetPage();
  }
});
