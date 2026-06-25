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
- ⏳ **Pra vender no app:** integrar **RevenueCat** (encapsula Google Play Billing).
  Web continua no Mercado Pago (~5%); app usa a loja (15%). Passos quando for ativar:
  1. `npm i @revenuecat/purchases-capacitor`.
  2. Criar `src/lib/revenuecat.ts` (init, identify no login, getOfferings, purchase, restore).
  3. Boot no `main.tsx` (guardado por `isNativeCapacitorApp()`), API key via `VITE_REVENUECAT_ANDROID_KEY`.
  4. Play Console: criar produtos `gerentia_pro_monthly` / `gerentia_pro_yearly` (mesmos preços).
  5. RevenueCat dashboard: mapear os produtos + webhook → `/gerentia-api/webhook/revenuecat`.
  Ver blueprint §10.5 (escrito p/ iOS, mesma lógica no Android).

---

## 5. Build de release (AAB pra Play)

### 5.1 Gerar o keystore de produção (uma vez) — CRÍTICO

> ⚠️ **Guarde o keystore + as senhas pra sempre.** Se perder, **nunca mais** consegue
> atualizar o app na Play. Faça backup em 2 lugares (gerenciador de senhas + nuvem privada).

Jeito mais seguro (Android Studio): **Build → Generate Signed App Bundle → Create new…** —
o wizard cria o `.jks`, define senhas e alias, e já gera o AAB assinado.

Ou por linha de comando (keytool vem com o JDK do Android Studio):
```bash
keytool -genkey -v -keystore gerentia-release.jks -alias gerentia \
  -keyalg RSA -keysize 2048 -validity 10000
```

### 5.2 Apontar o build pro keystore

Crie `android/keystore.properties` (já é **gitignored**):
```properties
storeFile=../gerentia-release.jks   # caminho relativo à pasta android/ (guarde o .jks FORA do repo)
storePassword=<sua-senha>
keyAlias=gerentia
keyPassword=<sua-senha>
```
O [android/app/build.gradle](../android/app/build.gradle) já lê esse arquivo: se existir,
assina o release com ele; se não, cai no debug (não quebra o build).

### 5.3 Gerar o AAB

```bash
npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
# saída: android/app/build/outputs/bundle/release/app-release.aab
```

## 6. Publicar na Play (checklist)

- [ ] Conta **Google Play Console** (taxa única US$25).
- [ ] Criar o app (package `app.gerentia`).
- [ ] Subir o **app-release.aab** (trilha interna primeiro pra testar).
- [ ] Ficha da loja: nome, descrição, ícone (512×512), screenshots, **Política de Privacidade** (URL).
- [ ] Questionário de conteúdo + Data Safety (conta individual, sem venda de dados).
- [ ] **Billing:** se for vender no app, configurar Play Billing + RevenueCat (§4) antes.

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
