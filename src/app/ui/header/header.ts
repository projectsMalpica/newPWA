import { Component } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SidebarService } from '../../services/sidebar.service';
import { NotificationsService } from '../../services/NotificationsService.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
unreadCount$;
notifications$;
loading$;
showNotifications = false;

  constructor(public global: GlobalService,
    public auth: AuthPocketbaseService,
    public router: Router,
    public sidebarService: SidebarService,
    public notificationsService: NotificationsService

  ) {
        this.unreadCount$ = this.notificationsService.unreadCount$;
        this.notifications$ = this.notificationsService.notifications$;
        this.loading$ = this.notificationsService.loading$;

   }

  async ngOnInit() {
  const userId = this.auth.getUserId();

  if (userId) {
    await this.notificationsService.initRealtimeNotifications(userId);
  }
}

  goHome(): void {
    const route = this.auth.isPartner() ? '/home-local' : '/home';
    this.router.navigate([route]);
  }

  goMenu(): void {
    this.router.navigate(['/sidebar']);
  }

  toggleSidebar() {
    this.sidebarService.toggle();
  }

  async toggleNotifications(): Promise<void> {
    this.showNotifications = !this.showNotifications;

    if (this.showNotifications) {
      await this.notificationsService.loadNotifications(this.auth.getUserId());
    }
  }

  async openNotification(notification: any): Promise<void> {
    this.showNotifications = false;
    await this.notificationsService.openNotification(notification);
  }

  async markAllAsRead(): Promise<void> {
    await this.notificationsService.markAllAsRead(this.auth.getUserId());
  }

  relativeTime(value: string): string {
    if (!value) return '';

    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.max(1, Math.floor(diff / 60000));

    if (minutes < 60) return `${minutes} min`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h`;

    const days = Math.floor(hours / 24);
    return `${days} d`;
  }
}
