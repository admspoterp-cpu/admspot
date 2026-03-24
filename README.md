# AdmSpot Finance

Projeto base em Ionic + Angular + Capacitor, estruturado para evoluir como aplicativo financeiro.

## Estrutura inicial

- `src/app/core`: modelos e servicos centrais da aplicacao.
- `src/app/features`: modulos de funcionalidades (dashboard e transacoes).
- `src/app/shared`: pasta reservada para componentes reutilizaveis.

## Rotas iniciais

- `/dashboard`: visao geral com resumo financeiro.
- `/transactions`: listagem de transacoes.

## Comandos

- `npm start`: sobe o app em modo desenvolvimento.
- `npm run build`: gera build de producao.
- `npm run test`: executa testes unitarios.
- `npx cap sync`: sincroniza plugins nativos (obrigatório após instalar dependências como `@capgo/capacitor-native-biometric`).

## Login com biometria (Face ID / digital)

O botão **Acessar** na rota `/login` só avança para o dashboard após **`NativeBiometric.verifyIdentity`** no app nativo (não no browser).

- **iOS**: Face ID ou Touch ID (`useFallback: false` — não usa o código do dispositivo como alternativa no fluxo atual).
- **Android**: impressão digital ou face, conforme o dispositivo (BiometricPrompt).

### iOS — `NSFaceIDUsageDescription`

Depois de `npx cap add ios`, adicione em `ios/App/App/Info.plist` (obrigatório para o Face ID aparecer):

```xml
<key>NSFaceIDUsageDescription</key>
<string>Usamos o Face ID para confirmar seu acesso à conta AdmSpot Finance.</string>
```

### Android

O manifest inclui `USE_BIOMETRIC`. O plugin está referenciado em `android/capacitor.settings.gradle` e `android/app/capacitor.build.gradle` (regenerados pelo `npx cap sync` quando possível).

## Orientação da tela

- **Padrão:** retrato em todo o app (`AppComponent` + `@capawesome/capacitor-screen-orientation`).
- **Exceção:** na rota `/boleto-scan` (leitor de código de barras do boleto) a orientação passa a **paisagem** e, ao sair ou após leitura, volta ao **retrato**.

### iOS

No `Info.plist`, inclua as orientações que o app pode usar (retrato e paisagem), mesmo que o código bloqueie a maior parte do tempo — assim o plugin consegue alternar no leitor de boleto:

- `UISupportedInterfaceOrientations` com Portrait e Landscape (por exemplo `UIInterfaceOrientationPortrait`, `UIInterfaceOrientationLandscapeLeft`, `UIInterfaceOrientationLandscapeRight`).
