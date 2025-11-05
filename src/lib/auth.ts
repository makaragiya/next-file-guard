// ⚠️ WARNING: This is a browser-only demo authentication system
// NOT suitable for production - credentials can be manipulated via browser dev tools

export interface User {
  username: string;
  password: string;
  role: 'admin' | 'user';
}

const STORAGE_KEY = 'filemanager_users';
const SESSION_KEY = 'filemanager_session';
const SUPER_ADMIN: User = {
  username: 'FileAdmin2025',
  password: 'file2025Manager',
  role: 'admin'
};

// Initialize storage with super admin
export const initializeAuth = () => {
  const users = localStorage.getItem(STORAGE_KEY);
  if (!users) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([SUPER_ADMIN]));
  }
};

// Get all users
export const getUsers = (): User[] => {
  const users = localStorage.getItem(STORAGE_KEY);
  return users ? JSON.parse(users) : [SUPER_ADMIN];
};

// Add new user
export const addUser = (username: string, password: string): { success: boolean; message: string } => {
  const users = getUsers();
  
  if (users.find(u => u.username === username)) {
    return { success: false, message: 'Username already exists' };
  }
  
  users.push({ username, password, role: 'user' });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
  return { success: true, message: 'User created successfully' };
};

// Delete user
export const deleteUser = (username: string): { success: boolean; message: string } => {
  if (username === SUPER_ADMIN.username) {
    return { success: false, message: 'Cannot delete super admin' };
  }
  
  const users = getUsers();
  const filtered = users.filter(u => u.username !== username);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return { success: true, message: 'User deleted successfully' };
};

// Login
export const login = (username: string, password: string): { success: boolean; user?: User; message: string } => {
  const users = getUsers();
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return { success: true, user, message: 'Login successful' };
  }
  
  return { success: false, message: 'Invalid credentials' };
};

// Logout
export const logout = () => {
  localStorage.removeItem(SESSION_KEY);
};

// Get current session
export const getCurrentUser = (): User | null => {
  const session = localStorage.getItem(SESSION_KEY);
  return session ? JSON.parse(session) : null;
};

// Check if user is admin
export const isAdmin = (): boolean => {
  const user = getCurrentUser();
  return user?.role === 'admin';
};
