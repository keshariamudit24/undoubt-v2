import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User,
  UserCredential 
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

class AuthService {
  // Sign in with Google
  async signInWithGoogle(): Promise<AuthUser> {
    try {
      const result: UserCredential = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      };
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    return auth.currentUser;
  }

  // Listen to auth state changes
  onAuthStateChanged(callback: (user: AuthUser | null) => void): () => void {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        callback({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        });
      } else {
        callback(null);
      }
    });
  }

  // Check if user email is from a college domain
  isCollegeEmail(email: string): boolean {
    const collegeEmailPatterns = [
      /\.edu$/,           // US educational institutions (.edu)
      /\.edu\./,          // Educational institutions with country code (.edu.in, .edu.au, etc.)
      /\.ac\./,           // Academic institutions (international) (.ac.uk, .ac.in, etc.)
      /\.ac$/,            // Academic institutions (.ac)
      /student\./,        // Student email patterns (student.university.edu)
      /college\./,        // College email patterns (college.university.edu)
      /university\./,     // University email patterns (university.edu)
      /\.iiit/,           // Indian Institute of Information Technology
      /\.iit/,            // Indian Institute of Technology
      /\.nit/,            // National Institute of Technology
      /\.bits/,           // BITS Pilani
      /\.dtu/,            // Delhi Technological University
      /\.nsut/,           // Netaji Subhas University of Technology
      /\.jiit/,           // Jaypee Institute of Information Technology
      /\.amity/,          // Amity University
      /\.manipal/,        // Manipal University
      /\.vit/,            // VIT University
      /\.srm/,            // SRM University
      /\.lpu/,            // Lovely Professional University
      /vnrvjiet\.in$/,    // VNR Vignana Jyothi Institute of Engineering and Technology
    ];

    return collegeEmailPatterns.some(pattern => pattern.test(email.toLowerCase()));
  }
}

export const authService = new AuthService();
