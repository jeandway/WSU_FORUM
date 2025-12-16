
// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  BASE_URL: 'http://localhost:8000/api',  // Backend API URL
  TIMEOUT: 10000,
  USE_MOCKS: false,  // Set to true for mock data, false for real backend
};

// ============================================================================
// HTTP CLIENT
// ============================================================================

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    };

    // Add auth token if available
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
      
      const response = await fetch(url, { ...config, signal: controller.signal });
      clearTimeout(timeoutId);


      const contentType = response.headers.get('content-type');
      
      // Check if response is actually JSON
      if (!contentType || !contentType.includes('application/json')) {
        console.error('Non-JSON response received:', {
          url,
          status: response.status,
          contentType,
        });
        
        // If it's HTML, Django probably returned an error page
        if (contentType?.includes('text/html')) {
          const htmlText = await response.text();
          console.error('HTML Response (first 500 chars):', htmlText.substring(0, 500));
          
          // Common Django errors
          if (htmlText.includes('CSRF')) {
            throw new ApiError(response.status, 'CSRF token error. Please refresh the page.');
          }
          if (htmlText.includes('404')) {
            throw new ApiError(404, 'API endpoint not found. Check backend URL configuration.');
          }
          if (htmlText.includes('500')) {
            throw new ApiError(500, 'Server error. Check Django console for details.');
          }
          
          throw new ApiError(response.status, `Server returned HTML instead of JSON. Status: ${response.status}`);
        }
        
        throw new ApiError(response.status, 'Invalid response format from server');
      }
      
      // Parse JSON response
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      
      if (!response.ok) {
        const errorMessage = data.message || data.Message || data.Error || data.error || 'Request failed';
        throw new ApiError(response.status, errorMessage);
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      
      if (error.name === 'AbortError') {
        throw new ApiError(0, 'Request timed out. Please try again.');
      }
      
      // JSON parse errors
      if (error instanceof SyntaxError) {
        console.error('JSON Parse Error:', error);
        throw new ApiError(0, 'Server returned invalid JSON. Check Django is running and returning JSON.');
      }
      
      console.error('API Error:', error);
      throw new ApiError(0, error.message || 'Network error. Please check your connection.');
    }
  }

  get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// ============================================================================
// MOCK DATA (keeping original for reference)
// ============================================================================

const MOCK_DATA = {
  user: {
    id: 'u_wsu_001',
    name: 'Jean D.',
    email: 'jean.d@wayne.edu',
    role: 'Student',
    major: 'Computer Science',
    year: 'Junior',
    avatar: 'https://api.dicebear.com/8.x/avataaars/svg?seed=Jean',
    bio: 'CS student passionate about AI and web development.',
    joinedAt: '2024-09-01',
    emailVerified: true,
    stats: { posts: 12, followers: 45, following: 32 },
  },
  posts: [],
  topics: [],
  events: [],
};

// ============================================================================
// API SERVICE
// ============================================================================

const client = new ApiClient(CONFIG.BASE_URL);

