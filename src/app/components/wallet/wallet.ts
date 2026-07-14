import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GlobalService } from '../../services/global.service';
import { WompiService } from '../../services/wompi.service';
import { AuthPocketbaseService } from '../../services/authPocketbase.service';
import { FormsModule } from '@angular/forms';

interface WalletPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  priceUsd: number;
  bonus?: number;
  theme: 'plus' | 'gold' | 'platinum';
}

@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './wallet.html',
  styleUrl: './wallet.scss',
})
export class Wallet implements OnInit {
activePackageId: string = 'basic';
  pendingRecharge: any = null;

  currentBalance = 0;
currentWallet: any = null;
  currencySymbol = '$';
  showRechargeModal = false;
  selectedRechargePackage: WalletPackage | null = null;
  isProcessingRecharge = false;
  packages: WalletPackage[] = [
    {
      id: 'basic',
      name: 'Wallet Básica',
      credits: 10000,
      price: 10000,
      priceUsd: 3,
      bonus: 0,
      theme: 'plus'
    },
    {
      id: 'smart',
      name: 'Wallet Smart',
      credits: 25000,
      price: 25000,
      priceUsd: 7,
      bonus: 3000,
      theme: 'gold'
    },
    {
      id: 'pro',
      name: 'Wallet Pro',
      credits: 50000,
      price: 50000,
      priceUsd: 13,
      bonus: 8000,
      theme: 'platinum'
    }
  ];
 

  packageBenefits: Record<string, string[]> = {
    basic: [
      'Recarga saldo para enviar regalos',
      'Visualiza tu saldo disponible',
      'Consulta tus movimientos',
      'Usa créditos dentro de la app',
      'Recarga rápida cuando lo necesites'
    ],
    smart: [
      'Incluye bono adicional de créditos',
      'Mayor capacidad para enviar regalos',
      'Visualiza tu saldo disponible',
      'Consulta tus movimientos',
      'Ideal para usuarios frecuentes'
    ],
    pro: [
      'Mejor valor en recarga',
      'Mayor bono promocional',
      'Más créditos para regalos y compras',
      'Visualiza tu saldo disponible',
      'Consulta tus movimientos completos'
    ]
  };
  manualPaymentMethod: 'binance' = 'binance';
  manualProofFile: File | null = null;
  manualProofPreview = '';
  manualPaymentNotes = '';
  isUploadingManualProof = false;

  manualPaymentMethods = [
    {
      id: 'binance',
      name: 'Binance Pay',
      description: 'Pago manual en USD por Binance Pay.',
      account: '51335354'
    }
  ];

  constructor(private router: Router, 
    private global: GlobalService,
    private wompiService: WompiService,
   public auth: AuthPocketbaseService,
       private cdr: ChangeDetectorRef

  ) {}
async ngOnInit(): Promise<void> {
  await this.loadWallet();
  await this.loadPendingRecharge();
}

async loadWallet(): Promise<void> {
  const userId = this.auth.currentUser?.id;

  if (!userId) return;

  try {
    const wallet = await this.global.pb.collection('wallet').getFirstListItem(
      `userId="${userId}"`,
      { requestKey: null }
    );

    this.currentWallet = wallet;
    this.currentBalance = Number(wallet['balance'] || 0);

  } catch {
    const wallet = await this.global.pb.collection('wallet').create({
      userId,
      balance: 0,
      currency: 'COP',
      status: 'active'
    });

    this.currentWallet = wallet;
    this.currentBalance = 0;
  }
    this.cdr.detectChanges();
}

  async loadPendingRecharge(): Promise<void> {
    const userId = this.auth.currentUser?.id;
    if (!userId) return;

    this.pendingRecharge = await this.global.pb
      .collection('wallet_recharge_proofs')
      .getFirstListItem(`userId="${userId}" && status="pending"`, {
        sort: '-created',
        requestKey: null
      })
      .catch(() => null);

    this.cdr.detectChanges();
  }

  get activePackage(): WalletPackage | undefined {
    return this.packages.find(pkg => pkg.id === this.activePackageId);
  }

  get activeBenefits(): string[] {
    return this.packageBenefits[this.activePackageId] || [];
  }

