import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';
import { PushApiService } from './push-api.service';
import { ToastService } from './ToastService.service';

declare global {
  interface Window {
    firebase?: any;
  }
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseMessagingService {
  private sdkPromise?: Promise<void>;
  private messaging: any = null;
  private onMessageReady = false;
  private registeringToken = false;
  private lastRegisteredToken = localStorage.getItem('ongo_fcm_registered_token') || '';

  constructor(
    private pushApi: PushApiService,
    private toastService: ToastService
  ) {}

  async registerTokenAfterLogin(): Promise<void> {
    if (this.registeringToken || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'denied') return;

    this.registeringToken = true;

    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();

      if (permission !== 'granted') return;

      const token = await this.getCurrentToken();
      if (!token || token === this.lastRegisteredToken) return;

      await this.pushApi.registerToken(token, 'web');
      this.lastRegisteredToken = token;
      localStorage.setItem('ongo_fcm_registered_token', token);
    } catch (error) {
      console.warn('[FirebaseMessagingService] No se pudo registrar FCM:', error);
    } finally {
      this.registeringToken = false;
    }
  }

  async unregisterTokenBeforeLogout(): Promise<void> {
    try {
      const token = await this.getCurrentToken();
      if (!token) return;

      await this.pushApi.unregisterToken(token);
      localStorage.removeItem('ongo_fcm_registered_token');
      this.lastRegisteredToken = '';
    } catch (error) {
      console.warn('[FirebaseMessagingService] No se pudo desactivar FCM. Logout continua:', error);
    }
  }

  async initForegroundMessages(): Promise<void> {
    if (this.onMessageReady || typeof window === 'undefined' || !('Notification' in window)) return;

    try {
      await this.ensureMessaging();
      if (!this.messaging) return;

      this.messaging.onMessage((payload: any) => {
        const title = payload?.notification?.title || payload?.data?.title || 'OnGo';
        const body = payload?.notification?.body || payload?.data?.body || 'Nueva notificación';

        this.toastService.show(`${title}: ${body}`, 'success');
      });

      this.onMessageReady = true;
    } catch (error) {
      console.warn('[FirebaseMessagingService] Foreground FCM no disponible:', error);
    }
  }

  private async getCurrentToken(): Promise<string> {
    await this.ensureMessaging();
    if (!this.messaging) return '';

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const options: any = { serviceWorkerRegistration: registration };

    if (environment.firebaseVapidKey) {
      options.vapidKey = environment.firebaseVapidKey;
    }

    return await this.messaging.getToken(options);
  }

  private async ensureMessaging(): Promise<void> {
    await this.loadFirebaseSdk();

    const firebase = window.firebase;
    if (!firebase) return;

    if (!firebase.apps?.length) {
      firebase.initializeApp(environment.firebaseConfig);
    }

    if (firebase.messaging?.isSupported) {
      const supported = await firebase.messaging.isSupported().catch(() => false);
      if (!supported) return;
    }

    this.messaging = this.messaging || firebase.messaging();
  }

  private loadFirebaseSdk(): Promise<void> {
    if (this.sdkPromise) return this.sdkPromise;

    this.sdkPromise = this.loadScript('https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js')
      .then(() => this.loadScript('https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js'));

    return this.sdkPromise;
  }

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(script);
    });
  }
}
