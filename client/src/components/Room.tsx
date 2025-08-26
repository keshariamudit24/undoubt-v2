import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { wsService, Doubt } from '../services/websocketService';
import { apiService } from '../services/apiService';
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
  const [likedDoubts, setLikedDoubts] = useState<Set<number>>(new Set());
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [newDoubt, setNewDoubt] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingDoubts, setIsLoadingDoubts] = useState(false);
  const [verifiedAdmin, setVerifiedAdmin] = useState<boolean | null>(null);

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

        // Fetch previous doubts first
        await fetchPreviousDoubts();

        if (isAdmin) {
          // Create room - backend will automatically send admin status confirmation
          wsService.createRoom(user?.email || '', roomId);
        } else {
          // For non-admins, check admin status immediately
          if (user?.email) {
            wsService.checkAdminStatus(user.email, roomId);
          }
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
          // Add new doubt to the list and check for duplicates using state updater
          setDoubts(prev => {
            // Check if this doubt already exists (to prevent duplicates)
            const doubtExists = prev.some(doubt => doubt.id === data.doubtId);
            if (doubtExists) {
              return prev; // No change if duplicate
            }

            // Add new doubt to the list
            const newDoubt: Doubt = {
              id: data.doubtId || Date.now(), // Use actual database ID from backend
              doubt: data.doubt,
              upvotes: 0,
              user_id: 0,
              userEmail: data.userEmail,
              room: roomId,
            };

            return [...prev, newDoubt];
          });

          // Show toast notification for new doubt to everyone in the room
          const isOwnDoubt = data.userEmail === user?.email;
          const toastMessage = isOwnDoubt ? 'Your doubt has been posted!' : 'New doubt posted!';

          toast.success(toastMessage, {
            style: {
              background: '#18181b',
              color: '#f4f4f5',
              border: '1px solid #06b6d4',
            },
            iconTheme: {
              primary: '#06b6d4',
              secondary: '#18181b',
            },
          });
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

        wsService.onMessage('admin-status', (data) => {
          console.log('Admin status received:', data.isAdmin, 'Frontend isAdmin:', isAdmin, 'Current verifiedAdmin:', verifiedAdmin);
          setVerifiedAdmin(data.isAdmin);

          // Only show warning if frontend thinks user is admin but backend strongly disagrees
          // AND this is not the initial room creation
          if (isAdmin && data.isAdmin === false && verifiedAdmin !== null) {
            toast.error('Admin privileges revoked - you are not the admin of this room!', {
              style: {
                background: '#18181b',
                color: '#f4f4f5',
                border: '1px solid #ef4444',
              },
              iconTheme: {
                primary: '#ef4444',
                secondary: '#18181b',
              },
            });
          }
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

  const handleToggleLike = (doubtId: number) => {
    const isCurrentlyLiked = likedDoubts.has(doubtId);

    if (isCurrentlyLiked) {
      // User is unliking - trigger downvote
      wsService.downvoteDoubt(roomId, doubtId);
      setLikedDoubts(prev => {
        const newSet = new Set(prev);
        newSet.delete(doubtId);
        return newSet;
      });
    } else {
      // User is liking - trigger upvote
      wsService.upvoteDoubt(roomId, doubtId);
      setLikedDoubts(prev => new Set(prev).add(doubtId));
    }
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

  // Fetch previous doubts from the database
  const fetchPreviousDoubts = async () => {
    try {
      setIsLoadingDoubts(true);

      const response = await apiService.getRoomDoubts(roomId);

      // Convert backend doubts to frontend format
      const previousDoubts: Doubt[] = response.doubts.map(backendDoubt => ({
        id: backendDoubt.id,
        doubt: backendDoubt.doubt,
        upvotes: backendDoubt.upvotes,
        user_id: backendDoubt.user_id,
        userEmail: backendDoubt.user.email,
        room: backendDoubt.room,
      }));

      setDoubts(previousDoubts);

      if (previousDoubts.length > 0) {
        toast.success(`Loaded ${previousDoubts.length} previous doubts`, {
          style: {
            background: '#18181b',
            color: '#f4f4f5',
            border: '1px solid #06b6d4',
          },
          iconTheme: {
            primary: '#06b6d4',
            secondary: '#18181b',
          },
        });
      }

    } catch (error) {
      console.error('Failed to fetch previous doubts:', error);
      toast.error('Failed to load previous doubts', {
        style: {
          background: '#18181b',
          color: '#f4f4f5',
          border: '1px solid #ef4444',
        },
        iconTheme: {
          primary: '#ef4444',
          secondary: '#18181b',
        },
      });
    } finally {
      setIsLoadingDoubts(false);
    }
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

  // Debug logging
  console.log('Room component render state:', {
    roomId,
    isAdmin,
    verifiedAdmin,
    isConnected,
    doubts: doubts.length,
    shouldShowAdminControls: (isAdmin && verifiedAdmin !== false)
  });

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
            {isAdmin && (verifiedAdmin === null || verifiedAdmin === true) && (
              <button
                onClick={handleCloseRoom}
                className="group relative px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl hover:shadow-red-500/25 border border-red-500/20 hover:border-red-400/40"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-red-700/20 rounded-xl blur-sm group-hover:blur-md transition-all duration-300"></div>
                <span className="relative flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Close Room
                </span>
              </button>
            )}
            <button
              onClick={handleLeaveRoom}
              className="group relative px-6 py-3 bg-gradient-to-r from-zinc-700 to-zinc-800 hover:from-zinc-600 hover:to-zinc-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border border-zinc-600/50 hover:border-zinc-500/70"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-700/20 to-zinc-800/20 rounded-xl blur-sm group-hover:blur-md transition-all duration-300"></div>
              <span className="relative flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Leave Room
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Room Info & QR Code (Admin only) */}
          {(isAdmin && verifiedAdmin !== false) && (
            <div className="lg:col-span-1">
              <div className="relative bg-zinc-800 rounded-2xl border-2 border-cyan-500/30 p-6 mb-6 shadow-lg shadow-cyan-500/10">
                {/* Neon glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 blur-sm"></div>
                <div className="relative">
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                    </svg>
                    Share Room
                  </h2>

                  {/* QR Code */}
                  <div className="text-center mb-4">
                    {qrCodeUrl && (
                      <div className="relative inline-block">
                        <img
                          src={qrCodeUrl}
                          alt="Room QR Code"
                          className="mx-auto rounded-lg border-2 border-cyan-500 shadow-lg shadow-cyan-500/20"
                        />
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/10 to-blue-500/10 blur-sm"></div>
                      </div>
                    )}
                    <p className="text-sm text-zinc-400 mt-2">
                      Scan to join the room
                    </p>
                  </div>

                  {/* Share URL */}
                  <button
                    onClick={copyJoinUrl}
                    className="group relative w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl hover:shadow-cyan-500/25"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 to-blue-700/20 rounded-xl blur-sm group-hover:blur-md transition-all duration-300"></div>
                    <span className="relative flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy Join URL
                    </span>
                  </button>
                </div>
              </div>

              {/* Admin Info */}
              <div className="relative bg-zinc-800 rounded-2xl border border-cyan-500/20 p-6 shadow-lg">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/5 to-blue-500/5 blur-sm"></div>
                <div className="relative">
                  <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Admin Controls
                  </h3>
                  <p className="text-sm text-zinc-400">
                    Click the eye icon next to each doubt to reveal/hide the user's email address
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Right Column - Doubts */}
          <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            {/* Submit Doubt (Non-admin) */}
            {!isAdmin && (
              <div className="relative bg-zinc-800 rounded-2xl border-2 border-cyan-500/30 p-6 mb-6 shadow-lg shadow-cyan-500/10">
                {/* Neon glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 blur-sm"></div>
                <div className="relative">
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Ask a Doubt
                  </h2>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={newDoubt}
                      onChange={(e) => setNewDoubt(e.target.value)}
                      placeholder="Type your doubt here..."
                      className="flex-1 px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-200 hover:border-zinc-500"
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitDoubt()}
                    />
                    <button
                      onClick={handleSubmitDoubt}
                      disabled={!newDoubt.trim()}
                      className="group relative px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-zinc-600 disabled:to-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-xl hover:shadow-cyan-500/25"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-xl blur-sm group-hover:blur-md transition-all duration-300"></div>
                      <span className="relative">Submit</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Doubts List */}
            <div className="relative bg-zinc-800 rounded-2xl border-2 border-cyan-500/30 p-6 shadow-lg shadow-cyan-500/10">
              {/* Neon glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 blur-sm"></div>
              <div className="relative">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Doubts ({doubts.length})
                </h2>

              {isLoadingDoubts ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                  <div className="text-zinc-400 text-lg mb-2">Loading previous doubts...</div>
                  <div className="text-zinc-500 text-sm">Please wait while we fetch the conversation history</div>
                </div>
              ) : doubts.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-zinc-400 text-lg mb-2">No doubts yet</div>
                  <div className="text-zinc-500 text-sm">
                    {isAdmin && (verifiedAdmin === null || verifiedAdmin === true) ? 'Waiting for participants to ask questions...' : 'Be the first to ask a doubt!'}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {doubts.map((doubt) => (
                    <div
                      key={doubt.id}
                      className="relative bg-zinc-700 rounded-xl p-4 border border-cyan-500/20 hover:border-cyan-400/40 transition-all duration-300 shadow-lg hover:shadow-cyan-500/10"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="text-white flex-1">{doubt.doubt}</p>
                        <div className="flex items-center gap-2 ml-4">
                          {/* Email visibility toggle for admin */}
                          {isAdmin && (verifiedAdmin === null || verifiedAdmin === true) && doubt.userEmail && (
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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleLike(doubt.id)}
                              className={`transition-colors ${
                                likedDoubts.has(doubt.id)
                                  ? 'text-cyan-400 hover:text-cyan-300'
                                  : 'text-zinc-400 hover:text-cyan-400'
                              }`}
                              title={likedDoubts.has(doubt.id) ? 'Unlike' : 'Like'}
                            >
                              <svg
                                className="w-5 h-5"
                                fill={likedDoubts.has(doubt.id) ? 'currentColor' : 'none'}
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L9 7m5 3v4M9 7H7l-3-3M9 7l.6-2.4A2 2 0 0111.6 3h.8A2 2 0 0114 5v2m-5 2H7l-3 3"
                                />
                              </svg>
                            </button>
                            <span className="text-zinc-300 font-medium min-w-[2rem] text-center">
                              {doubt.upvotes}
                            </span>
                          </div>
                        </div>
                      </div>
                      {/* Show email only if admin has toggled it visible for this specific doubt */}
                      {isAdmin && (verifiedAdmin === null || verifiedAdmin === true) && visibleEmails.has(doubt.id) && doubt.userEmail && (
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
    </div>
  );
};

export default Room;
