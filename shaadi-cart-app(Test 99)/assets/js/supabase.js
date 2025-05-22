1// Initialize Supabase client
const supabaseUrl = 'https://xiufkcbdhmilvgrxdjyr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpdWZrY2JkaG1pbHZncnhkanlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1Mzg1MDcsImV4cCI6MjA2MzExNDUwN30.GeA96QOyOVNzXTwhml3FftCE8lx2fMZ8doCENWqeca8';

// Create Supabase client
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Check if user is authenticated
async function isAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();
  return session !== null;
}

// Get current user
async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Sign up user
async function signUp(email, password, name) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name
        }
      }
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error signing up:', error.message);
    throw error;
  }
}

// Sign in user
async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error signing in:', error.message);
    throw error;
  }
}

// Sign out user
async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Error signing out:', error.message);
    throw error;
  }
}

// Phone Authentication Functions
async function sendOtp(phoneNumber) {
  try {
    console.log('Sending OTP to:', phoneNumber);
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: phoneNumber,
    });
    if (error) throw error;
    console.log('OTP sent successfully:', data);
    return data;
  } catch (error) {
    console.error('Error sending OTP:', error.message);
    throw error;
  }
}

async function verifyOtp(phoneNumber, otp) {
  try {
    console.log('Verifying OTP for:', phoneNumber);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phoneNumber,
      token: otp,
      type: 'sms', // Assuming SMS delivery
    });
    if (error) throw error;
    console.log('OTP verified successfully:', data);
    return data;
  } catch (error) {
    console.error('Error verifying OTP:', error.message);
    throw error;
  }
}

// Create wedding group
async function createWeddingGroup(name, weddingDate, userId, inviteCode) {
  try {
    const { data, error } = await supabase
      .from('wedding_groups')
      .insert([
        { name, wedding_date: weddingDate, created_by: userId, invite_code: inviteCode }
      ])
      .select();
    
    if (error) throw error;
    return data[0];
  } catch (error) {
    console.error('Error creating wedding group:', error.message);
    throw error;
  }
}

// Add user to wedding group
async function addUserToGroup(groupId, userId, role) {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .insert([
        { group_id: groupId, user_id: userId, role }
      ]);
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error adding user to group:', error.message);
    throw error;
  }
}

// Get user's wedding groups
async function getUserGroups(userId) {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select(`
        id,
        role,
        wedding_groups (
          id,
          name,
          wedding_date
        )
      `)
      .eq('user_id', userId);
    
    if (error) throw error;
    return data.map(item => ({
      id: item.wedding_groups.id,
      name: item.wedding_groups.name,
      weddingDate: item.wedding_groups.wedding_date,
      role: item.role
    }));
  } catch (error) {
    console.error('Error getting user groups:', error.message);
    throw error;
  }
}

// File upload function
async function uploadShoppingItemImage(itemId, file) {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${itemId}.${fileExt}`;
    const filePath = `shopping_item_images/${fileName}`;

    const { data, error } = await supabase.storage
      .from('wedding-photos') // Assuming you have a bucket named 'wedding-photos'
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (error) throw error;

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('wedding-photos')
      .getPublicUrl(filePath);

    if (!publicUrlData || !publicUrlData.publicUrl) throw new Error('Could not get public URL after upload');

    // Update the shopping item with the image URL
    const { data: updateData, error: updateError } = await supabase
      .from('shopping_items')
      .update({ image_url: publicUrlData.publicUrl })
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) throw updateError;

    console.log('Image uploaded and item updated:', updateData);
    return updateData;

  } catch (error) {
    console.error('Error uploading shopping item image:', error);
    throw error;
  }
}

// Export functions
window.supabaseClient = {
  isAuthenticated,
  getCurrentUser,
  signUp,
  signIn,
  signOut,
  sendOtp,
  verifyOtp,
  createWeddingGroup,
  addUserToGroup,
  getUserGroups,
  // Vendor functions
  async addVendor(vendorData) {
    try {
      console.log('Adding vendor:', vendorData);
      const { data, error } = await supabase
        .from('vendors')
        .insert([vendorData])
        .select()
        .single();

      if (error) {
        console.error('Error adding vendor:', error);
        throw error;
      }
      console.log('Vendor added successfully:', data);
      return data;
    } catch (error) {
      console.error('Exception in addVendor:', error);
      throw error;
    }
  },

  async getVendors(groupId) {
    try {
      console.log('Getting vendors for group:', groupId);
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('group_id', groupId)
        .order('name');

      if (error) {
        console.error('Error getting vendors:', error);
        throw error;
      }
      console.log('Vendors retrieved:', data);
      return data;
    } catch (error) {
      console.error('Exception in getVendors:', error);
      throw error;
    }
  },

  async deleteVendor(vendorId) {
    try {
      console.log('Deleting vendor:', vendorId);
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', vendorId);

      if (error) {
        console.error('Error deleting vendor:', error);
        throw error;
      }
      console.log('Vendor deleted successfully');
    } catch (error) {
      console.error('Exception in deleteVendor:', error);
      throw error;
    }
  },

  // Shopping item functions
  async addShoppingItem(categoryId, itemName, price) {
    try {
      const currentUser = await getCurrentUser();
      const currentGroupId = localStorage.getItem('currentGroupId');

      if (!currentUser) throw new Error('User not authenticated');
      if (!currentGroupId) throw new Error('Group not selected');

      console.log('Adding shopping item:', { categoryId, itemName, price, userId: currentUser.id, groupId: currentGroupId });

      const { data, error } = await supabase
        .from('shopping_items')
        .insert([
          { category_id: categoryId, name: itemName, price: price, user_id: currentUser.id, group_id: currentGroupId }
        ])
        .select()
        .single();

      if (error) {
        console.error('Error adding shopping item:', error);
        throw error;
      }
      console.log('Shopping item added successfully:', data);
      return data;
    } catch (error) {
      console.error('Exception in addShoppingItem:', error);
      throw error;
    }
  },

  async updateItemPurchaseStatus(itemId, isPurchased) {
    try {
      console.log('Updating purchase status for item:', itemId, isPurchased);
      const { data, error } = await supabase
        .from('shopping_items')
        .update({ is_purchased: isPurchased })
        .eq('id', itemId)
        .select()
        .single();

      if (error) {
        console.error('Error updating item purchase status:', error);
        throw error;
      }
      console.log('Item purchase status updated successfully:', data);
      return data;
    } catch (error) {
      console.error('Exception in updateItemPurchaseStatus:', error);
      throw error;
    }
  },

  async deleteShoppingItem(itemId) {
    try {
      console.log('Deleting shopping item:', itemId);
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.error('Error deleting shopping item:', error);
        throw error;
      }
      console.log('Shopping item deleted successfully:', itemId);
      return true;
    } catch (error) {
      console.error('Exception in deleteShoppingItem:', error);
      throw error;
    }
  },

  // File upload function
  uploadShoppingItemImage
};
