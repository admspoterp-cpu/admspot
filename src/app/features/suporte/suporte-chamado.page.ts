import { Component, inject, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent, NavController, ToastController, ViewWillEnter } from '@ionic/angular';

import { AuthSessionService } from '../../services/auth-session.service';
import type { SuporteChamado, SuporteMensagem } from '../../services/suporte-chamados.service';
import { SuporteChamadosService } from '../../services/suporte-chamados.service';

@Component({
  selector: 'app-suporte-chamado',
  templateUrl: './suporte-chamado.page.html',
  styleUrls: ['./suporte-chamado.page.scss'],
  standalone: false,
})
export class SuporteChamadoPage implements ViewWillEnter {
  @ViewChild(IonContent) private content?: IonContent;

  private readonly route = inject(ActivatedRoute);
  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);
  private readonly suporte = inject(SuporteChamadosService);
  private readonly toastController = inject(ToastController);

  readonly caretLeftSrc =
    'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1/CaretLeft-929df931-e44c-4c48-af18-efc51b7cea16.svg';

  chamado: SuporteChamado | null = null;
  respostaTexto = '';
  anexoRespostaNome: string | null = null;
  enviando = false;

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.voltarComErro('Chamado inválido.');
      return;
    }
    this.carregar(id);
  }

  private async voltarComErro(msg: string): Promise<void> {
    const t = await this.toastController.create({
      message: msg,
      duration: 2200,
      position: 'bottom',
      color: 'warning',
    });
    await t.present();
    void this.navController.back();
  }

  private carregar(id: string): void {
    const c = this.suporte.obterPorId(id);
    if (!c) {
      void this.voltarComErro('Chamado não encontrado.');
      return;
    }
    this.chamado = c;
    this.respostaTexto = '';
    this.anexoRespostaNome = null;
  }

  get mensagensOrdenadas(): SuporteMensagem[] {
    const c = this.chamado;
    if (!c?.messages?.length) {
      return [];
    }
    return [...c.messages].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  get podeEnviar(): boolean {
    return (
      !this.enviando &&
      (this.respostaTexto.trim().length > 0 || !!this.anexoRespostaNome)
    );
  }

  onArquivoResposta(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.anexoRespostaNome = null;
      return;
    }
    this.anexoRespostaNome = file.name;
    input.value = '';
  }

  limparAnexoResposta(): void {
    this.anexoRespostaNome = null;
  }

  async enviarResposta(): Promise<void> {
    if (!this.chamado || !this.podeEnviar) {
      return;
    }
    const texto = this.respostaTexto.trim();
    const anexo = this.anexoRespostaNome ?? undefined;
    if (!texto && !anexo) {
      return;
    }
    this.enviando = true;
    try {
      const atualizado = this.suporte.adicionarRespostaUsuario(
        this.chamado.id,
        texto || '(Anexo)',
        anexo,
      );
      if (atualizado) {
        this.chamado = atualizado;
      }
      this.respostaTexto = '';
      this.anexoRespostaNome = null;
      setTimeout(() => {
        void this.content?.scrollToBottom(320);
      }, 80);
    } finally {
      this.enviando = false;
    }
  }

  dataHoraCurta(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  }

  goBack(): void {
    void this.navController.back();
  }
}
