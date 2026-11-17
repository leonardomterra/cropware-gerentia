"""Gera o bloco do tema escuro em src/app.css (entre os marcadores TEMA ESCURO).

Rodar de novo depois de atualizar o Tailwind ou mudar a escala grafite:
    python3 scripts/gerar-tema-escuro.py
"""
import re
import os
RAIZ=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
tw=open(RAIZ+'/node_modules/tailwindcss/theme.css').read()
cores={}
for h,n,v in re.findall(r'--color-([a-z]+)-(\d+):\s*([^;]+);',tw):
    cores.setdefault(h,{})[int(n)]=v.strip()
PASSOS=[50,100,200,300,400,500,600,700,800,900,950]
# 200 -> 900 (e não 800): os selos (bg-*-200) ficavam saturados demais no escuro.
ESPELHO={50:950,100:900,200:900,300:700,400:600,500:500,600:400,700:300,800:200,900:100,950:50}
# Grafite escuro: escuro em cima, claro embaixo (mesma ideia do espelho, com o
# 500/600 levantados para o texto de apoio passar no contraste sobre o cartão).
GRAFITE_ESCURO={50:'#141417',100:'#26262b',200:'#33333a',300:'#45454c',400:'#6a6a72',
 500:'#9a9aa2',600:'#b4b4bb',700:'#cacacf',800:'#e2e2e6',900:'#eeeef1',950:'#f7f7f9'}
linhas=[]
for h in sorted(cores):
    if h=='slate' or len(cores[h])<11: continue
    for n in PASSOS:
        linhas.append(f'  --color-{h}-{n}: {cores[h][ESPELHO[n]]};')
GRAFITE_CLARO={50:'#f7f7f9',100:'#f1f1f3',200:'#e2e2e6',300:'#cacacf',400:'#a1a1a7',500:'#7c7c83',600:'#606066',700:'#4c4c52',800:'#3c3c42',900:'#2b2b30',950:'#19191d'}
graf_claro='\n'.join(f'  --color-slate-{n}: {GRAFITE_CLARO[n]};' for n in PASSOS)
linhas_claro=[f'  --color-{h}-{n}: {cores[h][n]};' for h in sorted(cores) if h!='slate' and len(cores[h])>=11 for n in PASSOS]
graf='\n'.join(f'  --color-slate-{n}: {GRAFITE_ESCURO[n]};' for n in PASSOS)
bloco=f'''/* >>> TEMA ESCURO (gerado por scripts/gerar-tema-escuro.py — editar lá, não aqui) >>>
   Como funciona: as utilities do Tailwind leem var(--color-*). No escuro,
   redefinimos essas variáveis sob .dark (no <html>), e as ~1.200 classes do
   app trocam sozinhas, sem `dark:` espalhado:
   - slate-* (a escala grafite da marca) inverte: o 50 (fundo da página) vira
     o mais escuro, o 900 (texto) vira o mais claro.
   - white = a SUPERFÍCIE (cartões, campos, menus), um degrau acima do fundo.
     Por isso `text-white` sobre botão grafite também acerta: o botão vira
     claro e o texto, escuro. Branco que precisa continuar branco (texto sobre
     cor forte ou sobre foto): `text-branco`.
   - As demais cores espelham a escala (50<->950, 100<->900...): selo de fundo
     claro vira fundo escuro da mesma cor, texto escuro vira claro. 500 fica.
   - black e as cores arbitrárias (bg-[#...]) não mudam.
   Quem escolhe o tema: lib/tema.ts (Claro / Escuro / Igual ao sistema). */
.dark {{
  color-scheme: dark;
  --color-white: #1d1d21;
{graf}
  --color-farm-primary: #b4b4bb;
  --color-farm-primary-dark: #cacacf;
  --color-farm-primary-darker: #e2e2e6;
  --color-farm-primary-darkest: #eeeef1;
  --color-farm-primary-light: #9a9aa2;

  --background: 240 6% 12%;
  --foreground: 240 9% 94%;
  --card: 240 6% 12%;
  --card-foreground: 240 9% 94%;
  --popover: 240 6% 12%;
  --popover-foreground: 240 9% 94%;
  --primary: 240 7% 89%;
  --primary-foreground: 240 6% 12%;
  --secondary: 240 6% 16%;
  --secondary-foreground: 240 9% 94%;
  --muted: 240 6% 16%;
  --muted-foreground: 240 4% 62%;
  --accent: 240 6% 16%;
  --accent-foreground: 240 9% 94%;
  --border: 240 6% 21%;
  --input: 240 6% 21%;
  --ring: 240 4% 62%;

{chr(10).join(linhas)}
}}

/* Ilhas que ficam no tema CLARO mesmo com o app escuro: o vidro escuro
   (menus, painéis, dicas, barra de ações — lib/ui-tokens.ts) já é escuro nos
   dois temas e foi desenhado com tinta clara (text-white, white/10,
   text-slate-100). Sem isto, no escuro ele inverteria e viraria vidro claro. */
.dark .tema-claro {{
  color-scheme: light;
  --color-white: #fff;
{graf_claro}
{chr(10).join(linhas_claro)}
}}
/* <<< TEMA ESCURO <<< */'''
p=RAIZ+'/src/app.css'
s=open(p).read()
ini='/* >>> TEMA ESCURO'; fim='/* <<< TEMA ESCURO <<< */'
if ini in s:
    a=s.index(ini); b=s.index(fim)+len(fim)
    s=s[:a]+bloco+s[b:]
else:
    # logo depois do :root dos tokens shadcn
    m=s.index('  --radius: 4px;\n}\n')+len('  --radius: 4px;\n}\n')
    s=s[:m]+'\n'+bloco+'\n'+s[m:]
open(p,'w').write(s)
print('cores espelhadas:',len(linhas))
