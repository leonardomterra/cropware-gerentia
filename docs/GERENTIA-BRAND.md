# Gerentia — Posicionamento e Marca

> Documento-fonte de marca do **gerentia.app**: posicionamento, público, voz, temas,
> terminologia, direcionamento por canal e catálogo de features. É a referência para
> qualquer copy pública (site, App Store, Instagram, bot, e-mail) e para alinhar produto
> e comunicação à mesma promessa.
>
> **Status:** V1 de marca. Decisões de nome e público fechadas em 23/06/2026.
> **Relacionado:** [FARM-PRICING.md](FARM-PRICING.md) (preço e trial),
> [FARM-DESIGN-SYSTEM.md](FARM-DESIGN-SYSTEM.md) (regras visuais),
> [FARM-ROADMAP.md](FARM-ROADMAP.md) (o que está entregue/standby).

---

## 0. Decisões de fundação (não reabrir sem alinhamento)

| Decisão | Escolha | Implicação |
|---|---|---|
| **Nome da marca** | **Gerentia** (marca única) | Aposentar "Diretor IA" da wordmark. O agente de IA é tratado genericamente: "assistente", "assistente do Gerentia". Não criar sub-marca para o bot. |
| **Público primário** | **Gestor individual genérico** | Qualquer pessoa que gerencia dinheiro pelo WhatsApp — autônomo, profissional liberal, PME pequena, gestão pessoal. Agro é **um nicho forte**, não o público. |
| **Promessa central** | **Zero planilha. Uma foto no WhatsApp.** | Tudo na comunicação volta a isso. Captura sem fricção + organização automática. |
| **Modelo de conta** | **Individual** | 1 usuário = 1 conta. A "organização" é partição invisível (plumbing mantido para escalar a multi-usuário no futuro, não exposto). |
| **Entrada** | **Trial 14 dias, sem tier grátis** | O trial é o funil. O "aha" (foto → lançamento) acontece no dia 1. |

> **Pendência de código gerada por esta decisão:** a wordmark animada ("DIRETOR IA" em
> `LogoWordmark.tsx`) e o símbolo ainda refletem a marca antiga. Migrar para a wordmark
> "Gerentia" é tarefa de produto — ver [FARM-DESIGN-SYSTEM.md §11](FARM-DESIGN-SYSTEM.md).

---

## 1. Posicionamento

**O que é (uma frase):**
> O Gerentia transforma uma foto no WhatsApp na sua gestão financeira organizada — sem
> planilha, sem digitar, sem pasta de notas.

**Categoria:** gestão financeira pessoal e profissional por WhatsApp + IA.

**Para quem:** qualquer pessoa que movimenta dinheiro e perde o controle dele em
canhotos, prints, boletos e cabeça. O gestor é individual — decide e lança sozinho.

**O problema que resolvemos:** a vida financeira de quem não é contador vive espalhada —
nota no porta-luvas, comprovante no print, boleto no e-mail, valor "na memória". Planilha
exige disciplina que ninguém mantém. App de banco mostra o passado, não organiza o que
**você** classifica. O resultado é sempre o mesmo: na hora de saber "quanto gastei com X"
ou "o que tenho a pagar", não dá pra responder.

**Como resolvemos:** o usuário manda uma foto do recibo (ou um áudio, ou um texto) no
WhatsApp. A IA lê, extrai valor, data, fornecedor e categoria, e devolve para confirmar.
Em segundos o lançamento está no app — categorizado, anexado, somado no dashboard.

**Diferencial defensável:** **foto + WhatsApp + zero planilha.** O canal de captura é o
app que a pessoa já tem aberto o dia todo. Não competimos por mais campos na tela —
competimos por **menos esforço para registrar**.

**O que NÃO somos:**
- Não somos ERP nem sistema contábil (não emitimos NF, não fechamos balanço).
- Não somos app de banco / open finance (não puxamos extrato — você decide o que entra).
- Não somos planilha com cara de app (a captura é o produto, não a grade de células).
- Não somos software de nicho único — o agro é um caso de uso, não a fronteira.

