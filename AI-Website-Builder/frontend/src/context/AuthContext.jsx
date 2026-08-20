import { createContext, useContext, useState, useEffect } from "react";
import { getMe } from "../utils/api";

const AuthContext = createContext();

// High-level provider that manages the global authentication state, session
// persistence, and the current user profile across the application.
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      // Refresh the profile in the background so credits etc. stay current.
      getMe()
        .then(({ user }) => {
          setUser(user);
          localStorage.setItem("user", JSON.stringify(user));
        })
        .catch(() => {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Persists the JWT token + user profile to localStorage and updates state.
  const loginUser = (token, userData) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  // Clears all credentials from localStorage and resets the global user state.
  const logoutUser = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  // Updates the cached user (e.g. after a profile edit or a credit change) and
  // keeps localStorage in sync.
  const updateUser = (userData) => {
    setUser(userData);
    if (userData) localStorage.setItem("user", JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, loginUser, logoutUser, updateUser, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook giving components streamlined access to the current user and the
// authentication control methods.
export const useAuth = () => useContext(AuthContext);