  selectPackage(packageId: string) {
    this.activePackageId = packageId;
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  goToHistory() {
    this.router.navigate(['/wallet-history']);
  }
   rechargeWallet() {
    const selected = this.activePackage;
    if (!selected) return;

    this.selectedRechargePackage = selected;
    this.showRechargeModal = true;
  }

  closeRechargeModal() {
    if (this.isProcessingRecharge || this.isUploadingManualProof) return;
    this.showRechargeModal = false;
    this.selectedRechargePackage = null;
    this.resetManualRechargeState();
  }

  getCopAmount(pkg: WalletPackage): string {
    return `$ ${pkg.price.toLocaleString('es-CO')} COP`;
  }

  getUsdAmount(pkg: WalletPackage): string {
    return `$${pkg.priceUsd.toLocaleString('en-US')} USD`;
  }

  getManualCreditAmount(pkg: WalletPackage): number {
    return Number(pkg.credits || 0) + Number(pkg.bonus || 0);
  }

 async confirmRecharge() {
  if (!this.selectedRechargePackage || this.isProcessingRecharge) return;

  try {
    this.isProcessingRecharge = true;

    const pkg = this.selectedRechargePackage;
    this.showRechargeModal = false;

    const intentRes = await fetch('https://db.ongomatch.com:5055/wallet/recharge-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: this.auth.currentUser.id,
        customerEmail: this.auth.currentUser.email,
        packageId: pkg.id,
        credits: pkg.credits,
        bonus: pkg.bonus || 0,
        price: pkg.price
      })
    });

    const intent = await intentRes.json();
    console.log('Intent response:', intent);
    const result = await this.wompiService.openCheckout({
  amountInCents: intent.amountInCents,
  reference: intent.reference,
  currency: 'COP',
  publicKey: intent.publicKey,
  signature: intent.signature,
  customerEmail: this.auth.currentUser.email,
  // redirectUrl: intent.redirectUrl
});

console.log('Resultado Wompi:', result);

const transaction = result?.transaction;

if (transaction?.reference && transaction?.status) {
  const confirmRes = await fetch('https://db.ongomatch.com:5055/wallet/confirm-recharge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reference: transaction.reference,
      status: transaction.status
    })
  });

  const confirmData = await confirmRes.json();

  console.log('Confirmación backend:', confirmData);

  await this.loadWallet();
  this.currentBalance = Number(confirmData.balanceAfter || this.currentBalance);
this.cdr.detectChanges();
}} catch (error) {
    console.error('Error al iniciar recarga:', error);
    alert('No se pudo iniciar el pago.');
  } finally {
    this.isProcessingRecharge = false;
    this.selectedRechargePackage = null;
  }
}

  confirmRechargeFromSelected(): void {
    const selected = this.activePackage;
    if (!selected) return;

    this.selectedRechargePackage = selected;
    this.confirmRecharge();
  }

  openManualRecharge(): void {
    const selected = this.activePackage;
    if (!selected) return;

    this.selectedRechargePackage = selected;
    this.showRechargeModal = true;
  }

  onManualProofSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      alert('Formato no permitido. Usa JPG, PNG, WEBP o PDF.');
      input.value = '';
      return;
    }

    this.manualProofFile = file;

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        this.manualProofPreview = String(reader.result);
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    } else {
      this.manualProofPreview = '';
    }
  }

  async submitManualRecharge(): Promise<void> {
    if (!this.selectedRechargePackage || !this.manualProofFile || this.isUploadingManualProof) return;

    const userId = this.auth.currentUser?.id;
    if (!userId || !this.currentWallet?.id) {
      alert('No se pudo identificar la wallet del usuario.');
      return;
    }

    try {
      this.isUploadingManualProof = true;
      const pkg = this.selectedRechargePackage;
      const creditsToApply = this.getManualCreditAmount(pkg);

      const formData = new FormData();
      formData.append('userId', userId);
      formData.append('walletId', this.currentWallet.id);
      formData.append('packageId', pkg.id);
      formData.append('packageName', pkg.name);
      formData.append('price', String(pkg.price));
      formData.append('priceUsd', String(pkg.priceUsd));
      formData.append('credits', String(creditsToApply));
      formData.append('bonus', String(pkg.bonus || 0));
      formData.append('currency', 'USD');
      formData.append('amountPaid', String(pkg.priceUsd));
      formData.append('paymentMethod', this.manualPaymentMethod);
      formData.append('status', 'pending');
      formData.append('adminNotes', this.manualPaymentNotes || '');
      formData.append('proofImage', this.manualProofFile);

      await this.global.pb.collection('wallet_recharge_proofs').create(formData, {
        requestKey: null
      });

      await this.loadPendingRecharge();
      this.showRechargeModal = false;
      this.selectedRechargePackage = null;
      this.resetManualRechargeState();
    } catch (error) {
      console.error('Error enviando comprobante:', error);
      alert('No se pudo enviar el comprobante.');
    } finally {
      this.isUploadingManualProof = false;
      this.cdr.detectChanges();
    }
  }

  private resetManualRechargeState(): void {
    this.manualProofFile = null;
    this.manualProofPreview = '';
    this.manualPaymentNotes = '';
  }
}
