(function () {
  "use strict";

  var WA_BASE = "https://wa.me/51924021846?text=";

  // Avisa un evento a la medición (assets/js/analytics.js). Sin ID de GA4 no hace nada.
  function hzTrack(name, params) {
    document.dispatchEvent(new CustomEvent("hz:track", { detail: { name: name, params: params || {} } }));
  }

  // Horario de atención en hora de Lima: lunes a viernes de 9:00 a 18:00, sábados de 9:00 a 13:00
  function limaSchedule() {
    var n = new Date();
    var d = new Date(n.getTime() + (n.getTimezoneOffset() - 300) * 60000);
    var day = d.getDay();
    var m = d.getHours() * 60 + d.getMinutes();
    var open = (day >= 1 && day <= 5 && m >= 540 && m < 1080) || (day === 6 && m >= 540 && m < 780);
    var when = null;
    if (!open) {
      if (day >= 1 && day <= 6 && m < 540) when = "hoy";
      else if (day === 6) when = "el lunes";
      else when = "mañana";
    }
    return { day: day, open: open, when: when };
  }

  // Sin pantalla de carga: el contenido se ve apenas llega. La clase marca que la página está lista.
  function initPreloader() {
    document.body.classList.add("is-ready");
  }


  function upgradeWhatsAppLinks() {
    var links = document.querySelectorAll("[data-wa]");
    links.forEach(function (link) {
      var msg = link.getAttribute("data-wa");
      link.setAttribute("href", WA_BASE + encodeURIComponent(msg));
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener");
    });
  }

  function initButtonPress() {
    var buttons = document.querySelectorAll(".btn");
    buttons.forEach(function (btn) {
      btn.addEventListener("pointerdown", function () {
        btn.classList.add("is-pressed");
      });
      ["pointerup", "pointerleave", "pointercancel"].forEach(function (evt) {
        btn.addEventListener(evt, function () {
          btn.classList.remove("is-pressed");
        });
      });
    });
  }

  function initWhatsAppToast() {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    var links = document.querySelectorAll("[data-wa]");

    links.forEach(function (link) {
      link.addEventListener("click", function (e) {
        toast(e.clientX, e.clientY);
      });
    });

    function toast(x, y) {
      var chip = document.createElement("span");
      chip.className = "wa-toast";
      chip.textContent = "Abriendo WhatsApp…";
      chip.style.left = x + "px";
      chip.style.top = Math.max(y - 44, 8) + "px";
      document.body.appendChild(chip);
      window.setTimeout(function () {
        chip.remove();
      }, 1400);
    }
  }

  function initRevealOnScroll() {
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (reduceMotion || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    items.forEach(function (el) {
      var siblings = Array.prototype.filter.call(el.parentElement.children, function (c) {
        return c.classList.contains("reveal");
      });
      var index = siblings.indexOf(el);
      el.style.transitionDelay = Math.min(index, 4) * 90 + "ms";
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach(function (el) {
      observer.observe(el);
    });
  }

  // CTA fijo: ofrece un diagnóstico gratis. Al tocarlo abre un arranque guiado con varias opciones
  // que llevan a WhatsApp con el mensaje ya escrito, ajustado a la sección que la persona está viendo.
  // Se oculta en la portada y en el cierre, donde ya hay un botón grande.
  function initStickyCta() {
    var root = document.getElementById("quick-cta");
    var btn = document.getElementById("quick-cta-btn");
    if (!root || !btn) return;
    var sheet = document.getElementById("quick-cta-sheet");
    var list = sheet.querySelector(".quick-cta__options");
    var closeBtn = sheet.querySelector(".quick-cta__close");
    var nudgeText = root.querySelector(".quick-cta__nudge-text");
    var opts = {};
    var ORDER = ["empresa", "marca", "notarial", "duda"].filter(function (k) {
      opts[k] = list.querySelector('[data-opt="' + k + '"]');
      return !!opts[k];
    });
    var BASE = "Hola, vengo de la web. ";
    var HIDE = { cierre: true, "site-foot": true };
    var heroEl = document.getElementById("hero");
    var current = "hero";
    var visible = false;
    var opened = false;
    var nudged = false;
    var mainKey = null;

    function setOpt(key, msg) {
      if (!opts[key]) return;
      opts[key].setAttribute("data-wa", msg);
      opts[key].setAttribute("href", WA_BASE + encodeURIComponent(msg));
    }

    function setPrimary(key) {
      if (!opts[key]) key = ORDER[0];
      if (key === mainKey) return;
      mainKey = key;
      var order = [key].concat(ORDER.filter(function (k) { return k !== key; }));
      order.forEach(function (k, i) {
        opts[k].classList.toggle("is-primary", k === key);
        opts[k].style.setProperty("--i", i);
        list.appendChild(opts[k]);
      });
    }

    // El mensaje de cada opción recoge lo que la persona estaba mirando
    function applyContext() {
      var empresa = BASE + "Quiero constituir mi empresa.";
      var marca = BASE + "Quiero registrar mi marca.";
      var notarial = BASE + "Necesito un trámite notarial.";
      // Cada página puede indicar qué opción va primero (en la de marca, "Registrar mi marca")
      var main = document.body.getAttribute("data-cta-main") || "empresa";
      if (current === "tramites") {
        var chip = document.querySelector(".expediente__tab.is-active");
        if (chip) notarial = BASE + chip.getAttribute("data-msg");
      } else if (current === "marca") {
        main = "marca";
        var input = document.getElementById("brand-name");
        var name = input ? input.value.replace(/\s+/g, " ").trim() : "";
        if (name) marca = BASE + "Quiero registrar mi marca «" + name + "».";
      } else if (current === "existimos" || current === "nosotros") {
        empresa = BASE + "Quiero constituir mi empresa con asesoría contable.";
      }
      setOpt("empresa", empresa);
      setOpt("marca", marca);
      setOpt("notarial", notarial);
      setOpt("duda", BASE + "Tengo una consulta.");
      if (!opened) setPrimary(main);
    }

    function open(fromKeyboard) {
      if (opened) return;
      applyContext();
      opened = true;
      hzTrack("diagnostico_abrir", { seccion: current });
      sheet.hidden = false;
      root.classList.add("is-open", "was-opened");
      root.classList.remove("show-nudge");
      btn.setAttribute("aria-expanded", "true");
      if (fromKeyboard) list.firstElementChild.focus();
    }

    function close(returnFocus) {
      if (!opened) return;
      opened = false;
      sheet.hidden = true;
      root.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      if (returnFocus) btn.focus();
    }

    btn.addEventListener("click", function (e) {
      if (opened) close(false);
      else open(e.detail === 0);
    });
    closeBtn.addEventListener("click", function () { close(true); });
    ORDER.forEach(function (k) {
      opts[k].addEventListener("click", function () { window.setTimeout(function () { close(false); }, 250); });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && opened) close(true);
    });
    document.addEventListener("pointerdown", function (e) {
      if (opened && !root.contains(e.target)) close(false);
    });

    // Horario de Lima: lunes a viernes de 9:00 a 18:00, sábados de 9:00 a 13:00
    function refreshStatus() {
      var sch = limaSchedule();
      root.classList.toggle("is-staffed", sch.open);
      nudgeText.textContent = sch.open ? "Atendiendo ahora. ¿Empezamos?" : "Déjanos tu caso. Respondemos " + sch.when + ".";
    }
    refreshStatus();
    window.setInterval(refreshStatus, 60000);

    // Invitación: un globo al aparecer y un pequeño movimiento del ícono si nadie lo abre
    function nudgeOnce() {
      // Espera a que la persona haya bajado un poco: nada salta apenas se abre la página
      if (nudged || current === "hero" || window.scrollY < window.innerHeight * 0.6) return;
      nudged = true;
      window.setTimeout(function () {
        if (opened || !visible) return;
        root.classList.add("show-nudge");
        window.setTimeout(function () { root.classList.remove("show-nudge"); }, 5000);
      }, 1400);
      window.setTimeout(function () {
        if (opened || !visible || root.classList.contains("was-opened")) return;
        root.classList.add("is-nudging");
        window.setTimeout(function () { root.classList.remove("is-nudging"); }, 1000);
      }, 16000);
    }

    function setVisible(v) {
      if (v === visible) return;
      visible = v;
      root.classList.toggle("is-visible", v);
      if (!v) close(false);
      else nudgeOnce();
    }

    // Sobre la portada de cada página no aparece: ahí ya están su botón rojo y el WhatsApp del
    // encabezado, y en el celular el flotante tapaba la línea del RUC. Tampoco mientras se ve el
    // video de "Quiénes somos": tapaba los controles del reproductor
    function refreshVisibility() {
      var enPortada = current === "hero" || /-hero$/.test(current);
      var viendoVideo = current === "quienes-somos" && !!document.querySelector(".cine__frame iframe");
      setVisible(!HIDE[current] && !enPortada && !viendoVideo);
    }
    document.addEventListener("hz:video", refreshVisibility);
    if (heroEl && "MutationObserver" in window) {
      new MutationObserver(function () { if (current === "hero") refreshVisibility(); })
        .observe(heroEl, { attributes: true, attributeFilter: ["class"] });
    }

    var watched = Array.prototype.slice.call(document.querySelectorAll("main > section[id], footer"));
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          current = e.target.id || "footer";
          refreshVisibility();
          if (visible) nudgeOnce();
          applyContext();
        });
      }, { rootMargin: "-50% 0px -50% 0px", threshold: 0 });
      watched.forEach(function (el) { io.observe(el); });
    } else {
      current = "footer";
      setVisible(true);
      applyContext();
    }
  }

  // Glosario: al tocar un término, aparece su definición en un globo flotante.
  // Un solo globo compartido, que se reposiciona junto al término activo.
  var GLOSSARY = {
    ruc: "El número con el que la SUNAT identifica a tu empresa para poder facturar y pagar impuestos.",
    estatuto: "El documento que fija las reglas internas de tu empresa: quién decide qué, y qué pasa si un socio se va.",
    sunarp: "El registro público donde se inscribe tu empresa. Sin esa inscripción, la empresa no existe legalmente.",
    sunat: "La entidad que cobra los impuestos. Le da el RUC a tu empresa y revisa lo que declara cada mes.",
    "reserva-nombre": "El primer paso del trámite: asegurar que nadie más pueda usar el nombre de tu empresa mientras se inscribe.",
    indecopi: "La entidad que registra las marcas en el Perú y protege la propiedad intelectual."
  };

  function initGlossary() {
    var pop = document.getElementById("term-pop");
    if (!pop) return;
    var popText = document.getElementById("term-pop-text");
    var closeBtn = pop.querySelector(".term-pop__close");
    var terms = Array.prototype.slice.call(document.querySelectorAll(".term"));
    var openBtn = null;

    function position(btn) {
      var r = btn.getBoundingClientRect();
      var pw = pop.offsetWidth;
      var ph = pop.offsetHeight;
      var left = Math.min(Math.max(r.left, 12), window.innerWidth - pw - 12);
      var top = r.bottom + 8;
      if (top + ph > window.innerHeight - 12) top = r.top - ph - 8;
      if (top < 12) top = 12;
      pop.style.left = left + "px";
      pop.style.top = top + "px";
    }

    function close() {
      if (!openBtn) return;
      pop.classList.remove("is-open");
      openBtn.setAttribute("aria-expanded", "false");
      openBtn = null;
    }

    function open(btn) {
      if (openBtn === btn) { close(); return; }
      close();
      var text = GLOSSARY[btn.getAttribute("data-term")];
      if (!text) return;
      popText.textContent = text;
      pop.classList.add("is-open");
      position(btn);
      // El borde puede haber cambiado con el contenido nuevo: reubicar tras medir
      requestAnimationFrame(function () { position(btn); });
      btn.setAttribute("aria-expanded", "true");
      openBtn = btn;
    }

    terms.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        open(btn);
      });
    });
    closeBtn.addEventListener("click", function () {
      var toFocus = openBtn;
      close();
      if (toFocus) toFocus.focus();
    });
    document.addEventListener("pointerdown", function (e) {
      if (!openBtn) return;
      if (pop.contains(e.target) || e.target === openBtn) return;
      close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && openBtn) {
        var toFocus = openBtn;
        close();
        toFocus.focus();
      }
    });
    // Reubica el globo mientras está abierto, en vez de cerrarlo: en el celular, el scroll
    // suele mover apenas la barra de direcciones y cerrar de una se sentiría roto.
    window.addEventListener("scroll", function () { if (openBtn) position(openBtn); }, { passive: true });
    window.addEventListener("resize", function () { if (openBtn) position(openBtn); });
  }

  // Registro de marca: el nombre que escribe el visitante recorre las etapas del trámite.
  // Al entrar en vista avanza solo una vez, hasta el registro; si la persona toca algo, manda ella.
  var BRAND_STAGES = [
    { label: "Búsqueda", status: "Buscando nombres iguales o parecidos", caption: "Primero revisamos si ya existe una marca igual o parecida a la tuya." },
    { label: "Solicitud", status: "Solicitud presentada", caption: "Presentamos la solicitud ante INDECOPI, en la clase que corresponde a lo que vendes." },
    { label: "Publicación", status: "Publicada en la Gaceta de INDECOPI", caption: "Tu marca se publica para que cualquiera pueda conocerla." },
    { label: "Oposición", status: "30 días hábiles para oposiciones", caption: "Durante 30 días hábiles, otros pueden oponerse. Si alguien lo hace, lo vemos juntos." },
    { label: "Registro", status: "Marca registrada · 10 años, renovables", caption: "Si todo está en orden, INDECOPI otorga el registro por 10 años, y se puede renovar." }
  ];

  function initBrandLab() {
    var card = document.getElementById("brand-card");
    if (!card) return;
    var input = document.getElementById("brand-name");
    var range = document.getElementById("brand-range");
    var text = document.getElementById("brand-card-text");
    var status = document.getElementById("brand-card-status");
    var caption = document.getElementById("brand-caption");
    var cta = document.getElementById("brand-cta");
    var steps = Array.prototype.slice.call(document.querySelectorAll(".brand-steps__labels button"));
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var stage = -1;
    var touched = false;
    var autoTimer = null;
    var swapTimer = null;

    // Mientras avanza solo, no se anuncia cada etapa al lector de pantalla
    caption.setAttribute("aria-live", "off");

    function setStage(n) {
      n = Math.max(0, Math.min(BRAND_STAGES.length - 1, n));
      if (n === stage) return;
      stage = n;
      var st = BRAND_STAGES[n];
      card.setAttribute("data-stage", String(n));
      range.value = String(n);
      range.setAttribute("aria-valuetext", st.label);
      range.style.setProperty("--pct", (n / (BRAND_STAGES.length - 1)) * 100 + "%");
      steps.forEach(function (b, i) {
        b.classList.toggle("is-active", i === n);
        b.classList.toggle("is-past", i < n);
      });
      clearTimeout(swapTimer);
      status.classList.add("is-swapping");
      caption.classList.add("is-swapping");
      swapTimer = setTimeout(function () {
        status.textContent = st.status;
        caption.textContent = st.caption;
        status.classList.remove("is-swapping");
        caption.classList.remove("is-swapping");
      }, reduce ? 0 : 200);
    }

    function updateName() {
      var name = input.value.replace(/\s+/g, " ").trim();
      var shown = name || "Tu marca";
      text.textContent = shown;
      card.classList.toggle("brand-card--m", shown.length > 10 && shown.length <= 16);
      card.classList.toggle("brand-card--s", shown.length > 16);
      var msg = name
        ? "Hola, vengo de la web. Quiero registrar mi marca «" + name + "»."
        : "Hola, vengo de la web. Quiero registrar mi marca.";
      cta.setAttribute("data-wa", msg);
      cta.setAttribute("href", WA_BASE + encodeURIComponent(msg));
    }

    function takeOver() {
      if (touched) return;
      touched = true;
      clearTimeout(autoTimer);
      caption.setAttribute("aria-live", "polite");
      hzTrack("marca_simulador_uso", {});
    }

    input.addEventListener("input", function () {
      takeOver();
      updateName();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        range.focus();
      }
    });
    range.addEventListener("pointerdown", takeOver);
    range.addEventListener("keydown", takeOver);
    range.addEventListener("input", function () {
      takeOver();
      setStage(parseInt(range.value, 10));
    });
    steps.forEach(function (b) {
      b.addEventListener("click", function () {
        takeOver();
        setStage(parseInt(b.getAttribute("data-step"), 10));
      });
    });

    function advance() {
      if (touched || stage >= BRAND_STAGES.length - 1) return;
      autoTimer = setTimeout(function () {
        if (touched) return;
        setStage(stage + 1);
        advance();
      }, 1900);
    }

    setStage(0);
    updateName();

    if (!reduce && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        advance();
      }, { threshold: 0.55 });
      io.observe(card);
    }
  }

  // Preguntas frecuentes como árbol: el tronco se llena hasta la pregunta elegida y
  // una rama la une con su respuesta. Puede haber varios grupos en la misma página.
  function initFaqTree() {
    var trees = Array.prototype.slice.call(document.querySelectorAll(".faq-tree"));
    if (!trees.length) return;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var wide = window.matchMedia("(min-width: 900px)");

    trees.forEach(function (root) {
      var qs = Array.prototype.slice.call(root.querySelectorAll(".faq-tree__q"));
      var panels = qs.map(function (q) { return document.getElementById(q.getAttribute("aria-controls")); });
      root.classList.add("is-ready");

      function open(i) {
        qs.forEach(function (q, k) {
          var on = k === i;
          q.classList.toggle("is-active", on);
          q.classList.toggle("is-passed", k < i);
          q.setAttribute("aria-expanded", on ? "true" : "false");
          panels[k].classList.toggle("is-active", on);
        });
      }
      root.hzOpen = open;
      root.hzIndex = function (id) {
        for (var i = 0; i < qs.length; i++) if (qs[i].id === id) return i;
        return -1;
      };

      qs.forEach(function (q, i) {
        q.addEventListener("click", function () {
          open(i);
          hzTrack("faq_pregunta", { pregunta: q.querySelector(".faq-tree__label").textContent.trim().slice(0, 60) });
          // En el celular la respuesta aparece debajo de la pregunta: que se vea completa
          if (!wide.matches) {
            var r = panels[i].getBoundingClientRect();
            if (r.bottom > window.innerHeight - 96 || r.top < 0) {
              q.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
            }
          }
        });
        q.addEventListener("keydown", function (e) {
          var next = null;
          if (e.key === "ArrowDown") next = Math.min(qs.length - 1, i + 1);
          else if (e.key === "ArrowUp") next = Math.max(0, i - 1);
          if (next === null) return;
          e.preventDefault();
          open(next);
          qs[next].focus();
        });
      });

      open(0);
    });

    // Burbujas de la foto: abren su pregunta, esté en el grupo que esté
    document.querySelectorAll("[data-faq-open]").forEach(function (b) {
      b.addEventListener("click", function () {
        var target = document.getElementById(b.getAttribute("data-faq-open"));
        if (!target) return;
        var root = target.closest(".faq-tree");
        var i = root.hzIndex(target.id);
        if (i >= 0) root.hzOpen(i);
        target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        target.focus({ preventScroll: true });
      });
    });
  }

  // Comprobación: copiar el RUC para consultarlo en SUNAT
  function initProofCopy() {
    var buttons = document.querySelectorAll("[data-copy]");
    buttons.forEach(function (btn) {
      var label = btn.textContent;
      var timer = null;
      function done() {
        btn.textContent = "Copiado";
        btn.classList.add("is-copied");
        clearTimeout(timer);
        timer = setTimeout(function () {
          btn.textContent = label;
          btn.classList.remove("is-copied");
        }, 1800);
      }
      function fallback(text) {
        var area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        try { document.execCommand("copy"); done(); } catch (err) {}
        area.remove();
      }
      btn.addEventListener("click", function () {
        var text = btn.getAttribute("data-copy");
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () { fallback(text); });
        } else {
          fallback(text);
        }
      });
    });
  }

  // Pie de página: la firma sube al llegar, una luz tenue sigue al puntero, la oficina muestra
  // si está abierta ahora y resalta el horario de hoy, y un botón lleva de vuelta arriba.
  function initSiteFoot() {
    var foot = document.getElementById("site-foot");
    if (!foot) return;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce || !("IntersectionObserver" in window)) {
      foot.classList.add("is-in");
    } else {
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        foot.classList.add("is-in");
        io.disconnect();
      }, { threshold: 0.2 });
      io.observe(foot.querySelector(".site-foot__sign"));
    }

    if (!reduce && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      var raf = null;
      var px = 0;
      var py = 0;
      foot.addEventListener("pointermove", function (e) {
        px = e.clientX;
        py = e.clientY;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = null;
          var r = foot.getBoundingClientRect();
          foot.style.setProperty("--mx", ((px - r.left) / r.width * 100).toFixed(1) + "%");
          foot.style.setProperty("--my", (py - r.top).toFixed(0) + "px");
        });
      });
    }

    var status = document.getElementById("office-status");
    var statusText = status ? status.querySelector(".site-foot__status-text") : null;
    var rows = Array.prototype.slice.call(foot.querySelectorAll(".site-foot__hours li"));
    function refresh() {
      var sch = limaSchedule();
      if (status) {
        status.classList.toggle("is-open", sch.open);
        statusText.textContent = sch.open ? "Abierto ahora" : "Abre " + sch.when + ", 9:00";
      }
      rows.forEach(function (li) {
        var days = li.getAttribute("data-days").split(",").map(Number);
        li.classList.toggle("is-today", days.indexOf(sch.day) !== -1);
      });
    }
    refresh();
    window.setInterval(refresh, 60000);

    var year = foot.querySelector("[data-year]");
    if (year) year.textContent = String(new Date().getFullYear());

    var up = foot.querySelector(".site-foot__up");
    if (up) {
      up.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      });
    }
  }

  // Encabezado fijo con los tres servicios. Sobre el video o una foto es transparente;
  // al bajar se vuelve esmerilado para que se lea sobre cualquier fondo.
  function initSiteHeader() {
    var header = document.getElementById("site-header");
    if (!header) return;
    var nav = header.querySelector(".site-header__nav");
    var alwaysSolid = header.classList.contains("is-solid");

    function refreshSolid() {
      header.classList.toggle("is-scrolled", alwaysSolid || window.scrollY > 8);
    }
    window.addEventListener("scroll", refreshSolid, { passive: true });
    refreshSolid();

    // En pantallas muy angostas la fila se desliza: que el servicio actual quede a la vista
    var current = header.querySelector(".site-header__link[aria-current]");
    if (current && nav.scrollWidth > nav.clientWidth + 2) {
      nav.scrollLeft = Math.max(0, current.offsetLeft - (nav.clientWidth - current.offsetWidth) / 2);
    }
  }

  // Guía de preguntas: orienta paso a paso, como lo haría un abogado, y termina con una
  // recomendación y su mensaje de WhatsApp. La recomendación la da la última respuesta que la tenga.
  function initGuides() {
    document.querySelectorAll("[data-guide]").forEach(function (root) {
      var steps = Array.prototype.slice.call(root.querySelectorAll(".guide__step"));
      var results = Array.prototype.slice.call(root.querySelectorAll(".guide__result"));
      var bars = Array.prototype.slice.call(root.querySelectorAll(".guide__progress span"));
      var answers = {};
      var order = [];

      var card = root.querySelector(".guide__card");
      var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      function show(panel, fromKeyboard) {
        steps.concat(results).forEach(function (el) { el.classList.toggle("is-active", el === panel); });
        // Si la tarjeta quedó debajo del encabezado, se acomoda para leer desde arriba
        var header = document.getElementById("site-header");
        var top = card.getBoundingClientRect().top - (header ? header.offsetHeight : 0) - 12;
        if (top < 0) window.scrollBy({ top: top, behavior: reduce ? "auto" : "smooth" });
        if (fromKeyboard) {
          var first = panel.querySelector("button, a");
          if (first) first.focus();
        }
      }
      function progress(done) {
        bars.forEach(function (b, i) { b.classList.toggle("is-done", i < done); });
      }

      root.addEventListener("click", function (e) {
        var opt = e.target.closest(".guide__opt");
        var keyboard = e.detail === 0;
        if (opt) {
          var kv = opt.getAttribute("data-answer").split(":");
          answers[kv[0]] = kv[1];
          order = order.filter(function (k) { return k !== kv[0]; });
          order.push(kv[0]);
          var go = opt.getAttribute("data-go");
          if (go === "result") {
            var result = null;
            for (var i = order.length - 1; i >= 0 && !result; i--) {
              result = root.querySelector('.guide__result[data-for="' + order[i] + ":" + answers[order[i]] + '"]');
            }
            if (!result) return;
            result.querySelectorAll("[data-note]").forEach(function (n) {
              var p = n.getAttribute("data-note").split(":");
              n.hidden = answers[p[0]] !== p[1];
            });
            progress(bars.length);
            show(result, keyboard);
            hzTrack("guia_resultado", { guia: root.getAttribute("data-guide"), resultado: result.getAttribute("data-for") });
          } else {
            var next = root.querySelector('.guide__step[data-step="' + go + '"]');
            progress(steps.indexOf(next));
            show(next, keyboard);
          }
          return;
        }
        if (e.target.closest(".guide__restart")) {
          answers = {};
          order = [];
          progress(0);
          show(steps[0], keyboard);
        }
      });
    });
  }

  // Gestión notarial: la persona toca su trámite y la tarjeta le explica de qué se trata,
  // con el mensaje de WhatsApp ya escrito para ese caso.
  // Gestión notarial: expediente de trámites. Pestañas con teclado (flechas, Inicio, Fin); al elegir,
  // la hoja se renueva, los pasos se encienden uno por uno y cae el sello. Con "reducir
  // movimiento" solo cambia el contenido.
  function initTramites() {
    var root = document.getElementById("tramites-picker");
    if (!root) return;
    var tabs = Array.prototype.slice.call(root.querySelectorAll(".expediente__tab"));
    var sheet = root.querySelector(".expediente__sheet");
    var title = document.getElementById("tramite-title");
    var text = document.getElementById("tramite-text");
    var num = document.getElementById("tramite-num");
    var cta = document.getElementById("tramite-cta");
    var wide = window.matchMedia("(min-width: 900px)");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var total = tabs.length;
    function two(n) { return (n < 10 ? "0" : "") + n; }

    function select(i, byUser, focus) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        t.classList.toggle("is-active", on);
      });
      var tab = tabs[i];
      if (focus) tab.focus();
      sheet.setAttribute("aria-labelledby", tab.id);
      title.textContent = tab.querySelector(".expediente__name").textContent;
      text.textContent = tab.getAttribute("data-text");
      num.textContent = two(i + 1) + " de " + two(total);
      var msg = "Hola, vengo de la web. " + tab.getAttribute("data-msg");
      cta.setAttribute("data-wa", msg);
      cta.setAttribute("href", WA_BASE + encodeURIComponent(msg));
      if (!byUser) return;
      if (!reduce) {
        sheet.classList.remove("is-playing");
        void sheet.offsetWidth;
        sheet.classList.add("is-playing");
      }
      hzTrack("tramite_elegido", { tramite: title.textContent });
      // En el celular la hoja está debajo de las pestañas: que se vea
      if (!wide.matches && !focus) {
        var r = sheet.getBoundingClientRect();
        if (r.top > window.innerHeight * 0.6) {
          window.scrollBy({ top: r.top - 120, behavior: reduce ? "auto" : "smooth" });
        }
      }
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(i, true, false); });
      tab.addEventListener("keydown", function (e) {
        var k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        var next = null;
        if (k) next = (i + k + total) % total;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = total - 1;
        if (next === null) return;
        e.preventDefault();
        select(next, true, true);
      });
    });
    select(0, false, false);

    // Desde "Para quién es": un trámite típico lleva al expediente con ese trámite elegido
    document.querySelectorAll("[data-ir-tramite]").forEach(function (a) {
      a.addEventListener("click", function (e) {
        var name = a.getAttribute("data-ir-tramite");
        var i = tabs.map(function (t) { return t.querySelector(".expediente__name").textContent; }).indexOf(name);
        if (i < 0) return;
        e.preventDefault();
        document.getElementById("tramites").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        window.setTimeout(function () { select(i, true, true); }, reduce ? 0 : 550);
      });
    });
  }

  // Gestión notarial: perfiles desplegables, uno abierto a la vez. Sin JavaScript se ven todos.
  function initPerfiles() {
    var list = document.getElementById("perfiles");
    if (!list) return;
    var heads = Array.prototype.slice.call(list.querySelectorAll(".perfil__head"));
    function open(i) {
      heads.forEach(function (h, k) {
        var on = k === i;
        h.setAttribute("aria-expanded", on ? "true" : "false");
        h.closest(".perfil").classList.toggle("is-open", on);
      });
      list.classList.toggle("has-open", i > -1);
    }
    heads.forEach(function (h, i) {
      h.addEventListener("click", function () {
        var abierto = h.getAttribute("aria-expanded") === "true";
        open(abierto ? -1 : i);
        if (abierto) return;
        hzTrack("perfil_convenio", { perfil: h.querySelector(".perfil__name").textContent });
        // Si los trámites que se abren quedan debajo de la pantalla (y de la barra de WhatsApp),
        // el perfil sube hasta quedar bajo el encabezado
        var perfil = h.closest(".perfil");
        setTimeout(function () {
          var r = perfil.getBoundingClientRect();
          if (r.bottom > window.innerHeight - 110) {
            var cab = document.querySelector(".site-header");
            var tope = (cab ? cab.getBoundingClientRect().bottom : 0) + 16;
            window.scrollBy({ top: r.top - tope, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          }
        }, 380);
      });
    });
    list.classList.add("is-ready");
    open(-1);
  }

  // Enlaces a una sección de la misma página: bajan con suavidad
  function initSmoothLinks() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll('a[href^="#"][data-scroll]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var target = document.getElementById(a.getAttribute("href").slice(1));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      });
    });
  }

  // Testimonios en movimiento: avanzan solos y en bucle, así se ven todos mientras se recorre la página.
  // Se detienen al pasar el mouse o al enfocarlos, y se pueden arrastrar con el dedo o el mouse.
  // La tarjeta que pasa por el centro se levanta un poco.
  function initVoiceMarquee() {
    var root = document.getElementById("voice-marquee");
    if (!root) return;
    var track = root.querySelector(".voice-marquee__track");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      root.classList.add("is-static");
      return;
    }
    var originals = Array.prototype.slice.call(track.children);
    originals.forEach(function (li) {
      var copy = li.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      track.appendChild(copy);
    });
    var cards = Array.prototype.slice.call(track.children);
    var SPEED = 36; // px por segundo
    var loopW = 0;
    var x = 0;
    var last = 0;
    var lastCenter = 0;
    var rafId = null;
    var inView = false;
    var hovered = false;
    var focused = false;
    var dragging = false;
    var dragged = false;
    var resumeAt = 0;
    var startX = 0;
    var startOff = 0;
    var pointerId = null;

    function measure() {
      loopW = cards[originals.length].offsetLeft - cards[0].offsetLeft;
    }
    function wrap() {
      if (!loopW) return;
      while (x <= -loopW) x += loopW;
      while (x > 0) x -= loopW;
    }
    function paint() {
      track.style.transform = "translate3d(" + x.toFixed(2) + "px,0,0)";
    }
    function markCenter() {
      var mid = window.innerWidth / 2;
      cards.forEach(function (c) {
        var r = c.getBoundingClientRect();
        c.classList.toggle("is-center", r.left < mid && r.right > mid);
      });
    }
    function frame(now) {
      rafId = null;
      var dt = Math.min(64, now - (last || now));
      last = now;
      if (!dragging && !hovered && !focused && now > resumeAt) x -= SPEED * dt / 1000;
      wrap();
      paint();
      if (now - lastCenter > 200) {
        lastCenter = now;
        markCenter();
      }
      if (inView && !document.hidden) rafId = requestAnimationFrame(frame);
    }
    function start() {
      if (rafId === null && inView && !document.hidden) {
        last = 0;
        rafId = requestAnimationFrame(frame);
      }
    }

    measure();
    window.addEventListener("resize", measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    track.querySelectorAll("img").forEach(function (img) {
      if (!img.complete) img.addEventListener("load", measure, { once: true });
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        inView = entries[0].isIntersecting;
        start();
      }).observe(root);
    } else {
      inView = true;
      start();
    }
    document.addEventListener("visibilitychange", start);

    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      root.addEventListener("mouseenter", function () { hovered = true; });
      root.addEventListener("mouseleave", function () { hovered = false; });
    }
    root.addEventListener("focusin", function () { focused = true; });
    root.addEventListener("focusout", function () { focused = false; });

    root.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      dragging = true;
      startX = e.clientX;
      startOff = x;
      pointerId = e.pointerId;
    });
    root.addEventListener("pointermove", function (e) {
      if (!dragging || e.pointerId !== pointerId) return;
      var dx = e.clientX - startX;
      if (!root.classList.contains("is-dragging") && Math.abs(dx) > 5) {
        root.classList.add("is-dragging");
        try { root.setPointerCapture(pointerId); } catch (err) {}
        if (!dragged) {
          dragged = true;
          hzTrack("testimonios_arrastre", {});
        }
      }
      x = startOff + dx;
      wrap();
      paint();
    });
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      root.classList.remove("is-dragging");
      resumeAt = performance.now() + 1600;
      markCenter();
    }
    root.addEventListener("pointerup", endDrag);
    root.addEventListener("pointercancel", endDrag);
    root.addEventListener("lostpointercapture", endDrag);
    root.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      x += (e.key === "ArrowLeft" ? 1 : -1) * (cards[1].offsetLeft - cards[0].offsetLeft);
      wrap();
      paint();
      markCenter();
    });
  }

  // Libro de reclamaciones: valida los datos, los envía al registro y muestra la hoja con su número.
  // PARA QUE QUEDE REGISTRADO: pegue aquí la dirección de la aplicación web de Google Apps Script
  // (build/libro-apps-script/ y docs/libro-de-reclamaciones.md). Ese programa asigna el número
  // correlativo, guarda la hoja y envía la copia al consumidor. Mientras esté vacío, se abre el
  // correo del visitante con la hoja ya escrita: sirve de respaldo, pero no cumple como registro.
  var LIBRO_ENDPOINT = "https://script.google.com/macros/s/AKfycbxDhHb6Lcbr4NaSe7VG87S2q4CTCAVHEudKCR6Hx1EQ0oYn1gju1pFzcZnIORm_FeRh/exec";
  var LIBRO_EMAIL = "contacto@hazlawpe.com";

  function initLibro() {
    var form = document.getElementById("libro-form");
    if (!form) return;
    var done = document.getElementById("libro-done");
    var doneText = document.getElementById("libro-done-text");
    var sheet = document.getElementById("libro-sheet");
    var menor = document.getElementById("es-menor");
    var tutor = document.getElementById("tutor");

    function two(n) { return (n < 10 ? "0" : "") + n; }
    var now = new Date();
    var fecha = two(now.getDate()) + "/" + two(now.getMonth() + 1) + "/" + now.getFullYear();
    // Número provisional, solo para el respaldo por correo. Con registro, el número oficial lo asigna el servidor.
    var codigo = "HZ-" + now.getFullYear() + two(now.getMonth() + 1) + two(now.getDate()) + "-" +
      String(Math.floor(1000 + Math.random() * 9000));
    document.getElementById("libro-fecha").textContent = fecha;
    document.getElementById("libro-codigo").textContent = LIBRO_ENDPOINT ? "Se asigna al enviar" : codigo;

    menor.addEventListener("change", function () {
      tutor.hidden = !menor.checked;
    });

    function val(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : "";
    }
    // El error queda ligado a su campo: el lector de pantalla anuncia que está mal y por qué
    function setError(id, msg) {
      var el = document.getElementById(id);
      var box = form.querySelector('[data-error-for="' + id + '"]');
      if (box && !box.id) box.id = "error-" + id;
      if (el) {
        el.classList.toggle("is-wrong", !!msg);
        if (msg) {
          el.setAttribute("aria-invalid", "true");
          if (box) el.setAttribute("aria-describedby", box.id);
        } else {
          el.removeAttribute("aria-invalid");
          el.removeAttribute("aria-describedby");
        }
      }
      if (box) box.textContent = msg || "";
      return !msg;
    }

    function validate() {
      var ok = true;
      var required = [
        ["doc-numero", "Escribe tu número de documento."],
        ["nombres", "Escribe tus nombres."],
        ["ape-paterno", "Escribe tu apellido paterno."],
        ["correo", "Escribe tu correo electrónico."],
        ["detalle", "Cuéntanos qué pasó."],
        ["pedido", "Dinos qué te gustaría que hagamos."]
      ];
      required.forEach(function (pair) {
        if (!val(pair[0])) ok = setError(pair[0], pair[1]) && ok;
        else setError(pair[0], "");
      });
      if (val("correo") && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val("correo"))) {
        ok = setError("correo", "Revisa tu correo: parece incompleto.") && ok;
      }
      if (document.getElementById("doc-tipo").value === "DNI" && val("doc-numero") && !/^\d{8}$/.test(val("doc-numero"))) {
        ok = setError("doc-numero", "El DNI tiene 8 números.") && ok;
      }
      if (menor.checked) {
        if (!val("tutor-nombre")) ok = setError("tutor-nombre", "Escribe el nombre de tu padre, madre o apoderado.") && ok;
        else setError("tutor-nombre", "");
        if (!val("tutor-doc")) ok = setError("tutor-doc", "Escribe su documento.") && ok;
        else setError("tutor-doc", "");
      }
      if (!ok) {
        var first = form.querySelector(".is-wrong");
        if (first) {
          first.focus();
          first.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }
      return ok;
    }

    function collect() {
      var tipo = form.querySelector('input[name="tipo"]:checked');
      return {
        codigo: codigo,
        fecha: fecha,
        proveedor: "Hazlaw S.R.L. · RUC 20614415950",
        tipoDocumento: document.getElementById("doc-tipo").value,
        documento: val("doc-numero"),
        nombre: (val("nombres") + " " + val("ape-paterno") + " " + val("ape-materno")).replace(/\s+/g, " ").trim(),
        celular: val("celular"),
        correo: val("correo"),
        direccion: [val("direccion"), val("distrito"), val("provincia")].filter(Boolean).join(", "),
        menorDeEdad: menor.checked ? "Sí" : "No",
        apoderado: menor.checked ? val("tutor-nombre") + " (" + val("tutor-doc") + ")" : "",
        servicio: document.getElementById("servicio").value,
        monto: val("monto"),
        fechaContrato: val("fecha-contrato"),
        expediente: val("expediente"),
        tipo: tipo ? tipo.value : "Reclamo",
        detalle: val("detalle"),
        pedido: val("pedido")
      };
    }

    var LABELS = [
      ["tipo", "Tipo"], ["servicio", "Servicio contratado"], ["monto", "Monto reclamado (S/)"],
      ["fechaContrato", "Fecha en que contrataste"], ["expediente", "Expediente o boleta"],
      ["detalle", "Qué pasó"], ["pedido", "Qué pide"]
    ];
    var LABELS_CONS = [
      ["nombre", "Nombre"], ["tipoDocumento", "Tipo de documento"], ["documento", "Número"],
      ["celular", "Celular"], ["correo", "Correo"], ["direccion", "Dirección"],
      ["menorDeEdad", "Menor de edad"], ["apoderado", "Padre, madre o apoderado"]
    ];

    // Todo lo que escribe la persona se muestra como texto, nunca como código
    function esc(t) {
      return String(t).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }

    function rows(data, labels) {
      return labels.filter(function (p) { return data[p[0]]; })
        .map(function (p) { return '<p class="sheet__row"><b>' + p[1] + ':</b> ' + esc(data[p[0]]) + "</p>"; })
        .join("");
    }

    function renderSheet(data) {
      sheet.innerHTML =
        "<h2>Hoja de reclamación</h2>" +
        '<p class="sheet__meta">N° ' + esc(data.codigo) + " · " + esc(data.fecha) + "</p>" +
        "<h3>Proveedor</h3><p>Hazlaw S.R.L. · RUC 20614415950<br>Av. Próceres de la Independencia 1625, San Juan de Lurigancho, Lima<br>contacto@hazlawpe.com · 924 021 846</p>" +
        "<h3>Consumidor</h3>" + rows(data, LABELS_CONS) +
        "<h3>Servicio y detalle</h3>" + rows(data, LABELS) +
        "<h3>Respuesta del proveedor</h3><p>Hazlaw S.R.L. responderá a este correo en un plazo máximo de 15 días hábiles.</p>";
    }

    function asText(data) {
      var lines = ["Hoja de reclamación N° " + data.codigo, "Fecha: " + data.fecha, ""];
      LABELS_CONS.concat(LABELS).forEach(function (p) {
        if (data[p[0]]) lines.push(p[1] + ": " + data[p[0]]);
      });
      return lines.join("\n");
    }

    function finish(msg) {
      form.hidden = true;
      done.hidden = false;
      doneText.textContent = msg;
      done.scrollIntoView({ block: "center", behavior: "smooth" });
      hzTrack("libro_enviado", { tipo: form.querySelector('input[name="tipo"]:checked').value });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;
      var trampa = document.getElementById("libro-web");
      if (trampa && trampa.value) return; // lo llenó un robot
      var data = collect();
      function respaldo(aviso) {
        document.getElementById("libro-codigo").textContent = data.codigo;
        renderSheet(data);
        openMail(data);
        finish(aviso);
      }
      if (LIBRO_ENDPOINT) {
        var btn = document.getElementById("libro-send");
        btn.disabled = true;
        btn.textContent = "Enviando…";
        // text/plain: es una petición simple, que Google Apps Script acepta desde otra dirección
        fetch(LIBRO_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data)
        }).then(function (res) {
          if (!res.ok) throw new Error("envío");
          return res.json();
        }).then(function (r) {
          if (!r || !r.ok || !/^HZ-\d{4}-\d{6}$/.test(r.codigo || "")) throw new Error("respuesta");
          data.codigo = r.codigo;
          if (r.fecha) data.fecha = r.fecha;
          document.getElementById("libro-codigo").textContent = data.codigo;
          renderSheet(data);
          finish("Tu hoja N° " + data.codigo + " quedó registrada. " +
            (r.copia ? "Te enviamos una copia a " + data.correo + ". " : "No pudimos enviarte la copia por correo: guarda o imprime tu hoja con el botón de abajo. ") +
            "Te respondemos en un plazo máximo de 15 días hábiles.");
        }).catch(function () {
          btn.disabled = false;
          btn.textContent = "Enviar mi reclamo";
          respaldo("No pudimos registrar tu hoja en este momento. Abrimos tu correo con la hoja N° " + data.codigo +
            " ya escrita: envíala para que quede registrada. También puedes escribirnos por WhatsApp.");
        });
      } else {
        respaldo("Abrimos tu correo con la hoja N° " + data.codigo + " ya escrita. Envíala para que quede registrada y te respondamos.");
      }
    });

    function openMail(data) {
      var asunto = "Libro de reclamaciones " + data.codigo + " · " + data.tipo;
      window.location.href = "mailto:" + LIBRO_EMAIL + "?subject=" + encodeURIComponent(asunto) +
        "&body=" + encodeURIComponent(asText(data).slice(0, 1600));
    }

    document.getElementById("libro-print").addEventListener("click", function () {
      window.print();
    });
  }

  // Ambiente fijo: se pausa con la pestaña oculta
  function initAmbient() {
    function sync() {
      document.body.classList.toggle("is-hidden", document.hidden);
    }
    document.addEventListener("visibilitychange", sync);
    sync();
  }

  // Video "Quiénes somos": la portada es propia y el reproductor de YouTube (sin cookies) entra
  // recién al pulsar. Sin JavaScript, el enlace abre el video en YouTube.
  function initVideo() {
    document.querySelectorAll("[data-yt]").forEach(function (frame) {
      var link = frame.querySelector(".cine__play");
      if (!link) return;
      link.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        var id = frame.getAttribute("data-yt");
        var iframe = document.createElement("iframe");
        iframe.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&playsinline=1";
        iframe.title = "Video: Conoce Hazlaw+";
        iframe.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        // En escritorio la portada está en formato de cine: se abre a 16:9 con una transición de alto
        var desde = frame.offsetHeight;
        frame.classList.add("is-open");
        var hasta = frame.offsetHeight;
        if (hasta !== desde && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          frame.style.height = desde + "px";
          frame.offsetHeight; // fija el alto inicial antes de animar
          frame.style.height = hasta + "px";
          frame.addEventListener("transitionend", function fin(ev) {
            if (ev.propertyName !== "height") return;
            frame.style.height = "";
            frame.removeEventListener("transitionend", fin);
          });
        }
        frame.replaceChild(iframe, link);
        iframe.focus({ preventScroll: true });
        if (hasta > desde) {
          window.setTimeout(function () { frame.scrollIntoView({ behavior: "smooth", block: "center" }); }, 120);
        }
        document.dispatchEvent(new CustomEvent("hz:video"));
        hzTrack("video_quienes_somos", {});
      });
    });
  }

  // Cifras: cada número cuenta desde cero al aparecer y las barras de porcentaje se llenan.
  // Respeta el formato del texto (coma decimal, miles con espacio). Con "reducir movimiento"
  // o sin IntersectionObserver queda todo como está en el HTML: el número final.
  function initCifras() {
    var paneles = document.querySelectorAll(".cifras");
    if (!paneles.length || !("IntersectionObserver" in window) ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    function formato(v, decimales) {
      var t = v.toFixed(decimales).replace(".", ",");
      var partes = t.split(",");
      partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
      return partes.join(",");
    }
    function contar(el) {
      var final = el.getAttribute("data-cifra");
      var limpio = final.replace(/[\s\u00a0]/g, "").replace(",", ".");
      var meta = parseFloat(limpio), decimales = (limpio.split(".")[1] || "").length;
      var inicio = null, dura = 1500;
      function paso(ts) {
        if (!inicio) inicio = ts;
        var k = Math.min((ts - inicio) / dura, 1), e = 1 - Math.pow(1 - k, 4);
        el.textContent = k < 1 ? formato(meta * e, decimales) : final;
        if (k < 1) requestAnimationFrame(paso);
      }
      requestAnimationFrame(paso);
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        en.target.classList.remove("is-pending");
        en.target.querySelectorAll("[data-cifra]").forEach(function (el) { if (!/ a /.test(el.getAttribute("data-cifra"))) contar(el); });
      });
    }, { threshold: 0.35 });
    paneles.forEach(function (p) {
      p.classList.add("is-pending");
      // Los rangos ("10 a 13") no cuentan: se muestran tal cual
      p.querySelectorAll("[data-cifra]").forEach(function (el) { if (!/ a /.test(el.getAttribute("data-cifra"))) el.textContent = "0"; });
      io.observe(p);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initPreloader();
    upgradeWhatsAppLinks();
    initSiteHeader();
    initGuides();
    initLibro();
    initTramites();
    initPerfiles();
    initSmoothLinks();
    initButtonPress();
    initWhatsAppToast();
    initGlossary();
    initBrandLab();
    initVoiceMarquee();
    initFaqTree();
    initProofCopy();
    initSiteFoot();
    initAmbient();
    initRevealOnScroll();
    initStickyCta();
    initVideo();
    initCifras();
  });
})();
