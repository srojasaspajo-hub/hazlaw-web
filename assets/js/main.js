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
    // También en el cotizador y en el chat de trámites: ahí ya hay un botón que lleva el caso escrito
    var HIDE = { cierre: true, "site-foot": true, cotiza: true, tramites: true };
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
      // En la página de marca, si ya escribió el nombre en el cotizador, va en el mensaje
      var input = document.getElementById("marca-nombre");
      var name = input ? input.value.replace(/\s+/g, " ").trim() : "";
      if (name) marca = BASE + "Quiero registrar mi marca «" + name + "».";
      if (current === "existimos" || current === "nosotros") {
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

    // Invitación: un globo al aparecer, una sola vez
    function nudgeOnce() {
      // Espera a que la persona haya bajado un poco: nada salta apenas se abre la página
      if (nudged || current === "hero" || window.scrollY < window.innerHeight * 0.6) return;
      nudged = true;
      window.setTimeout(function () {
        if (opened || !visible) return;
        root.classList.add("show-nudge");
        window.setTimeout(function () { root.classList.remove("show-nudge"); }, 5000);
      }, 1400);
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

  // Cotizador (constitución y marca): tres respuestas arman el tipo de empresa o de marca, el total
  // y el mensaje de WhatsApp. Sin JavaScript se ve el caso por defecto, que ya viene en el HTML.
  // Los montos cuentan del valor anterior al nuevo; con "reducir movimiento" cambian de golpe.
  var NBSP = " ";
  function soles(n) {
    var t = n.toFixed(Math.round(n * 100) % 100 ? 2 : 0).split(".");
    t[0] = t[0].replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
    return "S/" + NBSP + t.join(".");
  }
  function sinEspacios(s) { return String(s).replace(/[\s ]+/g, " ").trim(); }
  function marcaCambio(el) {
    el.classList.remove("is-cambio");
    void el.offsetWidth;
    el.classList.add("is-cambio");
  }

  var COTIZA = {
    // Constitución (2026-10-25): solo lo que cambia el precio (el capital) y dónde firmar. El precio no cambia
    // por tipo de empresa ni por número de socios; eso se conversa por WhatsApp.
    empresa: function (r) {
      var mas = r.capital === "mas";
      var lugar = { casa: "en tu casa", oficina: "en tu oficina", negocio: "en tu negocio", notaria: "en la notaría" }[r.firma];
      var lugarYo = { casa: "en mi casa", oficina: "en mi oficina", negocio: "en mi negocio", notaria: "en la notaría" }[r.firma];
      return {
        barra: "Firmas " + lugar,
        estado: { capital: r.capital, firma: r.firma },
        filas: {
          "serv-n": mas ? "A tu medida" : "500",
          "serv-det": mas ? "Según tu capital: te lo confirmamos antes de que pagues" : "Con derechos notariales y una toma de firmas",
          reg: mas ? "Según tu capital" : "S/ 100 a 200",
          total: mas ? "Te lo enviamos por escrito" : "S/ 600 a 700",
          // Los S/ 500 en dos partes: S/ 180 para empezar y S/ 320 el día de la firma; los registrales, aparte
          adelanto: 180,
          resto: mas ? "El resto" : 320,
          "reg-pago": mas ? "Según tu capital" : "S/ 100 a 200",
          firma: lugar
        },
        wa: "Hola, vengo de la web. Quiero constituir mi empresa, con capital de " + (mas ? "más de" : "hasta") +
            " S/ 20 000, y firmar " + lugarYo + "."
      };
    },
    marca: function (r) {
      var que = {
        nombre: ["El nombre", "el nombre"],
        logo: ["El logo", "el logo"],
        ambos: ["Nombre y logo", "el nombre y el logo"]
      }[r.protege];
      var dos = r.clases === "2";
      var nombre = r.nombre ? " «" + r.nombre + "»" : "";
      // Tasas de gob.pe (trámite 333), consultadas el 2026-10-24
      var t1 = 534.9, t2 = 533.3, total = 370 + t1 + (dos ? t2 : 0);
      return {
        valor: que[0],
        barra: que[0] + ", en " + (dos ? "dos clases" : "una clase"),
        estado: { protege: r.protege, clases: r.clases },
        // La barra del pase muestra cuánto es nuestro servicio y cuánto va al Estado
        proporcion: Math.round(370 / total * 100),
        filas: {
          tasa1: t1,
          tasa2: dos ? t2 : null,
          total: total
        },
        wa: "Hola, vengo de la web. Quiero registrar " + que[1] + " de mi negocio" + nombre + " en " + (dos ? "dos clases" : "una clase") + "."
      };
    }
  };

  function initCotizador() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll("[data-cotiza]").forEach(function (root) {
      var regla = COTIZA[root.getAttribute("data-cotiza")];
      if (!regla) return;
      var cta = root.querySelector("[data-out-wa]");
      var barra = root.querySelector("[data-barra]");
      var pase = root.querySelector(".pase");
      var usado = false;

      function out(id) { return root.querySelector('[data-out="' + id + '"]'); }
      function respuestas() {
        var r = {};
        root.querySelectorAll("input[type=radio]:checked").forEach(function (i) { r[i.name] = i.value; });
        return r;
      }
      // Escribe un monto o un texto; los montos cuentan desde el valor anterior
      function pon(el, valor) {
        if (!el) return false;
        var nuevo = typeof valor === "number" ? soles(valor) : valor;
        if (sinEspacios(el.textContent) === sinEspacios(nuevo)) return false;
        var m = /^S\/\s*([\d\s ]+(?:\.\d+)?)$/.exec(sinEspacios(el.textContent));
        var desde = m ? parseFloat(m[1].replace(/\s/g, "")) : null;
        if (el.tagName === "DD") el.classList.toggle("is-texto", !/^S\//.test(nuevo));
        var turno = el.hzTurno = {};
        if (typeof valor === "number" && desde !== null && !reduce) {
          var t0 = null;
          requestAnimationFrame(function paso(ts) {
            if (el.hzTurno !== turno) return;
            if (!t0) t0 = ts;
            var k = Math.min((ts - t0) / 560, 1), e = 1 - Math.pow(1 - k, 4);
            el.textContent = k < 1 ? soles(Math.round(desde + (valor - desde) * e)) : nuevo;
            if (k < 1) requestAnimationFrame(paso);
          });
          // Si el navegador pausa los cuadros (pestaña en segundo plano), el monto final llega igual
          setTimeout(function () { if (el.hzTurno === turno) el.textContent = nuevo; }, 700);
        } else {
          el.textContent = nuevo;
        }
        return true;
      }
      function pinta(avisar) {
        var r = respuestas();
        r.nombre = root.hzNombre || "";
        var s = regla(r);
        // Marca: el nombre que escribes se ve en el dibujo de lo que proteges
        var muestra = root.querySelector(".pase__muestra .ilu--nombre");
        if (muestra) {
          var visible = r.nombre ? (r.nombre.length > 18 ? r.nombre.slice(0, 17) + "…" : r.nombre) : "Tu marca";
          muestra.textContent = visible;
          // Un nombre largo se achica para caber, sin apretar las letras
          muestra.style.fontSize = visible.length > 8 ? Math.max(10, Math.min(18, 84 / (visible.length * 0.56))).toFixed(1) + "px" : "";
        }
        if (pon(out("valor"), s.valor) && !reduce) marcaCambio(out("valor"));
        Object.keys(s.filas).forEach(function (id) {
          var celda = out(id);
          if (!celda) return;
          var fila = celda.closest(".pase__linea");
          if (s.filas[id] === null) { if (fila) fila.hidden = true; return; }
          var aparece = fila && fila.hidden;
          if (fila) fila.hidden = false;
          var cambio = pon(celda, s.filas[id]);
          if (!reduce && cambio) {
            if (fila && aparece) { fila.classList.remove("is-nueva"); void fila.offsetWidth; fila.classList.add("is-nueva"); }
            else marcaCambio(fila || celda);
          }
        });
        if (pase) {
          // El pase muestra la respuesta: el capital, dónde firmas o qué se protege
          if (s.estado) Object.keys(s.estado).forEach(function (k) { pase.setAttribute("data-" + k, s.estado[k]); });
          if (s.proporcion) pase.style.setProperty("--p-serv", s.proporcion + "%");
          // Constitución: el ícono del lugar de la firma es el de la ficha elegida
          var icono = pase.querySelector("[data-out-icono]");
          var elegido = root.querySelector('input[name="firma"]:checked');
          var fuente = elegido && elegido.parentElement.querySelector(".ficha__icono");
          if (icono && fuente && icono.innerHTML !== fuente.innerHTML) {
            icono.innerHTML = fuente.innerHTML;
            if (!reduce && avisar) marcaCambio(icono);
          }
        }
        // La barra del celular repite lo esencial y marca el cambio, para ver el efecto de cada respuesta sin bajar
        var nuevoTotal = typeof s.filas.total === "number" ? soles(s.filas.total) : s.filas.total;
        if (barra) {
          var bv = barra.querySelector("[data-barra-valor]"), bt = barra.querySelector("[data-barra-total]");
          var cambia = sinEspacios(bt.textContent) !== sinEspacios(nuevoTotal) || sinEspacios(bv.textContent) !== sinEspacios(s.barra);
          bv.textContent = s.barra;
          bt.textContent = nuevoTotal;
          if (cambia && avisar && !reduce) marcaCambio(barra);
        }
        // Lectores de pantalla: un solo aviso con el resultado, no cada cifra mientras cuenta
        var anuncio = root.querySelector("[data-anuncio]");
        if (anuncio && avisar) anuncio.textContent = s.barra + ". Total: " + nuevoTotal + ".";
        if (cta) {
          cta.setAttribute("data-wa", s.wa);
          cta.setAttribute("href", WA_BASE + encodeURIComponent(s.wa));
        }
      }
      root.addEventListener("change", function () {
        pinta(true);
        if (!usado) { usado = true; hzTrack("cotizador_uso", { servicio: root.getAttribute("data-cotiza") }); }
      });
      var campoNombre = root.querySelector("[data-marca-nombre]");
      if (campoNombre) campoNombre.addEventListener("input", function () {
        root.hzNombre = campoNombre.value.replace(/\s+/g, " ").trim();
        pinta(false);
      });
      pinta();

      // Barra del total en el celular: aparece mientras se responden las preguntas y el pase no está a la vista
      if (barra && "IntersectionObserver" in window) {
        barra.hidden = false;
        var verForm = false, verPase = false;
        var refrescarBarra = function () { barra.classList.toggle("is-visible", verForm && !verPase); };
        new IntersectionObserver(function (es) { verForm = es[0].isIntersecting; refrescarBarra(); },
          { rootMargin: "-25% 0px -25% 0px" }).observe(root.querySelector(".cotiza__form"));
        new IntersectionObserver(function (es) { verPase = es[0].isIntersecting; refrescarBarra(); },
          { threshold: 0.15 }).observe(root.querySelector(".cotiza__recibo"));
      }

      // Los enlaces al precio: al llegar, la primera pregunta se ilumina un momento para decir "empieza aquí"
      document.querySelectorAll('a[href="#' + root.parentElement.id + '"]').forEach(function (a) {
        a.addEventListener("click", function () {
          var q = root.querySelector(".cotiza__q");
          if (!q || reduce) return;
          window.setTimeout(function () { q.classList.remove("is-llegada"); void q.offsetWidth; q.classList.add("is-llegada"); }, 700);
        });
      });

      // La primera vez que se ve, el pase se imprime: los montos cuentan desde cero y lo incluido entra en orden
      if (pase && !reduce && "IntersectionObserver" in window) {
        pase.classList.add("is-pendiente");
        var io = new IntersectionObserver(function (entries) {
          if (!entries[0].isIntersecting) return;
          io.disconnect();
          pase.querySelectorAll("dd, .pase__adelanto").forEach(function (dd) {
            if (/^S\/\s*[\d\s ]+(\.\d+)?$/.test(sinEspacios(dd.textContent))) dd.textContent = soles(0);
          });
          pase.classList.remove("is-pendiente");
          pase.classList.add("is-impreso");
          window.setTimeout(pinta, 250);
        }, { threshold: 0.25 });
        // Se observa el contenedor: el pase recortado no tiene área visible que medir
        io.observe(pase.parentElement);
      }
    });
  }

  // Escenas: cada beneficio tiene un dibujo que se anima la primera vez que se ve y se puede repetir.
  // La ruta de la notaría mueve una moto por el camino y en cada vuelta cambia el destino (casa, oficina, negocio);
  // la minuta cambia de caso y las clases de marca, de rubro. Lo que cambia lleva data-ciclo="a|b|c"; las celdas
  // que se encienden, data-encender="25,35|30,43"; el contador de hojas, data-cuenta-fin="8|10|9".
  function initEscenas() {
    var escenas = document.querySelectorAll("[data-escena]");
    if (!escenas.length) return;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Minuta: las hojas suben de una en una mientras entran las decisiones de tu empresa
    // modo: "fin" deja el total sin animar, "base" deja las hojas básicas; sin modo, cuenta hasta el total
    function hojas(e, modo) {
      var cuenta = e.querySelector("[data-cuenta]");
      if (!cuenta) return;
      var base = parseInt(cuenta.getAttribute("data-cuenta"), 10);
      var fin = parseInt(cuenta.hzFin || cuenta.getAttribute("data-cuenta-fin").split("|")[0], 10);
      var pila = e.querySelectorAll(".v-hojas__h");
      (e.hzRelojes || []).forEach(clearTimeout);
      e.hzRelojes = [];
      function pon(n) {
        cuenta.textContent = n;
        pila.forEach(function (h, i) { h.classList.toggle("is-on", i < n); });
      }
      if (modo === "fin") { pon(fin); return; }
      pon(base);
      if (modo === "base") return;
      var pasos = fin - base;
      for (var k = 1; k <= pasos; k++) {
        e.hzRelojes.push(setTimeout(pon.bind(null, base + k), 550 + (k - 1) * Math.round(1700 / pasos)));
      }
    }

    // Balanza: los trámites pasan del lado de tu estudio al de Hazlaw+ y la balanza se inclina con cada uno
    function balanza(e, alFinal) {
      var v = e.querySelector("[data-balanza]");
      if (!v) return;
      var a = v.querySelector('[data-pila="a"]'), b = v.querySelector('[data-pila="b"]');
      if (!v.hzBloques) v.hzBloques = Array.prototype.slice.call(a.children);
      (v.hzRelojes || []).forEach(clearTimeout);
      v.hzRelojes = [];
      v.getAnimations({ subtree: true }).forEach(function (an) { an.cancel(); });
      if (alFinal) {
        v.hzBloques.slice().reverse().forEach(function (bl) { b.appendChild(bl); });
        v.style.setProperty("--inclina", "1");
        v.classList.add("is-libre");
        return;
      }
      v.hzBloques.forEach(function (bl) { a.appendChild(bl); });
      v.style.setProperty("--inclina", "-1");
      v.classList.remove("is-libre");
      var total = v.hzBloques.length;
      v.hzBloques.slice().reverse().forEach(function (bl, k) {
        v.hzRelojes.push(setTimeout(function () {
          var antes = bl.getBoundingClientRect();
          b.appendChild(bl);
          var despues = bl.getBoundingClientRect();
          var dx = antes.left - despues.left, dy = antes.top - despues.top;
          if (bl.animate) {
            bl.animate([
              { transform: "translate(" + dx + "px," + dy + "px)" },
              { transform: "translate(" + dx / 2 + "px," + (dy / 2 - 34) + "px)", offset: 0.5 },
              { transform: "none" }
            ], { duration: 620, easing: "cubic-bezier(0.65, 0, 0.35, 1)" });
          }
          v.hzRelojes.push(setTimeout(function () {
            v.style.setProperty("--inclina", String(-1 + 2 * (k + 1) / total));
            if (k === total - 1) v.classList.add("is-libre");
          }, 560));
        }, 600 + k * 820));
      });
    }

    function juega(e) {
      // Vuelve al inicio sin animar el regreso, y arranca otra vez
      e.classList.add("is-reinicio");
      e.classList.remove("is-viva");
      hojas(e);
      balanza(e);
      void e.offsetWidth;
      e.classList.remove("is-reinicio");
      e.classList.add("is-viva");
      var moto = e.querySelector(".v-ruta__moto animateMotion");
      if (moto && moto.beginElement) moto.beginElement();
    }
    escenas.forEach(function (e) {
      var ciclos = e.querySelectorAll("[data-ciclo]");
      var encender = e.querySelector("[data-encender]");
      var cuenta = e.querySelector("[data-cuenta]");
      var vueltas = 0;
      var repite = e.querySelector("[data-escena-repite]");
      if (reduce) {
        e.classList.add("is-quieta");
        hojas(e, "fin");
        balanza(e, true);
        if (repite) repite.hidden = true;
        return;
      }
      // Antes de verse, la minuta parte de las hojas básicas
      if (cuenta) hojas(e, "base");
      if (repite) repite.addEventListener("click", function () {
        vueltas++;
        ciclos.forEach(function (c) {
          var lista = c.getAttribute("data-ciclo").split("|");
          c.textContent = lista[vueltas % lista.length];
        });
        if (cuenta) {
          var fines = cuenta.getAttribute("data-cuenta-fin").split("|");
          cuenta.hzFin = fines[vueltas % fines.length];
        }
        if (encender) {
          var grupos = encender.getAttribute("data-encender").split("|");
          var prenden = grupos[vueltas % grupos.length].split(",");
          encender.querySelectorAll("[data-c]").forEach(function (c) {
            c.classList.toggle("is-on", prenden.indexOf(c.getAttribute("data-c")) > -1);
          });
        }
        juega(e);
      });
    });
    if (reduce) return;
    if (!("IntersectionObserver" in window)) {
      escenas.forEach(function (e) { e.classList.add("is-quieta"); hojas(e, "fin"); balanza(e, true); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        juega(en.target);
      });
    }, { threshold: 0.45 });
    escenas.forEach(function (e) { io.observe(e); });
  }

  // Gestión notarial: "¿Qué trámite necesita tu cliente?" es un chat. El estudio toca un trámite, su pedido sale y
  // nuestros avisos llegan uno por uno, con "escribiendo…" entre ellos. Pestañas con teclado (flechas, Inicio, Fin).
  // Con "reducir movimiento" la conversación aparece completa.
  function initTramites() {
    var root = document.getElementById("tramites-chat");
    if (!root) return;
    var tabs = Array.prototype.slice.call(root.querySelectorAll(".chat-tramites__op"));
    var panel = document.getElementById("tramites-panel");
    var hilo = root.querySelector(".chat-tramites__hilo");
    var escribe = root.querySelector(".chat-tramites__escribe");
    var cta = document.getElementById("tramite-cta");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var total = tabs.length;
    var relojes = [];

    function burbuja(texto, tuya) {
      var li = document.createElement("li");
      li.className = "chat-tramites__msg" + (tuya ? " chat-tramites__msg--tu" : "");
      li.textContent = texto;
      return li;
    }
    function conversa(tab, animar) {
      relojes.forEach(clearTimeout);
      relojes = [];
      hilo.textContent = "";
      escribe.classList.remove("is-visible");
      var avisos = tab.getAttribute("data-avisos").split("|");
      var pide = burbuja(tab.getAttribute("data-pide"), true);
      hilo.appendChild(pide);
      var msgs = avisos.map(function (a) { return burbuja(a, false); });
      if (!animar) { msgs.forEach(function (m) { hilo.appendChild(m); }); return; }
      pide.classList.add("is-nueva");
      msgs.forEach(function (m, k) {
        var t0 = 500 + k * 1500;
        relojes.push(setTimeout(function () { escribe.classList.add("is-visible"); }, t0));
        relojes.push(setTimeout(function () {
          escribe.classList.remove("is-visible");
          m.classList.add("is-nueva");
          hilo.appendChild(m);
        }, t0 + 900));
      });
    }
    function select(i, byUser, focus) {
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
      });
      var tab = tabs[i];
      if (focus) tab.focus();
      panel.setAttribute("aria-labelledby", tab.id);
      var msg = "Hola, vengo de la web. " + tab.getAttribute("data-msg");
      cta.setAttribute("data-wa", msg);
      cta.setAttribute("href", WA_BASE + encodeURIComponent(msg));
      conversa(tab, byUser && !reduce);
      if (!byUser) return;
      hzTrack("tramite_elegido", { tramite: tab.textContent });
      // En el celular el chat está debajo de los trámites: que se vea la conversación
      var r = panel.getBoundingClientRect();
      if (!focus && r.top > window.innerHeight * 0.55) {
        window.scrollBy({ top: r.top - 110, behavior: reduce ? "auto" : "smooth" });
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
    // La primera vez que se ve, la conversación del primer trámite se escribe sola
    if (!reduce && "IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        var activa = tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0];
        conversa(activa, true);
      }, { threshold: 0.4 });
      io.observe(panel);
    }
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
    var pausado = false;

    // Botón de pausa: con el dedo no hay "pasar el mouse", así que se puede detener con un toque
    var pausa = document.querySelector(".voice-pausa");
    if (pausa) {
      pausa.hidden = false;
      pausa.addEventListener("click", function () {
        pausado = !pausado;
        pausa.setAttribute("aria-pressed", pausado ? "true" : "false");
        pausa.querySelector(".voice-pausa__txt").textContent = pausado ? "Reanudar" : "Pausar";
        pausa.classList.toggle("is-pausado", pausado);
        if (!pausado) start();
      });
    }

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
      if (!dragging && !hovered && !focused && !pausado && now > resumeAt) x -= SPEED * dt / 1000;
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

  // Preguntas frecuentes: un buscador que filtra las preguntas mientras escribes (sin tildes ni mayúsculas)
  function initFaqBuscar() {
    var campo = document.querySelector("[data-faq-buscar]");
    if (!campo) return;
    var res = document.querySelector("[data-faq-res]");
    var plano = function (s) { return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); };
    var items = Array.prototype.slice.call(document.querySelectorAll(".faq-tree__q")).map(function (q) {
      var panel = document.getElementById(q.getAttribute("aria-controls"));
      return { q: q, panel: panel, texto: plano(q.textContent + " " + (panel ? panel.textContent : "")), grupo: q.closest("section") };
    });
    var buscado = false;
    campo.parentElement.hidden = false;
    campo.addEventListener("input", function () {
      var palabras = plano(campo.value).split(/\s+/).filter(function (w) { return w.length > 1; });
      var cuenta = 0, grupos = new Map();
      items.forEach(function (it) {
        var ok = palabras.every(function (w) { return it.texto.indexOf(w) >= 0; });
        it.q.hidden = !ok;
        if (it.panel) it.panel.hidden = !ok;
        if (ok) { cuenta++; grupos.set(it.grupo, (grupos.get(it.grupo) || []).concat(it)); }
      });
      items.forEach(function (it) { if (it.grupo) it.grupo.hidden = !grupos.has(it.grupo); });
      // En cada grupo queda abierta la primera respuesta que coincide
      grupos.forEach(function (lista) {
        var arbol = lista[0].q.closest(".faq-tree");
        if (arbol && arbol.hzOpen) arbol.hzOpen(arbol.hzIndex(lista[0].q.id));
      });
      res.textContent = "";
      if (palabras.length) {
        res.appendChild(document.createTextNode(cuenta ? (cuenta === 1 ? "1 pregunta. " : cuenta + " preguntas. ") : "Ninguna coincide. Escríbenos por WhatsApp y te respondemos."));
        var primera = items.filter(function (it) { return !it.q.hidden; })[0];
        if (primera) {
          // Un enlace a la primera respuesta: en el celular queda más abajo, después de la foto
          var ver = document.createElement("button");
          ver.type = "button";
          ver.className = "faq-buscar__ver";
          ver.textContent = cuenta === 1 ? "Ver la respuesta" : "Ver las respuestas";
          ver.addEventListener("click", function () {
            primera.q.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
            primera.q.focus({ preventScroll: true });
          });
          res.appendChild(ver);
        }
      }
      if (palabras.length && !buscado) { buscado = true; hzTrack("faq_buscar", {}); }
    });
  }

  // Guías: el índice marca la sección que se está leyendo (en computadora queda fijo a la izquierda)
  function initIndiceGuia() {
    var nav = document.querySelector("[data-indice]");
    if (!nav || !("IntersectionObserver" in window)) return;
    var enlaces = {};
    nav.querySelectorAll('a[href^="#"]').forEach(function (a) { enlaces[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        Object.keys(enlaces).forEach(function (id) {
          var activo = id === en.target.id;
          enlaces[id].classList.toggle("is-actual", activo);
          if (activo) enlaces[id].setAttribute("aria-current", "true");
          else enlaces[id].removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-25% 0px -65% 0px" });
    Object.keys(enlaces).forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec) io.observe(sec);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initPreloader();
    upgradeWhatsAppLinks();
    initSiteHeader();
    initCotizador();
    initEscenas();
    initIndiceGuia();
    initFaqBuscar();
    initLibro();
    initTramites();
    initSmoothLinks();
    initButtonPress();
    initWhatsAppToast();
    initGlossary();
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
