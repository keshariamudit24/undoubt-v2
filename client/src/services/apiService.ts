/// <reference types="vite/client" />
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export interface BackendUser {
  id: string;
  name: string;
  email: string;
}

export interface SignInResponse {
  msg: string;
  user: BackendUser;
}

export interface ApiError {
  error: string;
}

class ApiService {
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      console.log('📤 Sending request to:', url);
      console.log('📤 Request config:', config);

      const response = await fetch(url, config);
      console.log('📥 Response status:', response.status);

      const data = await response.json();
      console.log('📥 Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('❌ API request failed:', error);
      console.error('❌ Error details:', {
        url,
        config,
        error: error instanceof Error ? error.message : error
      });
      throw error;
    }
  }

  // Sign in user to backend database
  async signInUser(name: string, email: string): Promise<SignInResponse> {
    console.log('🌐 Making API request to backend:', { name, email });
    console.log('🔗 API URL:', `${API_BASE_URL}/auth/signin`);

    return this.makeRequest<SignInResponse>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ name, email }),
    });
  }
}

export const apiService = new ApiService();