// Profile page functionality
document.addEventListener('DOMContentLoaded', async () => {
    const userNameElement = document.getElementById('user-name');
    const userEmailElement = document.getElementById('user-email');
    const groupListElement = document.getElementById('group-list');
    const loadingElement = document.getElementById('loading');
    const errorMessageElement = document.getElementById('error-message');

    try {
        // Show loading indicator
        loadingElement.style.display = 'flex';
        errorMessageElement.style.display = 'none';
        groupListElement.innerHTML = ''; // Clear loading text

        // Check authentication
        const isLoggedIn = await window.supabaseClient.isAuthenticated();
        if (!isLoggedIn) {
            window.location.href = 'login.html'; // Redirect to login if not authenticated
            return;
        }

        // Get current user
        const user = await window.supabaseClient.getCurrentUser();

        if (user) {
            // Display user information
            userNameElement.textContent = user.user_metadata.name || 'N/A';
            userEmailElement.textContent = user.email || 'N/A';

            // Get user's groups
            const groups = await window.supabaseClient.getUserGroups(user.id);

            if (groups && groups.length > 0) {
                // Display group information with invite codes
                groups.forEach(group => {
                    const groupElement = document.createElement('div');
                    groupElement.className = 'card mb-2';
                    groupElement.innerHTML = `
                        <p><strong>Group Name:</strong> ${group.name}</p>
                        <p><strong>Your Role:</strong> ${group.role}</p>
                        <!-- Fetching invite code requires getting group details -->
                        <p><strong>Invite Code:</strong> <span id="invite-code-${group.id}">Loading...</span></p>
                    `;
                    groupListElement.appendChild(groupElement);

                    // Fetch and display invite code for this group
                    fetchGroupInviteCode(group.id);
                });
            } else {
                groupListElement.innerHTML = '<p>You are not a member of any groups yet.</p>';
            }

        } else {
            // Should not happen if isAuthenticated is true, but as a fallback
            errorMessageElement.textContent = 'Could not retrieve user information.';
            errorMessageElement.style.display = 'block';
            console.error('User is null after authentication check.');
        }

    } catch (error) {
        console.error('Profile page initialization error:', error);
        errorMessageElement.textContent = 'Failed to load profile data. Please try again.';
        errorMessageElement.style.display = 'block';
    } finally {
        // Hide loading indicator
        loadingElement.style.display = 'none';
    }
});

// Logout functionality
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            // Call the Supabase signOut function
            await window.supabaseClient.signOut();
            
            // Clear current group from local storage on logout
            localStorage.removeItem('currentGroupId');
            
            // Redirect to login page
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error during logout:', error);
            // Optionally display an error message to the user
            alert('Failed to log out. Please try again.');
        }
    });
}

// Function to fetch and display the invite code for a specific group
async function fetchGroupInviteCode(groupId) {
    const inviteCodeElement = document.getElementById(`invite-code-${groupId}`);
    if (!inviteCodeElement) return;

    try {
        // Fetch the group details to get the invite code
        const { data: group, error } = await supabase
            .from('wedding_groups')
            .select('invite_code')
            .eq('id', groupId)
            .single();

        if (error) throw error;

        if (group && group.invite_code) {
            inviteCodeElement.textContent = group.invite_code;
        } else {
            inviteCodeElement.textContent = 'N/A';
        }

    } catch (error) {
        console.error(`Error fetching invite code for group ${groupId}:`, error);
        inviteCodeElement.textContent = 'Error loading code';
    }
} 