**Frase de validação (a pergunta que fecha):**
> "Você pagaria por nunca mais procurar uma nota e saber, a qualquer momento, quanto
> gastou com cada coisa?"

---

## 2. Público

### 2.1 Público primário — o gestor individual

Pessoa que **gerencia o próprio dinheiro com intenção** (não só "vê o saldo"), mas não
tem ferramenta à altura. Mistura vida pessoal e profissional nas mesmas contas. Vive no
celular, resolve tudo no WhatsApp, não abriria uma planilha por gosto.

Perfis dentro desse público:
- **Autônomo / profissional liberal** — dentista, advogado, personal, fotógrafo. Receita
  e despesa misturadas, precisa separar para saber o que sobra.
- **Pequeno negócio sem financeiro** — dono de loja, prestador, MEI. Não tem ERP nem
  contador de plantão; precisa de controle, não de contabilidade.
- **Produtor rural (nicho de origem)** — herança Cropware. Dor altíssima (canhoto,
  custo por safra) e disposição a pagar forte. Continua sendo o melhor caso de prova,
  mas a narrativa não se limita a ele.
- **Gestão pessoal séria** — quem quer categorizar a vida (casa, viagem, escritório) sem
  o tédio de digitar lançamento por lançamento.

### 2.2 O que todos têm em comum (o critério real)

1. Tomam decisões de dinheiro e querem clareza, não só registro.
2. Têm fricção com planilha — falta de tempo ou de disciplina.
3. Vivem no WhatsApp; mandar uma foto é natural, abrir um sistema não.
4. Valorizam tempo: "menos que um almoço por semana" é argumento, "tem 200 funções" não.

### 2.3 Quem NÃO é o público (para não diluir)

- Quem precisa de contabilidade fiscal completa (NF-e, SPED) — isso é camada futura paga,
  não o core.
- Grandes equipes com aprovação multi-nível — o modelo é individual por design.
- Quem quer conciliação automática de banco hoje — open finance é estudo, não promessa.

---

## 3. Voz

> A voz já está parcialmente codificada nas regras de UI (ver
> [FARM-DESIGN-SYSTEM.md §3](FARM-DESIGN-SYSTEM.md)). Esta seção é a fonte para **todo**
> texto da marca, dentro e fora do app.

**Em uma linha:** direto, prático e respeitoso — como um bom gerente que resolve, não que
enrola.

### 3.1 Princípios

1. **Trata por "você", nunca "senhor/senhora".** Próximo, não íntimo demais; respeitoso,
   não formal.
2. **Sem jargão corporativo nem financês.** "O que você tem a pagar", não "contas a pagar
   em aberto no fluxo de caixa projetado".
3. **Fala de benefício, não de feature.** "Nunca mais procure uma nota", não "OCR com
   visão computacional".
4. **Curto. Verbo na frente.** "Mande a foto." "Confirme o valor." "Veja o mês."
5. **Honesto sobre o que faz.** Não promete contabilidade, não promete banco. Promete
   organização sem esforço — e entrega.
6. **Confiante, não arrogante.** Mostramos o resultado e deixamos o usuário concluir.

### 3.2 Regras duras de texto (herança obrigatória)

- **Separador: travessão "—".** Nunca o ponto-do-meio "·". Nunca "-" como separador de
  frase. Vale em site, app, bot, PDF, App Store, Instagram.
- **Sem CAIXA ALTA** em texto corrido.
- **Title Case** em títulos e botões; **sentence case** em descrições, legendas e
  placeholders.
- **Português sempre acentuado** em texto visível.
- **Sem emoji em branding público** (site, App Store, peças, UI do app). Ícones são
  Lucide/Iconify. **Exceção:** o assistente no WhatsApp pode usar emoji com parcimônia —
  ali é UX de conversa, não identidade visual.

### 3.3 Exemplos — fazer / não fazer

