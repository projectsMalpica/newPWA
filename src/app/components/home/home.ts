import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { ClientFilters, GlobalService, RadarMode } from '../../services/global.service';
import { CommonModule } from '@angular/common';
import PocketBase from 'pocketbase';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { SwipesService } from '../../services/SwipesService.service';
import { Router, RouterLink } from '@angular/router';
import Swal from 'sweetalert2';
import { ToastService } from '../../services/ToastService.service';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { PushApiService } from '../../services/push-api.service';
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit, OnDestroy {
  @Input() clientes: any[] = [];
  currentIndex = 0;
  startX = 0;
  deltaX = 0;
  deltaY = 0;
  startY = 0;
  swipeHistory: { clientId: string; action: 'like' | 'dislike' | 'superlike' }[] = [];
  transform = '';
  isDragging = false;
  isTransitioning = false;
  isSwipeActionPending = false;
  private suppressMouseUntil = 0;
  private clientSwiperSubscription?: Subscription;
  pb: PocketBase;
  touchStartTime = 0;
  hasDragged = false;
  loadingClients = true;
  threshold = 140;
  superlikeThreshold = -180;
  minDragDistance = 35;
  lastTapTime = 0;
  tapDelay = 300;
  currentPhotoIndex = 0;
  showMatchOverlay = false;
  matchedClient: any = null;
  matchDistanceText = '';
  showGiftModal = false;
  giftReceiver: any = null;
  partnerProducts: any[] = [];
  selectedGiftProduct: any = null;
  giftMessage = '';
  walletBalance = 0;
  currentWallet: any = null;
  isSendingGift = false;
  giftSentSuccess = false;
  lastGiftOrder: any = null;
  lastRedeemCode = '';
  lastRedeemQr = '';
  showFilters = false;

  allClientes: any[] = [];

  filters = {
    interests: '',
    gender: '',
    address: ''
  };
  currentLocalId = '';
  currentLocalName = '';
  isInsideLocal = false;
  currentPartnerId = ''
  currentPartnerName = ''
  activeRadarMode: RadarMode = 'local';
  localFromHomeLocked = false;
  currentHotZoneId = '';
  currentHotZoneName = '';
  isInsideHotZone = false;
  hotZoneLocked = false;
  FREE_LIMITS = {
    likes: 10,
    superLikes: 1,
    chats: 3,
    gifts: 1
  };

  PREMIUM_LIMITS = {
    likes: 9999,
    superLikes: 10,
    chats: 9999,
    gifts: 9999
  };
  dailyUsage: any = null;
  constructor(
    public global: GlobalService,
    public authPocketbaseService: AuthPocketbaseService,
    public swipesService: SwipesService,
    private router: Router,
    private toastService: ToastService,
    private pushApi: PushApiService
  ) {
/*     this.pb = this.global.pb;
 */    this.pb = this.authPocketbaseService.pb;
  }
  get currentProfile(): any | null {
    return this.clientes[this.currentIndex] || null;
  }

  get nextProfile(): any | null {
    const nextIndex = this.currentIndex + 1;
    return nextIndex < this.clientes.length ? this.clientes[nextIndex] : null;
  }

  async openGiftFromHome(cliente: any): Promise<void> {
    if (!cliente?.id) return;

    this.giftReceiver = cliente;
    this.giftSentSuccess = false;
    this.lastGiftOrder = null;
    this.lastRedeemCode = '';
    this.lastRedeemQr = '';
    this.selectedGiftProduct = null;
    this.giftMessage = '';

    this.showGiftModal = true;

    await this.loadProductsForPartner(cliente.currentPartnerId || undefined);
    await this.loadWallet();
  }
  getReceiverUserId(cliente: any): string {
    return cliente?.userId || cliente?.id || '';
  }
  async ngOnInit(): Promise<void> {
    this.loadingClients = true;

    this.clientSwiperSubscription = this.global.clientSwiperState$.subscribe(state => {
      this.allClientes = state.allClientes;
      this.clientes = state.clientes;
      this.currentIndex = state.currentIndex;
      this.currentPhotoIndex = state.currentPhotoIndex;
      this.activeRadarMode = state.activeRadarMode;
      this.filters = { ...state.filters };
      this.hotZoneLocked = state.hotZoneLocked;
      this.localFromHomeLocked = state.localFromHomeLocked;
    });

    await this.updateClientLocation();
    this.syncSwiperContext();
    await this.loadDailyUsage();
    try {
      if (!this.global.getClientesSnapshot().length) {
        await this.global.initClientesRealtime();
      }
      this.loadingClients = false;
    } catch (error) {
      console.error('Error cargando clientes en home:', error);
      this.loadingClients = false;
    }
  }

  ngOnDestroy(): void {
    this.clientSwiperSubscription?.unsubscribe();
  }

  private syncSwiperContext(): void {
    const myProfile = this.authPocketbaseService.getCurrentProfile();
    const authUser = this.authPocketbaseService.getCurrentUser?.() || this.authPocketbaseService.currentUser;

    this.currentLocalId = myProfile?.currentPartnerId || '';
    this.currentLocalName = myProfile?.currentPartnerName || '';
    this.isInsideLocal = !!this.currentLocalId;

    this.global.setSwiperContext({
      authenticatedProfileId: myProfile?.id,
      authenticatedUserId: authUser?.id || myProfile?.userId,
      currentLocalId: this.currentLocalId,
      currentHotZoneId: this.currentHotZoneId,
      myLat: Number(myProfile?.lat),
      myLng: Number(myProfile?.lng),
      hasPro: this.hasClientProPlan()
    });
  }

  startDrag(event: MouseEvent | TouchEvent) {
    if (this.isTransitioning || this.isSwipeActionPending || !this.currentProfile) return;
    if (event.type.startsWith('mouse') && Date.now() < this.suppressMouseUntil) return;
    if (event.type.startsWith('touch')) {
      this.suppressMouseUntil = Date.now() + 450;
    }

    this.hasDragged = false;
    this.isDragging = true;
    const pos = this.getXY(event);
    this.startX = pos.x;
    this.startY = pos.y;
  }

  onDrag(event: MouseEvent | TouchEvent) {
    if (!this.isDragging || this.isTransitioning || this.isSwipeActionPending) return;
    if (event.type.startsWith('mouse') && Date.now() < this.suppressMouseUntil) return;

    const pos = this.getXY(event);
    this.deltaX = pos.x - this.startX;
    this.deltaY = pos.y - this.startY;

    const movedEnough =
      Math.abs(this.deltaX) > this.minDragDistance ||
      Math.abs(this.deltaY) > this.minDragDistance;

    this.hasDragged = movedEnough;

    if (!movedEnough) return;

    this.transform = `translate(${this.deltaX}px, ${this.deltaY}px) rotate(${this.deltaX / 20}deg)`;
  }

  async endDrag(event: MouseEvent | TouchEvent, cliente: any) {
    if (!this.isDragging) return;
    if (event.type.startsWith('mouse') && Date.now() < this.suppressMouseUntil) return;

    this.isDragging = false;
    const targetProfile = this.currentProfile;

    if (!targetProfile?.id || cliente?.id !== targetProfile.id) {
      this.resetCard();
      return;
    }

    const movedEnough =
      Math.abs(this.deltaX) > this.minDragDistance ||
      Math.abs(this.deltaY) > this.minDragDistance;

    if (!movedEnough) {
      this.resetCard();
      return;
    }

    if (this.deltaY < this.superlikeThreshold) {
      await this.superLike(targetProfile);
      return;
    }

    if (this.deltaX > this.threshold) {
      await this.like(targetProfile);
      return;
    }

    if (this.deltaX < -this.threshold) {
      await this.dislike(targetProfile);
      return;
    }

    this.resetCard();
  }
  async handleCardTap(cliente: any) {
    const targetProfile = this.currentProfile;
    if (!targetProfile?.id || cliente?.id !== targetProfile.id) return;
    if (this.isTransitioning || this.isSwipeActionPending) return;

    // Si venía de un swipe, no abrir chat
    if (this.hasDragged) return;

    const now = Date.now();
    const diff = now - this.lastTapTime;

    if (diff < this.tapDelay) {
      await this.abrirChat(targetProfile);
      this.lastTapTime = 0;
      return;
    }

    this.lastTapTime = now;
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
      }, { requestKey: null });

      this.currentWallet = wallet;
      this.walletBalance = 0;
    }
  }
  async sendGiftFromHome(): Promise<void> {
    if (this.isSendingGift) return;

    const product = this.selectedGiftProduct;

    if (!product) {
      this.toastService.show('Selecciona un producto.', 'error');
      return;
    }

    const buyerUserId = this.authPocketbaseService.currentUser?.id;
    const receiverUserId = this.giftReceiver?.userId || this.giftReceiver?.id;
    const partnerId = product.partnerId || this.giftReceiver?.currentPartnerId;

    if (!buyerUserId) {
      this.toastService.show('Debes iniciar sesión.', 'error');
      return;
    }

    if (!receiverUserId) {
      this.toastService.show('No se encontró el receptor.', 'error');
      return;
    }

    if (!partnerId) {
      this.toastService.show('Este producto no tiene local asociado.', 'error');
      return;
    }

    this.isSendingGift = true;

    try {
      await this.loadWallet();

      const amount = Number(product.price || 0);
      const balanceBefore = Number(this.currentWallet?.balance || 0);

      if (balanceBefore < amount) {
        this.toastService.show('Saldo insuficiente.', 'error');
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
      await this.creditPartnerWallet(
        partnerId,
        amount,
        order.id,
        product.name
      );
      const transaction = await this.pb.collection('wallet_transactions').create({
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
      this.pushApi.notifyGift(order.id);
      this.pushApi.notifyTransaction(transaction.id);

      this.walletBalance = balanceAfter;
      this.lastGiftOrder = order;
      this.lastRedeemCode = redeemCode;
      this.lastRedeemQr = redeemQr;

      this.closeGiftModal(true);

      setTimeout(async () => {
        const result = await Swal.fire({
          icon: 'success',
          title: 'Regalo creado 🎁',
          html: `
          <p>Comparte este código para reclamar en el local:</p>
          <h2 style="color:#7c3aed;">${redeemCode}</h2>
        `,
          confirmButtonText: 'Copiar código',
          showCancelButton: true,
          cancelButtonText: 'Cerrar'
        });

        if (result.isConfirmed) {
          await navigator.clipboard.writeText(redeemCode);
          this.toastService.show('Código copiado ✅', 'success');
        }
      }, 400);

    } catch (error) {
      console.error('Error enviando regalo:', error);
      this.toastService.show('No se pudo enviar el regalo.', 'error');
    } finally {
      this.isSendingGift = false;
    }
  }
  async creditPartnerWallet(
    partnerId: string,
    amount: number,
    orderId: string,
    productName: string
  ): Promise<void> {
    let partnerWallet: any;

    try {
      partnerWallet = await this.pb.collection('partner_wallet').getFirstListItem(
        `partnerId="${partnerId}"`,
        { requestKey: null }
      );
    } catch {
      partnerWallet = await this.pb.collection('partner_wallet').create({
        partnerId,
        currency: 'COP',
        status: 'active',
        balance: 0,
        pendingBalance: 0,
        paidBalance: 0
      }, { requestKey: null });
    }

    const balanceBefore = Number(partnerWallet.balance || 0);
    const pendingBefore = Number(partnerWallet.pendingBalance || 0);

    const balanceAfter = balanceBefore + amount;
    const pendingAfter = pendingBefore + amount;

    await this.pb.collection('partner_wallet').update(partnerWallet.id, {
      balance: balanceAfter,
      pendingBalance: pendingAfter
    }, { requestKey: null });

    await this.pb.collection('partner_wallet_transactions').create({
      partnerWalletId: partnerWallet.id,
      partnerId,
      productOrderId: orderId,
      type: 'product_sale',
      amount,
      netAmount: amount,
      direction: 'credit',
      status: 'pending',
      description: `Regalo comprado: ${productName}`,
      commission: 0
    }, { requestKey: null });
  }
  async showGiftSuccessAlert(redeemCode: string): Promise<void> {
    const result = await Swal.fire({
      icon: 'success',
      title: 'Regalo creado 🎁',
      html: `
      <p>Comparte este código con el cliente para reclamarlo en el local.</p>
      <div style="font-size:22px;font-weight:700;color:#7c3aed;margin:16px 0;">
        ${redeemCode}
      </div>
      <p>El local ya fue notificado y podrá validar el pedido.</p>
    `,
      confirmButtonText: 'Copiar código',
      showDenyButton: true,
      denyButtonText: 'Cerrar'
    });

    if (result.isConfirmed) {
      await navigator.clipboard.writeText(redeemCode);
      this.toastService.show('Código copiado ✅', 'success');
    }
  }
  async copyRedeemCode(): Promise<void> {
    if (!this.lastRedeemCode) return;

    await navigator.clipboard.writeText(this.lastRedeemCode);
    this.toastService.show('Código copiado ✅', 'success');
  }
  closeGiftModal(force = false): void {
    if (this.isSendingGift && !force) return;

    this.showGiftModal = false;
    this.giftReceiver = null;
    this.partnerProducts = [];
    this.selectedGiftProduct = null;
    this.giftMessage = '';
    this.giftSentSuccess = false;

    if (!force) {
      this.lastRedeemCode = '';
      this.lastRedeemQr = '';
      this.lastGiftOrder = null;
    }
  }

  resetCard() {
    this.transform = '';
    this.deltaX = 0;
    this.deltaY = 0;
    this.isDragging = false;
  }

  /*  async like(cliente: any) {
     await this.handleSwipeAction(cliente, 'like');
   } */
  async like(cliente: any) {
    const targetProfile = this.getStableActionProfile(cliente);
    if (!targetProfile) return;

    const allowed = await this.canUseDailyFeature('likes');

    if (!allowed) {
      this.showLimitModal('likes');
      return;
    }

    const completed = await this.handleSwipeAction(targetProfile, 'like');
    if (completed) {
      await this.incrementDailyFeature('likes');
    }
  }

  async dislike(cliente: any) {
    const targetProfile = this.getStableActionProfile(cliente);
    if (!targetProfile) return;

    await this.handleSwipeAction(targetProfile, 'dislike');
  }

  /* async superLike(cliente: any) {
    await this.handleSwipeAction(cliente, 'superlike');
  } */
  async superLike(cliente: any) {
    const targetProfile = this.getStableActionProfile(cliente);
    if (!targetProfile) return;

    const allowed = await this.canUseDailyFeature('superLikes');

    if (!allowed) {
      this.showLimitModal('super likes');
      return;
    }

    const completed = await this.handleSwipeAction(targetProfile, 'superlike');
    if (completed) {
      await this.incrementDailyFeature('superLikes');
    }
  }
  async handleSwipeAction(
    cliente: any,
    action: 'like' | 'dislike' | 'superlike'
  ): Promise<boolean> {
    if (this.isSwipeActionPending || this.isTransitioning) {
      return false;
    }

    if (cliente.id === this.global.profileData?.id) {
      console.warn('No puedes interactuar con tu propio perfil');
      return false;
    }

    if (!cliente?.id) return false;

    this.isSwipeActionPending = true;

    try {

      await this.registerSwipe(cliente, action);

      if (action === 'like') {
        this.transform = 'translateX(420px) rotate(18deg)';
      }

      if (action === 'dislike') {
        this.transform = 'translateX(-420px) rotate(-18deg)';
      }

      if (action === 'superlike') {
        this.transform = 'translateY(-520px) rotate(0deg)';
      }

      this.isTransitioning = true;

      await new Promise<void>(resolve => {
        window.setTimeout(() => {
          resolve();
        }, 250);
      });

      if (this.currentProfile?.id === cliente.id) {
        this.nextCard();
      }

      return true;

    } catch (error) {
      console.error('Error registrando swipe:', error);
      this.resetCard();
      alert('No se pudo registrar la interacción');
      return false;
    } finally {
      this.isTransitioning = false;
      this.isSwipeActionPending = false;
    }
  }

  private getStableActionProfile(cliente?: any): any | null {
    const targetProfile = this.currentProfile;

    if (!targetProfile?.id) {
      return null;
    }

    if (cliente?.id && cliente.id !== targetProfile.id) {
      return null;
    }

    return { ...targetProfile };
  }
  getDistanceLabel(cliente: any): string {
    return this.getClientDistanceText(cliente);
  }
  getPresenceLabel(cliente: any): string {
    if (!cliente?.locationUpdatedAt && !cliente?.updated) {
      return 'Disponible para conectar';
    }

    const dateValue = cliente.locationUpdatedAt || cliente.updated;
    const lastSeen = new Date(dateValue).getTime();
    const now = Date.now();

    const diffMinutes = Math.floor((now - lastSeen) / 1000 / 60);

    if (diffMinutes <= 3) {
      return '🔥 Acaba de llegar';
    }

    if (diffMinutes <= 10) {
      return '🟢 Activo ahora';
    }

    if (diffMinutes <= 30) {
      return '⚡ Cerca recientemente';
    }

    return '🌙 Disponible para conectar';
  }

  getPresenceClass(cliente: any): string {
    const label = this.getPresenceLabel(cliente);

    if (label.includes('Acaba')) return 'arrived';
    if (label.includes('Activo')) return 'active';
    if (label.includes('Cerca')) return 'recent';

    return 'available';
  }

  openProfile(event: Event, cliente: any) {
    event.stopPropagation();

    const targetProfile = this.getStableActionProfile(cliente);
    if (!targetProfile?.id) return;

    this.global.selectedClient = targetProfile;

    this.router.navigate(['/detailprofile', targetProfile.id]);
  }
  get likeOpacity() {
    return Math.max(0, this.deltaX / 120);
  }

  get rejectOpacity() {
    return Math.max(0, -this.deltaX / 120);
  }
  async openChat(cliente: any) {
    const targetProfile = this.getStableActionProfile(cliente);
    if (!targetProfile) return;

    const receiverUserId = this.getReceiverUserId(targetProfile);

    const canOpen = await this.hasActiveMatchWith(targetProfile);

    if (!canOpen) {
      Swal.fire({
        icon: 'info',
        title: 'Chat bloqueado',
        text: 'El chat se desbloquea cuando ambos hacen match.',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    const allowed = await this.canUseDailyFeature('chats');

    if (!allowed) {
      this.showLimitModal('chats');
      return;
    }

    await this.incrementDailyFeature('chats');

    this.global.selectedClient = { ...targetProfile };
    this.global.chatReceiverId = receiverUserId;

    await this.router.navigate(['/chat-detail', receiverUserId]);
  }
  async hasActiveMatchWith(cliente: any): Promise<boolean> {
    const myProfile = this.authPocketbaseService.getCurrentProfile();

    if (!myProfile?.id || !cliente?.id) return false;

    const filter = `
    (
      userA="${myProfile.id}" && userB="${cliente.id}"
    ) || (
      userA="${cliente.id}" && userB="${myProfile.id}"
    )
  `;

    try {
      const match = await this.pb.collection('matches').getFirstListItem(filter, {
        requestKey: null
      });

      return match['status'] === 'active';

    } catch {
      return false;
    }
  }

  async registerSwipe(cliente: any, action: 'like' | 'dislike' | 'superlike') {
    const targetProfileId = cliente.id;

    const result = await this.swipesService.registerSwipe(targetProfileId, action);

    console.log('RESULTADO SWIPE:', result);
    console.log('CLIENTE TARGET:', cliente);
    console.log('MI PERFIL:', this.authPocketbaseService.getCurrentProfile());
    const isMatch =
      result?.match ||
      result?.matched === true ||
      result?.isMatch === true;

    if (isMatch) {
      await this.createOrUpdateMatch(cliente);
      this.showConnectionOverlay(cliente);
    } else if (action === 'superlike') {
      this.showSuperLikeNotification(cliente);

    }

    this.swipeHistory.push({ clientId: cliente.id, action });
  }
  async createOrUpdateMatch(cliente: any): Promise<void> {
    const myProfile = this.authPocketbaseService.getCurrentProfile();
    const myAuthUser = this.authPocketbaseService.getCurrentUser?.() || this.authPocketbaseService.currentUser;

    if (!myProfile?.id || !cliente?.id || !myAuthUser?.id) return;

    const userA = myProfile.id;
    const userB = cliente.id;

    const userAAuthId = myAuthUser.id;
    const userBAuthId = cliente.userId || cliente.id;

    const sameLocal =
      myProfile.currentPartnerId &&
      cliente.currentPartnerId &&
      myProfile.currentPartnerId === cliente.currentPartnerId;

    const partnerId = sameLocal ? myProfile.currentPartnerId : '';
    const partnerName = sameLocal
      ? myProfile.currentPartnerName || cliente.currentPartnerName || ''
      : '';

    const filter = `
    (
      userA="${userA}" && userB="${userB}"
    ) || (
      userA="${userB}" && userB="${userA}"
    )
  `;

    try {
      const existing = await this.pb.collection('matches').getFirstListItem(filter, {
        requestKey: null
      });

      const updateData: any = {
        status: 'active',
        partnerName,
        insideSameLocal: !!sameLocal
      };

      if (partnerId) {
        updateData.partnerId = partnerId;
      }

      const match = await this.pb.collection('matches').update(existing.id, updateData, {
        requestKey: null
      });

      if (existing['status'] !== 'active') {
        this.pushApi.notifyMatch(match.id);
      }

    } catch {
      const data: any = {
        userA,
        userB,
        userAAuthId,
        userBAuthId,
        status: 'active',
        partnerName,
        insideSameLocal: !!sameLocal,
        lastMessage: ''
      };

      if (partnerId) {
        data.partnerId = partnerId;
      }

      const match = await this.pb.collection('matches').create(data, { requestKey: null });
      this.pushApi.notifyMatch(match.id);
    }
  }
  showConnectionOverlay(cliente: any) {
    console.log('MOSTRANDO OVERLAY MATCH:', cliente);

    this.matchedClient = cliente;
    this.matchDistanceText = this.getClientDistanceText(cliente);
    this.showMatchOverlay = true;

    navigator.vibrate?.([60, 40, 90, 40, 140]);

    setTimeout(() => {
      this.showMatchOverlay = false;
    }, 5200);
  }
  closeMatchOverlay() {
    this.showMatchOverlay = false;
  }
  /* canSendGiftTo(cliente: any): boolean {
    const myProfile = this.global.profileData;

    if (!myProfile || !cliente) return false;

    const myPlan = myProfile.plan || 'free';

    const sameLocal =
      myProfile.currentPartnerId &&
      cliente.currentPartnerId &&
      myProfile.currentPartnerId === cliente.currentPartnerId;

    if (myPlan === 'free') {
      return sameLocal;
    }

    return !!cliente.currentPartnerId;
  } */
  canSendGiftTo(cliente: any): boolean {
    const hasPro = this.hasClientProPlan();

    const sameLocal =
      this.currentLocalId &&
      cliente?.currentPartnerId &&
      cliente.currentPartnerId === this.currentLocalId;

    if (hasPro) {
      return !!cliente?.currentPartnerId;
    }

    return !!sameLocal;
  }
  async loadProductsForPartner(partnerId?: string): Promise<void> {
    const filter = partnerId
      ? `partnerId="${partnerId}" && isAvailable=true`
      : `isAvailable=true`;

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
      price: Number(item.price || 0),
      partnerId: item.partnerId,
      partnerName:
        item.expand?.partnerId?.venueName ||
        item.expand?.partnerId?.name ||
        'Local',
      image: item.image ? this.pb.files.getUrl(item, item.image) : ''
    }));
  }

  openMatchedChat() {
    if (!this.matchedClient) return;

    const receiverUserId = this.getReceiverUserId(this.matchedClient);

    this.showMatchOverlay = false;

    this.global.selectedClient = { ...this.matchedClient };
    this.global.chatReceiverId = receiverUserId;

    this.router.navigate(['/chat-detail', receiverUserId]);
  }

  getClientDistanceText(cliente: any): string {
    const myProfile = this.authPocketbaseService.getCurrentProfile();

    const myLat = Number(myProfile?.lat);
    const myLng = Number(myProfile?.lng);
    const clientLat = Number(cliente?.lat);
    const clientLng = Number(cliente?.lng);

    if (!myLat || !myLng || !clientLat || !clientLng) {
      return 'Cerca de ti';
    }

    const meters = this.calculateDistanceMeters(myLat, myLng, clientLat, clientLng);

    if (meters < 1000) {
      return `A ${Math.round(meters)} metros de ti`;
    }

    return `A ${(meters / 1000).toFixed(1)} km de ti`;
  }

  calculateDistanceMeters(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const earthRadius = 6371000;

    const toRad = (value: number) => value * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
  }
  nextCard() {
    this.transform = '';
    this.deltaX = 0;
    this.deltaY = 0;
    this.currentPhotoIndex = 0;

    if (!this.clientes.length) return;

    this.global.removeCurrentSwiperProfile();
  }

  async updateClientLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async position => {
        const profile = this.authPocketbaseService.getCurrentProfile();

        if (!profile?.id) return;

        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        let currentPartnerId = '';
        let currentPartnerName = '';

        try {
          const locales = await this.pb.collection('usuariosPartner').getFullList({
            filter: `lat != "" && lng != ""`,
            requestKey: null
          });

          for (const local of locales) {
            const localLat = Number(local['lat']);
            const localLng = Number(local['lng']);

            if (!localLat || !localLng) continue;

            const distancia = this.calculateDistanceMeters(
              userLat,
              userLng,
              localLat,
              localLng
            );

            console.log('Distancia a local:', {
              local: local['venueName'],
              distancia
            });

            if (distancia <= 80) {

              currentPartnerId = local.id;

              currentPartnerName =
                String(local['venueName']);


              await this.registerLocalVisit(currentPartnerId);


              break;

            }
          }

          const updatedProfile = await this.pb.collection('usuariosClient').update(
            profile.id,
            {
              lat: userLat,
              lng: userLng,
              currentPartnerId,
              currentPartnerName,
              insideLocal: !!currentPartnerId,
              locationUpdatedAt: new Date().toISOString()
            },
            { requestKey: null }
          );

          this.currentLocalId = currentPartnerId;
          this.currentLocalName = currentPartnerName;
          this.isInsideLocal = !!currentPartnerId;

          this.global.profileData = {
            ...this.global.profileData,
            ...updatedProfile,
            currentPartnerId,
            currentPartnerName,
            insideLocal: !!currentPartnerId,
            lat: userLat,
            lng: userLng
          };

          localStorage.setItem(
            'profile',
            JSON.stringify(this.global.profileData)
          );
          this.authPocketbaseService.profile = this.global.profileData;
          this.syncSwiperContext();

          console.log('Cliente actualizado en local:', {
            currentPartnerId,
            currentPartnerName,
            insideLocal: !!currentPartnerId
          });

        } catch (error) {
          console.error('Error actualizando ubicación del cliente:', error);
        }
      },
      error => {
        console.error('No se pudo obtener la ubicación:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }
  async registerLocalVisit(partnerId:string){

 try{

 const stats = await this.pb.collection('partner_stats')
 .getFirstListItem(
   `partnerId="${partnerId}"`,
   {
    requestKey:null
   }
 );


 await this.pb.collection('partner_stats')
 .update(stats.id,{
    currentVisitors: Number(stats['currentVisitors'] || 0)+1,
    todayVisitors: Number(stats['todayVisitors'] || 0)+1,
    totalVisits: Number(stats['totalVisits'] || 0)+1,
    lastUpdated:new Date()
 },{
    requestKey:null
 });


 }catch{

 await this.pb.collection('partner_stats')
 .create({

    partnerId,

    currentVisitors:1,

    todayVisitors:1,

    totalVisits:1,

    lastUpdated:new Date()

 },{
    requestKey:null
 });

 }

}
  undoLastSwipe() {
    if (this.swipeHistory.length === 0) return;

    const lastSwipe = this.swipeHistory.pop();
    if (lastSwipe?.clientId) {
      this.global.restoreSwiperProfile(lastSwipe.clientId);
    }
    this.transform = '';
  }

  getXY(event: MouseEvent | TouchEvent): { x: number; y: number } {
    return event instanceof MouseEvent
      ? { x: event.clientX, y: event.clientY }
      : { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  getX(event: MouseEvent | TouchEvent): number {
    return event instanceof MouseEvent
      ? event.clientX
      : event.touches[0].clientX;
  }

  async abrirChat(cliente: any) {
    const targetProfile = this.getStableActionProfile(cliente);
    if (!targetProfile) return;

    const receiverUserId = this.getReceiverUserId(targetProfile);

    await this.registerSwipe(targetProfile, 'superlike');

    this.global.selectedClient = { ...targetProfile };
    this.global.chatReceiverId = receiverUserId;

    await this.router.navigate(['/chat-detail', receiverUserId]);
  }

  showSuperLikeNotification(cliente: any) {
    Swal.fire({
      toast: true,
      position: 'top',
      timer: 2200,
      timerProgressBar: true,
      showConfirmButton: false,
      background: '#1e1033',
      color: '#fff',
      iconHtml: '⭐',
      customClass: {
        popup: 'superlike-toast'
      },
      title: `¡Super Like para ${cliente.name}!`,
      text: 'Tu perfil destacó automáticamente.',
    });
  }

  getCurrentPhoto(cliente: any): string {
    if (this.currentPhotoIndex === 0 && cliente?.avatar) {
      return cliente.avatar;
    }

    const photos = cliente?.photos || [];

    if (photos.length) {
      return photos[this.currentPhotoIndex - 1] || photos[0];
    }

    return 'assets/images/hero-night.png';
  }
  getTotalPhotos(cliente: any): number {
    const photosCount = cliente?.photos?.length || 0;
    return cliente?.avatar ? photosCount + 1 : photosCount;
  }
  nextPhoto(event?: Event) {
    event?.stopPropagation();

    const total = this.getTotalPhotos(this.currentProfile);

    if (total <= 1) return;

    this.currentPhotoIndex = (this.currentPhotoIndex + 1) % total;
    this.global.setSwiperPhotoIndex(this.currentPhotoIndex);
  }
  /*  onGiftClick(event: Event, cliente: any) {
     event.stopPropagation();
     event.preventDefault();
 
     this.openGiftFromHome(cliente);
 
   } */
  async onGiftClick(event: Event, cliente: any) {
    event.stopPropagation();
    event.preventDefault();
    const targetProfile = this.getStableActionProfile(cliente);
    if (!targetProfile) return;

    if (!this.canSendGiftTo(targetProfile)) {
      Swal.fire({
        icon: 'info',
        title: 'Regalos disponibles en el local',
        text: 'Con OnGo Free solo puedes enviar regalos a personas dentro de tu mismo local. Activa Premium para más opciones.',
        confirmButtonText: 'Ver planes',
        showCancelButton: true,
        cancelButtonText: 'Cerrar'
      }).then(result => {
        if (result.isConfirmed) {
          this.openClientPlans();
        }
      });

      return;
    }
    const allowed = await this.canUseDailyFeature('gifts');

    if (!allowed) {
      this.showLimitModal('regalos');
      return;
    }

    await this.incrementDailyFeature('gifts');
    this.openGiftFromHome(targetProfile);
  }
  prevPhoto(event?: Event) {
    event?.stopPropagation();

    const total = this.getTotalPhotos(this.currentProfile);

    if (total <= 1) return;

    this.currentPhotoIndex =
      this.currentPhotoIndex === 0 ? total - 1 : this.currentPhotoIndex - 1;
    this.global.setSwiperPhotoIndex(this.currentPhotoIndex);
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  hasActiveFilters(): boolean {
    return !!(
      this.filters.interests ||
      this.filters.gender ||
      this.filters.address
    );
  }

  applyClientFilters(): void {
    if (!this.hasClientProPlan()) {
      this.toastService.show(
        'Los filtros avanzados están disponibles en OnGo Premium o Platinum.',
        'info'
      );
      return;
    }
    this.global.setSwiperFilters(this.filters as ClientFilters);
  }

  clearClientFilters(): void {
    this.filters = {
      interests: '',
      gender: '',
      address: ''
    };

    this.global.clearSwiperFilters();
  }
  getActiveFiltersCount(): number {
    return [
      this.filters.interests,
      this.filters.gender,
      this.filters.address
    ].filter(value => String(value || '').trim()).length;
  }
  setRadarMode(mode: RadarMode): void {
    this.activeRadarMode = mode;
    this.syncSwiperContext();
    this.global.setSwiperMode(mode);
  }

  canUseHotZone(): boolean {
    const profile = this.authPocketbaseService.getCurrentProfile();

    return (
      profile?.subscriptionStatus === 'active' &&
      ['premium', 'vip'].includes(
        String(profile?.subscriptionPlanName || '').toLowerCase()
      )
    );
  }

  applyRadarMode(): void {
    this.syncSwiperContext();
    this.global.normalizeClientSwiperIndex();
  }
  openSubscriptionsModal(): void {
    this.router.navigate(['/profile']);
  }
  hasClientProPlan(): boolean {
    const profile = this.authPocketbaseService.getCurrentProfile();

    const planName = String(profile?.subscriptionPlanName || '').toLowerCase();
    const planId = String(profile?.subscriptionPlanId || '');
    const status = String(profile?.subscriptionStatus || '').toLowerCase();
    const expiresAt = profile?.subscriptionExpiresAt;

    const isActive =
      status === 'active' &&
      expiresAt &&
      new Date(expiresAt).getTime() > Date.now();

    const paidPlanNames =
      planName.includes('premium') ||
      planName.includes('platinum');

    const paidPlanIds = [
      'ruglhjy5kr7h8a8', // OnGo Premium
      '6ha3ke9bapjz4av'  // OnGo Platinum
    ].includes(planId);

    return !!isActive && (paidPlanNames || paidPlanIds);
  }

  openClientPlans(): void {
    this.router.navigate(['/profile'], {
      queryParams: {
        section: 'plans'
      }
    });
  }
  getTodayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async loadDailyUsage(): Promise<any> {
    const user = this.authPocketbaseService.getCurrentUser?.() || this.authPocketbaseService.currentUser;
    const profile = this.authPocketbaseService.getCurrentProfile();

    if (!user?.id || !profile?.id) return null;

    const dateKey = this.getTodayKey();

    try {
      this.dailyUsage = await this.pb.collection('client_daily_limits')
        .getFirstListItem(`userId="${user.id}" && dateKey="${dateKey}"`, {
          requestKey: null
        });

      return this.dailyUsage;

    } catch {
      this.dailyUsage = await this.pb.collection('client_daily_limits').create({
        userId: user.id,
        clientId: profile.id,
        dateKey,
        likesUsed: 0,
        superLikesUsed: 0,
        chatsUsed: 0,
        giftsUsed: 0
      }, { requestKey: null });

      return this.dailyUsage;
    }
  }

  async canUseDailyFeature(
    feature: 'likes' | 'superLikes' | 'chats' | 'gifts'
  ): Promise<boolean> {
    if (this.hasClientProPlan()) return true;

    const usage = await this.loadDailyUsage();
    if (!usage?.id) return false;

    const fieldMap: any = {
      likes: 'likesUsed',
      superLikes: 'superLikesUsed',
      chats: 'chatsUsed',
      gifts: 'giftsUsed'
    };

    const used = Number(usage[fieldMap[feature]] || 0);
    const limit = Number(this.FREE_LIMITS[feature]);

    return used < limit;
  }

  async incrementDailyFeature(
    feature: 'likes' | 'superLikes' | 'chats' | 'gifts'
  ): Promise<void> {
    if (this.hasClientProPlan()) return;

    const usage = await this.loadDailyUsage();
    if (!usage?.id) return;

    const fieldMap: any = {
      likes: 'likesUsed',
      superLikes: 'superLikesUsed',
      chats: 'chatsUsed',
      gifts: 'giftsUsed'
    };

    const field = fieldMap[feature];

    const updated = await this.pb.collection('client_daily_limits').update(
      usage.id,
      {
        [field]: Number(usage[field] || 0) + 1
      },
      { requestKey: null }
    );

    this.dailyUsage = updated;
  }

  showLimitModal(featureLabel: string): void {
    Swal.fire({
      icon: 'info',
      title: 'Límite diario alcanzado',
      text: `Alcanzaste el límite gratuito de ${featureLabel}. Activa OnGo Premium o Platinum para uso ilimitado.`,
      confirmButtonText: 'Ver planes',
      showCancelButton: true,
      cancelButtonText: 'Cerrar'
    }).then(result => {
      if (result.isConfirmed) {
        this.openClientPlans();
      }
    });
  }

}
