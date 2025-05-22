// tasks.js

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const isLoggedIn = await window.supabaseClient.isAuthenticated();
    if (!isLoggedIn) {
        window.location.href = 'login.html'; // Redirect to login if not authenticated
        return;
    }

    const currentGroupId = localStorage.getItem('currentGroupId');
    const taskList = document.getElementById('task-list');
    const newTaskInput = document.getElementById('new-task-input');
    const addTaskBtn = document.getElementById('add-task-btn');

    if (!currentGroupId) {
        taskList.innerHTML = '<p>Please select a wedding group first.</p>';
        return;
    }

    // Function to fetch tasks
    async function fetchTasks(filter = 'all', sort = 'created_at_asc') {
        let query = supabase
            .from('tasks')
            .select('id, description, is_completed, due_date')
            .eq('group_id', currentGroupId);

        // Apply filter
        if (filter === 'pending') {
            query = query.eq('is_completed', false);
        } else if (filter === 'completed') {
            query = query.eq('is_completed', true);
        }

        // Apply sorting
        let orderByColumn = 'created_at';
        let ascending = true;
        if (sort === 'created_date_desc') {
            orderByColumn = 'created_at';
            ascending = false;
        } else if (sort === 'due_date_asc') {
            orderByColumn = 'due_date';
            ascending = true;
            // Ensure tasks with no due date are handled (e.g., appear last)
            query = query.order('due_date', { ascending: true, nullsFirst: false });
             // Skip the general order call later if due_date_asc
             // This is handled by returning here or using a flag if more complex logic follows
            const { data, error } = await query;

            if (error) {
                console.error('Error fetching tasks:', error);
                const taskList = document.getElementById('task-list'); // Get taskList element here
                taskList.innerHTML = '<p>Error loading tasks.</p>';
                return [];
            }
            return data;

        } else if (sort === 'due_date_desc') {
            orderByColumn = 'due_date';
            ascending = false;
             // Ensure tasks with no due date are handled (e.g., appear last)
            query = query.order('due_date', { ascending: false, nullsFirst: false });
             // Skip the general order call later if due_date_desc
             // This is handled by returning here or using a flag if more complex logic follows
            const { data, error } = await query;

            if (error) {
                console.error('Error fetching tasks:', error);
                const taskList = document.getElementById('task-list'); // Get taskList element here
                taskList.innerHTML = '<p>Error loading tasks.</p>';
                return [];
            }
            return data;
        }

         // Default ordering for created_at asc/desc
        query = query.order(orderByColumn, { ascending: ascending });

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching tasks:', error);
            const taskList = document.getElementById('task-list'); // Get taskList element here
            taskList.innerHTML = '<p>Error loading tasks.</p>';
            return [];
        }
        return data;
    }

    // Function to render tasks
    function renderTasks(tasks) {
        const taskList = document.getElementById('task-list'); // Get taskList element
        taskList.innerHTML = ''; // Clear current list
        if (tasks.length === 0) {
            taskList.innerHTML = '<p>No tasks yet!</p>';
            return;
        }
        tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.classList.add('task-item');
            taskElement.dataset.taskId = task.id; // Store task ID
            
            // Add checkbox for completion
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.is_completed;
            checkbox.addEventListener('change', () => toggleTaskCompletion(task.id, checkbox.checked));

            // Container for description, due date, and icon
            const taskDetails = document.createElement('div');
            taskDetails.style.flexGrow = '1'; // Allow details to take available space
            taskDetails.style.marginRight = '10px';

            // Add span for description (editable)
            const descriptionSpan = document.createElement('span');
            descriptionSpan.textContent = task.description;
            descriptionSpan.classList.add('task-description');
            descriptionSpan.style.textDecoration = task.is_completed ? 'line-through' : 'none';
            descriptionSpan.addEventListener('dblclick', () => enableTaskEditing(taskElement, task.id, descriptionSpan));

            // Add due date and status icon
            const dueDateElement = document.createElement('span');
            dueDateElement.classList.add('task-due-date');
            dueDateElement.style.fontSize = '0.9em'; // Make due date slightly smaller
            dueDateElement.style.color = 'var(--text-light)';
            dueDateElement.style.marginLeft = '10px';

            let statusIcon = '';

            if (task.due_date) {
                const dueDate = new Date(task.due_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Reset time for comparison

                const timeDiff = dueDate.getTime() - today.getTime();
                const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                if (task.is_completed) {
                    dueDateElement.textContent = `Completed`;
                    statusIcon = '<i class="fas fa-check-circle" style="color: var(--success); margin-left: 5px;"></i>';
                } else if (daysDiff < 0) {
                    dueDateElement.textContent = `Overdue (${formatDate(task.due_date)})`;
                    statusIcon = '<i class="fas fa-exclamation-circle" style="color: var(--danger); margin-left: 5px;"></i>';
                } else if (daysDiff === 0) {
                    dueDateElement.textContent = `Due Today`;
                     statusIcon = '<i class="fas fa-clock" style="color: var(--warning); margin-left: 5px;"></i>';
                } else if (daysDiff <= 7) {
                    dueDateElement.textContent = `Due Soon (${formatDate(task.due_date)})`;
                     statusIcon = '<i class="fas fa-clock" style="color: var(--warning); margin-left: 5px;"></i>';
                } else {
                    dueDateElement.textContent = `Due ${formatDate(task.due_date)}`;
                    statusIcon = '<i class="fas fa-calendar-alt" style="color: var(--text-light); margin-left: 5px;"></i>';
                }
            } else if (task.is_completed) {
                 dueDateElement.textContent = `Completed`;
                 statusIcon = '<i class="fas fa-check-circle" style="color: var(--success); margin-left: 5px;"></i>';
            } else {
                 // No due date and not completed - show a default icon if desired or nothing
                 statusIcon = '<i class="fas fa-clock" style="color: var(--text-light); margin-left: 5px;"></i>'; // Example: a generic clock icon
            }

            taskDetails.appendChild(descriptionSpan);
            if (dueDateElement.textContent) {
                 taskDetails.appendChild(dueDateElement);
            }

            // Add a separate span for the icon to control spacing better
            const iconSpan = document.createElement('span');
            iconSpan.innerHTML = statusIcon;
            taskDetails.appendChild(iconSpan);

            // Add delete button
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i class="fas fa-trash"></i>'; // Use trash icon
            deleteButton.classList.add('delete-task-btn');
            deleteButton.addEventListener('click', () => deleteTask(task.id));

            taskElement.appendChild(checkbox);
            taskElement.appendChild(taskDetails);
            taskElement.appendChild(deleteButton);

            taskList.appendChild(taskElement);
        });
    }

    // Function to toggle task completion
    async function toggleTaskCompletion(taskId, isCompleted) {
        const { error } = await supabase
            .from('tasks')
            .update({ is_completed: isCompleted })
            .eq('id', taskId);

        if (error) {
            console.error('Error updating task completion:', error);
            alert('Failed to update task status.');
        } else {
             loadAndRenderTasks(); // Refresh list to show updated status/styling
        }
    }

    // Function to delete a task
    async function deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId);

            if (error) {
                console.error('Error deleting task:', error);
                alert('Failed to delete task.');
            } else {
                loadAndRenderTasks(); // Refresh list
            }
        }
    }

    // Function to enable task editing
    function enableTaskEditing(taskElement, taskId, descriptionSpan) {
        const currentText = descriptionSpan.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.classList.add('edit-task-input');
        
        // Replace span with input
        taskElement.replaceChild(input, descriptionSpan);

        input.focus();

        // Save on Enter or blur
        const saveEdit = async () => {
            const newDescription = input.value.trim();
            if (newDescription === currentText || !newDescription) {
                // No change or empty, revert
                taskElement.replaceChild(descriptionSpan, input);
                return;
            }

            const { error } = await supabase
                .from('tasks')
                .update({ description: newDescription })
                .eq('id', taskId);

            if (error) {
                console.error('Error updating task:', error);
                alert('Failed to update task.');
                 taskElement.replaceChild(descriptionSpan, input); // Revert on error
            } else {
                descriptionSpan.textContent = newDescription; // Update span text
                taskElement.replaceChild(descriptionSpan, input); // Replace input with updated span
            }
        };

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                saveEdit();
            }
        });
        input.addEventListener('blur', saveEdit);
    }

    // Function to add a new task
    async function addTask() {
        const descriptionInput = document.getElementById('new-task-input');
        const dueDateInput = document.getElementById('new-task-due-date');

        const description = descriptionInput.value.trim();
        const dueDate = dueDateInput.value; // YYYY-MM-DD format or empty string

        if (!description) return; // Don't add empty tasks

        // You might want to link the task to the current user if you added a user_id column to the tasks table
        const user = await window.supabaseClient.getCurrentUser();
        const userId = user ? user.id : null;

        const { data, error } = await supabase
            .from('tasks')
            .insert([{ 
                group_id: currentGroupId, 
                description: description,
                due_date: dueDate || null, // Store null if no due date
                created_by: userId // Link task to creator if user_id column exists
            }]);

        if (error) {
            console.error('Error adding task:', error);
            alert('Failed to add task.');
        } else {
            descriptionInput.value = ''; // Clear input
            dueDateInput.value = ''; // Clear date input
            loadAndRenderTasks(); // Refresh the list
        }
    }

    // Function to format a date for display (e.g., "Jul 10") - Add this if not already present
    function formatDate(dateString) {
        const options = { month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('en-US', options);
    }

    // Load and render tasks on page load
    async function loadAndRenderTasks(filter = 'all', sort = 'created_at_asc') {
        // Add a loading indicator if needed
        const taskList = document.getElementById('task-list'); // Get taskList element
        taskList.innerHTML = '<p class="text-center">Loading tasks...</p>'; // Show loading

        const tasks = await fetchTasks(filter, sort);
        renderTasks(tasks);
    }

    // Event listener for add button
    addTaskBtn.addEventListener('click', addTask);

    // Allow adding task on Enter key press in the input field
    newTaskInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission (if applicable)
            addTask();
        }
    });

    // Filter buttons functionality
    const filterButtons = document.querySelectorAll('.task-filters .btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to the clicked button
            button.classList.add('active');
            // Load and render tasks with the selected filter
            const filter = button.dataset.filter;
            loadAndRenderTasks(filter);
        });
    });

    // Sorting dropdown functionality
    const sortSelect = document.getElementById('sort-tasks');
    sortSelect.addEventListener('change', () => {
        // Load and render tasks with the current filter and new sort
        const currentFilterButton = document.querySelector('.task-filters .btn.active');
        const currentFilter = currentFilterButton ? currentFilterButton.dataset.filter : 'all';
        const currentSort = sortSelect.value;
        loadAndRenderTasks(currentFilter, currentSort);
    });

    // Load and render tasks on page load (with default filter 'all' and sort 'created_at_asc')
    loadAndRenderTasks('all', 'created_at_asc');
}); 