| Contexto | ✅ Faça | ❌ Evite |
|---|---|---|
| Headline | "Sua gestão financeira começa com uma foto." | "A plataforma definitiva de gestão financeira inteligente." |
| CTA | "Mandar a primeira foto" | "Iniciar sua jornada financeira" |
| Erro | "Não consegui ler esse recibo. Manda de novo mais de perto?" | "Erro 422 — falha no processamento da imagem." |
| Vencimento | "Você tem 3 contas vencendo essa semana." | "Notificação: 3 obrigações financeiras pendentes." |
| Preço | "Menos que um almoço por semana." | "Apenas R$2,96 por dia em 12x sem juros." |

---

## 4. Temas

Os eixos narrativos que toda comunicação reforça. Cada peça deve puxar **um** com clareza.

1. **Captura sem esforço — a foto é o produto.** O herói é o gesto: tirar foto no
   WhatsApp e o lançamento aparecer pronto. Tudo o mais é consequência.
2. **Fim da planilha e da pasta de notas.** Inimigo claro e concreto. Não vendemos um
   app novo — aposentamos dois hábitos chatos.
3. **Clareza, não só registro.** "Quanto gastei com X?" respondido na hora. O valor não é
   guardar — é saber.
4. **Tudo num lugar que você já usa.** WhatsApp para lançar, app para ver. Sem instalar
   hábito novo.
5. **Controle de quem decide sozinho.** Feito para o gestor individual — rápido, direto,
   sem burocracia de equipe.
6. **Confiança e privacidade.** Seus dados são seus (MFA, conta individual, sem puxar
   banco sem permissão). Tema de fundo, sempre presente, nunca alarmista.

**Tema de nicho (agro), quando o canal pede:** "Saiba seu custo por hectare sem planilha."
Usar como prova e caso de entrada — não como a definição da marca.

---

## 5. Terminologia

> Padronizar reduz atrito cognitivo e mantém a marca coerente. **Use os termos da coluna
> "Use".** Os da coluna "Evite" confundem ou puxam para a categoria errada.

### 5.1 Marca

| Use | Evite | Por quê |
|---|---|---|
| **Gerentia** | "Diretor IA", "Cropware Farm", "o Farm" | Marca única. Nomes legados saem da comunicação. |
| **gerentia.app** (URL/handle) | "gerentia.com.br" sem confirmar | Domínio canônico. |
| **assistente do Gerentia** | "Diretor IA", "o bot" (em copy formal) | O agente não tem marca própria. "Bot" só em contexto técnico. |

### 5.2 Produto e fluxo

| Conceito | Use | Evite |
|---|---|---|
| Registro financeiro | **lançamento** | "transação", "registro", "movimentação" |
| Entrada de dinheiro | **receita** | "crédito", "entrada" |
| Saída de dinheiro | **despesa** | "débito", "gasto" (ok informal) |
| Foto de comprovante | **recibo**, **nota** | "documento fiscal" (só no contexto fiscal) |
| Comprovante anexado | **anexo** | "arquivo", "mídia" |
| Eixo de organização | **Centro de Custo** | "projeto", "carteira", "conta" |
| Agrupador de lançamento | **categoria** | "tag", "rubrica" |
| Fatura de cartão | **fatura** | "extrato do cartão" |
| Gasto que se repete | **recorrência** | "assinatura", "lançamento fixo" |
| Conta a vencer | **vencimento** | "obrigação", "pendência fiscal" |
| Saída em PDF/CSV | **relatório**, **exportação** | "extração de dados" |

### 5.3 Status (semântica fixa — bate com as cores do design system)

`pago` / `recebido` (verde) — `a pagar` / `a receber` (âmbar) — `vencido` (vermelho) —
`cancelado` (cinza). Sempre em minúsculo no texto corrido; Title Case em badge.

### 5.4 Como falar da IA

- Diga o que ela **faz para você**: "lê o recibo", "preenche o lançamento", "te avisa do
  vencimento".
- Evite vender a tecnologia: "OCR", "visão computacional", "LLM", "modelo treinado".
- Nunca prometa contabilidade ou consultoria financeira — ela organiza, não aconselha
  investimento.

---

## 6. Direcionamento por canal

Prioridades fechadas: **WhatsApp, Instagram, App Store (iOS) + web.** (E-mail de ciclo de
vida existe e importa para conversão de trial, mas não é canal de aquisição prioritário —
ver [FARM-PRICING.md §5](FARM-PRICING.md).)

