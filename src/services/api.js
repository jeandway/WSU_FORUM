/**
 * API Service Layer
 * =================
 * Centralized API configuration and methods.
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  BASE_URL: 'http://localhost:5000/api',  // Backend API URL
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
      credentials: 'include',  // Important for cookies
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
      
      // Handle empty responses
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      
      if (!response.ok) {
        // Extract user-friendly error message
        const errorMessage = data.message || data.Message || 'Request failed';
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
// MOCK DATA
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

  posts: [],  // Posts are now in PostContext with more realistic mock data

  topics: [
    { id: 't1', name: 'Announcements', description: 'Official WSU announcements', followers: 1234, color: '#0c5449' },
    { id: 't2', name: 'CS & AI', description: 'Computer Science and AI discussions', followers: 856, color: '#3b82f6' },
    { id: 't3', name: 'Events', description: 'Campus events and activities', followers: 2103, color: '#f59e0b' },
    { id: 't4', name: 'Housing', description: 'Housing and roommate finder', followers: 445, color: '#8b5cf6' },
    { id: 't5', name: 'Marketplace', description: 'Buy, sell, and trade', followers: 678, color: '#10b981' },
    { id: 't6', name: 'Study Groups', description: 'Find study partners', followers: 523, color: '#ec4899' },
    { id: 't7', name: 'Career', description: 'Jobs, internships, and career advice', followers: 892, color: '#6366f1' },
    { id: 't8', name: 'Sports', description: 'WSU athletics and intramurals', followers: 1567, color: '#ef4444' },
  ],

  events: [
    { 
      id: 'e1', 
      title: 'AI/ML Club Meetup', 
      description: 'Monthly meetup to discuss latest AI trends and projects.',
      date: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '18:00',
      place: 'Prentis 2F', 
      going: 42,
      interested: 78,
      organizer: 'AI/ML Club',
    },
    { 
      id: 'e2', 
      title: 'Robotics Demo Night', 
      description: 'See student robotics projects in action!',
      date: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '19:00',
      place: 'Engineering 1500', 
      going: 87,
      interested: 156,
      organizer: 'WSU Robotics',
    },
    { 
      id: 'e3', 
      title: 'Winter Career Fair', 
      description: 'Connect with top employers recruiting WSU students.',
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '10:00',
      place: 'Student Center Ballroom', 
      going: 256,
      interested: 890,
      organizer: 'Career Services',
    },
    { 
      id: 'e4', 
      title: 'Study Jam: Finals Week', 
      description: 'Group study session with free coffee and snacks.',
      date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: '14:00',
      place: 'Library 3rd Floor', 
      going: 34,
      interested: 89,
      organizer: 'Student Government',
    },
  ],
};

// ============================================================================
// MOCK API HELPERS
// ============================================================================

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mockResponse = async (data, delayMs = 300) => {
  await delay(delayMs);
  return JSON.parse(JSON.stringify(data)); // Deep clone
};

// ============================================================================
// API SERVICE
// ============================================================================

const client = new ApiClient(CONFIG.BASE_URL);

export const api = {
  // --------------------------------------------------------------------------
  // AUTH
  // --------------------------------------------------------------------------
  auth: {
    async signInWithSSO() {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ user: MOCK_DATA.user, token: 'mock_token_123' }, 600);
      }
      return client.post('/auth/sso');
    },

    async signIn(email, password) {
      if (CONFIG.USE_MOCKS) {
        await delay(500);
        if (email && password) {
          return { success: true, user: MOCK_DATA.user, accessToken: 'mock_token_123' };
        }
        throw new ApiError(401, 'Invalid email or password');
      }
      
      // Real API call
      const response = await client.post('/auth/login', { email, password });
      
      // Store token if successful
      if (response.success && response.accessToken) {
        localStorage.setItem('accessToken', response.accessToken);
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
        return mockResponse({ 
          success: true,
          user: { ...MOCK_DATA.user, ...data }, 
          accessToken: 'mock_token_123',
          message: 'Account created! Please check your email to verify.'
        }, 600);
      }
      
      // Real API call
      const response = await client.post('/auth/register', {
        email: data.email,
        password: data.password,
        name: data.name,
        role: 1,  // Student = 1
        major: data.major || null,
        year: data.year || null,
      });
      
      // Store token if successful
      if (response.success && response.accessToken) {
        localStorage.setItem('accessToken', response.accessToken);
      }
      
      return {
        user: response.user,
        token: response.accessToken,
        success: response.success,
        message: response.message,
      };
    },

    async signOut() {
      if (CONFIG.USE_MOCKS) {
        localStorage.removeItem('accessToken');
        return mockResponse({ success: true }, 200);
      }
      
      try {
        await client.post('/auth/logout');
      } catch (e) {
        // Ignore logout errors
      } finally {
        localStorage.removeItem('accessToken');
      }
      return { success: true };
    },

    async verifyEmail(email, code) {
      if (CONFIG.USE_MOCKS) {
        await delay(400);
        if (code === '123456') {
          return { success: true, message: 'Email verified!' };
        }
        throw new ApiError(400, 'Invalid verification code');
      }
      return client.post('/auth/verify-email', { email, code });
    },

    async forgotPassword(email) {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ success: true, message: 'Reset email sent' }, 400);
      }
      return client.post('/auth/forgot-password', { email });
    },

    async getMe() {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ user: MOCK_DATA.user });
      }
      
      const token = localStorage.getItem('accessToken');
      if (!token) return { user: null };
      
      try {
        return await client.get('/users/me');
      } catch (e) {
        localStorage.removeItem('accessToken');
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
        let posts = [...MOCK_DATA.posts];
        if (params.topicId) {
          posts = posts.filter((p) => p.topicId === params.topicId);
        }
        return mockResponse({ posts });
      }
      try {
        return await client.get('/posts', params);
      } catch (e) {
        return { posts: [] };
      }
    },

    async getById(id) {
      if (CONFIG.USE_MOCKS) {
        const post = MOCK_DATA.posts.find((p) => p.id === id);
        if (!post) throw new ApiError(404, 'Post not found');
        return mockResponse({ post });
      }
      return client.get(`/posts/${id}`);
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
        return mockResponse({ post: newPost }, 400);
      }
      return client.post('/posts', data);
    },

    async update(id, data) {
      if (CONFIG.USE_MOCKS) {
        const index = MOCK_DATA.posts.findIndex((p) => p.id === id);
        if (index === -1) throw new ApiError(404, 'Post not found');
        MOCK_DATA.posts[index] = { ...MOCK_DATA.posts[index], ...data };
        return mockResponse({ post: MOCK_DATA.posts[index] });
      }
      return client.patch(`/posts/${id}`, data);
    },

    async delete(id) {
      if (CONFIG.USE_MOCKS) {
        const index = MOCK_DATA.posts.findIndex((p) => p.id === id);
        if (index !== -1) MOCK_DATA.posts.splice(index, 1);
        return mockResponse({ success: true });
      }
      return client.delete(`/posts/${id}`);
    },

    async like(id) {
      if (CONFIG.USE_MOCKS) {
        const post = MOCK_DATA.posts.find((p) => p.id === id);
        if (post) {
          post.liked = !post.liked;
          post.likes += post.liked ? 1 : -1;
        }
        return mockResponse({ liked: post?.liked, likes: post?.likes });
      }
      return client.post(`/posts/${id}/like`);
    },

    async save(id) {
      if (CONFIG.USE_MOCKS) {
        const post = MOCK_DATA.posts.find((p) => p.id === id);
        if (post) post.saved = !post.saved;
        return mockResponse({ saved: post?.saved });
      }
      return client.post(`/posts/${id}/save`);
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
        return mockResponse({ comment });
      }
      return client.post(`/posts/${postId}/comments`, { text });
    },
  },

  // --------------------------------------------------------------------------
  // TOPICS
  // --------------------------------------------------------------------------
  topics: {
    async getAll() {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ topics: MOCK_DATA.topics }, 200);
      }
      try {
        return await client.get('/topics');
      } catch (e) {
        return { topics: MOCK_DATA.topics };
      }
    },

    async getById(id) {
      if (CONFIG.USE_MOCKS) {
        const topic = MOCK_DATA.topics.find((t) => t.id === id);
        if (!topic) throw new ApiError(404, 'Topic not found');
        return mockResponse({ topic });
      }
      return client.get(`/topics/${id}`);
    },

    async follow(id) {
      if (CONFIG.USE_MOCKS) {
        const topic = MOCK_DATA.topics.find((t) => t.id === id);
        if (topic) topic.followers += 1;
        return mockResponse({ followed: true });
      }
      return client.post(`/topics/${id}/follow`);
    },

    async unfollow(id) {
      if (CONFIG.USE_MOCKS) {
        const topic = MOCK_DATA.topics.find((t) => t.id === id);
        if (topic) topic.followers -= 1;
        return mockResponse({ followed: false });
      }
      return client.delete(`/topics/${id}/follow`);
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
        return await client.get('/events', params);
      } catch (e) {
        return { events: MOCK_DATA.events };
      }
    },

    async getById(id) {
      if (CONFIG.USE_MOCKS) {
        const event = MOCK_DATA.events.find((e) => e.id === id);
        if (!event) throw new ApiError(404, 'Event not found');
        return mockResponse({ event });
      }
      return client.get(`/events/${id}`);
    },

    async rsvp(id, status) {
      if (CONFIG.USE_MOCKS) {
        const event = MOCK_DATA.events.find((e) => e.id === id);
        if (event && status === 'going') event.going += 1;
        if (event && status === 'interested') event.interested += 1;
        return mockResponse({ status });
      }
      return client.post(`/events/${id}/rsvp`, { status });
    },
  },

  // --------------------------------------------------------------------------
  // USER / PROFILE
  // --------------------------------------------------------------------------
  users: {
    async getProfile(id) {
      if (CONFIG.USE_MOCKS) {
        return mockResponse({ user: MOCK_DATA.user });
      }
      return client.get(`/users/${id}`);
    },

    async updateProfile(data) {
      if (CONFIG.USE_MOCKS) {
        Object.assign(MOCK_DATA.user, data);
        return mockResponse({ user: MOCK_DATA.user });
      }
      return client.patch('/users/me', data);
    },

    async getSavedPosts() {
      if (CONFIG.USE_MOCKS) {
        const saved = MOCK_DATA.posts.filter((p) => p.saved);
        return mockResponse({ posts: saved });
      }
      return client.get('/users/me/saved');
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
      return client.post('/reports', { type, targetId, reason });
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
        return await client.get('/users/me/settings');
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
        return await client.patch('/users/me/settings', settings);
      } catch (e) {
        localStorage.setItem('wsu_forum_settings', JSON.stringify(settings));
        return { success: true, settings };
      }
    },
  },
};

// Export for direct use
export { ApiError, CONFIG };
export default api;
