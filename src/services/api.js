/**
 * API Service Layer - Fixed for Django Backend
 * ================================================
 * Configured to work with WSU Forum Django backend
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  BASE_URL: 'http://127.0.0.1:8000',  // Django backend URL
  TIMEOUT: 10000,
  USE_MOCKS: false,
};

// ============================================================================
// HTTP CLIENT
// ============================================================================

class ApiClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
  }

  async request(endpoint, options = {}) {
    // Remove trailing slash from endpoint to match Django URLs
    const cleanEndpoint = endpoint.endsWith('/') ? endpoint.slice(0, -1) : endpoint;
    const url = `${this.baseURL}${cleanEndpoint}`;
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    // Add auth token if available
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log(`API Request: ${options.method || 'GET'} ${url}`); // Debug log

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
      
      const response = await fetch(url, { ...config, signal: controller.signal });
      clearTimeout(timeoutId);
      
      // Handle empty responses
      const text = await response.text();
      let data = {};
      
      try {
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error('JSON Parse Error:', text.substring(0, 200));
        throw new ApiError(response.status, 'Invalid response from server');
      }
      
      if (!response.ok) {
        const errorMessage = data.message || data.detail || data.error || 
          (typeof data === 'object' ? Object.values(data)[0]?.[0] : null) ||
          'Request failed';
        throw new ApiError(response.status, errorMessage);
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      
      if (error.name === 'AbortError') {
        throw new ApiError(0, 'Request timed out. Please try again.');
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

  delete(endpoint, data) {
    return this.request(endpoint, { 
      method: 'DELETE',
      body: data ? JSON.stringify(data) : undefined,
    });
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
// MOCK DATA (for development when backend is unavailable)
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
  topics: [
    { id: 't1', name: 'Announcements', description: 'Official WSU announcements', followers: 1234, color: '#0c5449' },
    { id: 't2', name: 'CS & AI', description: 'Computer Science and AI discussions', followers: 856, color: '#3b82f6' },
  ],
  events: [
    { 
      id: 'e1', 
      title: 'AI/ML Club Meetup', 
      description: 'Monthly meetup to discuss latest AI trends.',
      date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '18:00',
      place: 'Prentis 2F', 
      going: 42,
    },
  ],
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mockResponse = async (data, delayMs = 300) => {
  await delay(delayMs);
  return JSON.parse(JSON.stringify(data));
};

// ============================================================================
// API SERVICE
// ============================================================================

const client = new ApiClient(CONFIG.BASE_URL);

export const api = {
  // --------------------------------------------------------------------------
  // AUTH - Maps frontend auth to Django endpoints
  // --------------------------------------------------------------------------
  auth: {
    /**
     * Sign in with SSO (not implemented in backend yet)
     */
    async signInWithSSO() {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ user: MOCK_DATA.user, token: 'mock_token_123' }, 600);
      }
      throw new ApiError(501, 'SSO not implemented yet');
    },

    /**
     * Sign in with username/password
     * Django endpoint: POST /login (NO trailing slash)
     */
    async signIn(email, password) {
      if (CONFIG.USE_MOCKS) {
        await delay(500);
        if (email && password) {
          return { success: true, user: MOCK_DATA.user, accessToken: 'mock_token_123' };
        }
        throw new ApiError(401, 'Invalid email or password');
      }
      
      // Extract username from email (before @)
      const username = email.includes('@') ? email.split('@')[0] : email;
      
      // Try the custom login endpoint first
      try {
        const response = await client.post('/login', { 
          username: username,
          password: password 
        });
        
        // Store tokens if returned
        if (response.access) {
          localStorage.setItem('accessToken', response.access);
          localStorage.setItem('refreshToken', response.refresh);
        } else if (response.token) {
          localStorage.setItem('accessToken', response.token);
        }
        
        // Get user info after login
        const userInfo = await this.getMe();
        
        return {
          success: true,
          user: userInfo.user,
          accessToken: response.access || response.token,
          message: response.message,
        };
      } catch (error) {
        // If custom login fails, try JWT token endpoint
        if (error.status === 404) {
          const response = await client.post('/api/token', { 
            username: username,
            password: password 
          });
          
          if (response.access) {
            localStorage.setItem('accessToken', response.access);
            localStorage.setItem('refreshToken', response.refresh);
          }
          
          const userInfo = await this.getMe();
          
          return {
            success: true,
            user: userInfo.user,
            accessToken: response.access,
          };
        }
        throw error;
      }
    },

    /**
     * Sign up / Register
     * Django endpoint: POST /register (NO trailing slash)
     */
    async signUp(data) {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ 
          success: true,
          user: { ...MOCK_DATA.user, ...data }, 
          accessToken: 'mock_token_123',
          message: 'Account created! Please check your email to verify.'
        }, 600);
      }
      
      // Map frontend data to Django backend format
      const backendData = {
        username: data.email.split('@')[0],
        email: data.email,
        password: data.password,
        pass2: data.confirmPassword || data.password,
        role: data.role || 'student',
        major: data.major || '',
        classification: data.year || data.classification || 'Freshman',
        department: data.department || '',
      };
      
      console.log('Sending registration data:', backendData); // Debug log
      
      const response = await client.post('/register', backendData);
      
      return {
        success: true,
        user: response,
        message: response.message || 'Account created! Please check your email to verify.',
      };
    },

    /**
     * Sign out
     */
    async signOut() {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return { success: true };
    },

    /**
     * Verify email - Django uses link-based verification
     * Django endpoint: GET /activate/<uidb64>/<token>
     */
    async verifyEmail(email, code) {
      if (CONFIG.USE_MOCKS) {
        await delay(400);
        if (code === '123456') {
          return { success: true, message: 'Email verified!' };
        }
        throw new ApiError(400, 'Invalid verification code');
      }
      throw new ApiError(400, 'Please click the verification link in your email');
    },

    /**
     * Get current user info
     * Django endpoint: GET /settings (NO trailing slash)
     */
    async getMe() {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ user: MOCK_DATA.user });
      }
      
      const token = localStorage.getItem('accessToken');
      if (!token) return { user: null };
      
      try {
        const settings = await client.get('/settings');
        
        return {
          user: {
            id: settings.user?.id || 'current_user',
            name: settings.user?.username || 'User',
            username: settings.user?.username,
            email: settings.user?.email || '',
            role: settings.user?.role || 'Student',
            major: settings.user?.Major,
            classification: settings.user?.Class,
            department: settings.user?.Department,
            bio: settings.user?.Bio || '',
            avatar: settings.user?.Profile_Picture || '',
          }
        };
      } catch (e) {
        console.error('Error getting user:', e);
        if (e.status === 401) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
        return { user: null };
      }
    },

    /**
     * Forgot password
     * Django endpoint: POST /reset
     */
    async forgotPassword(email) {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ success: true, message: 'Reset email sent' }, 400);
      }
      return client.post('/reset', { email });
    },
  },

  // --------------------------------------------------------------------------
  // POSTS
  // --------------------------------------------------------------------------
  posts: {
    /**
     * Get all posts
     * Django endpoint: GET /posts (NO trailing slash)
     */
    async getAll(params = {}) {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ posts: MOCK_DATA.posts });
      }
      
      try {
        const posts = await client.get('/posts', params);
        
        const transformedPosts = Array.isArray(posts) ? posts.map(post => ({
          id: post.id,
          title: post.title,
          body: post.body,
          author: {
            id: post.user,
            name: post.user,
            avatar: post.profile_picture || '',
          },
          subforumId: post.subforum?.id || null,
          subforumName: post.subforum?.name || null,
          likes: post.like_amt || 0,
          comments: [],
          liked: false,
          saved: false,
          createdAt: post.created_at,
          contentType: post.event_start ? 'event' : 'discussion',
          eventDate: post.event_start,
          image: post.image,
        })) : [];
        
        return { posts: transformedPosts };
      } catch (e) {
        console.error('Error fetching posts:', e);
        return { posts: [] };
      }
    },

    /**
     * Get single post
     * Django endpoint: GET /<post_id> (NO trailing slash)
     */
    async getById(id) {
      if (CONFIG.USE_MOCKS) {
        const post = MOCK_DATA.posts.find((p) => p.id === id);
        if (!post) throw new ApiError(404, 'Post not found');
        return mockResponse({ post });
      }
      
      const post = await client.get(`/${id}`);
      return { 
        post: {
          id: post.id,
          title: post.title,
          body: post.body,
          author: {
            id: post.user,
            name: post.user,
            avatar: post.profile_picture,
          },
          likes: post.likes?.length || 0,
          comments: post.comments?.map(c => ({
            id: c.id,
            author: { name: c.user },
            text: c.body,
            createdAt: c.created_at,
          })) || [],
          createdAt: post.created_at,
        }
      };
    },

    /**
     * Create post
     * Django endpoint: POST /posts (NO trailing slash)
     */
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
        return mockResponse({ post: newPost }, 400);
      }
      
      const backendData = {
        title: data.title,
        body: data.body,
        subforum_id: data.subforumId || null,
        event_start: data.eventDate ? `${data.eventDate}T${data.eventTime || '00:00'}:00Z` : null,
      };
      
      const response = await client.post('/posts', backendData);
      return { post: response, success: true };
    },

    /**
     * Delete post
     */
    async delete(id) {
      if (CONFIG.USE_MOCKS) {
        const index = MOCK_DATA.posts.findIndex((p) => p.id === id);
        if (index !== -1) MOCK_DATA.posts.splice(index, 1);
        return mockResponse({ success: true });
      }
      
      return client.delete(`/profile`, { id });
    },

    /**
     * Like/unlike post
     * Django endpoint: POST /<post_id>/likes (NO trailing slash)
     */
    async like(id) {
      if (CONFIG.USE_MOCKS) {
        const post = MOCK_DATA.posts.find((p) => p.id === id);
        if (post) {
          post.liked = !post.liked;
          post.likes += post.liked ? 1 : -1;
        }
        return mockResponse({ liked: post?.liked, likes: post?.likes });
      }
      
      return client.post(`/${id}/likes`, {});
    },

    /**
     * Save/unsave post
     * Django endpoint: POST /<post_id>/save (NO trailing slash)
     */
    async save(id) {
      if (CONFIG.USE_MOCKS) {
        const post = MOCK_DATA.posts.find((p) => p.id === id);
        if (post) post.saved = !post.saved;
        return mockResponse({ saved: post?.saved });
      }
      
      return client.post(`/${id}/save`, {});
    },

    /**
     * Add comment
     * Django endpoint: POST /<post_id>/comments (NO trailing slash)
     */
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
        return mockResponse({ comment });
      }
      
      return client.post(`/${postId}/comments`, { body: text });
    },

    /**
     * Update post
     */
    async update(id, data) {
      if (CONFIG.USE_MOCKS) {
        const index = MOCK_DATA.posts.findIndex((p) => p.id === id);
        if (index === -1) throw new ApiError(404, 'Post not found');
        MOCK_DATA.posts[index] = { ...MOCK_DATA.posts[index], ...data };
        return mockResponse({ post: MOCK_DATA.posts[index] });
      }
      
      throw new ApiError(501, 'Post update not implemented in backend');
    },
  },

  // --------------------------------------------------------------------------
  // SUBFORUMS
  // --------------------------------------------------------------------------
  subforums: {
    /**
     * Get all subforums
     * Django endpoint: GET /subforums (NO trailing slash)
     */
    async getAll(params = {}) {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ subforums: [] });
      }
      
      try {
        const subforums = await client.get('/subforums', params);
        return { subforums: Array.isArray(subforums) ? subforums : [] };
      } catch (e) {
        console.error('Error fetching subforums:', e);
        return { subforums: [] };
      }
    },

    /**
     * Get single subforum
     * Django endpoint: GET /subforums/<id> (NO trailing slash)
     */
    async getById(id) {
      const subforum = await client.get(`/subforums/${id}`);
      return { subforum };
    },

    /**
     * Get subforum posts
     * Django endpoint: GET /subforums/<id>/posts (NO trailing slash)
     */
    async getPosts(id, params = {}) {
      const response = await client.get(`/subforums/${id}/posts`, params);
      return response;
    },

    /**
     * Create subforum
     * Django endpoint: POST /subforums (NO trailing slash)
     */
    async create(data) {
      return client.post('/subforums', data);
    },

    /**
     * Subscribe to subforum
     * Django endpoint: POST /subforums/<id>/subscribe (NO trailing slash)
     */
    async subscribe(id) {
      return client.post(`/subforums/${id}/subscribe`, {});
    },

    /**
     * Unsubscribe from subforum
     * Django endpoint: DELETE /subforums/<id>/subscribe (NO trailing slash)
     */
    async unsubscribe(id) {
      return client.delete(`/subforums/${id}/subscribe`);
    },

    /**
     * Get trending subforums
     * Django endpoint: GET /subforums/trending (NO trailing slash)
     */
    async getTrending() {
      const subforums = await client.get('/subforums/trending');
      return { subforums };
    },
  },

  // --------------------------------------------------------------------------
  // TOPICS (uses subforums on backend)
  // --------------------------------------------------------------------------
  topics: {
    async getAll() {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ topics: MOCK_DATA.topics }, 200);
      }
      
      try {
        const tags = await client.get('/subforums/tags');
        return { topics: tags };
      } catch (e) {
        return { topics: MOCK_DATA.topics };
      }
    },

    async follow(id) {
      return mockResponse({ followed: true });
    },

    async unfollow(id) {
      return mockResponse({ followed: false });
    },
  },

  // --------------------------------------------------------------------------
  // EVENTS
  // --------------------------------------------------------------------------
  events: {
    async getAll(params = {}) {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ events: MOCK_DATA.events }, 200);
      }
      
      try {
        const posts = await client.get('/posts');
        const events = posts.filter(p => p.event_start).map(p => ({
          id: p.id,
          title: p.title,
          description: p.body,
          date: p.event_start,
          place: '',
          going: 0,
          interested: 0,
        }));
        return { events };
      } catch (e) {
        return { events: MOCK_DATA.events };
      }
    },

    async rsvp(id, status) {
      return mockResponse({ status });
    },
  },

  // --------------------------------------------------------------------------
  // USER / PROFILE
  // --------------------------------------------------------------------------
  users: {
    /**
     * Get profile
     * Django endpoint: GET /profile (NO trailing slash)
     */
    async getProfile(id) {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ user: MOCK_DATA.user });
      }
      return client.get('/profile');
    },

    /**
     * Update profile
     * Django endpoint: PATCH /settings (NO trailing slash)
     */
    async updateProfile(data) {
      if (CONFIG.USE_MOCKS) {
        Object.assign(MOCK_DATA.user, data);
        return mockResponse({ user: MOCK_DATA.user });
      }
      
      return client.patch('/settings', data);
    },

    /**
     * Get saved posts
     */
    async getSavedPosts() {
      if (CONFIG.USE_MOCKS) {
        const saved = MOCK_DATA.posts.filter((p) => p.saved);
        return mockResponse({ posts: saved });
      }
      
      const profile = await client.get('/profile');
      return { posts: profile.Saved || [] };
    },
  },

  // --------------------------------------------------------------------------
  // SEARCH
  // --------------------------------------------------------------------------
  search: {
    /**
     * Search posts and users
     * Django endpoint: POST /search (NO trailing slash)
     */
    async search(query) {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ People: [], Posts: [] });
      }
      
      return client.post('/search', { searchText: query });
    },
  },

  // --------------------------------------------------------------------------
  // SETTINGS
  // --------------------------------------------------------------------------
  settings: {
    async get() {
      if (CONFIG.USE_MOCKS) {
        const saved = localStorage.getItem('wsu_forum_settings');
        return mockResponse({ settings: saved ? JSON.parse(saved) : {} });
      }
      
      try {
        const response = await client.get('/settings');
        return { settings: response.user || {} };
      } catch (e) {
        const saved = localStorage.getItem('wsu_forum_settings');
        return { settings: saved ? JSON.parse(saved) : {} };
      }
    },

    async update(settings) {
      if (CONFIG.USE_MOCKS) {
        localStorage.setItem('wsu_forum_settings', JSON.stringify(settings));
        return mockResponse({ success: true, settings });
      }
      
      try {
        return await client.patch('/settings', settings);
      } catch (e) {
        localStorage.setItem('wsu_forum_settings', JSON.stringify(settings));
        return { success: true, settings };
      }
    },
  },

  // --------------------------------------------------------------------------
  // REPORTS
  // --------------------------------------------------------------------------
  reports: {
    async create({ type, targetId, reason }) {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ success: true, reportId: `r_${Date.now()}` }, 350);
      }
      
      if (type === 'subforum') {
        return client.post(`/subforums/${targetId}/report`, { reason });
      }
      
      throw new ApiError(501, 'Report type not implemented');
    },
  },
};

// Export for direct use
export { ApiError, CONFIG };
export default api;