### 6.1 WhatsApp — captura e ativação (o canal-produto)

É onde o produto vive e onde o "aha" acontece. Papel duplo: **canal de uso** (lançar por
foto/áudio/texto) e **canal de ativação** (a primeira foto no dia 1 do trial).

- **Tom:** conversa de gerente prático. Frases curtas, confirmação clara, uma pergunta por
  vez. Emoji com parcimônia (UX, não branding).
- **Sempre confirmar antes de gravar:** devolver valor, categoria e fornecedor/descrição e
  pedir "Confirma? [Sim / Corrigir]".
- **Nunca inventar** dado que não veio na imagem (CNPJ, nº de nota) — deixar em branco.
- **Proativo, não invasivo:** alerta de vencimento e resumo semanal são bem-vindos; spam
  não. Respeitar os templates aprovados.
- **Momento que vende:** "R$ 150 em Combustível no Posto Vale, 17/05. Confirma?" — esse é o
  print de marketing, não a tela cheia de campos.

### 6.2 Instagram — aquisição e prova

Topo e meio de funil. Mostrar o gesto e o resultado, não falar de funcionalidade.

- **Formato herói:** vídeo curto do fluxo real — foto do recibo → lançamento aparecendo →
  dashboard somando. O "antes/depois" da planilha.
- **Provas por nicho:** rotação de casos (autônomo, pequeno negócio, produtor rural, gestão
  pessoal). O agro entrega o depoimento mais forte de ROI — usar como prova, não como
  definição da conta.
- **Linha editorial:** dores reconhecíveis ("a nota que sumiu", "quanto eu gastei mesmo?"),
  dicas de organização, bastidores. Sempre com a promessa central no final.
- **Visual:** paleta zinc/neutra do app, ícones (não emoji), travessão como separador.
  Coerência literal com o produto.
- **CTA único:** "Comece com uma foto — 14 dias grátis." Link para o trial.

### 6.3 App Store (iOS) — conversão de intenção

Quem chega aqui já tem intenção. A página vende clareza e confiança.

- **Subtítulo:** promessa central, não lista de features. Ex.: "Gestão financeira por foto
  no WhatsApp."
- **Screenshots:** sequência do fluxo (capturar → confirmar → ver). Primeira imagem é a
  foto virando lançamento.
- **Regra Apple inegociável:** na UI iOS, billing só via StoreKit/RevenueCat. **Nunca**
  linkar Mercado Pago, site ou preço fora da App Store — rejeição automática. Ver
  [blueprint §10.5](../CROPWARE-FARM-BLUEPRINT.md).
- **Privacidade:** ficha da App Store honesta — conta individual, dados do usuário, sem
  venda de dados.

### 6.4 Web (landing + onboarding do trial)

A casa da marca e o funil de conversão fora do iOS.

- **Above the fold:** headline da promessa central + vídeo do gesto + CTA "Mandar a
  primeira foto / Começar grátis".
- **Estrutura:** problema (planilha/pasta de notas) → solução (foto no WhatsApp) → prova
  (casos por nicho) → preço simples → trial.
- **Preço sem rodeio:** plano único Pro, 14 dias, sem letra miúda. Ver
  [FARM-PRICING.md](FARM-PRICING.md).
- **Onboarding (dia 1):** levar o usuário a mandar a **primeira foto** e ver o lançamento
  aparecer — antes de qualquer tour. Esse momento é o produto.

### 6.5 Coerência entre canais

Mesma promessa, mesma voz, mesmo separador "—", mesma proibição de emoji em peça pública.
O WhatsApp é a única superfície onde emoji é tolerado. O nicho agro aparece como prova em
qualquer canal, nunca como teto da marca.

---

## 7. Catálogo de features

> Fonte de verdade do que comunicar. **Status** evita prometer o que não está no ar:
> `Entregue` (vivo no app) — `Standby` (código existe, pausado) — `Futuro` (planejado).
> Detalhe técnico vive no [FARM-ROADMAP.md](FARM-ROADMAP.md); aqui é a leitura de marca.

### 7.1 Captura e lançamento (o core)

