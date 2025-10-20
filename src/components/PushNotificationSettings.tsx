import React, { useState, useEffect } from 'react';
import { pushService } from '../services/pushService';
import { Bell, BellOff, TestTube2 } from 'lucide-react';

export const PushNotificationSettings: React.FC = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    checkSubscriptionStatus();
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const checkSubscriptionStatus = async () => {
    const subscribed = await pushService.isSubscribed();
    setIsSubscribed(subscribed);
  };

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const success = await pushService.subscribeToPush();
      if (success) {
        setIsSubscribed(true);
        setPermission(Notification.permission);
        alert('✅ Notificaciones activadas correctamente');
      } else {
        alert('❌ No se pudieron activar las notificaciones');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error activando notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    setLoading(true);
    try {
      const success = await pushService.unsubscribe();
      if (success) {
        setIsSubscribed(false);
        alert('✅ Notificaciones desactivadas');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error desactivando notificaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    try {
      await pushService.sendTestNotification();
      alert('📱 Notificación de prueba enviada! Deberías recibirla en unos segundos.');
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Error enviando notificación');
    } finally {
      setLoading(false);
    }
  };

  if (permission === 'denied') {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
        <div className="flex items-start">
          <BellOff className="h-6 w-6 text-red-600 mr-3 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-red-800 mb-2">
              🚫 Notificaciones Bloqueadas
            </h3>
            <p className="text-sm text-red-700">
              Has bloqueado las notificaciones para este sitio. Para activarlas:
            </p>
            <ol className="text-sm text-red-700 list-decimal list-inside mt-2 space-y-1">
              <li>Haz clic en el ícono de candado en la barra de direcciones</li>
              <li>Busca "Notificaciones" y cambia a "Permitir"</li>
              <li>Recarga la página</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3">
          <div className={`p-3 rounded-full ${isSubscribed ? 'bg-green-100' : 'bg-gray-100'}`}>
            <Bell className={`h-6 w-6 ${isSubscribed ? 'text-green-600' : 'text-gray-600'}`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-lg">
              🔔 Notificaciones Push
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Recibe alertas de recordatorios, tareas urgentes y actualizaciones importantes
              incluso cuando el navegador esté cerrado.
            </p>
            <div className="mt-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                isSubscribed 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {isSubscribed ? '✅ Activadas' : '⚪ Desactivadas'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
        <h4 className="font-medium text-blue-900 mb-2 text-sm">
          💡 ¿Para qué sirven las notificaciones push?
        </h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Recordatorios de seguimiento de leads</li>
          <li>• Alertas de tareas urgentes y vencidas</li>
          <li>• Notificaciones de nuevos leads asignados</li>
          <li>• Funcionan aunque cierres el navegador</li>
        </ul>
      </div>

      <div className="flex gap-3">
        {!isSubscribed ? (
          <button
            onClick={handleSubscribe}
            disabled={loading}
            className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            <Bell size={20} />
            <span>{loading ? 'Activando...' : 'Activar Notificaciones'}</span>
          </button>
        ) : (
          <>
            <button
              onClick={handleTest}
              disabled={loading}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              <TestTube2 size={20} />
              <span>{loading ? 'Enviando...' : 'Enviar Prueba'}</span>
            </button>
            <button
              onClick={handleUnsubscribe}
              disabled={loading}
              className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              <BellOff size={20} />
              <span>{loading ? 'Desactivando...' : 'Desactivar'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};