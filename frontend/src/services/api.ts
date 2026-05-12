// API Base URL Configuration
// Priority: window.__API_BASE_URL__ (runtime) > VITE_API_URL env var > default localhost
// This allows runtime configuration without rebuilding
const getApiBaseUrl = (): string => {
  // ALWAYS check for runtime configuration FIRST (useful for staging/production)
  // This allows changing API URL without rebuilding
  if (typeof window !== 'undefined') {
    // Check multiple possible locations for runtime config
    const runtimeUrl = (window as any).__API_BASE_URL__ || 
                       (window as any).config?.API_URL ||
                       (window as any).ENV?.API_URL;
    
    if (runtimeUrl && runtimeUrl !== 'http://ec2-54-123-45-67.compute-1.amazonaws.com:3000') {
      // Only use runtime URL if it's not the broken EC2 URL
      console.log('[API] Using runtime API URL:', runtimeUrl);
      return runtimeUrl;
    }
  }
  
  // Check environment variable (set during build)
  // BUT ignore the broken EC2 URL if it's hardcoded
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && 
      envUrl !== 'http://ec2-54-123-45-67.compute-1.amazonaws.com:3000' &&
      !envUrl.includes('ec2-54-123-45-67')) {
    console.log('[API] Using environment API URL:', envUrl);
    return envUrl;
  }
  
  // Default to localhost for development
  console.warn('[API] Using default API URL: http://localhost:3000');
  console.warn('[API] To set a custom URL, add this to index.html:');
  console.warn('[API] <script>window.__API_BASE_URL__ = "http://your-backend-url:3000";</script>');
  return 'http://localhost:3000';
};
class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    // Add Authorization header if token exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const baseUrl = getApiBaseUrl();
      const fullUrl = `${baseUrl}${endpoint}`;
      console.log('API Request:', fullUrl);
      const response = await fetch(fullUrl, {
        ...options,
        headers,
        credentials: 'include', // Include credentials for CORS
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API Error: ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch {
          // If not JSON, use the text or status text
          errorMessage = errorText || errorMessage;
        }
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        throw error;
      }

      return response.json();
    } catch (error: any) {
      // Handle CORS errors specifically
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const baseUrl = getApiBaseUrl();
        throw new Error(`CORS Error: Unable to connect to API at ${baseUrl}. Please check that the backend server is running and CORS is properly configured.`);
      }
      throw error;
    }
  }

  // Auth endpoints
  async register(name: string, email: string, password: string, role: 'admin' | 'customer') {
    const data = await this.request<{ access_token: string; role: string; email: string; name: string }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      },
    );
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('rtlgds_user_role', data.role);
    localStorage.setItem('rtlgds_user_email', data.email);
    if (data.name) {
      localStorage.setItem('rtlgds_user_name', data.name);
    }
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{ access_token: string; role: string; email: string; name?: string }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('rtlgds_user_role', data.role);
    localStorage.setItem('rtlgds_user_email', data.email);
    if (data.name) {
      localStorage.setItem('rtlgds_user_name', data.name);
    }
    return data;
  }

  // Config endpoints
  async getConfiguration() {
    // Use public endpoint - works for both admin and customers
    return this.request('/config');
  }

  // Admin-only endpoints
  async getAdminConfiguration() {
    return this.request('/admin/config');
  }

  async setConfiguration(config: any) {
    return this.request('/admin/set', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async updateConfiguration(config: any) {
    // Use POST /admin/set for updating configuration (same as setConfiguration)
    return this.request('/admin/set', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }


  // Estimation endpoints
  async calculateCost(projectConfig: any, save: boolean = false) {
    const requestBody = {
      ...projectConfig,
      ...(save ? { save: true } : {}),
    };
    
    return this.request<{ 
      months: number;
      price: number;
      projectId?: number;
      saved?: boolean;
    }>('/estimation/calculate', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  }

  // Project endpoints
  async getAllProjects() {
    return this.request('/projects');
  }

  async getMyProjects(email?: string) {
    const url = email 
      ? `/projects/my-projects?email=${encodeURIComponent(email)}`
      : '/projects/my-projects';
    return this.request(url);
  }

  async getProjectById(id: number) {
    return this.request(`/projects/${id}`);
  }

  async checkProjectNameExists(projectName: string) {
    return this.request<{ exists: boolean; message: string }>(`/projects/check-name?name=${encodeURIComponent(projectName)}`);
  }

  async deleteProject(id: number) {
    return this.request(`/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Customer/Lead endpoints - Updated to /customer
  async sendOtp(email: string) {
    return this.request<{ message: string }>(
      '/customer/send-otp',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
    );
  }

  async verifyOtp(email: string, otpCode: string) {
    return this.request<{ message: string; verified: boolean }>(
      '/customer/verify-otp',
      {
        method: 'POST',
        body: JSON.stringify({ email, otpCode }),
      },
    );
  }

  async createLead(name: string, email: string, phone?: string, company?: string) {
    return this.request<{ id: number; name: string; email: string; phone?: string; company?: string; createdAt: string }>(
      '/customer',
      {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, company }),
      },
    );
  }

  async getLeadByEmail(email: string) {
    return this.request<{ id: number; name: string; email: string; phone?: string; company?: string; createdAt: string } | null>(
      `/customer?email=${encodeURIComponent(email)}`,
      {
        method: 'GET',
      },
    );
  }
}

export const apiService = new ApiService();