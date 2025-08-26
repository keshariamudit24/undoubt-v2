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

  // Store room state for reconnection
  private currentRoom: { roomId: string; email: string; isAdmin: boolean } | null = null;
  private reconnectionCallbacks: (() => void)[] = [];

  constructor() {
    // Load persisted room state when service initializes
    this.loadPersistedState();
  }

  // Save room state to localStorage
  private persistState() {
    if (this.currentRoom) {
      localStorage.setItem('undoubt_room', JSON.stringify(this.currentRoom));
      console.log('💾 Room state persisted to localStorage:', this.currentRoom);
    } else {
      localStorage.removeItem('undoubt_room');
      console.log('🗑️ Room state cleared from localStorage');
    }
  }

  // Load room state from localStorage
  private loadPersistedState() {
    try {
      const savedState = localStorage.getItem('undoubt_room');
      if (savedState) {
        this.currentRoom = JSON.parse(savedState);
        console.log('📂 Room state loaded from localStorage:', this.currentRoom);
      }
    } catch (error) {
      console.error('Failed to load persisted state:', error);
      localStorage.removeItem('undoubt_room');
    }
  }

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

          // If we have a stored room, rejoin it after reconnection
          if (this.currentRoom) {
            console.log('🔄 Rejoining room after reconnection:', this.currentRoom.roomId);
            const roomToRejoin = { ...this.currentRoom }; // Create a copy to avoid overwriting

            if (roomToRejoin.isAdmin) {
              this.send({
                type: 'create',
                payload: { email: roomToRejoin.email, roomId: roomToRejoin.roomId }
              });
            } else {
              this.send({
                type: 'join',
                payload: { email: roomToRejoin.email, roomId: roomToRejoin.roomId }
              });
            }
          }

          // Execute any pending reconnection callbacks
          this.reconnectionCallbacks.forEach(callback => callback());
          this.reconnectionCallbacks = [];

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
          console.log('🔌 WebSocket disconnected. Current room state:', this.currentRoom);
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
        this.connect().catch((error) => {
          console.error('❌ Reconnection failed:', error);
          // Continue trying to reconnect
          this.attemptReconnect();
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached. Please refresh the page.');
    }
  }

  disconnect(clearRoomState: boolean = false) {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Only clear room state if explicitly requested (for permanent disconnection)
    if (clearRoomState) {
      this.currentRoom = null;
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
    // Store room state for reconnection
    this.currentRoom = { roomId, email, isAdmin: true };
    console.log('💾 Stored room state for reconnection:', this.currentRoom);
    this.persistState(); // Save to localStorage

    this.send({
      type: 'create',
      payload: { email, roomId }
    });
  }

  joinRoom(email: string, roomId: string) {
    // Store room state for reconnection
    this.currentRoom = { roomId, email, isAdmin: false };
    console.log('💾 Stored room state for reconnection:', this.currentRoom);
    this.persistState(); // Save to localStorage

    this.send({
      type: 'join',
      payload: { email, roomId }
    });
  }

  leaveRoom(roomId: string) {
    // Clear room state when leaving
    this.currentRoom = null;
    console.log('🚪 Left room, cleared room state');
    this.persistState(); // Remove from localStorage

    this.send({
      type: 'leave',
      payload: { roomId }
    });
  }

  closeRoom(roomId: string) {
    // Clear room state when closing
    this.currentRoom = null;
    this.persistState(); // Remove from localStorage

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

  // Register callback for when reconnection happens
  onReconnect(callback: () => void) {
    this.reconnectionCallbacks.push(callback);
  }

  // Get current room info
  getCurrentRoom() {
    return this.currentRoom;
  }

  // Check if currently in a specific room
  isInRoom(roomId: string): boolean {
    return this.currentRoom?.roomId === roomId;
  }

  // Check if user is admin of a room
  checkAdminStatus(email: string, roomId: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message = {
      type: 'check-admin',
      payload: {
        email,
        roomId
      }
    };

    this.ws.send(JSON.stringify(message));
  }

  // Utility method to generate room ID
  generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}

export const wsService = new WebSocketService();