| Feature | Status | Como comunicar |
|---|---|---|
| **Captura por foto + OCR** | Entregue | "Tire uma foto. O Gerentia lê e preenche." Herói da marca. |
| **Lançamentos (receita/despesa)** | Entregue | "Tudo o que entra e sai, organizado." CRUD com status, categoria e anexo. |
| **Assistente no WhatsApp** | Standby | "Lance por foto, áudio ou texto — sem abrir o app." Inclui marcar conta como paga e perguntar sobre as finanças. Aprovar templates Meta antes de prometer. |
| **Áudio (transcrição)** | Standby | "Fale o gasto, ele anota." Parte do assistente. |
| **Notas e Recibos** | Entregue | Aba dedicada aos comprovantes capturados. |

### 7.2 Organização

| Feature | Status | Como comunicar |
|---|---|---|
| **Centros de Custo** | Entregue | "Separe por obra, projeto, fazenda ou área da vida." Eixo universal de organização (limite de 6 ativos). |
| **Categorias** | Entregue | "52 categorias prontas — Fazenda, Pessoal, Escritório, Viagem, Financeiro — e as suas." Custom por usuário + ocultar presets. |
| **Faturas de cartão** | Entregue | "Cartão sem contar gasto duas vezes." Anti-duplicidade: a fatura é informativa, os itens é que contam no total. |
| **Recorrências** | Entregue | "O que se repete, o app lança sozinho." Lançamentos recorrentes automáticos. |
| **Anexos** | Entregue | "Todo comprovante guardado e ligado ao lançamento." Galeria pesquisável. |

### 7.3 Visão e saída

| Feature | Status | Como comunicar |
|---|---|---|
| **Dashboard** | Entregue | "Quanto entrou, quanto saiu, com o quê — num olhar." Gráficos de 6 meses + top categorias. |
| **Alertas de vencimento** | Standby | "Nada vence sem você saber." Via WhatsApp. |
| **Resumo semanal** | Standby | "Seu resumo da semana, sem pedir." Via WhatsApp. |
| **Relatórios (PDF)** | Entregue | "Exporte tudo, com os comprovantes junto." PDF e CSV. |
| **Exportação CSV** | Entregue | "Seus dados são seus — leve quando quiser." |

### 7.4 Conta e confiança

| Feature | Status | Como comunicar |
|---|---|---|
| **Conta individual** | Entregue | "Sua conta, suas regras." Modelo individual por design. |
| **Segurança / MFA** | Entregue | "Verificação em duas etapas." Falar como tranquilidade, não como tecnicalidade. |
| **Multi-dispositivo** | Entregue | "Comece no celular, continue no computador." |
| **App iOS (Capacitor)** | Futuro | Não prometer data. Comunicar quando publicar. |

### 7.5 Camada futura (upsell — não prometer no core)

| Feature | Status | Como comunicar |
|---|---|---|
| **Fiscal (XML/NF-e, custo/ha)** | Futuro | Camada paga separada (~R$169/mês), só quando validada. **Nunca** incluir no Pro nem na promessa principal. |
| **Open Finance (conciliação)** | Futuro | Estudo pausado (Pluggy). Não comunicar até existir. |

### 7.6 Regra de ouro do catálogo

Vendemos **a promessa central** (foto → organização), não a lista. Toda feature entra na
comunicação **a serviço dela**. Se uma feature não reforça "zero planilha, uma foto no
WhatsApp", ela não lidera uma peça — no máximo, dá suporte.

---

## 8. Checklist rápido (antes de publicar qualquer peça)

- [ ] A promessa central aparece — foto/WhatsApp + zero planilha?
- [ ] Fala de benefício, não de feature/tecnologia?
- [ ] Nome **Gerentia** (sem "Diretor IA" / "Cropware Farm")?
- [ ] Separador "—" (nunca "·"), sem emoji (exceto WhatsApp)?
- [ ] "você", Title Case nos títulos, português acentuado?
- [ ] Não promete feature em `Standby`/`Futuro` como se estivesse no ar?
- [ ] Não promete contabilidade, banco ou fiscal no core?
</content>
</invoke>
