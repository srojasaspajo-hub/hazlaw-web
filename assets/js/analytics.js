(function () {
  "use strict";

  // ======================= Medición =======================
  // Pegue aquí cada identificador. Mientras estén vacíos no se carga nada de
  // Google, de Microsoft ni de Meta, y no se envía ningún dato de sus visitantes.
  var GA_ID = "G-8WY2205C5N"; // Google Analytics 4 (propiedad hazlawpe.com, cuenta contacto@hazlawpe.com)
  var CLARITY_ID = "";     // Microsoft Clarity. Se ve así: abcd1234ef
  var META_PIXEL_ID = "";  // Pixel de Meta (Facebook e Instagram). Solo números
  // Google Search Console se verifica con la etiqueta <meta name="google-site-verification">
  // que está lista, comentada, en el <head> de cada página.

  // ===================== Consentimiento =====================
  // Ley 29733 y su reglamento (D.S. 016-2024-JUS): las cookies de medición y publicidad tratan
  // datos personales, así que nada de Google, Microsoft ni Meta se carga antes de que la persona
  // acepte. Medición y publicidad se aceptan por separado, la decisión se puede cambiar desde
  // "Configurar cookies" en el pie y se vuelve a preguntar a los 12 meses o si cambia este aviso.
  var CONSENT_KEY = "hz-consentimiento";
  var CONSENT_VERSION = 1;
  var CONSENT_DAYS = 365;
  var hasGA = /^G-[A-Z0-9]{6,}$/.test(GA_ID);
  var hasClarity = /^[a-z0-9]{6,}$/i.test(CLARITY_ID);
  var hasMeta = /^[0-9]{10,}$/.test(META_PIXEL_ID);
  var hasMedicion = hasGA || hasClarity;
  var enabled = hasMedicion || hasMeta;
  var choice = { medicion: false, publicidad: false };

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  // Un solo evento se reparte a las herramientas que la persona aceptó
  function track(name, params) {
    if (choice.medicion && hasGA && window.gtagLoaded) gtag("event", name, params || {});
    if (choice.medicion && hasClarity && window.clarity) window.clarity("event", name);
    if (choice.publicidad && hasMeta && window.fbq) window.fbq("trackCustom", name, params || {});
  }
  window.hzTrack = track;
  // El resto del sitio avisa sus eventos con: document.dispatchEvent(new CustomEvent("hz:track", {detail}))
  document.addEventListener("hz:track", function (e) {
    if (e.detail && e.detail.name) track(e.detail.name, e.detail.params);
  });

  // Sin identificadores no hay nada que aceptar: ni aviso ni botón en el pie
  window.hzConsent = { open: function () {} };
  if (!enabled) return;

  function loadGA() {
    if (!hasGA || window.gtagLoaded) return;
    window.gtagLoaded = true;
    gtag("consent", "default", {
      analytics_storage: "granted",
      ad_storage: choice.publicidad ? "granted" : "denied",
      ad_user_data: choice.publicidad ? "granted" : "denied",
      ad_personalization: choice.publicidad ? "granted" : "denied"
    });
    gtag("js", new Date());
    gtag("config", GA_ID, {
      allow_google_signals: choice.publicidad,
      allow_ad_personalization_signals: choice.publicidad
    });
    var tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(tag);
  }

  function loadClarity() {
    if (!hasClarity || window.clarity) return;
    window.clarity = function () { (window.clarity.q = window.clarity.q || []).push(arguments); };
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.clarity.ms/tag/" + CLARITY_ID;
    document.head.appendChild(s);
    window.clarity("consent");
  }

  function loadMeta() {
    if (!hasMeta || window.fbq) return;
    var n = window.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    window._fbq = window._fbq || n;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
    window.fbq("consent", "grant");
    window.fbq("init", META_PIXEL_ID);
    window.fbq("track", "PageView");
  }

  function apply() {
    if (choice.medicion) { loadGA(); loadClarity(); }
    if (choice.publicidad) loadMeta();
  }

  // Si alguien retira un permiso ya dado: se borran las cookies de esas herramientas en este
  // dominio y se recarga la página para que sus scripts dejen de correr
  function clearCookies(prefixes) {
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (!prefixes.some(function (p) { return name.indexOf(p) === 0; })) return;
      var host = location.hostname;
      [host, "." + host, "." + host.split(".").slice(-2).join(".")].forEach(function (d) {
        document.cookie = name + "=; Max-Age=0; path=/; domain=" + d;
      });
      document.cookie = name + "=; Max-Age=0; path=/";
    });
  }

  function save(next) {
    var revoca = (choice.medicion && !next.medicion) || (choice.publicidad && !next.publicidad);
    choice = { medicion: !!next.medicion, publicidad: !!next.publicidad };
    var record = { v: CONSENT_VERSION, fecha: new Date().toISOString(), medicion: choice.medicion, publicidad: choice.publicidad };
    try { localStorage.setItem(CONSENT_KEY, JSON.stringify(record)); } catch (err) {}
    if (revoca) {
      if (!choice.medicion) clearCookies(["_ga", "_gid", "_clck", "_clsk", "CLID"]);
      if (!choice.publicidad) clearCookies(["_fbp", "_fbc"]);
      location.reload();
      return;
    }
    apply();
  }

  function read() {
    try {
      var r = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
      if (!r || r.v !== CONSENT_VERSION) return null;
      if (Date.now() - new Date(r.fecha).getTime() > CONSENT_DAYS * 864e5) return null;
      return r;
    } catch (err) { return null; }
  }

  // ---------- Aviso ----------
  var bar = null;
  function row(id, title, text, checked) {
    return '<label class="consent__opt"><input type="checkbox" id="' + id + '"' + (checked ? " checked" : "") + '>' +
      '<span><b>' + title + '</b><span>' + text + '</span></span></label>';
  }
  function build(showOptions) {
    if (bar) bar.remove();
    bar = document.createElement("div");
    bar.className = "consent";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Aviso de cookies");
    var opts = '<div class="consent__opts" id="consent-opts"' + (showOptions ? "" : " hidden") + '>' +
      '<p class="consent__opt consent__opt--fixed"><b>Necesarias</b><span>Guardan esta elección en tu navegador. Siempre activas.</span></p>' +
      (hasMedicion ? row("consent-medicion", "Medición", "Cuántas personas visitan la web y qué secciones usan" + (hasClarity ? ", incluido un registro anónimo de clics y desplazamiento (Microsoft Clarity)." : "."), choice.medicion) : "") +
      (hasMeta ? row("consent-publicidad", "Publicidad", "Medir y mostrar anuncios en Facebook e Instagram (Meta).", choice.publicidad) : "") +
      '<button class="consent__btn consent__btn--save" type="button" data-choice="guardar">Guardar mis preferencias</button>' +
      "</div>";
    bar.innerHTML =
      '<p class="consent__text">Usamos cookies propias necesarias y, solo si aceptas, cookies de terceros para ' +
      (hasMedicion && hasMeta ? "medir el uso de la web y la publicidad" : hasMeta ? "medir la publicidad" : "medir el uso de la web") +
      '. <a href="politica-de-cookies.html">Política de cookies</a></p>' + opts +
      '<div class="consent__actions">' +
      '<button class="consent__link" type="button" data-choice="configurar" aria-expanded="' + (showOptions ? "true" : "false") + '" aria-controls="consent-opts">Configurar</button>' +
      '<button class="consent__btn" type="button" data-choice="rechazar">Rechazar</button>' +
      '<button class="consent__btn" type="button" data-choice="aceptar">Aceptar</button>' +
      "</div>";
    document.body.appendChild(bar);
    requestAnimationFrame(function () { bar.classList.add("is-in"); });
    bar.addEventListener("click", function (e) {
      var c = e.target.getAttribute && e.target.getAttribute("data-choice");
      if (!c) return;
      if (c === "configurar") {
        var o = bar.querySelector(".consent__opts");
        o.hidden = !o.hidden;
        e.target.setAttribute("aria-expanded", o.hidden ? "false" : "true");
        if (!o.hidden) { var first = o.querySelector("input"); if (first) first.focus(); }
        return;
      }
      if (c === "aceptar") save({ medicion: hasMedicion, publicidad: hasMeta });
      else if (c === "rechazar") save({ medicion: false, publicidad: false });
      else if (c === "guardar") {
        var m = bar.querySelector("#consent-medicion"), p = bar.querySelector("#consent-publicidad");
        save({ medicion: !!(m && m.checked), publicidad: !!(p && p.checked) });
      }
      close();
    });
  }
  function close() {
    if (!bar) return;
    var b = bar; bar = null;
    b.classList.remove("is-in");
    setTimeout(function () { b.remove(); }, 400);
  }

  window.hzConsent = {
    open: function () {
      build(true);
      var first = document.querySelector(".consent__opts input");
      if (first) first.focus();
    }
  };

  var stored = read();
  if (stored) {
    choice = { medicion: !!stored.medicion, publicidad: !!stored.publicidad };
    apply();
  }
  document.addEventListener("DOMContentLoaded", function () {
    // El botón "Configurar cookies" del pie solo aparece cuando hay algo que configurar
    document.querySelectorAll("[data-consent-open]").forEach(function (btn) {
      btn.hidden = false;
      btn.addEventListener("click", function () { window.hzConsent.open(); });
    });
    if (!stored) build(false);
  });

  // De qué parte de la página viene cada clic
  var PAGE = (location.pathname.split("/").pop() || "index.html").replace(".html", "") || "index";
  function sectionOf(el) {
    if (el.closest(".quick-cta")) return "boton_flotante";
    if (el.closest(".site-header")) return "encabezado";
    var sec = el.closest("section[id]");
    if (sec) return sec.id;
    if (el.closest("footer")) return "pie";
    return "otro";
  }
  function labelOf(el) {
    var inner = el.querySelector(".quick-cta__opt-label");
    var text = (el.getAttribute("aria-label") || (inner ? inner.textContent : el.textContent) || "").replace(/\s+/g, " ").trim();
    return text.slice(0, 60);
  }
  // Solo el tipo de consulta: nunca se envía lo que la persona escribió
  function topicOf(msg) {
    if (/marca/i.test(msg)) return "marca";
    if (/notarial|notar/i.test(msg)) return "notarial";
    if (/consulta|pregunta/i.test(msg)) return "consulta";
    return "empresa";
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("a, button");
    if (!el) return;
    var href = el.getAttribute("href") || "";
    var base = { pagina: PAGE, seccion: sectionOf(el), boton: labelOf(el) };
    if (el.hasAttribute("data-wa") || /wa\.me\//.test(href)) {
      base.tema = topicOf(el.getAttribute("data-wa") || "");
      track("whatsapp_click", base);
    } else if (/^tel:/.test(href)) {
      track("llamada_click", base);
    } else if (/^mailto:/.test(href)) {
      track("correo_click", base);
    } else if (/google\.[a-z.]+\/maps/.test(href)) {
      track("mapa_click", base);
    } else if (/sunat\.gob\.pe/.test(href)) {
      track("sunat_click", base);
    } else if (el.hasAttribute("data-copy")) {
      track("copiar_ruc", base);
    } else if (/instagram|facebook|tiktok/.test(href)) {
      base.red = (href.match(/instagram|facebook|tiktok/) || [""])[0];
      track("red_social_click", base);
    } else if (/preguntas-frecuentes|registro-de-marca|constitucion-de-empresas|gestion-notarial|nosotros|index\.html/.test(href)) {
      base.destino = href;
      track("pagina_interna_click", base);
    }
  }, true);

  // Hasta dónde llega cada visita: cada sección se cuenta una vez
  document.addEventListener("DOMContentLoaded", function () {
    if (!("IntersectionObserver" in window)) return;
    var seen = {};
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id || "pie";
        if (seen[id]) return;
        seen[id] = true;
        track("seccion_vista", { pagina: PAGE, seccion: id });
        io.unobserve(entry.target);
      });
    }, { threshold: 0.4 });
    document.querySelectorAll("main > section[id], footer").forEach(function (el) { io.observe(el); });
  });
})();
