import axios from 'axios';

const BASE_URL = 'https://fiat-crm-backend-production.up.railway.app';

console.log('🚀 API inicializada con URL:', BASE_URL);

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para AGREGAR TOKEN a todas las peticiones
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📤 REQUEST:', config.method?.toUpperCase(), config.url);
    console.log('🔑 Token:', token ? '✅ PRESENTE' : '❌ NO HAY TOKEN');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      console.log('✅ Token agregado al header Authorization');
    } else {
      console.warn('⚠️ NO SE AGREGÓ TOKEN - Usuario probablemente no logueado');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return config;
  },
  (error) => {
    console.error('❌ Error en interceptor request:', error);
    return Promise.reject(error);
  }
);

// Interceptor para MANEJAR RESPUESTAS
api.interceptors.response.use(
  (response) => {
    console.log('✅ Response OK:', response.config.url, '- Status:', response.status);
    return response;
  },
  (error) => {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERROR en request:', error.config?.url);
    console.error('Status:', error.response?.status);
    console.error('Mensaje:', error.response?.data?.error || error.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (error.response?.status === 401) {
      console.log('🚫 Token inválido o expirado - Limpiando localStorage y redirigiendo al login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Solo redirigir si no estamos ya en la página de login
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;