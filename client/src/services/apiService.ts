/// <reference types="vite/client" />
import axios, { AxiosResponse } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface BackendUser {
  id: string;
  name: string;
  email: string;
}

export interface SignInResponse {
  msg: string;
  user: BackendUser;
}

export interface BackendDoubt {
  id: number;
  doubt: string;
  upvotes: number;
  user_id: number;
  room: string;
  user: {
    email: string;
  };
  answered?: boolean; // This property was missing from your provided file but is used in Room.tsx
}

export interface DoubtsResponse {
  msg: string;
  doubts: BackendDoubt[];
}

export interface ApiError {
  error: string;
}

class ApiService {
  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: any
  ): Promise<T> {
    try {
      console.log('Sending request to:', `${API_BASE_URL}${endpoint}`);
      console.log('Request method:', method);
      console.log('Request data:', data);

      const response = await axiosInstance.request<T>({
        url: endpoint,
        method,
        data,
      });

      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      return response.data;
    } catch (error) {
      console.error('API request failed:', error);

      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error ||
                           error.response?.data?.message ||
                           error.message ||
                           'Network request failed';
        console.error('Error details:', {
          endpoint,
          method,
          data,
          status: error.response?.status,
          message: errorMessage
        });
        throw new Error(errorMessage);
      }

      throw new Error('Network request failed');
    }
  }

  // Sign in user to backend database
  async signInUser(name: string, email: string): Promise<SignInResponse> {
    console.log('Making API request to backend:', { name, email });
    console.log('API URL:', `${API_BASE_URL}/auth/signin`);

    return this.makeRequest<SignInResponse>('/auth/signin', 'POST', { name, email });
  }

  // Fetch all doubts for a room
  async getRoomDoubts(roomId: string): Promise<DoubtsResponse> {
    console.log('Fetching doubts for room:', roomId);
    console.log('API URL:', `${API_BASE_URL}/doubts/get-all?roomId=${roomId}`);

    return this.makeRequest<DoubtsResponse>(`/doubts/get-all?roomId=${encodeURIComponent(roomId)}`, 'GET');
  }
}

export const apiService = new ApiService();