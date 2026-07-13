import { Injectable } from '@angular/core';
import PocketBase from 'pocketbase';
import { BehaviorSubject } from 'rxjs';
import { UserInterface } from '../interface/user-interface ';

export type RadarMode = 'local' | 'hotzone' | 'nearby';

export interface ClientFilters {
  interests: string;
  gender: string;
  address: string;
}

export interface SwiperContext {
  authenticatedProfileId?: string;
  authenticatedUserId?: string;
  currentLocalId?: string;
  currentHotZoneId?: string;
  myLat?: number;
  myLng?: number;
  hasPro?: boolean;
}

export interface ClientSwiperState {
  allClientes: any[];
  clientes: any[];
  currentIndex: number;
  currentPhotoIndex: number;
  currentProfileId: string;
  activeRadarMode: RadarMode;
  filters: ClientFilters;
  hotZoneLocked: boolean;
  localFromHomeLocked: boolean;
  discardedProfileIds: string[];
}

@Injectable({
  providedIn: 'root',
})
export class GlobalService {
  activeRoute: string = '';
  pb = new PocketBase('https://db.ongomatch.com:8090');
  selectedPromo: any = null;
  private clientesSubject = new BehaviorSubject<any[]>([]);
  clientes$ = this.clientesSubject.asObservable();

  private clientSwiperStateSubject = new BehaviorSubject<ClientSwiperState>({
    allClientes: [],
    clientes: [],
    currentIndex: 0,
    currentPhotoIndex: 0,
    currentProfileId: '',
    activeRadarMode: 'local',
    filters: {
      interests: '',
      gender: '',
      address: ''
    },
    hotZoneLocked: false,
    localFromHomeLocked: false,
    discardedProfileIds: []
  });
  clientSwiperState$ = this.clientSwiperStateSubject.asObservable();
  private clientSwiperContext: SwiperContext = {};

  private partnersSubject = new BehaviorSubject<any[]>([]);
  partners$ = this.partnersSubject.asObservable();

  private promosSubject = new BehaviorSubject<any[]>([]);
  promos$ = this.promosSubject.asObservable();

  private planningPartnersSubject = new BehaviorSubject<any[]>([]);
  planningPartners$ = this.planningPartnersSubject.asObservable();

  private planningClientsSubject = new BehaviorSubject<any[]>([]);
  planningClients$ = this.planningClientsSubject.asObservable();

  private clientesSubscribed = false;
  private partnersSubscribed = false;
  private promosSubscribed = false;
  private planningPartnersSubscribed = false;
  private planningClientsSubscribed = false;

  selectedPartner: any = null;
  selectedClient: any = null;
  chatReceiverId: string = '';
  profileData: any = {};
  profileDataPartner: any = {};
  previewCard: any = null;
  promosByPartner: any[] = [];
  selectedServicesPartner: any[] = [];
  allServices: { value: string; label: string }[] = [];

  currentUser: any;

  constructor() {
    this.clearUrlHash();
  }

  async initialize() {
    await this.loadProfile();
    await this.initRealtimeData();
  }

  private async initRealtimeData() {
    if (!this.pb.authStore.isValid) {
      console.warn('No autenticado, omitiendo realtime');
      return;
    }

    await this.initClientesRealtime();
    await this.initPartnersRealtime();
    await this.initPromosRealtime();
    await this.initPlanningPartnersRealtime();
    await this.initPlanningClientsRealtime();
  }

  setRoute(route: string) {
    this.activeRoute = route;
  }

  getRoute(): string {
    return this.activeRoute;
  }

  previewPartner(partner: any) {
    this.selectedPartner = partner;
    this.activeRoute = 'detail-profile-local';
  }

  previewClient(client: any) {
    this.selectedClient = client;
    this.activeRoute = 'detail-profile';
  }

  async loadProfile() {
    if (!this.pb.authStore.isValid) {
      console.warn('No autenticado, omitiendo realtime');
      return;
    }

    const user = this.getCurrentUser();
    if (!user?.id) {
      console.error('No hay usuario autenticado');
      return;
    }

    try {
      let userData;
      if (user.type === 'partner') {
        userData = await this.pb
          .collection('usuariosPartner')
          .getFirstListItem(`userId="${user.id}"`);
        this.profileDataPartner = userData;
      } else {
        userData = await this.pb
          .collection('usuariosClient')
          .getFirstListItem(`userId="${user.id}"`);
        this.profileData = userData;
      }

      this.setUser(userData as unknown as UserInterface);
      localStorage.setItem('profile', JSON.stringify(userData));
    } catch (error: any) {
      if (error && error.status === 404) {
        console.warn('No se encontró el perfil del usuario en la colección correspondiente.');
      } else {
        console.error('Error al cargar el perfil:', error);
      }
    }
  }

  setUser(user: UserInterface) {
    this.currentUser = user;
  }

