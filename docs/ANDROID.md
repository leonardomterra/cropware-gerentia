# Android — gerentia.app

App Android nativo via **Capacitor** (mesmo código web, empacotado). iOS usa o mesmo
projeto Capacitor depois (precisa de Mac).

- **appId / package:** `app.gerentia` (permanente — não muda depois de publicar)
- **appName:** Gerentia
- **webDir:** `build` (saída do Vite; a API continua remota no Supabase)
- Config: [capacitor.config.ts](../capacitor.config.ts)

---

## 1. Pré-requisitos (uma vez)

- **Android Studio** + **Android SDK** (Platform 36, Build-Tools, Platform-Tools, Emulator).
  O SDK fica em `C:\Users\<user>\AppData\Local\Android\Sdk`.
- `android/local.properties` aponta o SDK (gitignored). Se faltar, crie com:
  ```
  sdk.dir=C\:\\Users\\<user>\\AppData\\Local\\Android\\Sdk
  ```

## 2. Rodar em dev

```bash
npm run build            # gera build/
npx cap sync android     # copia build/ + plugins pro projeto android/
npx cap open android     # abre no Android Studio
```
No Android Studio: escolha um device (emulador no Device Manager, ou celular por USB com
Depuração USB) e clique **▶ Run**.

> Sempre que mudar o front: `npm run build && npx cap sync android`.
> **Não** rode o "AGP Upgrade Assistant" — a versão atual é a que o Capacitor espera.

## 3. Ícone e splash

Fontes em [`assets/`](../assets) (fundo branco, símbolo escuro). Pra regenerar tudo:
```bash
npx capacitor-assets generate --android --iconBackgroundColor '#ffffff' --iconBackgroundColorDark '#ffffff'
```
> O XML adaptive (`mipmap-anydpi-v26/ic_launcher*.xml`) usa `@color/ic_launcher_background`
> (branco sólido edge-to-edge). Se regenerar, confira que o background **não** ficou com
> `<inset>` (o default do tooling deixa, e isso causa cantos transparentes na máscara redonda).

---

## 4. Billing na Play — IMPORTANTE

A **Play proíbe** pagamento externo (Mercado Pago) dentro do app pra bens digitais.
- ✅ Já feito: no app nativo, o checkout do MP fica **escondido**
  ([SubscriptionCard.tsx](../src/modules/account/components/SubscriptionCard.tsx) via
  `isNativeCapacitorApp()`) — mostra só status + "assinaturas pelo app em breve".
- ✅ **RevenueCat já scaffoldado** (encapsula Google Play Billing): `@revenuecat/purchases-capacitor`
  instalado, `src/lib/revenuecat.ts` (init/identify/offerings/purchase/restore, tudo guardado),
  boot no `main.tsx`, identidade no `AppShell`, e UI de compra no `SubscriptionCard` (mostra as
  ofertas quando existirem; senão "em breve"). **Inerte** sem chave/produtos — não afeta o build atual.
- ⏳ **Pra ATIVAR a venda no app** (web segue no Mercado Pago ~5%; app usa a loja ~15%):
  1. Play Console: criar produtos de assinatura `gerentia_pro_monthly` / `gerentia_pro_yearly`.
  2. RevenueCat dashboard: mapear os produtos + webhook → `/gerentia-api/webhook/revenuecat`
     (handler ainda é 501 — implementar a reconciliação).
  3. Setar `VITE_REVENUECAT_ANDROID_KEY` (e `VITE_REVENUECAT_IOS_KEY`) no `.env` do build.
  4. Mudar a declaração da Play de "sem compras" para "com compras no app".

---

## 5. Build de release (AAB pra Play) — JÁ FEITO

- **Keystore de upload (gerado):** `C:\Cropware\gerentia-secrets\gerentia-upload.jks`
  (FORA do repo), alias `upload`. SHA-256: `4F:B2:65:21:2B:1A:1B:09:0D:9E:51:99:BF:3B:06:57:FE:22:DC:98:0C:3C:F9:46:AD:5A:C9:F9:5D:04:A2:23`.
- **`android/keystore.properties`** (gitignored) já aponta pra ele com a senha. O
  [build.gradle](../android/app/build.gradle) assina o release com esse keystore.
