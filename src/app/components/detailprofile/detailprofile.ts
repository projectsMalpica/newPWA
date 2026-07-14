import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { GlobalService } from '../../services/global.service';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import PocketBase from 'pocketbase';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-detailprofile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './detailprofile.html',
  styleUrl: './detailprofile.scss',
})
export class Detailprofile implements OnInit {
  showGiftModal = false;
  giftReceiver: any = null;
  partnerProducts: any[] = [];
  selectedGiftProduct: any = null;
  giftMessage = '';
  walletBalance = 0;
  currentWallet: any = null;
  isSendingGift = false;
  interests: string[] = [];
  clientPhotos: string[] = [];
  galleryOpen = false;
  galleryIndex = 0;
  pb: PocketBase;
  constructor(
    public global: GlobalService,
    private router: Router,
    private route: ActivatedRoute,
    private authPocketbaseService: AuthPocketbaseService
  ) { 
    this.pb = this.authPocketbaseService.pb;

  }

  async ngOnInit(): Promise<void> {
    await this.loadSelectedClientFullData();
  }

  async loadSelectedClientFullData(): Promise<void> {
    const routeId = this.route.snapshot.paramMap.get('id');
    const selected = this.global.selectedClient;
    const clientId = routeId || selected?.id || selected?.userId;

    if (!clientId) {
      this.clientPhotos = this.buildClientPhotos(selected);
      this.interests = this.getInterests(selected?.interests);
      return;
    }

    try {
      let client: any = null;

      client = await this.pb.collection('usuariosClient').getOne(clientId, {
        requestKey: null
      }).catch(() => null);

      if (!client) {
        client = await this.pb.collection('usuariosClient').getFirstListItem(
          `userId="${clientId}"`,
          { requestKey: null }
        ).catch(() => null);
      }

      if (!client) {
        client = selected;
      }

      this.global.selectedClient = {
        ...selected,
        ...client,
        avatar: this.normalizeFileOrUrl(client, client?.avatar) || selected?.avatar
      };
    } catch (error) {
      console.error('Error cargando datos completos del cliente:', error);
    } finally {
      this.clientPhotos = this.buildClientPhotos(this.global.selectedClient);
      this.interests = this.getInterests(this.global.selectedClient?.interests);
    }
  }

  getReceiverUserId(cliente: any): string {
    return cliente?.userId || cliente?.id || '';
  }
  async abrirChat(cliente: any) {
    if (!cliente) return;

    const receiverUserId = this.getReceiverUserId(cliente);

    this.global.selectedClient = { ...cliente };
    this.global.chatReceiverId = receiverUserId;

    await this.router.navigate(['/chat-detail', receiverUserId]);
  }

  getInterests(interests: string | string[]): string[] {
    if (!interests) return [];

    if (Array.isArray(interests)) {
      return interests;
    }

    return interests
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  }

  buildClientPhotos(client: any): string[] {
    const photos: string[] = [];
    const avatar = this.normalizeFileOrUrl(client, client?.avatar);

    if (avatar) {
      photos.push(avatar);
    }

    const rawPhotos = this.normalizePhotos(client?.photos);

    rawPhotos.forEach(photo => {
      const url = this.normalizeFileOrUrl(client, photo);
      if (url && !photos.includes(url)) {
        photos.push(url);
      }
    });

    ['photo1', 'photo2', 'photo3', 'photo4', 'photo5', 'photo6'].forEach(field => {
      const url = this.normalizeFileOrUrl(client, client?.[field]);
      if (url && !photos.includes(url)) {
        photos.push(url);
      }
    });

    return photos;
  }

  private normalizePhotos(value: any): any[] {
    if (Array.isArray(value)) return value;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return [];

      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }

