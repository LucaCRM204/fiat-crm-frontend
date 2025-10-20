import { api } from "../api"; // ✅ CORREGIDO - Subir un nivel

export class PushService {
  private static instance: PushService;
  private registration: ServiceWorkerRegistration | null = null;
  private subscription: PushSubscription | null = null;

  private constructor() {}

  static getInstance(): PushService {
    if (!PushService.instance) {
      PushService.instance = new PushService();
    }
    return PushService.instance;
  }

  async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('❌ Service Workers no soportados en este navegador');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      this.registration = registration;
      console.log('✅ Service Worker registrado:', registration);

      // Esperar a que esté activo
      if (registration.installing) {
        console.log('⏳ Service Worker instalando...');
      } else if (registration.waiting) {
        console.log('⏳ Service Worker esperando...');
      } else if (registration.active) {
        console.log('✅ Service Worker activo');
      }

      // Actualizar automáticamente
      registration.addEventListener('updatefound', () => {
        console.log('🔄 Actualización de Service Worker encontrada');
      });

    } catch (error) {
      console.error('❌ Error registrando Service Worker:', error);
    }
  }

  async subscribeToPush(): Promise<boolean> {
    if (!this.registration) {
      console.error('❌ Service Worker no registrado');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission !== 'granted') {
        console.warn('❌ Permiso de notificaciones denegado');
        return false;
      }

      console.log('✅ Permiso de notificaciones concedido');

      // Obtener clave pública VAPID del servidor
      const response = await api.get('/push/vapid-public-key');
      const vapidPublicKey = response.data.publicKey;

      // Convertir la clave a Uint8Array
      const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);

      // Suscribirse a push
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      this.subscription = subscription;
      console.log('✅ Suscripción creada:', subscription);

      // Enviar suscripción al servidor
      await api.post('/push/subscribe', {
        subscription: subscription.toJSON()
      });

      console.log('✅ Suscripción guardada en servidor');
      return true;

    } catch (error) {
      console.error('❌ Error suscribiéndose a push:', error);
      return false;
    }
  }

  async unsubscribe(): Promise<boolean> {
  try {
    if (this.subscription) {
      await this.subscription.unsubscribe();
      console.log('✅ Desuscrito de push notifications');
      
      // Notificar al servidor
      await api.delete('/push/unsubscribe');  // ✅ DELETE correcto
      
      this.subscription = null;
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error desuscribiéndose:', error);
    return false;
  }
}

  async isSubscribed(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const subscription = await this.registration.pushManager.getSubscription();
      this.subscription = subscription;
      return subscription !== null;
    } catch (error) {
      console.error('❌ Error verificando suscripción:', error);
      return false;
    }
  }

  async sendTestNotification(): Promise<void> {
  try {
    await api.post('/push/test');  // ✅ Ruta correcta
    console.log('✅ Notificación de prueba enviada');
  } catch (error) {
    console.error('❌ Error enviando notificación de prueba:', error);
    throw error;
  }
}

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
}

export const pushService = PushService.getInstance();