import React, { useState, useEffect, useRef, useMemo } from "react";
import QRCode from "qrcode";
import toast from "react-hot-toast";
import { wsService, Doubt } from "../services/websocketService";
import { apiService } from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";

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
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [newDoubt, setNewDoubt] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingDoubts, setIsLoadingDoubts] = useState(false);
  const [verifiedAdmin, setVerifiedAdmin] = useState<boolean | null>(null);
  const [isRoomClosed, setIsRoomClosed] = useState(false);
  const [activeTab, setActiveTab] = useState<"doubts" | "answered">("doubts");

  // Generate QR code
  useEffect(() => {
    const generateQR = async () => {
      try {
        const joinUrl = `${window.location.origin}?roomId=${roomId}`;
        const qrUrl = await QRCode.toDataURL(joinUrl, {
          width: 200,
          margin: 2,
          color: {
            dark: "#06b6d4", // cyan-500
            light: "#18181b", // zinc-900
          },
        });
        setQrCodeUrl(qrUrl);
      } catch (error) {
        console.error("Error generating QR code:", error);
      }
    };
    generateQR();
  }, [roomId]);

  // WebSocket connection and event handlers
  useEffect(() => {
    console.log("Setting up WebSocket handlers for room:", roomId);

    const setupMessageHandlers = () => {
      // Clear any existing handlers to avoid duplicates
      wsService.clearHandlers();

      // Set up message handlers for room functionality
      wsService.onMessage("error", (data) => {
        if (!data.msg?.includes("Invalid room Id")) {
          toast.error(data.msg || "An error occurred");
        }
      });

      // Add handler for success messages from server
      wsService.onMessage("success", (data) => {
        console.log("Success message received:", data);
        // Optionally show success toast for important operations
        if (data.msg && !data.msg.includes("successfully")) {
          toast.success(data.msg);
        }
      });

      wsService.onMessage("new doubt triggered", (data) => {
        console.log("New doubt received:", data);

        // Add new doubt to the list and check for duplicates using state updater
        setDoubts((prev) => {
          // Check if this doubt already exists (to prevent duplicates)
          const doubtExists = prev.some((doubt) => doubt.id === data.doubtId);
          if (doubtExists) {
            console.log("Duplicate doubt detected, ignoring");
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

          console.log("Adding new doubt to state:", newDoubt);
          return [...prev, newDoubt];
        });

        // Show toast notification for new doubt
        const isOwnDoubt = data.userEmail === user?.email;
        const toastMessage = isOwnDoubt
          ? "Your doubt has been posted!"
          : "New doubt posted!";

        toast.success(toastMessage, {
          style: {
            background: "#18181b",
            color: "#f4f4f5",
            border: "1px solid #06b6d4",
          },
          iconTheme: {
            primary: "#06b6d4",
            secondary: "#18181b",
          },
        });
      });

      wsService.onMessage("upvote triggered", (data) => {
        console.log("Upvote received for doubt ID:", data.doubtId, typeof data.doubtId);
        setDoubts((prev) => {
          return prev.map((doubt) => {
            // Make sure to compare as numbers (handle string/number conversions)
            const doubtId = parseInt(String(doubt.id));
            const receivedId = parseInt(String(data.doubtId));

            if (doubtId === receivedId) {
              console.log(
                "Updating upvotes for doubt:",
                doubt.id,
                "from",
                doubt.upvotes,
                "to",
                doubt.upvotes + 1
              );
              return { ...doubt, upvotes: doubt.upvotes + 1 };
            }
            return doubt;
          });
        });
      });

      wsService.onMessage("downvote triggered", (data) => {
        console.log("Downvote received for doubt ID:", data.doubtId, typeof data.doubtId);
        setDoubts((prev) => {
          return prev.map((doubt) => {
            // Make sure to compare as numbers (handle string/number conversions)
            const doubtId = parseInt(String(doubt.id));
            const receivedId = parseInt(String(data.doubtId));

            if (doubtId === receivedId) {
              console.log(
                "Updating downvotes for doubt:",
                doubt.id,
                "from",
                doubt.upvotes,
                "to",
                doubt.upvotes - 1
              );
              return { ...doubt, upvotes: Math.max(0, doubt.upvotes - 1) };
            }
            return doubt;
          });
        });
      });

      wsService.onMessage("admin-status", (data) => {
        console.log("Admin status update:", data);
        setVerifiedAdmin(data.isAdmin);
      });

      wsService.onMessage("doubt-answered", (data) => {
        toast.success("Doubt marked as answered!");
        setDoubts((prevDoubts) =>
          prevDoubts.map((doubt) =>
            doubt.id === data.doubtId ? { ...doubt, answered: true } : doubt
          )
        );
      });

      // Add handler for room closure notification
      wsService.onMessage("room-closed", (data) => {
        // This handler is for non-admin users who are still in the room.
        // The admin who initiated the close is redirected immediately.
        if (!isAdmin) {
          console.log("Room has been closed by admin:", data);
          setIsRoomClosed(true); // Set room to closed for participants
          toast.error(
            data.message || "This room has been closed by the admin. Please exit.",
            {
              duration: 10000,
              icon: "🚫",
            }
          );

          // Clear doubts since they've been deleted from the database
          setDoubts([]);
        }
      });
    };
    
    const connectAndJoin = async () => {
      let connectionAttempts = 0;
      const maxAttempts = 3;

      const attemptConnection = async () => {
        try {
          // Check if already connected, if not connect
          if (!wsService.isConnected()) {
            await wsService.connect();
          }
          setIsConnected(true);

          // Set up message handlers
          setupMessageHandlers();

          // Critical fix: Always rejoin the room after page refresh to re-register the socket on the server
          const email = user?.email || "";
          if (email) {
            if (isAdmin) {
              console.log("Explicitly re-creating room as admin after page load:", roomId);
              wsService.createRoom(email, roomId);
            } else {
              console.log("Explicitly re-joining room after page load:", roomId);
              wsService.joinRoom(email, roomId);
            }
          }

          // Fetch previous doubts after joining room
          await fetchPreviousDoubts();

          return true; // Connection successful
        } catch (error) {
          console.error(`Connection attempt ${connectionAttempts + 1}/${maxAttempts} failed:`, error);

          if (connectionAttempts < maxAttempts - 1) {
            // If not the last attempt, wait and try again
            connectionAttempts++;
            console.log(`Retrying connection in 1 second... (Attempt ${connectionAttempts + 1}/${maxAttempts})`);

            // Wait 1 second before trying again
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return attemptConnection();
          }

          // Only show error toast on final failed attempt
          console.error("All connection attempts failed");
          setIsConnected(false);

          // Show a more accurate error message
          const errorMsg = error instanceof Error
            ? error.message
            : "Unable to connect to room";

          if (errorMsg.includes("not in this room")) {
            toast.error("You're not in this room. Rejoining...");
            // Try one last rejoining attempt
            try {
              const email = user?.email || "";
              if (email) {
                wsService.joinRoom(email, roomId);
                return true;
              }
            } catch (e) {
              console.error("Final rejoin attempt failed:", e);
            }
          } else {
            toast.error("Connection issue. Try refreshing the page.");
          }

          return false;
        }
      };

      return attemptConnection();
    };

    // Initial setup
    connectAndJoin();

    // Handle WebSocket reconnections
    const handleReconnect = () => {
      console.log("WebSocket reconnected, restoring handlers");
      setIsConnected(true);

      // Re-setup message handlers after reconnection
      setupMessageHandlers();
    };

    // Register reconnect handler
    wsService.onReconnect(handleReconnect);

    // Debugging function to log the current state of doubts
    const logDoubts = () => {
      console.log("Current doubts state:", doubts.map((d) => ({ id: d.id, upvotes: d.upvotes })));
    };

    // Set up a periodic check to log doubts (for debugging)
    const debugInterval = setInterval(logDoubts, 10000);

    return () => {
      clearInterval(debugInterval);
      wsService.clearHandlers();
      console.log("Room component unmounting, handlers cleaned up");
    };
  }, [roomId, isAdmin, user?.email, onLeaveRoom]);

  const handleSubmitDoubt = () => {
    if (newDoubt.trim() && user?.email) {
      try {
        console.log("Submitting doubt:", newDoubt);
        wsService.askDoubt(user.email, roomId, newDoubt.trim());
        setNewDoubt("");
      } catch (error) {
        console.error("Error submitting doubt:", error);
        toast.error("Failed to submit doubt. Please try again.");
      }
    }
  };

  // Load liked doubts from localStorage on component mount
  useEffect(() => {
    const loadLikedDoubts = () => {
      try {
        const storedLikes = localStorage.getItem(`undoubt_likes_${roomId}_${user?.email}`);
        if (storedLikes) {
          const likedIds = JSON.parse(storedLikes);
          setLikedDoubts(new Set(likedIds));
          console.log("Restored liked doubts from localStorage:", likedIds);
        }
      } catch (error) {
        console.error("Failed to load liked doubts from localStorage:", error);
      }
    };

    if (user?.email) {
      loadLikedDoubts();
    }
  }, [roomId, user?.email]);

  // Save liked doubts to localStorage whenever they change
  useEffect(() => {
    if (user?.email && likedDoubts.size > 0) {
      localStorage.setItem(
        `undoubt_likes_${roomId}_${user?.email}`,
        JSON.stringify(Array.from(likedDoubts))
      );
    }
  }, [likedDoubts, roomId, user?.email]);

  const handleMarkAsAnswered = (doubtId: number) => {
    if (isAdmin) {
      wsService.markAsAnswered(roomId, doubtId);
    }
  };

  const handleToggleLike = (doubtId: number) => {
    const isCurrentlyLiked = likedDoubts.has(doubtId);
    console.log("Toggle like for doubt:", doubtId, "Currently liked:", isCurrentlyLiked);

    try {
      if (isCurrentlyLiked) {
        // User is unliking - trigger downvote
        wsService.downvoteDoubt(roomId, doubtId);
        setLikedDoubts((prev) => {
          const newSet = new Set(prev);
          newSet.delete(doubtId);
          return newSet;
        });
      } else {
        // User is liking - trigger upvote
        wsService.upvoteDoubt(roomId, doubtId);
        setLikedDoubts((prev) => new Set(prev).add(doubtId));
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      toast.error("Failed to update vote. Please try again.");
    }
  };

  const toggleEmailVisibility = (doubtId: number) => {
    setVisibleEmails((prev) => {
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
      const previousDoubts: Doubt[] = response.doubts.map((backendDoubt) => ({
        id: backendDoubt.id,
        doubt: backendDoubt.doubt,
        upvotes: backendDoubt.upvotes,
        user_id: backendDoubt.user_id,
        userEmail: backendDoubt.user.email,
        room: backendDoubt.room,
        answered: backendDoubt.answered
      }));

      setDoubts(previousDoubts);

      if (previousDoubts.length > 0) {
        toast.success(`Loaded ${previousDoubts.length} previous doubts`, {
          id: "load-doubts-success", // Add ID to prevent duplicate toasts
          duration: 3000,
          style: {
            background: "#18181b",
            color: "#f4f4f5",
            border: "1px solid #06b6d4",
          },
          iconTheme: {
            primary: "#06b6d4",
            secondary: "#18181b",
          },
        });
      }
    } catch (error) {
      console.error("Failed to fetch previous doubts:", error);
      // Don't show error toast for this - it's not critical and can confuse users
      console.warn("Couldn't load previous doubts. New doubts will still work.");
    } finally {
      setIsLoadingDoubts(false);
    }
  };

  const handleCloseRoom = () => {
    if (isAdmin) {
      // Send the close room command to the server
      wsService.closeRoom(roomId);
      
      // Immediately provide feedback and redirect the admin
      toast.success("Room closed successfully. Redirecting...");
      
      // Use a short timeout to allow the toast to be seen before redirecting
      setTimeout(() => {
        onLeaveRoom();
      }, 1500);
    }
  };

  const handleLeaveRoom = () => {
    wsService.leaveRoom(roomId);
    onLeaveRoom();
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast.success("Room ID copied to clipboard!");
  };

  const copyJoinUrl = () => {
    const joinUrl = `${window.location.origin}?roomId=${roomId}`;
    navigator.clipboard.writeText(joinUrl);
    toast.success("Join URL copied to clipboard!");
  };

  // Sort doubts by upvotes (highest first)
  const sortedDoubts = useMemo(() => {
    return [...doubts].sort((a, b) => b.upvotes - a.upvotes);
  }, [doubts]);

  const unansweredDoubts = useMemo(
    () => sortedDoubts.filter((d) => !d.answered),
    [sortedDoubts]
  );

  const answeredDoubts = useMemo(
    () => sortedDoubts.filter((d) => d.answered),
    [sortedDoubts]
  );

  // Debug logging
  console.log("Room component render state:", {
    roomId,
    isAdmin,
    verifiedAdmin,
    isConnected,
    doubts: doubts.length,
    shouldShowAdminControls: (isAdmin && verifiedAdmin !== false),
  });

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400 mb-2">
              {isAdmin ? "Room Admin Panel" : "Room"}
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
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              <span className="text-sm text-zinc-400">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            {/* Show Close Room button for admins ONLY if the room is not closed yet */}
            {isAdmin && !isRoomClosed && (verifiedAdmin === null || verifiedAdmin === true) && (
              <button
                onClick={handleCloseRoom}
                className="group relative px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl hover:shadow-red-500/25 border border-red-500/20 hover:border-red-400/40"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 to-red-700/20 rounded-xl blur-sm group-hover:blur-md transition-all duration-300"></div>
                <span className="relative flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Close Room
                </span>
              </button>
            )}

            {/* Show Leave Room button for non-admins OR for admins of a closed room */}
            {(!isAdmin || isRoomClosed) && (
              <button
                onClick={handleLeaveRoom}
                className="group relative px-6 py-3 bg-gradient-to-r from-zinc-700 to-zinc-800 hover:from-zinc-600 hover:to-zinc-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl border border-zinc-600/50 hover:border-zinc-500/70"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-zinc-700/20 to-zinc-800/20 rounded-xl blur-sm group-hover:blur-md transition-all duration-300"></div>
                <span className="relative flex items-center gap-2">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Leave Room
                </span>
              </button>
            )}
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
                    <svg
                      className="w-6 h-6 text-cyan-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                      />
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
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
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
                    <svg
                      className="w-5 h-5 text-cyan-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
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
          <div className={`${isAdmin ? "lg:col-span-2" : "lg:col-span-3"}`}>
            {/* Submit Doubt (Non-admin) */}
            {!isAdmin && (
              <div className="relative bg-zinc-800 rounded-2xl border-2 border-cyan-500/30 p-6 mb-6 shadow-lg shadow-cyan-500/10">
                {/* Neon glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 blur-sm"></div>
                <div className="relative">
                  <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                    <svg
                      className="w-6 h-6 text-cyan-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Ask a Doubt
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="text"
                      value={newDoubt}
                      onChange={(e) => setNewDoubt(e.target.value)}
                      placeholder={
                        isRoomClosed
                          ? "This room has been closed"
                          : "Type your doubt here..."
                      }
                      className="flex-1 px-4 py-3 bg-zinc-700 border border-zinc-600 rounded-xl text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-200 hover:border-zinc-500"
                      onKeyDown={(e) => e.key === "Enter" && handleSubmitDoubt()}
                      disabled={isRoomClosed}
                    />
                    <button
                      onClick={handleSubmitDoubt}
                      disabled={!newDoubt.trim() || isRoomClosed}
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
                <div className="flex border-b border-zinc-700 mb-4">
                  <button
                    onClick={() => setActiveTab("doubts")}
                    className={`px-4 py-2 text-lg font-medium transition-colors duration-200 ${
                      activeTab === "doubts"
                        ? "text-cyan-400 border-b-2 border-cyan-400"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Doubts ({unansweredDoubts.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("answered")}
                    className={`px-4 py-2 text-lg font-medium transition-colors duration-200 ${
                      activeTab === "answered"
                        ? "text-cyan-400 border-b-2 border-cyan-400"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    Answered ({answeredDoubts.length})
                  </button>
                </div>

                <div className="relative min-h-[100px]">
                  {/* Unanswered Doubts */}
                  <div
                    className={`transition-opacity duration-300 ease-in-out ${
                      activeTab === "doubts"
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none absolute w-full"
                    }`}
                  >
                    {isLoadingDoubts ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400 mx-auto mb-4"></div>
                        <p>Loading doubts...</p>
                      </div>
                    ) : unansweredDoubts.length === 0 ? (
                      <div className="text-center py-8 text-zinc-400">
                        No active doubts.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {unansweredDoubts.map((doubt) => (
                          <div
                            key={doubt.id}
                            className="relative bg-zinc-700 rounded-xl p-4 border border-cyan-500/20 hover:border-cyan-400/40 transition-all duration-300 shadow-lg hover:shadow-cyan-500/10"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <p className="text-white flex-1">{doubt.doubt}</p>
                              <div className="flex items-center gap-2 ml-4">
                                {isAdmin && (verifiedAdmin === null || verifiedAdmin === true) && (
                                  <>
                                    <button
                                      onClick={() => handleMarkAsAnswered(doubt.id)}
                                      className="text-zinc-400 hover:text-green-400 transition-colors"
                                      title="Mark as answered"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </button>
                                    {doubt.userEmail && (
                                      <button
                                        onClick={() => toggleEmailVisibility(doubt.id)}
                                        className="text-zinc-400 hover:text-cyan-400 transition-colors"
                                        title={visibleEmails.has(doubt.id) ? "Hide email" : "Show email"}
                                      >
                                        {visibleEmails.has(doubt.id) ? (
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                                        ) : (
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        )}
                                      </button>
                                    )}
                                  </>
                                )}
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleToggleLike(doubt.id)}
                                    className={`transition-colors ${ likedDoubts.has(doubt.id) ? "text-cyan-400 hover:text-cyan-300" : "text-zinc-400 hover:text-cyan-400" }`}
                                    title={likedDoubts.has(doubt.id) ? "Unlike" : "Like"}
                                  >
                                    {likedDoubts.has(doubt.id) ? (
                                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" /></svg>
                                    ) : (
                                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 20 20" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" /></svg>
                                    )}
                                  </button>
                                  <span className="text-zinc-300 font-medium min-w-[2rem] text-center">
                                    {doubt.upvotes}
                                  </span>
                                </div>
                              </div>
                            </div>
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

                  {/* Answered Doubts */}
                  <div
                    className={`transition-opacity duration-300 ease-in-out ${
                      activeTab === "answered"
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none absolute w-full"
                    }`}
                  >
                    {answeredDoubts.length === 0 ? (
                      <div className="text-center py-8 text-zinc-400">
                        No answered doubts yet.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {answeredDoubts.map((doubt) => (
                          <div
                            key={doubt.id}
                            className="relative bg-zinc-900 rounded-xl p-4 border border-green-500/30"
                          >
                            <div className="flex justify-between items-start">
                              <p className="text-zinc-300 flex-1">{doubt.doubt}</p>
                              <div className="flex items-center gap-2 ml-4">
                                <span className="text-green-400 font-bold">Answered</span>
                              </div>
                            </div>
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
      </div>
    </div>
  );
};

export default Room;

