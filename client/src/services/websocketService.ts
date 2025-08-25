/// <reference types="vite/client" />

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';

export interface Doubt {
  id: number;
  doubt: string;
  upvotes: number;
  user_id: number;
  userEmail?: string;
  room: string;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
  messageType?: string;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageHandlers: Map<string, (data: any) => void> = new Map();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // If already connected, resolve immediately
      if (this.isConnected()) {
        resolve();
        return;
      }

      try {
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('📥 Received message:', message);
            
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
              handler(message.payload);
            }
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error);
          }
        };

        this.ws.onclose = () => {
          console.log('🔌 WebSocket disconnected');
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private send(message: WebSocketMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('📤 Sending message:', message);
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('❌ WebSocket not connected');
      throw new Error('WebSocket not connected');
    }
  }

  // Room management
  createRoom(email: string, roomId: string) {
    this.send({
      type: 'create',
      payload: { email, roomId }
    });
  }

  joinRoom(email: string, roomId: string) {
    this.send({
      type: 'join',
      payload: { email, roomId }
    });
  }

  leaveRoom(roomId: string) {
    this.send({
      type: 'leave',
      payload: { roomId }
    });
  }

  closeRoom(roomId: string) {
    this.send({
      type: 'close',
      payload: { roomId }
    });
  }

  // Doubt management
  askDoubt(email: string, roomId: string, msg: string) {
    this.send({
      type: 'ask-doubt',
      payload: { email, roomId, msg }
    });
  }

  upvoteDoubt(roomId: string, doubtId: number) {
    this.send({
      type: 'upvote',
      payload: { roomId, doubtId }
    });
  }

  downvoteDoubt(roomId: string, doubtId: number) {
    this.send({
      type: 'downvote',
      payload: { roomId, doubtId }
    });
  }

  // Event handlers
  onMessage(type: string, handler: (data: any) => void) {
    this.messageHandlers.set(type, handler);
  }

  offMessage(type: string) {
    this.messageHandlers.delete(type);
  }

  // Clear all message handlers
  clearHandlers() {
    this.messageHandlers.clear();
  }

  // Utility method to generate room ID
  generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

export const wsService = new WebSocketService();
