import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { wsService, Doubt } from '../services/websocketService';
import { useAuth } from '../contexts/AuthContext';

interface RoomProps {
  roomId: string;
  isAdmin: boolean;
  onLeaveRoom: () => void;
}

const Room: React.FC<RoomProps> = ({ roomId, isAdmin, onLeaveRoom }) => {
  const { user } = useAuth();
  const [doubts, setDoubts] = useState<Doubt[]>([]);
  const [visibleEmails, setVisibleEmails] = useState<Set<number>>(new Set());
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [newDoubt, setNewDoubt] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // Generate QR code
  useEffect(() => {
    const generateQR = async () => {
      try {
        const joinUrl = `${window.location.origin}?roomId=${roomId}`;
        const qrUrl = await QRCode.toDataURL(joinUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: '#06b6d4', // cyan-500
            light: '#18181b', // zinc-900
          },
        });
        setQrCodeUrl(qrUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };
    generateQR();
  }, [roomId]);

  // WebSocket connection and event handlers
  useEffect(() => {
    const connectAndJoin = async () => {
      try {
        // Check if already connected, if not connect
        if (!wsService.isConnected()) {
          await wsService.connect();
        }
        setIsConnected(true);

        // Clear any existing handlers to avoid conflicts
        wsService.clearHandlers();

        if (isAdmin) {
          wsService.createRoom(user?.email || '', roomId);
        }
        // Note: For non-admin users, the join was already handled in Dashboard
        // We don't call joinRoom again here to avoid conflicts

        // Set up message handlers for room functionality
        wsService.onMessage('error', (data) => {
          // Only show errors that aren't related to joining (those are handled in Dashboard)
          if (!data.msg?.includes('Invalid room Id')) {
            toast.error(data.msg || 'An error occurred');
          }
        });

        wsService.onMessage('new doubt triggered', (data) => {
          // Add new doubt to the list
          const newDoubt: Doubt = {
            id: Date.now(), // Temporary ID
            doubt: data.doubt,
            upvotes: 0,
            user_id: 0,
            userEmail: data.userEmail, // Don't default to 'Anonymous', use actual email or undefined
            room: roomId,
          };
          setDoubts(prev => [...prev, newDoubt]);
        });

        wsService.onMessage('upvote triggered', (data) => {
          setDoubts(prev => prev.map(doubt =>
            doubt.id === data.doubtId
              ? { ...doubt, upvotes: doubt.upvotes + 1 }
              : doubt
          ));
        });

        wsService.onMessage('downvote triggered', (data) => {
          setDoubts(prev => prev.map(doubt =>
            doubt.id === data.doubtId
              ? { ...doubt, upvotes: Math.max(0, doubt.upvotes - 1) }
              : doubt
          ));
        });

      } catch (error) {
        console.error('Failed to setup room:', error);
        setIsConnected(false);
      }
    };

    connectAndJoin();

    return () => {
      // Clean up handlers when component unmounts
      wsService.clearHandlers();
      setIsConnected(false);
    };
  }, [roomId, isAdmin, user?.email]);

  const handleSubmitDoubt = () => {
    if (newDoubt.trim() && user?.email) {
      wsService.askDoubt(user.email, roomId, newDoubt.trim());
      setNewDoubt('');
    }
  };

  const handleUpvote = (doubtId: number) => {
    wsService.upvoteDoubt(roomId, doubtId);
  };

  const handleDownvote = (doubtId: number) => {
    wsService.downvoteDoubt(roomId, doubtId);
  };

  const toggleEmailVisibility = (doubtId: number) => {
    setVisibleEmails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(doubtId)) {
        newSet.delete(doubtId);
      } else {
        newSet.add(doubtId);
      }
      return newSet;
    });
  };

  const handleCloseRoom = () => {
    if (isAdmin) {
      wsService.closeRoom(roomId);
      toast.success('Room closed successfully');
      onLeaveRoom();
    }
  };

  const handleLeaveRoom = () => {
    wsService.leaveRoom(roomId);
    onLeaveRoom();
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast.success('Room ID copied to clipboard!');
  };

  const copyJoinUrl = () => {
    const joinUrl = `${window.location.origin}?roomId=${roomId}`;
    navigator.clipboard.writeText(joinUrl);
    toast.success('Join URL copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400 mb-2">
              {isAdmin ? 'Room Admin Panel' : 'Room'}
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-zinc-300">Room ID:</span>
              <code className="bg-zinc-800 px-3 py-1 rounded-lg text-cyan-400 font-mono">
                {roomId}
              </code>
              <button
                onClick={copyRoomId}
                className="text-zinc-400 hover:text-cyan-400 transition-colors"
                title="Copy Room ID"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm text-zinc-400">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            {isAdmin && (
              <button
                onClick={handleCloseRoom}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
              >
                Close Room
              </button>
            )}
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-semibold transition-colors"
            >
              Leave Room
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Room Info & QR Code (Admin only) */}
          {isAdmin && (
            <div className="lg:col-span-1">
              <div className="bg-zinc-800 rounded-2xl border border-zinc-700 p-6 mb-6">
                <h2 className="text-xl font-semibold text-white mb-4">Share Room</h2>
                
                {/* QR Code */}
                <div className="text-center mb-4">
                  {qrCodeUrl && (
                    <img 
                      src={qrCodeUrl} 
                      alt="Room QR Code" 
                      className="mx-auto rounded-lg border-2 border-cyan-500"
                    />
                  )}
                  <p className="text-sm text-zinc-400 mt-2">
                    Scan to join the room
                  </p>
                </div>

                {/* Share URL */}
                <button
                  onClick={copyJoinUrl}
                  className="w-full py-2 px-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Copy Join URL
                </button>
              </div>

              {/* Admin Info */}
              <div className="bg-zinc-800 rounded-2xl border border-zinc-700 p-6">
                <h3 className="text-white font-medium mb-2">Admin Controls</h3>
                <p className="text-sm text-zinc-400">
                  Click the eye icon next to each doubt to reveal/hide the user's email address
                </p>
              </div>
            </div>
          )}

          {/* Right Column - Doubts */}
          <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            {/* Submit Doubt (Non-admin) */}
            {!isAdmin && (
              <div className="bg-zinc-800 rounded-2xl border border-zinc-700 p-6 mb-6">
                <h2 className="text-xl font-semibold text-white mb-4">Ask a Doubt</h2>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={newDoubt}
                    onChange={(e) => setNewDoubt(e.target.value)}
                    placeholder="Type your doubt here..."
                    className="flex-1 px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmitDoubt()}
                  />
                  <button
                    onClick={handleSubmitDoubt}
                    disabled={!newDoubt.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-zinc-600 disabled:to-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300"
                  >
                    Submit
                  </button>
                </div>
              </div>
            )}

            {/* Doubts List */}
            <div className="bg-zinc-800 rounded-2xl border border-zinc-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Doubts ({doubts.length})
              </h2>
              
              {doubts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-zinc-400 text-lg mb-2">No doubts yet</div>
                  <div className="text-zinc-500 text-sm">
                    {isAdmin ? 'Waiting for participants to ask questions...' : 'Be the first to ask a doubt!'}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {doubts.map((doubt) => (
                    <div
                      key={doubt.id}
                      className="bg-zinc-700 rounded-xl p-4 border border-zinc-600"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-white flex-1">{doubt.doubt}</p>
                        <div className="flex items-center gap-2 ml-4">
                          {/* Email visibility toggle for admin */}
                          {isAdmin && doubt.userEmail && (
                            <button
                              onClick={() => toggleEmailVisibility(doubt.id)}
                              className="text-zinc-400 hover:text-cyan-400 transition-colors"
                              title={visibleEmails.has(doubt.id) ? "Hide email" : "Show email"}
                            >
                              {visibleEmails.has(doubt.id) ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleUpvote(doubt.id)}
                            className="text-zinc-400 hover:text-green-400 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <span className="text-zinc-300 font-medium min-w-[2rem] text-center">
                            {doubt.upvotes}
                          </span>
                          <button
                            onClick={() => handleDownvote(doubt.id)}
                            className="text-zinc-400 hover:text-red-400 transition-colors"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {/* Show email only if admin has toggled it visible for this specific doubt */}
                      {isAdmin && visibleEmails.has(doubt.id) && doubt.userEmail && (
                        <div className="text-sm text-cyan-400 mt-2">
                          {doubt.userEmail}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Room;
