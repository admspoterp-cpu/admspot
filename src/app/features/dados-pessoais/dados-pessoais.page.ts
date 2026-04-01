import { Component, inject } from '@angular/core';
import { NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { GESTOR_ORIGIN } from '../../services/api-base-url';
import { AuthSessionService } from '../../services/auth-session.service';
import type { UserProfilePayload } from '../../services/user-profile.service';
import { UserProfileService } from '../../services/user-profile.service';
import {
  digitsOnly,
  formatCepMask,
  formatCpfCnpjMask,
  formatWhatsappBrMask,
  isValidCepDigits,
} from '../../shared/utils/client-form-mask.util';

const G = 'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

function photoUrlFromPath(photo: string | undefined): string | null {
  if (!photo?.trim()) {
    return null;
  }
  const p = photo.trim();
  if (/^https?:\/\//i.test(p)) {
    return p;
  }
  const path = p.startsWith('/') ? p.slice(1) : p;
  return `${GESTOR_ORIGIN}/${path}`;
}

function formatDateTimeBr(raw: string | undefined): string {
  if (!raw?.trim()) {
    return '—';
  }
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) {
    return raw;
  }
  return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
}

function statusLabel(s: string | undefined): string {
  const v = (s ?? '').toLowerCase();
  const map: Record<string, string> = {
    confirmed: 'Confirmado',
    pending: 'Pendente',
    active: 'Ativo',
    inactive: 'Inativo',
  };
  return map[v] ?? (s && s.length > 0 ? s : '—');
}

@Component({
  selector: 'app-dados-pessoais',
  templateUrl: './dados-pessoais.page.html',
  styleUrls: ['./dados-pessoais.page.scss'],
  standalone: false,
})
export class DadosPessoaisPage implements ViewWillEnter {
  readonly caretLeftSrc = `${G}/CaretLeft-551d7cb4-ea42-4617-adb3-2d33f5ed3da9.svg`;
  readonly avatarPlaceholderSrc = `${G}/Frame427319717-82588a42-8267-485c-b49b-e07e0051f7bf.svg`;

  selectedTab: 'meus-dados' | 'minha-wallet' = 'meus-dados';
  editMode = false;
  loading = false;
  loadError: string | null = null;
  saveBusy = false;

  firstName = '';
  lastName = '';
  email = '';
  documentDisplay = '';
  genre = 'male';
  datebirth = '';
  whatsappDisplay = '';
  postalCodeDisplay = '';
  state = '';
  city = '';
  statusDisplay = '';
  createdAtDisplay = '';
  updatedAtDisplay = '';

