import { Component, inject } from '@angular/core';
import { NavController, ViewWillEnter } from '@ionic/angular';

import { AuthSessionService } from '../../services/auth-session.service';
import {
  SUPORTE_MOTIVOS,
  type SuporteChamado,
  SuporteChamadosService,
} from '../../services/suporte-chamados.service';

@Component({
  selector: 'app-suporte',
  templateUrl: './suporte.page.html',
  styleUrls: ['./suporte.page.scss'],
  standalone: false,
})
export class SuportePage implements ViewWillEnter {
  private readonly navController = inject(NavController);
  private readonly authSession = inject(AuthSessionService);
  private readonly suporte = inject(SuporteChamadosService);

  readonly caretLeftSrc =
    'https://storage.googleapis.com/uxpilot-auth.appspot.com/PpDwGQ71w5RZv155vdRkzs78Kdu1/CaretLeft-929df931-e44c-4c48-af18-efc51b7cea16.svg';

  readonly motivos = SUPORTE_MOTIVOS;

  motivoSelecionado: string | null = null;
  descricao = '';
  /** Nome do arquivo escolhido na abertura (somente referência local). */
  anexoNome: string | null = null;

  chamados: SuporteChamado[] = [];
  abrirChamadoBusy = false;

  ionViewWillEnter(): void {
    if (this.authSession.isTokenExpired()) {
      this.authSession.clear();
      void this.navController.navigateRoot('/login');
      return;
    }
    this.recarregarLista();
  }

  get motivoLabelAtual(): string {
    const v = this.motivoSelecionado;
    if (!v) {
      return '';
    }
    return this.motivos.find((m) => m.value === v)?.label ?? '';
  }

  get podeAbrirChamado(): boolean {
    return (
      !!this.motivoSelecionado &&
      this.descricao.trim().length > 0 &&
      !this.abrirChamadoBusy
    );
  }

  recarregarLista(): void {
    this.chamados = this.suporte.listar();
  }

  onMotivoChange(): void {
    if (!this.motivoSelecionado) {
      this.descricao = '';
      this.limparAnexo();
    }
  }

  onArquivoAbertura(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.anexoNome = null;
      return;
    }
    this.anexoNome = file.name;
    input.value = '';
  }

  limparAnexo(): void {
    this.anexoNome = null;
  }

  abrirChamado(): void {
    if (!this.podeAbrirChamado || !this.motivoSelecionado) {
      return;
    }
    const motivoLabel = this.motivoLabelAtual;
    this.abrirChamadoBusy = true;
    try {
      this.suporte.criarChamado({
        motivoValue: this.motivoSelecionado,
        motivoLabel,
        descricao: this.descricao.trim(),
        anexoNome: this.anexoNome ?? undefined,
      });
      this.motivoSelecionado = null;
      this.descricao = '';
      this.limparAnexo();
      this.recarregarLista();
    } finally {
      this.abrirChamadoBusy = false;
    }
  }

  /** Título curto na lista: trecho da mensagem ou motivo. */
  tituloLista(c: SuporteChamado): string {
    const texto = (c.descricao ?? c.messages[0]?.text ?? '').trim();
    if (!texto) {
      return c.motivoLabel;
    }
    const max = 52;
    return texto.length > max ? `${texto.slice(0, max)}…` : texto;
  }

  statusLabel(status: SuporteChamado['status']): string {
    return status === 'respondido' ? 'Respondido' : 'Aguardando';
  }

  irParaChamado(c: SuporteChamado): void {
    void this.navController.navigateForward(['/suporte/chamado', c.id]);
  }

  goBack(): void {
    void this.navController.back();
  }
}