      return [trimmed];
    }

    return [];
  }

  private normalizeFileOrUrl(record: any, value: any): string {
    const photo = value?.url || value;
    if (!photo || typeof photo !== 'string') return '';
    if (photo.startsWith('http') || photo.startsWith('assets/')) return photo;

    if (record?.id && record?.collectionId) {
      return this.pb.files.getUrl(record, photo);
    }

    return photo;
  }

  openGallery(index: number): void {
    if (!this.clientPhotos.length) return;
    this.galleryIndex = Math.max(0, Math.min(index, this.clientPhotos.length - 1));
    this.galleryOpen = true;
  }

  closeGallery(): void {
    this.galleryOpen = false;
  }

  nextPhoto(): void {
    if (this.galleryIndex < this.clientPhotos.length - 1) {
      this.galleryIndex++;
    }
  }

  prevPhoto(): void {
    if (this.galleryIndex > 0) {
      this.galleryIndex--;
    }
  }
  irAWallet(cliente: any) {
    if (!cliente) return;

    this.global.selectedClient = { ...cliente };
    this.router.navigate(['/wallet']);
  }
  onGiftClick(event: Event, cliente: any) {
    event.stopPropagation();
    event.preventDefault();

    this.openGiftFromHome(cliente);
  }
  async openGiftFromHome(cliente: any) {
    if (!cliente?.id) return;

    this.giftReceiver = cliente;
    this.showGiftModal = true;

    const partnerId = cliente.currentPartnerId;

    // Modo prueba: si no tiene local activo, carga todos los productos
    await this.loadProductsForPartner(partnerId || undefined);

    await this.loadWallet();
  }
  async loadProductsForPartner(partnerId?: string) {
    let filter = 'isAvailable=true';

    if (partnerId) {
      filter = `partnerId="${partnerId}" && isAvailable=true`;
    }

    const records = await this.pb.collection('partnerProducts').getFullList({
      filter,
      sort: '-created',
      expand: 'partnerId',
      requestKey: null
    });

    this.partnerProducts = records.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price,
      partnerId: item.partnerId,
      partnerName:
        item.expand?.partnerId?.venueName ||
        item.expand?.partnerId?.name ||
        'Local',
      image: item.image ? this.pb.files.getUrl(item, item.image) : ''
    }));
  }
  async loadWallet(): Promise<void> {
    const userId = this.authPocketbaseService.currentUser?.id;

    if (!userId) return;

    try {
      const wallet = await this.pb.collection('wallet').getFirstListItem(
        `userId="${userId}"`,
        { requestKey: null }
      );

      this.currentWallet = wallet;
      this.walletBalance = Number(wallet['balance'] || 0);

    } catch {
      const wallet = await this.pb.collection('wallet').create({
        userId,
        balance: 0,
        currency: 'COP',
        status: 'active'
      });

      this.currentWallet = wallet;
      this.walletBalance = 0;
    }
  }

  async sendGiftFromProfile(): Promise<void> {
    if (this.isSendingGift) return;

    const product = this.selectedGiftProduct;
    const buyerUserId = this.authPocketbaseService.currentUser?.id;
    const receiverUserId = this.giftReceiver?.userId || this.giftReceiver?.id;
    const partnerId = product?.partnerId || this.giftReceiver?.currentPartnerId;

    if (!product || !buyerUserId || !receiverUserId || !partnerId) {
      await Swal.fire({
        icon: 'warning',
        title: 'Faltan datos',
        text: 'Selecciona un regalo válido antes de continuar.'
      });
      return;
    }

    this.isSendingGift = true;

    try {
      await this.loadWallet();

      const amount = Number(product.price || 0);
      const balanceBefore = Number(this.currentWallet?.balance || 0);

      if (!this.currentWallet?.id || balanceBefore < amount) {
        await Swal.fire({
          icon: 'warning',
          title: 'Saldo insuficiente',
          text: 'Recarga tu wallet para enviar este regalo.'
        });
        return;
      }

      const balanceAfter = balanceBefore - amount;
      const redeemCode = `ONGO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const redeemQr = `${window.location.origin}/redeem/${redeemCode}`;

      await this.pb.collection('wallet').update(this.currentWallet.id, {
        balance: balanceAfter
      }, { requestKey: null });

      const order = await this.pb.collection('product_orders').create({
        buyerUserId,
        receiverUserId,
        partnerId,
        productId: product.id,
        productName: product.name,
        productImage: product.image || '',
        amount,
        paymentMethod: 'wallet',
        status: 'paid',
        orderStatus: 'pending_redeem',
        message: this.giftMessage || '',
        orderType: 'gift',
        redeemCode,
        redeemQr
      }, { requestKey: null });

      await this.pb.collection('wallet_transactions').create({
        walletId: this.currentWallet.id,
        userId: buyerUserId,
        partnerId,
        type: 'gift_sent',
        amount,
        direction: 'debit',
        balanceBefore,
        balanceAfter,
        referenceType: 'product_order',
        referenceId: order.id,
        status: 'completed',
        description: `Regalo enviado: ${product.name}`
      }, { requestKey: null });

      this.walletBalance = balanceAfter;
      this.closeGiftModal(true);

      await Swal.fire({
        icon: 'success',
        title: 'Regalo creado',
        html: `<p>Codigo de canje:</p><h2>${redeemCode}</h2>`,
        timer: 2200,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('Error enviando regalo:', error);
      await Swal.fire({
        icon: 'error',
        title: 'No se pudo enviar',
        text: 'Intenta nuevamente.'
      });
    } finally {
      this.isSendingGift = false;
    }
  }

  closeGiftModal(force = false): void {
    if (this.isSendingGift && !force) return;

    this.showGiftModal = false;
    this.giftReceiver = null;
    this.partnerProducts = [];
    this.selectedGiftProduct = null;
    this.giftMessage = '';
  }
}