- **AAB pronto:** `android/app/build/outputs/bundle/release/app-release.aab`.

> ⚠️ **Backup do keystore + senha.** Estão em `C:\Cropware\gerentia-secrets\` e em
> `android/keystore.properties`. Copie pra um gerenciador de senhas + nuvem privada. Com
> **Play App Signing** (padrão), o upload key é **recuperável** via Google se perder — mas
> faça backup mesmo assim.

**Regerar o AAB** (após qualquer mudança):
```bash
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
```
> Subiu de versão? Antes, incremente `versionCode` (e `versionName`) em
> [android/app/build.gradle](../android/app/build.gradle) — a Play recusa o mesmo `versionCode` duas vezes.

### Assets de loja (gerados em `store/`)
- **Ícone 512×512:** [store/icon-512.png](../store/icon-512.png)
- **Feature graphic 1024×500:** [store/feature-graphic-1024x500.png](../store/feature-graphic-1024x500.png) (placeholder simples — dá pra caprichar no Canva)
- **Política de Privacidade:** [public/privacidade.html](../public/privacidade.html) → publicada em `https://gerentia.app/privacidade.html`
- **Screenshots:** tirar no tablet (Power + Volume↓) nas telas Dashboard / Lançamentos / Conta (mín. 2).

## 6. Publicar na Play — passo a passo

Tudo no [Google Play Console](https://play.google.com/console). Você precisa de uma conta
de desenvolvedor (taxa única **US$25**).

1. **Criar app:** *Criar app* → nome **Gerentia**, idioma padrão Português (Brasil), tipo
   **App**, **Gratuito**. Aceitar as políticas.
2. **Play App Signing:** deixe ativado (padrão) — você sobe o AAB assinado com o *upload key*
   e o Google gerencia a chave final.
3. **Trilha de teste interna (recomendado primeiro):** *Testes → Teste interno* → *Criar
   versão* → subir `app-release.aab` → adicionar seu e-mail como testador → publicar.
   Instala via link no seu celular/tablet, valida, e só depois promove pra Produção.
4. **Ficha da loja** (*Crescer → Presença na loja → Ficha principal*):
   - Nome: **Gerentia**
   - Descrição curta + completa (foco: "gestão financeira por foto no WhatsApp — zero planilha").
   - **Ícone:** `store/icon-512.png` · **Feature graphic:** `store/feature-graphic-1024x500.png`
   - **Screenshots:** as do tablet (mín. 2).
5. **Política de Privacidade:** colar `https://gerentia.app/privacidade.html`.
6. **Conteúdo do app** (*Política → Conteúdo do app*): classificação indicativa,
   **Data Safety** (coleta e-mail/nome/telefone + dados financeiros que o usuário cria; uso
   = funcionamento do app; **sem venda de dados**; criptografia em trânsito; permite excluir
   conta), público-alvo (adultos), anúncios = não.
7. **Billing:** o app **não vende nada por enquanto** (checkout MP escondido no nativo) —
   declare **sem compras no app**. Quando ativar RevenueCat (§4), atualize isso.
8. **Enviar para revisão.** Primeira revisão costuma levar de horas a alguns dias.

---

## 7. Pendências (quando der)

- **Deep links de auth:** reset de senha / confirmação de e-mail abrem no navegador, não no app.
  Pra abrir no app: intent-filter `autoVerify` pro domínio `gerentia.app` no AndroidManifest +
  hospedar `https://gerentia.app/.well-known/assetlinks.json` com o **SHA-256 do keystore de
  produção** + listener `App.addListener('appUrlOpen', …)` que navega pra rota.
  (SHA-256 do **debug**, pra testar: `EA:FE:6C:32:8F:31:C3:A3:92:1C:A7:68:CF:8C:BD:42:20:19:1E:22:4A:0D:83:01:61:CB:D2:8F:18:CB:E6:78`.)
- **iOS:** mesmo projeto Capacitor, precisa de Mac (`npx cap add ios`) + RevenueCat/StoreKit.

---

## 8. O que NÃO commitar (já gitignored)

`android/local.properties` · `android/keystore.properties` · `*.jks` / `*.keystore` ·
`android/.idea` · `android/app/src/main/assets/public` (bundle web regenerado por `cap sync`).
