// Configuration
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
// URL del backend en Render (producción) y Localhost (desarrollo)
// NOTA: Si tu URL de Render es diferente, cámbiala aquí
const API_URL = isLocalhost 
    ? 'http://localhost:10000/api' 
    : 'https://brightlawyers.onrender.com/api'; 

window.API_URL = API_URL;

// Token management
const getToken = () => localStorage.getItem('token');

const setToken = (token) => localStorage.setItem('token', token);

const removeToken = () => localStorage.removeItem('token');

const setUser = (user) => localStorage.setItem('user', JSON.stringify(user));

const getUser = () => {
  const user = localStorage.getItem('user');
  if (!user || user === 'undefined' || user === 'null') {
    return null;
  }
  try {
    return JSON.parse(user);
  } catch (e) {
    console.error('Error parsing user:', e);
    return null;
  }
};

const removeUser = () => localStorage.removeItem('user');

const getInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

// API calls
const register = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.errors?.[0]?.msg || 'Error en el registro');
    }

    return data;
  } catch (error) {
    throw error;
  }
};

const login = async (email, password) => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.errors?.[0]?.msg || 'Error en el login');
    }

    // Guardar token y usuario
    setToken(data.token);
    setUser(data.user);

    return data;
  } catch (error) {
    throw error;
  }
};

const getCurrentUser = async () => {
  try {
    const token = getToken();
    if (!token) {
      throw new Error('No hay token');
    }

    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al obtener usuario');
    }

    setUser(data.user);
    return data.user;
  } catch (error) {
    // Si el token es inválido, limpiar storage
    removeToken();
    removeUser();
    throw error;
  }
};

const getRoles = async () => {
  try {
    const response = await fetch(`${API_URL}/roles`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al obtener roles');
    }

    return data.roles;
  } catch (error) {
    throw error;
  }
};

const getBasePath = () => {
  const path = window.location.pathname;
  if (path.includes('/admin/') || path.includes('/client/') || path.includes('/lawyer/')) {
    return '../';
  }
  return '';
};

const logout = () => {
  removeToken();
  removeUser();
  
  // Redirect to login page
  window.location.href = getBasePath() + 'login.html';
};

// Check if user is authenticated
const isAuthenticated = () => {
  return !!getToken();
};

// Redirect to login if not authenticated
const requireAuth = async () => {
  if (!isAuthenticated()) {
    window.location.href = getBasePath() + 'login.html';
    return false;
  }

  try {
    await getCurrentUser();
    return true;
  } catch (error) {
    window.location.href = getBasePath() + 'login.html';
    return false;
  }
};

// Redirect to dashboard if already authenticated
const redirectIfAuthenticated = () => {
  if (isAuthenticated()) {
    const user = getUser();
    const userRoles = user?.userRoles || [];
    const basePath = getBasePath();
    
    // Check if user is admin
    const isAdmin = userRoles.some(ur => 
      ur.role && (ur.role.name === 'admin' || ur.role.name === 'administrador')
    );

    // Check if user is lawyer
    const isLawyer = userRoles.some(ur => 
      ur.role && (ur.role.name === 'abogado' || ur.role.name === 'lawyer' || ur.role.name === 'support_lawyer')
    );
    
    if (isAdmin) {
      window.location.href = basePath + 'admin/admin.html';
    } else if (isLawyer) {
      window.location.href = basePath + 'lawyer/dashboard-lawyer.html';
    } else {
      window.location.href = basePath + 'client/dashboard.html';
    }
  }
};

// Expose functions globally
window.getToken = getToken;
window.setToken = setToken;
window.removeToken = removeToken;
window.getUser = getUser;
window.setUser = setUser;
window.removeUser = removeUser;
window.logout = logout;
window.isAuthenticated = isAuthenticated;
window.requireAuth = requireAuth;
window.redirectIfAuthenticated = redirectIfAuthenticated;

// Update navbar based on auth status
const updateNavbar = () => {
  const token = getToken();
    const user = getUser();
  const navbar = document.querySelector('.navbar-nav');

  if (!navbar) return;

  // Buscar o crear el elemento de login
  let authItem = navbar.querySelector('.nav-item-auth');

  if (token && user) {
    // Usuario autenticado - mostrar nombre y logout
    if (!authItem) {
      authItem = document.createElement('li');
      authItem.className = 'nav-item nav-item-auth';
      navbar.appendChild(authItem);
    }

    // Determine dashboard URL based on role
    let dashboardUrl = 'dashboard.html'; // Default fallback
    const userRoles = user?.userRoles || [];
    const isAdmin = userRoles.some(ur => ur.role && (ur.role.name === 'admin' || ur.role.name === 'administrador'));
    const isLawyer = userRoles.some(ur => ur.role && (ur.role.name === 'abogado' || ur.role.name === 'lawyer' || ur.role.name === 'support_lawyer'));
    
    // Check path to determine relative link
    const path = window.location.pathname;
    const isRoot = !path.includes('/admin/') && !path.includes('/lawyer/') && !path.includes('/client/');
    
    if (isAdmin) {
        dashboardUrl = isRoot ? 'admin/admin.html' : '../admin/admin.html';
    } else if (isLawyer) {
        dashboardUrl = isRoot ? 'lawyer/dashboard-lawyer.html' : '../lawyer/dashboard-lawyer.html';
    } else {
        dashboardUrl = isRoot ? 'client/dashboard.html' : '../client/dashboard.html';
    }

    authItem.innerHTML = `
      <a href="${dashboardUrl}" class="nav-link">
        <i class="icon-user mr-1"></i>${user.name}
      </a>
    `;
  } else {
    // Usuario no autenticado - mostrar login
    if (!authItem) {
      authItem = document.createElement('li');
      authItem.className = 'nav-item nav-item-auth';
      navbar.appendChild(authItem);
    }

    authItem.innerHTML = `
      <a href="login.html" class="nav-link">
        <i class="icon-lock mr-1"></i>Iniciar Sesión
      </a>
    `;
  }
};

// Initialize on page load
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    // Update navbar on every page
    updateNavbar();
  });
}

// Expose login explicitly
window.login = login;
console.log('Auth.js loaded and functions exposed');
