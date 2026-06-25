# gerentia.app — Status & Retomada

> Onde estamos e exatamente o que falta, pra retomar do ponto certo (sem reler tudo).
> Última atualização: 25/06/2026.

---

## ✅ No ar / pronto

| Frente | Estado |
|---|---|
| **Marca** | Logo + favicon novos; posicionamento em [GERENTIA-BRAND.md](GERENTIA-BRAND.md) |
| **Web (gerentia.app)** | Deploy automático no push pra `main` (Cloudflare Pages) |
| **Billing web** | Assinatura Mercado Pago **deployada e funcionando** (planos R$89/R$890); 3 segredos ativos; webhook validando. Ver [FARM-PRICING.md](FARM-PRICING.md) |
| **Política de privacidade** | https://gerentia.app/privacidade.html |
| **Android** | App nativo (Capacitor) **validado em device real**; ícone+splash; compliance da Play; **AAB de release assinado pronto** |
| **iOS** | Projeto `ios/` scaffoldado no Windows (ícone+splash+Info.plist). Falta o Mac. |
| **RevenueCat (IAP)** | Scaffoldado nos dois apps, **inerte** (sem chave/produtos) |
| **Assets de loja** | `store/icon-512.png`, `store/feature-graphic-1024x500.png`, textos em `store/play-store-listing.md`, screenshots tiradas |

---

## ⏳ Trilha A — Publicar Android (Windows + browser, sem Mac)

**Bloqueio:** conta Google Play Console + número **D-U-N-S** (solicitado na CIAL D&B — chega por e-mail, até ~30 dias).

Quando o D-U-N-S chegar:
1. Criar a conta **Organização** no Play Console (com o D-U-N-S) — ver [ANDROID.md §6](ANDROID.md).
2. Subir o **AAB já pronto**: `android/app/build/outputs/bundle/release/app-release.aab`
   (regerar se mudar algo: `npm run build && npx cap sync android && cd android && ./gradlew bundleRelease`).
3. Ficha da loja: colar textos de `store/play-store-listing.md`, subir ícone + feature graphic + screenshots.
4. Data Safety, política de privacidade, declarar **sem compras no app**, enviar.

> **Keystore de release** está **nesta máquina Windows** (`C:\Cropware\gerentia-secrets\gerentia-upload.jks`
> + `android/keystore.properties`, ambos fora do git). Faça backup. O Android se publica daqui, não do Mac.

---

## ⏳ Trilha B — Publicar iOS (precisa de Mac)

**Bloqueio:** Mac + Xcode + conta **Apple Developer** (US$99/ano).

O projeto iOS já está no repo, pronto. No Mac, o caminho está em [IOS.md](IOS.md):
1. `npm install && npm run build && npx cap sync ios && npx cap open ios`
2. Xcode: signing automático com seu Team, bundle id `app.gerentia`, rodar no simulador.
3. Screenshots no simulador → Archive → App Store Connect → TestFlight → ficha → revisão.

> O Mac **não precisa** de nenhum segredo do Windows (API é remota, anon key é pública; iOS usa
> certificados Apple via Xcode). Só clonar/pull o repo.

---

## 🔜 Quando for ATIVAR venda no app (depois do lançamento)

RevenueCat está scaffoldado mas inerte. Pra ligar (ver [ANDROID.md §4](ANDROID.md) / [IOS.md §4](IOS.md)):
1. Criar produtos de assinatura na Play e na App Store Connect.
2. Mapear no painel RevenueCat + implementar o webhook `/gerentia-api/webhook/revenuecat` (hoje 501).
3. Setar `VITE_REVENUECAT_ANDROID_KEY` / `VITE_REVENUECAT_IOS_KEY`.

Outras pendências não-bloqueantes: **paywall pós-trial** (hoje nada bloqueia ao vencer), **deep links de
auth** (universal/app links — melhor fazer com as contas, pra ter SHA/Team ID).

---

## 📌 Prompt pra retomar no Mac (copiar e colar no Claude Code)

```
Estou no Mac pra finalizar e publicar o app iOS do gerentia.app (Capacitor).
O projeto iOS já foi scaffoldado no Windows e está no repo (pasta ios/), com
ícones, splash e Info.plist prontos. Antes de começar, leia docs/IOS.md (handoff
completo), docs/STATUS-E-RETOMAR.md e a memória do projeto (MEMORY.md).

Contexto: app Capacitor (React + Vite), bundle id app.gerentia, Capacitor 8 (Swift
Package Manager, sem CocoaPods). API é remota (Supabase), não precisa de segredos
locais. RevenueCat está scaffoldado mas inerte — NÃO ativar agora.

O que preciso fazer aqui no Mac:
1. Confirmar Xcode instalado + conta Apple Developer.
2. npm install && npm run build && npx cap sync ios && npx cap open ios
3. Xcode: signing automático com meu Team, bundle id app.gerentia, rodar no simulador.
4. Capturar screenshots no simulador (tamanhos no docs/IOS.md).
5. Archive → App Store Connect → criar o app → TestFlight → ficha (reusar
   store/play-store-listing.md) → enviar pra revisão.

Me guie passo a passo a partir do item 2, verificando cada etapa. Comece confirmando
o estado do projeto iOS no repo e me dizendo o primeiro comando.
```

---

## Documentos-fonte
- [ANDROID.md](ANDROID.md) — build, assinatura, Play Console, RevenueCat, deep links.
- [IOS.md](IOS.md) — Mac, Xcode, App Store, RevenueCat, universal links.
- [FARM-PRICING.md](FARM-PRICING.md) — preço, trial, arquitetura de billing.
- [GERENTIA-BRAND.md](GERENTIA-BRAND.md) — posicionamento, voz, ficha de loja.
