import { Injectable } from '@angular/core';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PushApiService {
  private readonly baseUrl = environment.pushBackendUrl.replace(/\/$/, '');
  private readonly notified = new Set<string>();

  registerToken(token: string, platform = 'web'): Promise<any> {
    return this.post('/push/register-token', { token, platform });
  }

  unregisterToken(token: string): Promise<any> {
    return this.post('/push/unregister-token', { token });
  }

  notifyMessage(messageId: string): void {
    this.notifyOnce('message', messageId, '/notifications/message', { messageId });
  }

  notifyMatch(matchId: string): void {
    this.notifyOnce('match', matchId, '/notifications/match', { matchId });
  }

  notifyGift(giftId: string): void {
    this.notifyOnce('gift', giftId, '/notifications/gift', { giftId });
  }

  notifyTransaction(transactionId: string): void {
    this.notifyOnce('transaction', transactionId, '/notifications/transaction', { transactionId });
  }

  notifyUserProfile(profileId: string, profileType: 'client' | 'partner'): void {
    this.notifyOnce('user-profile', `${profileType}:${profileId}`, '/notifications/user-profile', { profileId, profileType });
  }

  private notifyOnce(kind: string, id: string, path: string, body: Record<string, string>): void {
    if (!id) return;

    const key = `${kind}:${id}`;
    if (this.notified.has(key)) return;

    this.notified.add(key);
    this.post(path, body).catch((error) => {
      this.notified.delete(key);
      console.warn(`[PushApiService] Fallo no bloqueante notificando ${kind}:`, error);
    });
  }

  private async post(path: string, body: unknown): Promise<any> {
    const token = localStorage.getItem('accessToken') ||
      localStorage.getItem('pb_token') ||
      sessionStorage.getItem('pb_token') ||
      '';

    if (!token) {
      throw new Error('No hay token PocketBase para llamar backend push');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || payload?.message || `Error HTTP ${response.status}`);
    }

    return payload;
  }
}
