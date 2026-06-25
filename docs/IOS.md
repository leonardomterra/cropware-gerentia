# iOS — gerentia.app

App iOS nativo via **Capacitor** (mesmo código web + Android). O projeto `ios/` já foi
gerado e configurado **no Windows** — o que falta exige **Mac** (build, assinatura, upload).

- **Bundle ID:** `app.gerentia` (mesmo do Android; permanente na App Store)
- **Nome:** Gerentia · **webDir:** `build`
- Capacitor 8 usa **Swift Package Manager** (não CocoaPods).

---

## ✅ Já feito (no Windows, está no repo)
- `@capacitor/ios` instalado + projeto `ios/` gerado (`cap add ios`).
- **Ícone (1024) + splash** claro/escuro da marca (`capacitor-assets --ios`) em
  `ios/App/App/Assets.xcassets/`.
- **Info.plist:** permissões de câmera/fotos (pt-BR) + `ITSAppUsesNonExemptEncryption=false`
  (evita o questionário de export compliance no TestFlight).
- Boot nativo no `main.tsx` (status bar) e **compliance de billing** (checkout do Mercado
  Pago escondido no nativo) já valem pra iOS — via `isNativeCapacitorApp()`.

## Pré-requisitos no Mac
- **macOS + Xcode** (App Store).
- **Apple Developer Program** — **US$99/ano** (diferente da Play, que é taxa única).
- Node + o repo clonado.

## 1. Subir o projeto no Mac
```bash
npm install
npm run build
npx cap sync ios      # resolve os Swift Packages + copia o build/
npx cap open ios      # abre no Xcode
```

## 2. Assinatura (Xcode)
- Xcode → target **App** → aba **Signing & Capabilities**.
- Marque **Automatically manage signing** → selecione seu **Team** (Apple Developer).
- Confirme o **Bundle Identifier** = `app.gerentia`.
- Rode num **simulador** (não precisa de device) ou num iPhone real.

## 3. Ícone / splash (se precisar regenerar)
```bash
npx capacitor-assets generate --ios
```
Fontes em `assets/` (mesmas do Android). Já estão gerados; só rode se mudar a arte.

---

## 4. Billing na App Store — REGRA APPLE (mais rígida que a Play)
- Assinatura digital consumida no app **tem que** usar **StoreKit (IAP)**. **Proibido**
  qualquer link/menção a pagamento externo (Mercado Pago, site, preço de fora) na UI iOS —
  **rejeição automática**.
- ✅ Já coberto: o checkout do MP fica **escondido no nativo**.
- ⏳ Pra vender no app: **RevenueCat** (encapsula StoreKit). Passos (mesmo do blueprint §10.5):
  1. `npm i @revenuecat/purchases-capacitor`.
  2. `src/lib/revenuecat.ts` (init, identify no login, getOfferings, purchase, restore).
  3. Boot no `main.tsx` (guardado por `isNativeCapacitorApp()`), key via `VITE_REVENUECAT_IOS_KEY`.
  4. App Store Connect: criar **produtos de assinatura** (`gerentia_pro_monthly` / `_yearly`)
     num Subscription Group.
  5. RevenueCat dashboard: mapear os produtos + webhook → `/gerentia-api/webhook/revenuecat`.
  6. Tela de conta iOS **sem** links externos (a Apple policia isso).

## 5. Publicar na App Store (passo a passo)
1. **App Store Connect** (appstoreconnect.apple.com) → **My Apps → +** → novo app,
   bundle id `app.gerentia`, idioma PT-BR.
2. **Versão / build:** no Xcode, **Product → Archive** → **Distribute App → App Store Connect**
   (ou exportar e subir pelo **Transporter**). Incremente `MARKETING_VERSION`/`CURRENT_PROJECT_VERSION`
   a cada envio.
3. **TestFlight** (recomendado): teste interno antes da revisão pública. iOS **não** tem a
   regra dos 20 testadores da Play — TestFlight é livre.
4. **Ficha da App Store:** nome, subtítulo, descrição (reusar `store/play-store-listing.md`),
   **ícone** (o do app já entra), **screenshots** do simulador (tamanhos exigidos: iPhone 6.7"
   1290×2796 e 6.5"; iPad se for suportar).
5. **App Privacy** (nutrition labels) — mesma base do Data Safety da Play
   (`store/play-store-listing.md`): coleta e-mail/nome/telefone + dados financeiros; não vende dados.
6. **Política de Privacidade:** `https://gerentia.app/privacidade.html`.
7. **Enviar para revisão.** A revisão da Apple costuma ser mais criteriosa que a do Google.

## 6. Pendências (quando der)
- **Universal Links** (deep link de auth): hospedar `https://gerentia.app/.well-known/apple-app-site-association`
  com o App ID (`<TeamID>.app.gerentia`) + `Associated Domains` no Xcode + listener
  `App.addListener('appUrlOpen', …)`. Equivalente ao App Links do Android.
- **RevenueCat** (§4) quando for vender no app.

## 7. O que NÃO commitar (já gitignored pelo template)
`ios/App/App/public` (bundle web) · `ios/App/build` · `DerivedData` · `xcuserdata` ·
`ios/App/App/capacitor.config.json` (gerado).
