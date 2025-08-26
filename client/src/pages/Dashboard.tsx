import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { wsService } from '../services/websocketService';
import Room from '../components/Room';

const Dashboard: React.FC = () => {
  const { user, backendUser, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const [showEmail, setShowEmail] = useState(false);
  const [showJoinRoomModal, setShowJoinRoomModal] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [currentRoom, setCurrentRoom] = useState<{ roomId: string; isAdmin: boolean } | null>(null);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleEmailVisibility = () => {
    setShowEmail(!showEmail);
  };

  const maskEmail = (email: string) => {
    if (!email) return '';
    const [username, domain] = email.split('@');
    const maskedUsername = username.slice(0, 2) + '*'.repeat(username.length - 2);
    return `${maskedUsername}@${domain}`;
  };

  const handleCreateRoom = async () => {
    const newRoomId = wsService.generateRoomId();

    try {
      // Test WebSocket connection first
      await wsService.connect();

      // For room creation, we can immediately set the room state since admin creates it
      setCurrentRoom({ roomId: newRoomId, isAdmin: true });
      toast.success(`Room created: ${newRoomId}`);
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      toast.error('Failed to connect to server. Please try again.');
    }
  };

  const handleJoinRoom = async () => {
    if (roomId.trim()) {
      try {
        // Test WebSocket connection first
        await wsService.connect();

        // Set up one-time listeners for join result
        const joinPromise = new Promise<void>((resolve, reject) => {
          const successHandler = (data: any) => {
            if (data.message && data.message.includes('Successfully joined')) {
              wsService.offMessage('system');
              wsService.offMessage('error');
              resolve();
            }
          };

          const errorHandler = (data: any) => {
            wsService.offMessage('system');
            wsService.offMessage('error');
            reject(new Error(data.msg || 'Failed to join room'));
          };

          wsService.onMessage('system', successHandler);
          wsService.onMessage('error', errorHandler);

          // Set timeout for join attempt
          setTimeout(() => {
            wsService.offMessage('system');
            wsService.offMessage('error');
            reject(new Error('Join room timeout'));
          }, 5000);
        });

        // Attempt to join room
        wsService.joinRoom(user?.email || '', roomId.trim());

        // Wait for join confirmation
        await joinPromise;

        // Only set room state if join was successful
        setCurrentRoom({ roomId: roomId.trim(), isAdmin: false });
        setShowJoinRoomModal(false);
        setRoomId('');
        toast.success(`Joined room: ${roomId.trim()}`);

      } catch (error: any) {
        console.error('Failed to join room:', error);
        toast.error(error.message || 'Failed to join room. Please check the room ID.');
        // Keep modal open and room ID so user can try again
      }
    }
  };

  const handleLeaveRoom = () => {
    setCurrentRoom(null);
    toast.success('Left the room');
  };

  const closeJoinRoomModal = () => {
    setShowJoinRoomModal(false);
    setRoomId('');
  };

  // Check for persisted room on component mount
  useEffect(() => {
    // Try to reconnect to WebSocket server first
    const checkPersistedRoom = async () => {
      try {
        if (!wsService.isConnected()) {
          await wsService.connect();
        }
        
        // Check if there's a persisted room state
        const persistedRoom = wsService.getCurrentRoom();
        if (persistedRoom && persistedRoom.roomId) {
          console.log('📋 Found persisted room, restoring session:', persistedRoom);
          setCurrentRoom({
            roomId: persistedRoom.roomId,
            isAdmin: persistedRoom.isAdmin
          });
          toast.success(`Reconnected to room: ${persistedRoom.roomId}`, {
            duration: 3000
          });
        }
      } catch (error) {
        console.error('Failed to restore room session:', error);
      }
    };
    
    checkPersistedRoom();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // If user is in a room, show the room component
  if (currentRoom) {
    return (
      <Room
        roomId={currentRoom.roomId}
        isAdmin={currentRoom.isAdmin}
        onLeaveRoom={handleLeaveRoom}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className={`container mx-auto px-4 py-8 transition-all duration-300 ${showJoinRoomModal ? 'blur-sm' : ''}`}>
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl font-bold mb-2 text-cyan-400">Welcome to Undoubt</h1>
            </div>
            <button
              onClick={handleSignOut}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors duration-200 shadow-lg"
            >
              Sign Out
            </button>
          </div>

          {/* User Info Card */}
          <div className="bg-zinc-800 rounded-lg p-6 mb-8 border border-cyan-500/20">
            <h2 className="text-2xl font-semibold mb-4 text-cyan-400">Your Profile</h2>
            
            <div className="flex items-center space-x-4 mb-6">
              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="w-16 h-16 rounded-full border-2 border-cyan-400"
                />
              )}
              <div className="flex-1">
                <h3 className="text-xl font-medium text-white">
                  {user?.displayName || 'Anonymous User'}
                </h3>
                <div className="flex items-center space-x-2 mt-1">
                  <p className="text-zinc-400">
                    {showEmail ? user?.email : maskEmail(user?.email || '')}
                  </p>
                  <button
                    onClick={toggleEmailVisibility}
                    className="text-cyan-400 hover:text-cyan-300 transition-colors"
                    title={showEmail ? 'Hide email' : 'Show email'}
                  >
                    {showEmail ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-center space-x-3">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-green-900/30 border border-green-500/30">
                <span className="text-green-400 text-sm">✓ College Email Verified</span>
              </div>
              {backendUser && (
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-900/30 border border-blue-500/30">
                  <span className="text-blue-400 text-sm">✓ Database Registered</span>
                </div>
              )}
            </div>
          </div>



          {/* Main Action Section */}
          <div className="mt-16 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-4">
              Create or join a room to start collaborating with others.
            </h2>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mt-12 max-w-2xl mx-auto">
              {/* Create Room Button */}
              <button
                onClick={handleCreateRoom}
                className="group relative w-full sm:w-80 h-20 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl hover:shadow-cyan-500/25 border border-cyan-500/20 hover:border-cyan-400/40"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-600/20 rounded-2xl blur-sm group-hover:blur-md transition-all duration-300"></div>
                <div className="relative flex items-center justify-center space-x-3 h-full">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span className="text-xl font-semibold text-white">Create Room</span>
                </div>
              </button>

              {/* Join Room Button */}
              <button
                onClick={() => setShowJoinRoomModal(true)}
                className="group relative w-full sm:w-80 h-20 bg-zinc-800 hover:bg-zinc-700 border-2 border-zinc-600 hover:border-zinc-500 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                <div className="flex items-center justify-center space-x-3 h-full">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-xl font-semibold text-white">Join Room</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Join Room Modal */}
      {showJoinRoomModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="relative bg-zinc-900 rounded-2xl border-2 border-cyan-500 shadow-2xl shadow-cyan-500/25 max-w-md w-full mx-4 animate-in fade-in zoom-in duration-300">
            {/* Neon glow effect */}
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 blur-sm"></div>
            <div className="relative bg-zinc-900 rounded-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-700">
                <h2 className="text-2xl font-bold text-white">Join Room</h2>
                <button
                  onClick={closeJoinRoomModal}
                  className="text-zinc-400 hover:text-cyan-400 transition-colors p-1 hover:bg-zinc-800 rounded-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <div className="text-center mb-6">
                  <p className="text-zinc-300 text-lg mb-2">Enter the room ID or scan the QR code</p>
                  <p className="text-zinc-400">provided by the host</p>
                </div>

                {/* Room ID Input */}
                <div className="mb-6">
                  <label htmlFor="roomId" className="block text-sm font-medium text-zinc-300 mb-2">
                    Room ID
                  </label>
                  <input
                    type="text"
                    id="roomId"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="Enter room ID"
                    className="w-full px-4 py-3 bg-zinc-800 border border-zinc-600 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-200 hover:border-zinc-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                  />
                </div>

                {/* Join Button */}
                <button
                  onClick={handleJoinRoom}
                  disabled={!roomId.trim()}
                  className="w-full py-3 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:from-zinc-600 disabled:to-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-xl hover:shadow-cyan-500/25"
                >
                  Join
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