  getCurrentUser() {
    if (!this.currentUser) {
      const userString = localStorage.getItem('user');
      if (userString) {
        this.currentUser = JSON.parse(userString);
      }
    }
    return this.currentUser;
  }


  public async initClientesRealtime() {
  try {

    const myProfileId = this.profileData?.id;
    const myAuthUserId = this.getCurrentUser()?.id || this.profileData?.userId;

    const result = await this.pb.collection('usuariosClient').getFullList({
      filter: myProfileId
        ? `id != "${myProfileId}"`
        : ''
    });

    console.log('✅ usuariosClient cargados:', result);

    const parsed = result.map((c: any) => ({
      ...c,
      avatar: c.avatar || null
    }));

    this.setClientesSnapshot(
      parsed,
      myProfileId,
      myAuthUserId
    );

    if (!this.clientesSubscribed) {
      this.subscribeRealtime('usuariosClient', this.clientesSubject, false);
      this.clientesSubscribed = true;
    }

  } catch (error) {
    console.error('❌ Error en initClientesRealtime:', error);
    this.clientesSubject.next([]);
  }
}

  public async initPartnersRealtime() {
    try {
      const result = await this.pb.collection('usuariosPartner').getFullList();

      const parsed = result.map((p: any) => ({
        ...p,
        avatar: p.avatar ? this.pb.getFileUrl(p, p.avatar) : null
      }));

      this.partnersSubject.next(parsed);

      if (!this.partnersSubscribed) {
        this.subscribeRealtime('usuariosPartner', this.partnersSubject, true);
        this.partnersSubscribed = true;
      }
    } catch (error) {
      console.error('❌ Error en initPartnersRealtime:', error);
      this.partnersSubject.next([]);
    }
  }

  public async initPromosRealtime() {
    try {
      const result = await this.pb.collection('promos').getFullList();
      this.promosSubject.next(result);

      if (!this.promosSubscribed) {
        this.subscribeRealtime('promos', this.promosSubject);
        this.promosSubscribed = true;
      }
    } catch (error) {
      console.error('❌ Error en initPromosRealtime:', error);
      this.promosSubject.next([]);
    }
  }

  public async initPlanningPartnersRealtime() {
    try {
      const result = await this.pb.collection('planningPartners').getFullList();
      this.planningPartnersSubject.next(result);

      if (!this.planningPartnersSubscribed) {
        this.subscribeRealtime('planningPartners', this.planningPartnersSubject);
        this.planningPartnersSubscribed = true;
      }
    } catch (error) {
      console.error('❌ Error en initPlanningPartnersRealtime:', error);
      this.planningPartnersSubject.next([]);
    }
  }

  public async initPlanningClientsRealtime() {
    try {
      const result = await this.pb.collection('planningClients').getFullList();
      this.planningClientsSubject.next(result);

      if (!this.planningClientsSubscribed) {
        this.subscribeRealtime('planningClients', this.planningClientsSubject);
        this.planningClientsSubscribed = true;
      }
    } catch (error) {
      console.error('❌ Error en initPlanningClientsRealtime:', error);
      this.planningClientsSubject.next([]);
    }
  }

  public subscribeRealtime(
    collection: string,
    subject: BehaviorSubject<any[]>,
    buildFileUrl = false
  ) {
    this.pb.collection(collection).subscribe('*', (e: any) => {
      let record = e.record;

      if (buildFileUrl && record?.avatar) {
        record = {
          ...record,
          avatar: this.pb.getFileUrl(record, record.avatar)
        };
      }

      let current = subject.getValue();

      if (e.action === 'create') {
        current = [...current, record];
      } else if (e.action === 'update') {
        current = current.map((c: any) => (c.id === record.id ? record : c));
      } else if (e.action === 'delete') {
        current = current.filter((c: any) => c.id !== record.id);
      }

      if (collection === 'usuariosClient') {
        current = this.excludeAuthenticatedProfile(
          current,
          this.clientSwiperContext.authenticatedProfileId || this.profileData?.id,
          this.clientSwiperContext.authenticatedUserId || this.getCurrentUser()?.id || this.profileData?.userId
        );
      }

      subject.next(current);

      if (collection === 'usuariosClient') {
        this.setSwiperBaseProfiles(current, {
          preserveCurrentProfile: true,
          resetPhoto: false
        });
      }
    });
  }

