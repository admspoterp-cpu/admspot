import { Component, inject } from '@angular/core';
import { NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { GESTOR_ORIGIN } from '../../services/api-base-url';
import { AuthSessionService } from '../../services/auth-session.service';
import type { UserProfilePayload } from '../../services/user-profile.service';
import { UserProfileService } from '../../services/user-profile.service';
import type {
  WalletEntityPayload,
  WalletProfileUpdateCepResponse,
} from '../../services/wallet-profile.service';
import { WalletProfileService } from '../../services/wallet-profile.service';
import {
  digitsOnly,
  formatCepMask,
  formatCpfCnpjMask,
  formatWhatsappBrMask,
  isValidCepDigits,
} from '../../shared/utils/client-form-mask.util';
import { fetchViaCepDigits } from '../../shared/utils/viacep.util';
import {
  BRL_ZERO_DISPLAY,
  apiReaisStringToBrlDisplay,
  brlDisplayToApiReaisString,
} from '../../shared/utils/brl-currency.util';

const G = 'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1';

/** API omitiu o campo ou veio vazio — não tratar como zero monetário para merge. */
function hasApiMoneyValue(raw: unknown): boolean {
  if (raw === null || raw === undefined) {
    return false;
  }
  return String(raw).trim() !== '';
}

/**
 * Resposta de update pode vir sem `spending_cap` / `earning_goal`; nesse caso mantém
 * os valores já carregados para não zerar metas no formulário nem em `lastWallet`.
 */
function mergeWalletPreserveMoneyFields(
  previous: WalletEntityPayload | null,
  incoming: WalletEntityPayload,
): WalletEntityPayload {
  if (!previous) {
    return incoming;
  }
  const merged: WalletEntityPayload = { ...previous, ...incoming };
  if (!hasApiMoneyValue(incoming.spending_cap)) {
    merged.spending_cap = previous.spending_cap;
  }
  if (!hasApiMoneyValue(incoming.earning_goal)) {
    merged.earning_goal = previous.earning_goal;
  }
  return merged;
}

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

  readonly tipoTributacaoOptions = [
    { value: 'ME', label: 'ME' },
    { value: 'MEI', label: 'MEI' },
    { value: 'LTDA', label: 'LTDA' },
  ];

  readonly walletRegimeOptions = [
    { value: 'INDIVIDUAL', label: 'Individual' },
    { value: 'SIMPLES_NACIONAL', label: 'Simples Nacional' },
    { value: 'LUCRO_PRESUMIDO', label: 'Lucro presumido' },
    { value: 'LUCRO_REAL', label: 'Lucro real' },
  ];

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

  walletLoading = false;
  walletLoadError: string | null = null;
  walletEditMode = false;
  walletSaveBusy = false;
  walletCepLookupBusy = false;

  wWalletName = '';
  /** Valor bruto da API (`APPROVED` | `REJECTED` | `BLOQUED` | …); `null` = não exibir bloco. */
  wHasDigitalAccountRaw: string | null = null;
  wWalletTokenDisplay = '';
  wEmail = '';
  wContact = '';
  wAtividade = '';
  wTipoTributacao = 'ME';
  wSpendingCap = BRL_ZERO_DISPLAY;
  wEarningGoal = BRL_ZERO_DISPLAY;
  /** Feedback após copiar o token (borda / estado visual). */
  walletTokenCopied = false;
  wStreet = '';
  wDistrict = '';
  wNumber = '';
  wCountry = '';
  wState = '';
  wCity = '';
  wZipcodeDisplay = '';
  wDocumentDisplay = '';
  wNomeFantasia = '';
  wCompanyRegistroDate = '';
  wType = 'INDIVIDUAL';

  wWorkspotServerUrl: string | null = null;
  wNewWorkspotPreview: string | null = null;
  private pendingWorkspotDataUrl = '';
  /** Exposto ao template para exibir o formulário após o GET da wallet. */
  lastWallet: WalletEntityPayload | null = null;

  private walletTokenCopyTimer: number | null = null;

  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);
  private readonly toastController = inject(ToastController);
  private readonly userProfile = inject(UserProfileService);
  private readonly walletProfile = inject(WalletProfileService);

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

  /** Nome do gestor a partir dos dados pessoais (Meus dados), somente leitura na aba Wallet. */
  get gestorNomeFromUser(): string {
    const n = `${this.firstName} ${this.lastName}`.trim();
    return n || '—';
  }

  /** Exibe "Conta digital" só para estes valores (API em inglês). */
  get showContaDigital(): boolean {
    const k = this.digitalAccountNormalizedKey;
    return k !== null && ['APPROVED', 'REJECTED', 'BLOQUED', 'BLOCKED'].includes(k);
  }

  /** Rótulo em PT para o valor atual. */
  get contaDigitalLabelPt(): string {
    const k = this.digitalAccountNormalizedKey;
    if (!k) {
      return '';
    }
    const map: Record<string, string> = {
      APPROVED: 'Aprovada',
      REJECTED: 'Rejeitada',
      BLOQUED: 'Bloqueada',
      BLOCKED: 'Bloqueada',
    };
    return map[k] ?? '';
  }

  private get digitalAccountNormalizedKey(): string | null {
    const r = this.wHasDigitalAccountRaw;
    if (r == null) {
      return null;
    }
    const t = String(r).trim().toUpperCase();
    return t.length ? t : null;
  }

  async copyWalletToken(): Promise<void> {
    const t = this.wWalletTokenDisplay?.trim();
    if (!t) {
      return;
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(t);
      } else {
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      if (this.walletTokenCopyTimer != null) {
        window.clearTimeout(this.walletTokenCopyTimer);
      }
      this.walletTokenCopied = true;
      this.walletTokenCopyTimer = window.setTimeout(() => {
        this.walletTokenCopied = false;
        this.walletTokenCopyTimer = null;
      }, 2200);
      await this.presentToast('Token copiado.', 'success');
    } catch {
      await this.presentToast('Não foi possível copiar.', 'warning');
    }
  }

  get displayWorkspotSrc(): string {
    if (this.wNewWorkspotPreview) {
      return this.wNewWorkspotPreview;
    }
    if (this.wWorkspotServerUrl) {
      return this.wWorkspotServerUrl;
    }
    return this.avatarPlaceholderSrc;
  }

  onSegmentChange(ev: CustomEvent): void {
    const v = ev.detail?.value;
    if (v === 'meus-dados' || v === 'minha-wallet') {
      this.selectedTab = v;
      if (v === 'minha-wallet' && !this.walletLoading) {
        const token = this.authSession.getAccessToken();
        const wt = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
        if (token && wt && !this.lastWallet) {
          void this.loadWalletProfile(token, wt);
        }
      }
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

  onWalletEditToggle(ev: CustomEvent): void {
    const checked = Boolean(ev.detail?.checked);
    this.walletEditMode = checked;
    if (!checked && this.lastWallet) {
      this.applyWalletToForm(this.lastWallet);
      this.clearWorkspotPreview();
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

  onWalletDocumentInput(ev: Event): void {
    if (!this.walletEditMode) {
      return;
    }
    const el = ev.target as HTMLInputElement;
    const masked = formatCpfCnpjMask(el.value);
    this.wDocumentDisplay = masked;
    el.value = masked;
  }

  onWalletCepInput(ev: Event): void {
    if (!this.walletEditMode) {
      return;
    }
    const el = ev.target as HTMLInputElement;
    const masked = formatCepMask(el.value);
    this.wZipcodeDisplay = masked;
    el.value = masked;
  }

  async onWalletCepBlur(): Promise<void> {
    if (!this.walletEditMode) {
      return;
    }
    const d = digitsOnly(this.wZipcodeDisplay);
    if (!isValidCepDigits(d)) {
      return;
    }
    this.walletCepLookupBusy = true;
    try {
      const via = await fetchViaCepDigits(d);
      if (!via) {
        await this.presentToast('CEP não encontrado.', 'warning');
        return;
      }
      this.wStreet = (via.logradouro ?? '').trim();
      this.wDistrict = (via.bairro ?? '').trim();
      this.wCity = (via.localidade ?? '').trim();
      this.wState = (via.uf ?? '').trim();
      this.wCountry = 'BRASIL';
    } finally {
      this.walletCepLookupBusy = false;
    }
  }

  onWorkspotLogoSelected(ev: Event): void {
    if (!this.walletEditMode) {
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
        this.wNewWorkspotPreview = r;
        this.pendingWorkspotDataUrl = r;
      }
    };
    reader.readAsDataURL(file);
  }

  clearWorkspotPreview(input?: HTMLInputElement): void {
    this.wNewWorkspotPreview = null;
    this.pendingWorkspotDataUrl = '';
    if (input) {
      input.value = '';
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

  async onWalletSave(): Promise<void> {
    if (!this.walletEditMode || this.walletSaveBusy) {
      return;
    }
    const token = this.authSession.getAccessToken();
    const walletToken = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
    if (!token || !walletToken) {
      void this.navController.navigateRoot('/login');
      return;
    }
    const name = this.wWalletName.trim();
    if (!name) {
      void this.presentToast('Informe o nome da wallet.', 'warning');
      return;
    }
    const zipDigits = digitsOnly(this.wZipcodeDisplay);
    if (!isValidCepDigits(zipDigits)) {
      void this.presentToast('CEP da wallet inválido (8 dígitos).', 'warning');
      return;
    }
    const contactDigits = digitsOnly(this.wContact);
    if (contactDigits.length < 10 || contactDigits.length > 15) {
      void this.presentToast('Informe um contato válido (só dígitos, DDD + número).', 'warning');
      return;
    }
    if (!this.wEmail.trim()) {
      void this.presentToast('Informe o e-mail da wallet.', 'warning');
      return;
    }
    if (!this.wCompanyRegistroDate) {
      void this.presentToast('Informe a data de registro da empresa.', 'warning');
      return;
    }

    this.walletSaveBusy = true;
    try {
      const body = {
        wallet_token: walletToken,
        zipcode: zipDigits,
        number: this.wNumber.trim(),
        workspot_logo: this.pendingWorkspotDataUrl || '',
        wallet: name,
        nome_fantasia: this.wNomeFantasia.trim(),
        email: this.wEmail.trim(),
        contact: contactDigits,
        atividade: this.wAtividade.trim(),
        company_registro_date: this.wCompanyRegistroDate,
        spending_cap: brlDisplayToApiReaisString(this.wSpendingCap),
        earning_goal: brlDisplayToApiReaisString(this.wEarningGoal),
        type: this.wType,
        tipo_tributacao: this.wTipoTributacao,
      };
      const res = await this.walletProfile.updateProfile(token, body);
      if (!res) {
        await this.presentToast('Não foi possível salvar os dados da wallet. Tente novamente.', 'danger');
        return;
      }
      if (!res.success) {
        await this.presentToast(res.message ?? 'Erro ao atualizar dados da wallet.', 'danger');
        return;
      }
      if (res.wallet) {
        this.lastWallet = mergeWalletPreserveMoneyFields(this.lastWallet, res.wallet);
        this.clearWorkspotPreview();
        this.applyWalletToForm(this.lastWallet);
      } else {
        await this.loadWalletProfile(token, walletToken);
      }
      this.applyCepFromUpdateResponse(res.cep);
      this.walletEditMode = false;
      await this.presentToast(res.message ?? 'Dados da wallet atualizados.', 'success');
    } finally {
      this.walletSaveBusy = false;
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

      const wt = this.authSession.getDefaultWallet()?.wallet_token_account?.trim();
      if (wt) {
        void this.loadWalletProfile(token, wt);
      } else {
        this.walletLoadError = 'Nenhuma carteira padrão. Escolha uma carteira antes.';
        this.lastWallet = null;
      }
    } finally {
      this.loading = false;
    }
  }

  private async loadWalletProfile(accessToken: string, walletToken: string): Promise<void> {
    this.walletLoading = true;
    this.walletLoadError = null;
    try {
      const data = await this.walletProfile.fetchProfile(accessToken, walletToken);
      if (!data?.success || !data.wallet) {
        this.walletLoadError = data?.message ?? 'Não foi possível carregar os dados da wallet.';
        this.lastWallet = null;
        return;
      }
      this.lastWallet = data.wallet;
      this.walletEditMode = false;
      this.clearWorkspotPreview();
      this.applyWalletToForm(data.wallet);
      const rootTok = data.wallet_token?.trim() || data.wallet.wallet_token_account?.trim();
      if (rootTok) {
        this.wWalletTokenDisplay = rootTok;
      }
    } finally {
      this.walletLoading = false;
    }
  }

  /** Endereço devolvido pelo gestor após `POST .../wallet/profile/update` (objeto `cep`). */
  private applyCepFromUpdateResponse(cep: WalletProfileUpdateCepResponse | undefined): void {
    if (!cep?.ok) {
      return;
    }
    const d = cep.data;
    if (d) {
      if (d.logradouro?.trim()) {
        this.wStreet = d.logradouro.trim();
      }
      if (d.bairro?.trim()) {
        this.wDistrict = d.bairro.trim();
      }
      if (d.localidade?.trim()) {
        this.wCity = d.localidade.trim();
      }
      if (d.uf?.trim()) {
        this.wState = d.uf.trim();
      }
      const z = d.cep;
      if (z) {
        this.wZipcodeDisplay = formatCepMask(digitsOnly(z));
      }
    }
    const filled = cep.filled;
    if (filled?.city?.trim()) {
      this.wCity = filled.city.trim();
    }
    if (filled?.state?.trim()) {
      this.wState = filled.state.trim();
    }
    if (filled?.zipcode) {
      this.wZipcodeDisplay = formatCepMask(digitsOnly(filled.zipcode));
    }
    this.wCountry = 'BRASIL';
  }

  private applyWalletToForm(w: WalletEntityPayload): void {
    this.wWalletName = (w.wallet ?? '').trim();
    const hda = w.has_digital_account;
    if (hda === null || hda === undefined) {
      this.wHasDigitalAccountRaw = null;
    } else {
      const s = String(hda).trim();
      this.wHasDigitalAccountRaw = s.length ? s : null;
    }
    this.wWalletTokenDisplay = (w.wallet_token_account ?? this.wWalletTokenDisplay ?? '').trim();
    this.wEmail = (w.email ?? '').trim();
    this.wContact = (w.contact ?? '').trim();
    this.wAtividade = (w.atividade ?? '').trim();
    const tt = (w.tipo_tributacao ?? 'ME').trim().toUpperCase();
    this.wTipoTributacao = ['ME', 'MEI', 'LTDA', 'LDTA'].includes(tt) ? tt : 'ME';
    this.wSpendingCap = apiReaisStringToBrlDisplay(w.spending_cap);
    this.wEarningGoal = apiReaisStringToBrlDisplay(w.earning_goal);
    this.wStreet = (w.street ?? '').trim();
    this.wDistrict = (w.district ?? '').trim();
    this.wNumber = (w.number ?? '').trim();
    this.wCountry = (w.country ?? '').trim() || 'BRASIL';
    this.wState = (w.state ?? '').trim();
    this.wCity = (w.city ?? '').trim();
    this.wZipcodeDisplay = formatCepMask((w.zipcode ?? '').replace(/\D/g, ''));
    const doc = w.document ?? w.cnpj ?? '';
    this.wDocumentDisplay = formatCpfCnpjMask(doc);
    this.wNomeFantasia = (w.nome_fantasia ?? '').trim();
    const cr = (w.company_registro_date ?? '').trim();
    this.wCompanyRegistroDate = cr.length >= 10 ? cr.slice(0, 10) : cr;
    const ty = (w.type ?? 'INDIVIDUAL').trim().toUpperCase();
    const allowed = this.walletRegimeOptions.map((o) => o.value);
    this.wType = allowed.includes(ty) ? ty : 'INDIVIDUAL';
    this.wWorkspotServerUrl = photoUrlFromPath(w.workspot_logo);
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
