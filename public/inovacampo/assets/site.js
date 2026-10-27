// Gerentia — apresentação Inova+Campo 2026.
// Tudo aqui é progressivo: sem JS, a página mostra o conteúdo completo
// (conversas inteiras, linha do lançamento já no painel, capturas como links).
(() => {
  "use strict";
  const doc = document.documentElement;
  doc.classList.remove("no-js");
  doc.classList.add("js");

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Navegação: seção atual + barra de progresso ----------
  // Qualquer rolagem programática em outro elemento (faixa do menu, corpo de
  // uma conversa) interrompe a rolagem suave da página no Chrome. Por isso os
  // links internos são tratados aqui, e enquanto a página rola até o destino
  // (`navigating`) as conversas e o menu esperam: o que pedirem nesse
  // intervalo roda em `afterNav`, quando a rolagem para.
  const nav = $(".nav");
  const header = $(".site-header");
  const navLinks = $$(".nav a[href^='#']");
  const sections = navLinks.map((a) => $(a.getAttribute("href"))).filter(Boolean);
  const progress = $(".progress");
  let navigating = false;
  let navTarget = 0;
  let afterNav = [];
  let idleTimer = 0;
  const whenIdle = (fn) => { if (navigating) afterNav.push(fn); else fn(); };
  const endNav = () => {
    if (!navigating) return;
    navigating = false;
    const queued = afterNav;
    afterNav = [];
    queued.forEach((fn) => fn());
  };
  const onScroll = () => {
    const max = doc.scrollHeight - window.innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
    if (!navigating) return;
    // Termina ao chegar ao destino (ou ao fim da página). Sem chegar, só depois
    // de 1 s parada: o usuário interrompeu a rolagem com o dedo ou o mouse.
    const arrived = Math.abs(window.scrollY - navTarget) < 2 || window.scrollY >= max - 1;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(endNav, arrived ? 60 : 1000);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  // O Chrome às vezes dispara um scrollend logo após o clique, resto da rolagem
  // anterior: só vale como fim se a página já chegou ao destino.
  window.addEventListener("scrollend", () => {
    const max = doc.scrollHeight - window.innerHeight;
    if (Math.abs(window.scrollY - navTarget) < 2 || window.scrollY >= max - 1) endNav();
  });
  onScroll();

  $$("a[href^='#']").forEach((a) => {
    const id = a.getAttribute("href").slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const offset = (header ? header.getBoundingClientRect().height : 0) + 12;
      const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
      navigating = true;
      navTarget = Math.min(top, doc.scrollHeight - window.innerHeight);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(endNav, 1200); // caso a página já esteja no destino
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
      history.replaceState(null, "", "#" + id);
      if (id === "conteudo") target.focus({ preventScroll: true });
    });
  });

  const centerNavLink = (a) => {
    // Só a faixa do menu rola, e só no celular, onde ela transborda.
    if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2;
  };
  if ("IntersectionObserver" in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        navLinks.forEach((a) => {
          if (a.getAttribute("href") === "#" + e.target.id) {
            a.setAttribute("aria-current", "true");
            whenIdle(() => { if (a.hasAttribute("aria-current")) centerNavLink(a); });
          } else a.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => spy.observe(s));
  }

  // ---------- Entrada suave ----------
  const reveals = $$(".reveal");
  if (!reduced && "IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach((el) => io.observe(el));
  } else reveals.forEach((el) => el.classList.add("is-in"));

  // ---------- Reprodutor de conversa ----------
  // Cada .msg pode ter data-stage (etapa do pipeline) e data-event (gatilho
  // para o painel ilustrativo). Mensagens do assistente mostram "digitando".
  class Player {
    constructor(root, opts = {}) {
      this.root = root;
      this.body = $(".wa-body", root);
      this.items = $$(".msg, .msg--note", this.body);
      this.onStage = opts.onStage || (() => {});
      this.onEvent = opts.onEvent || (() => {});
      this.onReset = opts.onReset || (() => {});
      this.onDone = opts.onDone || (() => {});
      // reserve: mensagens pendentes ocupam o espaço (só ficam invisíveis) e
      // não há "digitando". Para conversas sem altura fixa, como a do topo,
      // cujo crescimento empurraria a página durante a rolagem.
      this.reserve = !!opts.reserve;
      if (this.reserve) root.classList.add("player--reserve");
      this.run = 0;
      this.playing = false;
    }
    reset() {
      this.run++;
      this.playing = false;
      $$(".typing", this.body).forEach((t) => t.remove());
      this.items.forEach((m) => m.classList.add("is-pending"));
      this.onReset();
      whenIdle(() => { this.body.scrollTop = 0; });
    }
    showAll() {
      this.run++;
      this.playing = false;
      $$(".typing", this.body).forEach((t) => t.remove());
      this.items.forEach((m) => m.classList.remove("is-pending", "is-new"));
      this.items.forEach((m) => { if (m.dataset.event) this.onEvent(m.dataset.event, true); });
      this.onStage(null, true);
      this.onDone();
    }
    scroll() {
      whenIdle(() => this.body.scrollTo({ top: this.body.scrollHeight, behavior: reduced ? "auto" : "smooth" }));
    }
    async play() {
      if (reduced) { this.showAll(); return; }
      this.reset();
      const run = this.run;
      this.playing = true;
      await wait(350);
      for (const m of this.items) {
        if (run !== this.run) return;
        const isBot = m.classList.contains("msg--in");
        if (isBot && this.reserve) {
          await wait(900);
          if (run !== this.run) return;
        } else if (isBot) {
          const t = document.createElement("div");
          t.className = "typing";
          t.setAttribute("aria-hidden", "true");
          t.innerHTML = "<i></i><i></i><i></i>";
          this.body.insertBefore(t, m);
          this.scroll();
          const len = (m.textContent || "").length;
          await wait(Math.min(1500, 520 + len * 6));
          t.remove();
          if (run !== this.run) return;
        } else {
          await wait(m.classList.contains("msg--note") ? 200 : 650);
          if (run !== this.run) return;
        }
        m.classList.remove("is-pending");
        m.classList.add("is-new");
        if (m.dataset.stage) this.onStage(Number(m.dataset.stage));
        if (m.dataset.event) this.onEvent(m.dataset.event, false);
        this.scroll();
        await wait(isBot ? 900 : 450);
      }
      if (run !== this.run) return;
      this.playing = false;
      this.onStage(null, true);
      this.onDone();
    }
  }

  // Toca uma vez quando o bloco aparece. Se ele só cruzou a tela durante uma
  // navegação pelo menu, espera: toca se ainda estiver visível quando a
  // rolagem parar, ou na próxima vez que entrar na tela.
  const autoplayOnce = (el, fn) => {
    if (reduced || !("IntersectionObserver" in window)) return;
    let done = false;
    const inView = () => {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight * 0.75 && r.bottom > window.innerHeight * 0.25;
    };
    const io = new IntersectionObserver((entries) => {
      if (done || !entries.some((e) => e.isIntersecting)) return;
      whenIdle(() => {
        if (done || !inView()) return;
        done = true;
        io.disconnect();
        fn();
      });
    }, { threshold: 0.35 });
    io.observe(el);
  };

  const stageHighlighter = (list) => {
    const lis = list ? $$("li", list) : [];
    let last = 0;
    return (n, done) => {
      if (!list) return;
      if (done) { list.classList.remove("is-live"); lis.forEach((li) => li.classList.remove("is-on", "is-done")); last = 0; return; }
      list.classList.add("is-live");
      if (n == null) return;
      last = Math.max(last, n);
      lis.forEach((li, i) => {
        li.classList.toggle("is-on", i + 1 === n);
        li.classList.toggle("is-done", i + 1 < last && i + 1 !== n);
      });
    };
  };

  // ---------- Hero: conversa curta ----------
  const heroPhone = $("#hero-chat");
  if (heroPhone) {
    const p = new Player(heroPhone, { reserve: true });
    p.reset();
    if (reduced) p.showAll();
    else setTimeout(() => p.play(), 500);
  }

  // ---------- Demonstração de IA: abas + reprodutor ----------
  const demo = $("#demo-ai");
  if (demo) {
    const tabs = $$("[role='tab']", demo);
    const panels = $$(".scenario", demo);
    const pipe = $("#pipeline-ai");
    const highlight = stageHighlighter(pipe);
    const players = new Map();
    panels.forEach((panel) => {
      players.set(panel.id, new Player(panel, { onStage: highlight }));
    });
    const replay = $("#demo-replay");
    const skip = $("#demo-skip");
    let current = panels[0] && panels[0].id;

    const select = (tab, autoplay) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach((pn) => { pn.hidden = pn.id !== tab.getAttribute("aria-controls"); });
      current = tab.getAttribute("aria-controls");
      players.forEach((pl, id) => { if (id !== current) pl.reset(); });
      const pl = players.get(current);
      if (autoplay) pl.play(); else pl.showAll();
    };
    tabs.forEach((t, i) => {
      t.addEventListener("click", () => select(t, true));
      t.addEventListener("keydown", (e) => {
        let j = null;
        if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
        if (e.key === "ArrowLeft") j = (i - 1 + tabs.length) % tabs.length;
        if (e.key === "Home") j = 0;
        if (e.key === "End") j = tabs.length - 1;
        if (j !== null) { e.preventDefault(); tabs[j].focus(); select(tabs[j], true); }
      });
    });
    if (replay) replay.addEventListener("click", () => players.get(current).play());
    if (skip) skip.addEventListener("click", () => players.get(current).showAll());
    // Estado inicial: conversa completa visível; toca uma vez ao entrar na tela.
    players.forEach((pl, id) => { if (id !== current) pl.reset(); });
    players.get(current).showAll();
    autoplayOnce(demo, () => players.get(current).play());
  }

  // ---------- Fluxo WhatsApp → painel ----------
  const flow = $("#flow-wa");
  if (flow) {
    const steps = $$("#flow-steps li");
    const row = $(".row-wa", flow);
    const detail = $(".detail", flow);
    const kpiOut = $("[data-kpi='out']", flow);
    const kpiBal = $("[data-kpi='bal']", flow);
    const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const base = { out: Number(kpiOut.dataset.base), bal: Number(kpiBal.dataset.base) };
    const add = Number(row.dataset.value);
    const setKpis = (applied, bump) => {
      $("strong", kpiOut).textContent = brl(applied ? base.out + add : base.out);
      $("strong", kpiBal).textContent = brl(applied ? base.bal - add : base.bal);
      if (bump) [kpiOut, kpiBal].forEach((k) => { k.classList.remove("is-bump"); void k.offsetWidth; k.classList.add("is-bump"); });
    };
    const stepOn = (n) => steps.forEach((li, i) => li.classList.toggle("is-on", n != null && i + 1 <= n));
    const p = new Player(flow, {
      onStage: (n, done) => { if (done) stepOn(5); else if (n) stepOn(n); },
      onEvent: (ev, instant) => {
        if (ev === "saved") {
          row.classList.remove("is-pending");
          if (!instant) row.classList.add("is-new");
          detail.classList.remove("is-pending");
          setKpis(true, !instant);
        }
      },
      onReset: () => {
        row.classList.add("is-pending");
        row.classList.remove("is-new");
        detail.classList.add("is-pending");
        setKpis(false, false);
        stepOn(null);
      },
    });
    $("#flow-play").addEventListener("click", () => p.play());
    $("#flow-skip").addEventListener("click", () => p.showAll());
    p.showAll();
    autoplayOnce(flow, () => p.play());
  }

  // ---------- Capturas ampliáveis ----------
  const dlg = $("#lightbox");
  if (dlg && typeof dlg.showModal === "function") {
    const img = $("img", dlg);
    const cap = $(".lightbox__cap", dlg);
    $$("a.shot").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const src = a.getAttribute("href");
        const thumb = $("img", a);
        img.src = src;
        img.alt = thumb ? thumb.alt : "";
        img.classList.toggle("is-phone", a.dataset.kind === "phone");
        cap.textContent = a.dataset.caption || (thumb ? thumb.alt : "");
        dlg.showModal();
      });
    });
    $(".lightbox__close", dlg).addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  }

  // ---------- Impressão: tudo aberto ----------
  window.addEventListener("beforeprint", () => {
    $$("details").forEach((d) => { d.dataset.wasOpen = d.open ? "1" : ""; d.open = true; });
  });
  window.addEventListener("afterprint", () => {
    $$("details").forEach((d) => { d.open = d.dataset.wasOpen === "1"; });
  });
})();