  public clearUrlHash() {
    history.replaceState(null, '', window.location.pathname);
  }
  public getClientesSnapshot(): any[] {
  return this.clientesSubject.getValue();
}

public getClientSwiperSnapshot(): ClientSwiperState {
  const state = this.clientSwiperStateSubject.getValue();

  return {
    ...state,
    allClientes: [...state.allClientes],
    clientes: [...state.clientes],
    filters: { ...state.filters },
    discardedProfileIds: [...state.discardedProfileIds]
  };
}

public setSwiperContext(context: SwiperContext): void {
  this.clientSwiperContext = {
    ...this.clientSwiperContext,
    ...context
  };

  this.setClientesSnapshot(
    this.clientesSubject.getValue(),
    this.clientSwiperContext.authenticatedProfileId,
    this.clientSwiperContext.authenticatedUserId
  );

  this.applyClientSwiperState({
    preserveCurrentProfile: true,
    resetPhoto: false
  });
}

public setSwiperBaseProfiles(
  profiles: any[],
  options: {
    preserveCurrentProfile?: boolean;
    resetPhoto?: boolean;
  } = {}
): void {
  const current = this.getClientSwiperSnapshot();
  const baseProfiles = this.excludeAuthenticatedProfile(
    profiles || [],
    this.clientSwiperContext.authenticatedProfileId,
    this.clientSwiperContext.authenticatedUserId
  );
  const nextCurrentProfileId = options.preserveCurrentProfile !== false
    ? current.currentProfileId
    : '';

  this.clientSwiperStateSubject.next({
    ...current,
    allClientes: this.dedupeProfiles(baseProfiles),
    currentProfileId: nextCurrentProfileId,
    currentPhotoIndex: options.resetPhoto === false ? current.currentPhotoIndex : 0
  });

  this.applyClientSwiperState({
    preserveCurrentProfile: options.preserveCurrentProfile !== false,
    resetPhoto: options.resetPhoto !== false
  });
}

public setSwiperMode(mode: RadarMode): void {
  const current = this.getClientSwiperSnapshot();

  this.clientSwiperStateSubject.next({
    ...current,
    activeRadarMode: mode,
    currentProfileId: '',
    currentIndex: 0,
    currentPhotoIndex: 0
  });

  this.applyClientSwiperState({
    preserveCurrentProfile: false,
    resetPhoto: true
  });
}

public setSwiperFilters(filters: ClientFilters): void {
  const current = this.getClientSwiperSnapshot();

  this.clientSwiperStateSubject.next({
    ...current,
    filters: { ...filters },
    currentProfileId: '',
    currentIndex: 0,
    currentPhotoIndex: 0
  });

  this.applyClientSwiperState({
    preserveCurrentProfile: false,
    resetPhoto: true
  });
}

public clearSwiperFilters(): void {
  this.setSwiperFilters({
    interests: '',
    gender: '',
    address: ''
  });
}

public setSwiperPhotoIndex(index: number): void {
  const current = this.getClientSwiperSnapshot();

  this.clientSwiperStateSubject.next({
    ...current,
    currentPhotoIndex: Math.max(0, index)
  });
}

public removeCurrentSwiperProfile(): any | null {
  const current = this.getClientSwiperSnapshot();
  const profile = current.clientes[current.currentIndex];

  if (!profile?.id) {
    return null;
  }

  const discardedProfileIds = Array.from(
    new Set([...current.discardedProfileIds, profile.id])
  );

  this.clientSwiperStateSubject.next({
    ...current,
    discardedProfileIds,
    currentProfileId: '',
    currentPhotoIndex: 0
  });

  this.applyClientSwiperState({
    preserveCurrentProfile: false,
    resetPhoto: true,
    preferredIndex: current.currentIndex
  });

  return profile;
}

public restoreSwiperProfile(profileId: string): void {
  if (!profileId) return;

  const current = this.getClientSwiperSnapshot();
  const discardedProfileIds = current.discardedProfileIds.filter(id => id !== profileId);

  this.clientSwiperStateSubject.next({
    ...current,
    discardedProfileIds,
    currentProfileId: profileId,
    currentPhotoIndex: 0
  });

  this.applyClientSwiperState({
    preserveCurrentProfile: true,
    resetPhoto: true
  });
}

public moveSwiperBy(delta: number): void {
  const current = this.getClientSwiperSnapshot();

  if (!current.clientes.length) return;

  const nextIndex = this.clampIndex(
    current.currentIndex + delta,
    current.clientes.length
  );
  const nextProfile = current.clientes[nextIndex];

  this.clientSwiperStateSubject.next({
    ...current,
    currentIndex: nextIndex,
    currentProfileId: nextProfile?.id || '',
    currentPhotoIndex: 0
  });
}

public normalizeClientSwiperIndex(): void {
  this.applyClientSwiperState({
    preserveCurrentProfile: true,
    resetPhoto: false
  });
}

private setClientesSnapshot(
  profiles: any[],
  authenticatedProfileId?: string,
  authenticatedUserId?: string
): void {
  const filtered = this.excludeAuthenticatedProfile(
    profiles || [],
    authenticatedProfileId,
    authenticatedUserId
  );

  this.clientesSubject.next(this.dedupeProfiles(filtered));
  this.setSwiperBaseProfiles(filtered, {
    preserveCurrentProfile: true,
    resetPhoto: false
  });
}

private applyClientSwiperState(options: {
  preserveCurrentProfile?: boolean;
  resetPhoto?: boolean;
  preferredIndex?: number;
} = {}): void {
  const current = this.getClientSwiperSnapshot();
  const discarded = new Set(current.discardedProfileIds);
  let hotZoneLocked = false;
  let localFromHomeLocked = false;

  let profiles = current.allClientes.filter(profile => !discarded.has(profile.id));
  profiles = this.applyRadarFilter(profiles, current.activeRadarMode);

  if (current.activeRadarMode === 'local') {
    const isInsideLocal = !!this.clientSwiperContext.currentLocalId;
    const hasPro = !!this.clientSwiperContext.hasPro;

    if (!isInsideLocal && !hasPro) {
      localFromHomeLocked = true;
      profiles = [];
    }
  }

  if (current.activeRadarMode === 'hotzone' && !this.clientSwiperContext.hasPro) {
    hotZoneLocked = true;
    profiles = [];
  }

  profiles = this.applyClientFilters(profiles, current.filters);

  const restoredIndex = options.preserveCurrentProfile && current.currentProfileId
    ? profiles.findIndex(profile => profile.id === current.currentProfileId)
    : -1;
  const fallbackIndex = options.preferredIndex ?? current.currentIndex;
  const currentIndex = restoredIndex >= 0
    ? restoredIndex
    : this.clampIndex(fallbackIndex, profiles.length);
  const currentProfileId = profiles[currentIndex]?.id || '';

  this.clientSwiperStateSubject.next({
    ...current,
    clientes: profiles,
    currentIndex,
    currentPhotoIndex: options.resetPhoto === false ? current.currentPhotoIndex : 0,
    currentProfileId,
    hotZoneLocked,
    localFromHomeLocked
  });
}

private applyRadarFilter(profiles: any[], mode: RadarMode): any[] {
  if (mode === 'local') {
    return profiles.filter(profile =>
      !!this.clientSwiperContext.currentLocalId &&
      profile.currentPartnerId === this.clientSwiperContext.currentLocalId
    );
  }

  if (mode === 'hotzone') {
    return profiles.filter(profile =>
      !!this.clientSwiperContext.currentHotZoneId &&
      profile.currentHotZoneId === this.clientSwiperContext.currentHotZoneId
    );
  }

  if (mode === 'nearby') {
    const myLat = Number(this.clientSwiperContext.myLat);
    const myLng = Number(this.clientSwiperContext.myLng);

    return profiles.filter(profile => {
      const clientLat = Number(profile.lat);
      const clientLng = Number(profile.lng);

      if (!myLat || !myLng || !clientLat || !clientLng) return false;

      return this.calculateDistanceMeters(myLat, myLng, clientLat, clientLng) <= 500;
    });
  }

  return profiles;
}

private applyClientFilters(profiles: any[], filters: ClientFilters): any[] {
  const interests = filters.interests.trim().toLowerCase();
  const gender = filters.gender.trim().toLowerCase();
  const address = filters.address.trim().toLowerCase();

  if (!interests && !gender && !address) {
    return profiles;
  }

  return profiles.filter((client: any) => {
    const clientInterests = String(client.interests || '').toLowerCase();
    const clientGender = String(client.gender || '').toLowerCase();
    const clientAddress = String(client.address || '').toLowerCase();

    const matchInterests = !interests || clientInterests.includes(interests);
    const matchGender = !gender || clientGender === gender;
    const matchAddress = !address || clientAddress.includes(address);

    return matchInterests && matchGender && matchAddress;
  });
}

private excludeAuthenticatedProfile(
  profiles: any[],
  authenticatedProfileId?: string,
  authenticatedUserId?: string
): any[] {
  if (!authenticatedProfileId && !authenticatedUserId) {
    return profiles;
  }

  return profiles.filter(profile => {
    const profileId = String(profile?.id || '');
    const profileUserId = String(profile?.userId || profile?.user || '');

    return (
      (!authenticatedProfileId || profileId !== authenticatedProfileId) &&
      (!authenticatedUserId || profileUserId !== authenticatedUserId)
    );
  });
}

private dedupeProfiles(profiles: any[]): any[] {
  const seen = new Set<string>();

  return profiles.filter(profile => {
    if (!profile?.id || seen.has(profile.id)) {
      return false;
    }

    seen.add(profile.id);
    return true;
  });
}

private clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
}

private calculateDistanceMeters(
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

async getPartnerStats(partnerId:string){

  try {

    return await this.pb.collection('partner_stats')
      .getFirstListItem(
        `partnerId="${partnerId}"`,
        {
          requestKey:null
        }
      );

  } catch {

    return null;

  }

}
}