export const api = {
  // --------------------------------------------------------------------------
  // AUTH - FIXED ENDPOINTS
  // --------------------------------------------------------------------------
  auth: {
    async signIn(email, password) {
      if (CONFIG.USE_MOCKS) {
        // Mock logic...
        return { success: true, user: MOCK_DATA.user, accessToken: "mock_token_123" };
      }

      // ✅ FIX 1: Use correct endpoint and send 'username' field
      const response = await client.post("/login", { 
        username: email,  // Django expects 'username', not 'email'
        password: password 
      });

      // Handle Django response format
      if (response.success && response.accessToken) {
        localStorage.setItem("accessToken", response.accessToken);
        if (response.refreshToken) {
          localStorage.setItem("refreshToken", response.refreshToken);
        }
      }

      return {
        user: response.user,
        token: response.accessToken,
        success: response.success,
        message: response.message,
      };
    },

    async signUp(data) {
      if (CONFIG.USE_MOCKS) {
        return {
          success: true,
          user: { ...MOCK_DATA.user, ...data },
          accessToken: "mock_token_123",
          message: "Account created! Please check your email to verify.",
        };
      }

      // ✅ FIX 3: Use correct endpoint and match Django serializer fields
      const response = await client.post("/register", {
        username: data.email.split('@')[0],  // Extract username from email
        email: data.email,
        password: data.password,
        pass2: data.pass2,
        name: data.name,
        role: data.role === 'student' ? 1 : data.role === 'faculty' ? 2 : data.role === 'staff' ? 3 : 4,
        // Optional fields
        ...(data.major && { major: data.major }),
        ...(data.classification && { classification: data.classification }),
        ...(data.department && { department: data.department }),
      });

      // Note: Registration doesn't set token until email is verified
      return {
        user: response.user,
        success: true,
        message: response.message || "Account created! Please check your email to verify.",
      };
    },

    async verifyEmail(uidb64, token) {
      if (CONFIG.USE_MOCKS) {
        return { success: true, message: "Email verified!" };
      }

      //  Use correct verification endpoint
      const response = await client.get(`/activate/${uidb64}/${token}`);
      return { 
        success: response.message === "success",
        message: response.message 
      };
    },

    async forgotPassword(email) {
      if (CONFIG.USE_MOCKS) {
        return { success: true, message: "Reset email sent" };
      }

      // ✅ Correct endpoint (matches Django urls.py)
      const response = await client.post("/auth/forgot-password", { email });
      return { 
        success: true, 
        message: response.message || "Password reset link sent to your email" 
      };
    },

    async resetPassword(uidb64, token, password) {
      if (CONFIG.USE_MOCKS) {
        return { success: true, message: "Password reset successfully" };
      }

      // ✅ Correct endpoint (matches Django urls.py)
      const response = await client.post(`/auth/reset-password/${uidb64}/${token}`, { 
        password 
      });
      return { 
        success: true, 
        message: response.message || "Password reset successfully" 
      };
    },

    async signOut() {
      if (CONFIG.USE_MOCKS) {
        localStorage.removeItem("accessToken");
        return { success: true };
      }

      try {
        // Django doesn't have a logout endpoint, just clear local storage
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      } catch (e) {
        console.error('Logout error:', e);
      }

      return { success: true };
    },

    async getMe() {
      if (CONFIG.USE_MOCKS) {
        return { user: MOCK_DATA.user };
      }

      const token = localStorage.getItem("accessToken");
      if (!token) return { user: null };

      try {
        // ✅ FIX 5: Use correct endpoint to get current user
        const response = await client.get("/login");
        return { user: response.username ? { username: response.username } : null };
      } catch (e) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        return { user: null };
      }
    },
  },

  // --------------------------------------------------------------------------
  // POSTS
  // --------------------------------------------------------------------------
  posts: {
    async getAll(params = {}) {
      if (CONFIG.USE_MOCKS) {
        return { posts: MOCK_DATA.posts };
      }
      try {
        const response = await client.get('/posts', params);
        return { posts: response };
      } catch (e) {
        return { posts: [] };
      }
    },

    async getById(id) {
      if (CONFIG.USE_MOCKS) {
        const post = MOCK_DATA.posts.find((p) => p.id === id);
        if (!post) throw new ApiError(404, 'Post not found');
        return { post };
      }
      const response = await client.get(`/${id}`);
      return { post: response };
    },

    async create(data) {
      if (CONFIG.USE_MOCKS) {
        const newPost = {
          id: `p_${Date.now()}`,
          author: MOCK_DATA.user,
          liked: false,
          saved: false,
          likes: 0,
          comments: [],
          createdAt: 'Just now',
          ...data,
        };
        MOCK_DATA.posts.unshift(newPost);
        return { post: newPost };
      }
      const response = await client.post('/posts', data);
      return { post: response };
    },

    async like(id) {
      if (CONFIG.USE_MOCKS) {
        const post = MOCK_DATA.posts.find((p) => p.id === id);
        if (post) {
          post.liked = !post.liked;
          post.likes += post.liked ? 1 : -1;
        }
        return { liked: post?.liked, likes: post?.likes };
      }
      const response = await client.post(`/${id}/likes`);
      return response;
    },

    async save(id) {
      if (CONFIG.USE_MOCKS) {
        const post = MOCK_DATA.posts.find((p) => p.id === id);
        if (post) post.saved = !post.saved;
        return { saved: post?.saved };
      }
      const response = await client.post(`/${id}/save`);
      return response;
    },

    async addComment(postId, text) {
      if (CONFIG.USE_MOCKS) {
        const post = MOCK_DATA.posts.find((p) => p.id === postId);
        if (!post) throw new ApiError(404, 'Post not found');
        const comment = {
          id: `c_${Date.now()}`,
          author: MOCK_DATA.user,
          text,
          createdAt: 'Just now',
        };
        post.comments.push(comment);
        return { comment };
      }
      const response = await client.post(`/${postId}/comments`, { text });
      return { comment: response };
    },

    async delete(id) {
      if (CONFIG.USE_MOCKS) {
        const index = MOCK_DATA.posts.findIndex((p) => p.id === id);
        if (index !== -1) MOCK_DATA.posts.splice(index, 1);
        return { success: true };
      }
      await client.delete(`/profile`, { id });
      return { success: true };
    },
  },

  // --------------------------------------------------------------------------
  // SETTINGS
  // --------------------------------------------------------------------------
  settings: {
    async get() {
      if (CONFIG.USE_MOCKS) {
        const saved = localStorage.getItem('wsu_forum_settings');
        return { settings: saved ? JSON.parse(saved) : {} };
      }
      try {
        const response = await client.get('/settings');
        return { settings: response.user };
      } catch (e) {
        const saved = localStorage.getItem('wsu_forum_settings');
        return { settings: saved ? JSON.parse(saved) : {} };
      }
    },

    async update(settings) {
      if (CONFIG.USE_MOCKS) {
        localStorage.setItem('wsu_forum_settings', JSON.stringify(settings));
        return { success: true, settings };
      }
      try {
        const response = await client.patch('/settings', settings);
        return { success: true, settings: response };
      } catch (e) {
        localStorage.setItem('wsu_forum_settings', JSON.stringify(settings));
        return { success: true, settings };
      }
    },
  },

  // --------------------------------------------------------------------------
  // SEARCH
  // --------------------------------------------------------------------------
  search: {
    async query(searchText) {
      if (CONFIG.USE_MOCKS) {
        // Mock search results
        return {
          users: [],
          posts: [],
          subforums: [],
        };
      }
      
      try {
        const response = await client.post('/search', { searchText });
        return {
          users: response.People || [],
          posts: response.Posts || [],
          subforums: response.Subforums || [],
        };
      } catch (e) {
        console.error('Search error:', e);
        return { users: [], posts: [], subforums: [] };
      }
    },
  },

  // --------------------------------------------------------------------------
  // USER PROFILE
  // --------------------------------------------------------------------------
  users: {
    async getProfile(id) {
      if (CONFIG.USE_MOCKS) {
        return { user: MOCK_DATA.user };
      }
      const response = await client.get(`/profile`);
      return { user: response };
    },

    async updateProfile(data) {
      if (CONFIG.USE_MOCKS) {
        Object.assign(MOCK_DATA.user, data);
        return { user: MOCK_DATA.user };
      }
      const response = await client.patch('/settings', data);
      return { user: response };
    },

    async getSavedPosts() {
      if (CONFIG.USE_MOCKS) {
        const saved = MOCK_DATA.posts.filter((p) => p.saved);
        return { posts: saved };
      }
      const response = await client.get('/profile');
      return { posts: response.Saved || [] };
    },
  },

  // --------------------------------------------------------------------------
  // SUBFORUMS
  // --------------------------------------------------------------------------
  subforums: {
    async getAll(params = {}) {
      if (CONFIG.USE_MOCKS) {
        return { subforums: [] };
      }
      try {
        const response = await client.get('/subforums', params);
        return { subforums: response };
      } catch (e) {
        return { subforums: [] };
      }
    },

    async getById(id) {
      if (CONFIG.USE_MOCKS) {
        return { subforum: null };
      }
      const response = await client.get(`/subforums/${id}`);
      return { subforum: response };
    },

    async create(data) {
      if (CONFIG.USE_MOCKS) {
        return { subforum: data };
      }
      const response = await client.post('/subforums', data);
      return { subforum: response };
    },

    async subscribe(id) {
      if (CONFIG.USE_MOCKS) {
        return { success: true };
      }
      const response = await client.post(`/subforums/${id}/subscribe`);
      return response;
    },

    async unsubscribe(id) {
      if (CONFIG.USE_MOCKS) {
        return { success: true };
      }
      const response = await client.delete(`/subforums/${id}/subscribe`);
      return response;
    },
  },

  // --------------------------------------------------------------------------
  // NOTIFICATIONS
  // --------------------------------------------------------------------------
  notifications: {
    async getAll() {
      if (CONFIG.USE_MOCKS) {
        const saved = localStorage.getItem('wsu_notifications');
        if (saved) {
          return { notifications: JSON.parse(saved) };
        }
        return { notifications: [] };
      }
      try {
        return await client.get('/notifications');
      } catch (e) {
        return { notifications: [] };
      }
    },
    
    async markAsRead(notificationId) {
      if (CONFIG.USE_MOCKS) {
        return { success: true };
      }
      return client.post(`/notifications/${notificationId}/read`);
    },
    
    async markAllAsRead() {
      if (CONFIG.USE_MOCKS) {
        return { success: true };
      }
      return client.post('/notifications/read-all');
    },
  },
};

export { ApiError, CONFIG };
export default api;