  photoServerUrl: string | null = null;
  newPhotoPreview: string | null = null;
  private pendingPhotoDataUrl = '';
  private lastUser: UserProfilePayload | null = null;

  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);
  private readonly toastController = inject(ToastController);
  private readonly userProfile = inject(UserProfileService);

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    void this.loadProfile();
  }

  goBack(): void {
    void this.navController.back();
  }

  onSegmentChange(ev: CustomEvent): void {
    const v = ev.detail?.value;
    if (v === 'meus-dados' || v === 'minha-wallet') {
      this.selectedTab = v;
    }
  }

  onEditToggle(ev: CustomEvent): void {
    const checked = Boolean(ev.detail?.checked);
    this.editMode = checked;
    if (!checked && this.lastUser) {
      this.applyUserToForm(this.lastUser);
      this.clearNewPhoto();
    }
  }

  get displayAvatarSrc(): string {
    if (this.newPhotoPreview) {
      return this.newPhotoPreview;
    }
    if (this.photoServerUrl) {
      return this.photoServerUrl;
    }
    return this.avatarPlaceholderSrc;
  }

  onWhatsappInput(ev: Event): void {
    if (!this.editMode) {
      return;
    }
    const el = ev.target as HTMLInputElement;
    const masked = formatWhatsappBrMask(el.value);
    this.whatsappDisplay = masked;
    el.value = masked;
  }

  onCepInput(ev: Event): void {
    if (!this.editMode) {
      return;
    }
    const el = ev.target as HTMLInputElement;
    const masked = formatCepMask(el.value);
    this.postalCodeDisplay = masked;
    el.value = masked;
  }

  onPhotoSelected(ev: Event): void {
    if (!this.editMode) {
      return;
    }
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    if (!/^image\/(jpeg|png)$/i.test(file.type)) {
      void this.presentToast('Use uma imagem JPEG ou PNG.', 'warning');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result as string;
      if (typeof r === 'string' && r.startsWith('data:')) {
        this.newPhotoPreview = r;
        this.pendingPhotoDataUrl = r;
      }
    };
    reader.readAsDataURL(file);
  }

  clearNewPhoto(photoInput?: HTMLInputElement): void {
    this.newPhotoPreview = null;
    this.pendingPhotoDataUrl = '';
    if (photoInput) {
      photoInput.value = '';
    }
  }

  async onSave(): Promise<void> {
    if (!this.editMode || this.saveBusy) {
      return;
    }
    const token = this.authSession.getAccessToken();
    if (!token) {
      void this.navController.navigateRoot('/login');
      return;
    }
    const fn = this.firstName.trim();
    const ln = this.lastName.trim();
    if (!fn || !ln) {
      void this.presentToast('Preencha nome e sobrenome.', 'warning');
      return;
    }
    const cepDigits = digitsOnly(this.postalCodeDisplay);
    if (!isValidCepDigits(cepDigits)) {
      void this.presentToast('CEP inválido (8 dígitos).', 'warning');
      return;
    }
    const waDigits = digitsOnly(this.whatsappDisplay);
    if (waDigits.length < 10 || waDigits.length > 11) {
      void this.presentToast('WhatsApp inválido.', 'warning');
      return;
    }
    if (!this.datebirth) {
      void this.presentToast('Informe a data de nascimento.', 'warning');
      return;
    }

    this.saveBusy = true;
    try {
      const body = {
        first_name: fn,
        last_name: ln,
        genre: this.genre,
        datebirth: this.datebirth,
        whatsapp: waDigits,
        photo: this.pendingPhotoDataUrl || '',
        postal_code: cepDigits,
      };
      const res = await this.userProfile.updateProfile(token, body);
      if (!res) {
        await this.presentToast('Não foi possível salvar. Tente novamente.', 'danger');
        return;
      }
      if (!res.success) {
        await this.presentToast(res.message ?? 'Erro ao atualizar perfil.', 'danger');
        return;
      }
      if (res.user) {
        this.lastUser = res.user;
        this.newPhotoPreview = null;
        this.pendingPhotoDataUrl = '';
        this.applyUserToForm(res.user);
        const cur = this.authSession.getUser();
        const u = res.user;
        if (cur && u.id != null) {
          this.authSession.updateUserProfile({
            ...cur,
            first_name: (u.first_name ?? cur.first_name).trim() || cur.first_name,
            last_name: (u.last_name ?? cur.last_name).trim() || cur.last_name,
            email: (u.email ?? cur.email).trim() || cur.email,
            level: typeof u.level === 'number' ? u.level : cur.level,
            ...(u.document !== undefined &&
            u.document !== null &&
            String(u.document).length > 0
              ? { document: String(u.document) }
              : {}),
          });
        }
      } else {
        await this.loadProfile();
      }
      this.editMode = false;
      await this.presentToast(res.message ?? 'Perfil atualizado.', 'success');
    } finally {
      this.saveBusy = false;
    }
  }

  private async loadProfile(): Promise<void> {
    const token = this.authSession.getAccessToken();
    if (!token) {
      void this.navController.navigateRoot('/login');
      return;
    }
    this.loading = true;
    this.loadError = null;
    try {
      const data = await this.userProfile.fetchProfile(token);
      if (!data?.success || !data.user) {
        this.loadError = data?.message ?? 'Não foi possível carregar seus dados.';
        return;
      }
      this.newPhotoPreview = null;
      this.pendingPhotoDataUrl = '';
      this.lastUser = data.user;
      this.applyUserToForm(data.user);
    } finally {
      this.loading = false;
    }
  }

  private applyUserToForm(u: UserProfilePayload): void {
    this.firstName = (u.first_name ?? '').trim();
    this.lastName = (u.last_name ?? '').trim();
    this.email = (u.email ?? '').trim();
    this.documentDisplay = formatCpfCnpjMask(u.document ?? '');
    this.genre = (u.genre ?? 'male').trim() || 'male';
    const db = (u.datebirth ?? '').trim();
    this.datebirth = db.length >= 10 ? db.slice(0, 10) : db;
    this.whatsappDisplay = formatWhatsappBrMask(u.whatsapp ?? '');
    this.postalCodeDisplay = formatCepMask(u.postal_code ?? '');
    this.state = (u.state ?? '').trim() || '—';
    this.city = (u.city ?? '').trim() || '—';
    this.statusDisplay = statusLabel(u.status);
    this.createdAtDisplay = formatDateTimeBr(u.created_at);
    this.updatedAtDisplay = formatDateTimeBr(u.updated_at);
    this.photoServerUrl = photoUrlFromPath(u.photo);
  }

  private async presentToast(
    message: string,
    color: 'success' | 'warning' | 'danger' | 'medium',
  ): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 2600,
      position: 'bottom',
      color,
    });
    await toast.present();
  }
}
