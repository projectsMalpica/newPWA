import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { GlobalService } from './global.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private notificationsSubject = new BehaviorSubject<any[]>([]);
  notifications$ = this.notificationsSubject.asObservable();
  notifications = this.notifications$;

  private unreadCountSubject = new BehaviorSubject<number>(0);
  unreadCount$ = this.unreadCountSubject.asObservable();
  unreadCount = this.unreadCount$;

  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();
  loading = this.loading$;

  private subscribedUserId = '';
  private realtimeActive = false;

  constructor(
    private global: GlobalService,
    private router: Router
  ) {}

  async initRealtimeNotifications(userId: string) {
    await this.subscribeToRealtime(userId);
  }

  async subscribeToRealtime(userId?: string) {
    const pb = this.global.pb;
    const currentUserId = userId || this.getCurrentUserId();

    if (!currentUserId) return;

    if (this.realtimeActive && this.subscribedUserId === currentUserId) return;

    await this.unsubscribeFromRealtime();
    this.subscribedUserId = currentUserId;

    await this.loadNotifications(currentUserId);

    await pb.collection('notifications').subscribe('*', async (e) => {
      const notification = e.record;

      if (notification?.['user'] !== this.subscribedUserId) return;

      if (e.action === 'create') {
        const current = this.notificationsSubject.value;
        const exists = current.some((item) => item.id === notification.id);

        if (!exists) {
          this.notificationsSubject.next([notification, ...current]);
          this.updateUnreadCount();
          if (!notification?.['read']) this.playNotificationSound();
        }
      }

      if (e.action === 'update') {
        const current = this.notificationsSubject.value;
        const exists = current.some((item) => item.id === notification.id);
        const updated = exists
          ? current.map((item) => item.id === notification.id ? notification : item)
          : [notification, ...current];

        this.notificationsSubject.next(updated);
        this.updateUnreadCount();
      }

      if (e.action === 'delete') {
        const filtered = this.notificationsSubject.value.filter(
          (item) => item.id !== notification.id
        );

        this.notificationsSubject.next(filtered);
        this.updateUnreadCount();
      }
    });

    this.realtimeActive = true;
  }

  async loadNotifications(userId?: string) {
    const pb = this.global.pb;
    const currentUserId = userId || this.getCurrentUserId();

    if (!currentUserId) return;

    this.loadingSubject.next(true);

    try {
      const records = await pb.collection('notifications').getList(1, 50, {
        filter: `user="${currentUserId}"`,
        sort: '-created',
        expand: 'fromUser',
        requestKey: null
      });

      this.notificationsSubject.next(records.items);
      this.updateUnreadCount();
    } finally {
      this.loadingSubject.next(false);
    }
  }

  async markAsRead(notificationId: string) {
    const pb = this.global.pb;

    const updated = await pb.collection('notifications').update(notificationId, {
      read: true
    });

    const list = this.notificationsSubject.value.map((item) =>
      item.id === notificationId ? updated : item
    );

    this.notificationsSubject.next(list);
    this.updateUnreadCount();
  }

  async markAllAsRead(userId: string) {
    const currentUserId = userId || this.getCurrentUserId();
    const unread = this.notificationsSubject.value.filter(
      (item) => item.user === currentUserId && !item.read
    );

    for (const item of unread) {
      await this.markAsRead(item.id);
    }
  }

  async openNotification(notification: any) {
    if (!notification) return;

    if (!notification.read) {
      await this.markAsRead(notification.id);
    }

    const route = this.resolveNotificationRoute(notification);
    await this.router.navigateByUrl(route);
  }

  refreshUnreadCount() {
    this.updateUnreadCount();
  }

  parseNotificationData(data: any): Record<string, any> {
    if (!data) return {};
    if (typeof data === 'object' && !Array.isArray(data)) return data;

    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      } catch {
        return {};
      }
    }

    return {};
  }

  resolveNotificationRoute(notification: any): string {
    const data = this.parseNotificationData(notification?.data);
    const dataRoute = typeof data['route'] === 'string' ? data['route'] : data['url'];

    if (this.isSafeInternalRoute(dataRoute)) {
      return dataRoute;
    }

    const type = notification?.type;
    const referenceId = notification?.referenceId;

    if ((type === 'message' || type === 'new_message') && (data['senderId'] || referenceId)) {
      return `/chat-detail/${data['senderId'] || referenceId}`;
    }

    if (type === 'match' || type === 'new_match') {
      return '/matches';
    }

    if (type === 'gift_received' || type === 'gift') {
      return '/my-orders';
    }

    if (type === 'gift_order') {
      return '/home-local';
    }

    if (type === 'wallet_transaction') {
      return '/wallet-history';
    }

    if (type === 'partner_wallet_transaction') {
      return '/wallet-partner';
    }

    if (type === 'profile_approved' || type === 'profile_pending' || type === 'user_profile') {
      return data['profileType'] === 'partner' ? '/profile-local' : '/profile';
    }

    return '/maps';
  }

  private updateUnreadCount() {
    const count = this.notificationsSubject.value.filter(
      (item) => !item.read
    ).length;

    this.unreadCountSubject.next(count);
  }

  private playNotificationSound() {
    try {
      const audio = new Audio('assets/sounds/notification.mp3');
      audio.play().catch(() => {});
    } catch (error) {
      console.warn('No se pudo reproducir sonido de notificación', error);
    }
  }

  async stopRealtimeNotifications() {
    await this.unsubscribeFromRealtime();
  }

  async unsubscribeFromRealtime() {
    const pb = this.global.pb;
    await pb.collection('notifications').unsubscribe('*');
    this.realtimeActive = false;
    this.subscribedUserId = '';
  }

  private getCurrentUserId(): string {
    return this.global.pb.authStore.record?.id ||
      this.global.pb.authStore.model?.id ||
      localStorage.getItem('userId') ||
      '';
  }

  private isSafeInternalRoute(route: any): route is string {
    return typeof route === 'string' &&
      route.startsWith('/') &&
      !route.startsWith('//') &&
      !route.includes('://');
  }
}
