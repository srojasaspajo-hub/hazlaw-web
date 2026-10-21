(function () {
  "use strict";

  // Deben coincidir carácter por carácter con la media query del hero estático en styles.css
  var GATES = [
    "(orientation: landscape) and (pointer: coarse) and (max-height: 560px)",
    "(prefers-reduced-motion: reduce)"
  ];

  // Pantalla vertical: versión 4:3 enmarcada (1200x900). Horizontal: 1920x1080 a pantalla completa.
  // Debe coincidir con la media query del hero enmarcado en styles.css
  var PORTRAIT = "(max-aspect-ratio: 1/1)";
  var SOURCES = {
    desktop: { url: "assets/video/hero-tienda.mp4", bytes: 2589104, poster: "assets/img/hero-poster.webp?v=3" },
    // Celular: 960x720 liviano (730 KB)
    mobile: { url: "assets/video/hero-tienda-m2.mp4", bytes: 747566, poster: "assets/img/hero-poster-m.webp?v=3" }
  };

  var hero = document.getElementById("hero");
  if (!hero) return;
  var stage = hero.querySelector(".hero__stage");
  var video = hero.querySelector(".hero__video");
  var poster = hero.querySelector(".hero__poster");
  var ring = hero.querySelector(".hero__ring");

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function smoothstep(p, e0, e1) {
    var t = clamp((p - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Parte cada titular en palabras. El lector de pantalla recibe la frase completa.
  function splitText(el, seed) {
    var text = el.textContent.trim();
    var words = text.split(/\s+/);
    var rand = rng(seed);
    var spread = parseFloat(el.getAttribute("data-spread")) || 0.5;
    el.textContent = "";
    var sr = document.createElement("span");
    sr.className = "sr-only";
    sr.textContent = text;
    var visual = document.createElement("span");
    visual.setAttribute("aria-hidden", "true");
    words.forEach(function (word, i) {
      var w = document.createElement("span");
      w.className = "w";
      w.textContent = word;
      w.style.setProperty("--th", (i / words.length * spread + rand() * 0.06).toFixed(3));
      visual.appendChild(w);
      if (i < words.length - 1) visual.appendChild(document.createTextNode(" "));
    });
    el.appendChild(sr);
    el.appendChild(visual);
  }

  var bands = Array.prototype.map.call(hero.querySelectorAll(".band"), function (el, i) {
    var range = el.getAttribute("data-band").split(",").map(parseFloat);
    el.querySelectorAll(".split").forEach(function (s, j) { splitText(s, 1000 + i * 17 + j); });
    return {
      el: el,
      a: range[0],
      b: range[1],
      ramp: parseFloat(el.getAttribute("data-ramp")) || 0,
      op: -1,
      k: -1,
      live: null
    };
  });

  function heroProgress() {
    var rect = hero.getBoundingClientRect();
    var range = hero.offsetHeight - window.innerHeight;
    if (range <= 0) return 0;
    return clamp(-rect.top / range, 0, 1);
  }

  // Carga de la primera banda: aparece armada al entrar, sin esperar el scroll
  var loadK = 0;
  var loadStart = null;

  function bandState(band, p, index) {
    var a = band.a, b = band.b;
    var f = Math.min(0.02, (b - a) / 3);
    var fadeIn = index === 0 ? 1 : smoothstep(p, a, a + f);
    var fadeOut = index === bands.length - 1 ? 1 : 1 - smoothstep(p, b - f, b);
    var op = fadeIn * fadeOut;
    var ramp = band.ramp || Math.min(0.025, (b - a) * 0.35);
    var k = clamp((p - a) / ramp, 0, 1);
    if (index === 0) k = Math.max(k, loadK);
    return { op: op, k: k };
  }

  // Indicador de avance: tres barritas que se llenan mientras se baja
  var steps = Array.prototype.slice.call(hero.querySelectorAll(".hero__step"));
  var stepF = steps.map(function () { return -1; });

  var lastScrolled = null;
  var lastFinal = null;
  function updateCaptions(p) {
    bands.forEach(function (band, i) {
      var st = bandState(band, p, i);
      if (Math.abs(st.op - band.op) > 0.004) {
        band.op = st.op;
        band.el.style.opacity = st.op.toFixed(3);
      }
      // Solo la banda que se ve recibe toques (sus enlaces y su botón)
      var live = st.op > 0.6;
      if (live !== band.live) {
        band.live = live;
        band.el.classList.toggle("is-live", live);
      }
      if (Math.abs(st.k - band.k) > 0.008 || (st.k === 1 && band.k !== 1) || (st.k === 0 && band.k !== 0)) {
        band.k = st.k;
        band.el.style.setProperty("--k", st.k.toFixed(3));
      }
    });
    steps.forEach(function (el, i) {
      var band = bands[i];
      if (!band) return;
      var f = clamp((p - band.a) / (band.b - band.a), 0, 1);
      if (Math.abs(f - stepF[i]) > 0.01 || f === 1 || f === 0) {
        stepF[i] = f;
        el.style.setProperty("--f", f.toFixed(3));
      }
    });
    var isFinal = p >= bands[bands.length - 1].a;
    if (isFinal !== lastFinal) {
      lastFinal = isFinal;
      hero.classList.toggle("is-final", isFinal);
    }
    var scrolled = p > 0.015;
    if (scrolled !== lastScrolled) {
      lastScrolled = scrolled;
      hero.classList.toggle("is-scrolled", scrolled);
    }
  }

  // Búsquedas del video con compuerta: nunca se apilan
  var seekBusy = false;
  var pendingTime = null;
  function requestSeek(t) {
    if (!video.duration || !isFinite(video.duration)) return;
    t = clamp(t, 0, video.duration - 0.04);
    if (seekBusy) { pendingTime = t; return; }
    seekBusy = true;
    video.currentTime = t;
  }
  video.addEventListener("seeked", function () {
    seekBusy = false;
    if (pendingTime !== null) {
      var t = pendingTime;
      pendingTime = null;
      requestSeek(t);
    }
  });
  video.addEventListener("error", function () {
    seekBusy = false;
    pendingTime = null;
    failVideo();
  });

  // Tiempo mostrado suavizado, independiente de la tasa de refresco, y que descansa
  var target = 0;
  var shown = 0;
  var rafId = null;
  var lastTick = 0;
  var heroOnScreen = true;
  var scrubOn = false;

  function tick(now) {
    var dt = Math.min(100, now - (lastTick || now));
    lastTick = now;
    var kf = 0.16;
    shown += (target - shown) * (1 - Math.pow(1 - kf, dt / 16.667));
    if (Math.abs(target - shown) < 0.0005) {
      shown = target;
      rafId = null;
      lastTick = 0;
    } else {
      rafId = requestAnimationFrame(tick);
    }
    requestSeek(shown * video.duration);
    updateCaptions(shown);
  }

  function onScroll() {
    target = heroProgress();
    if (rafId === null && heroOnScreen) rafId = requestAnimationFrame(tick);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      heroOnScreen = entries[0].isIntersecting;
      if (heroOnScreen && scrubOn) onScroll();
    }).observe(hero);
  }

  function runLoadRamp(now) {
    if (!scrubOn) return;
    if (!document.body.classList.contains("is-ready")) {
      requestAnimationFrame(runLoadRamp);
      return;
    }
    if (loadStart === null) loadStart = now;
    var t = clamp((now - loadStart) / 1100, 0, 1);
    loadK = 1 - Math.pow(1 - t, 3);
    updateCaptions(shown);
    if (t < 1) requestAnimationFrame(runLoadRamp);
  }

  // Carga del video como Blob en streaming, con anillo de progreso y vigilante
  var started = false;
  function startBlobFetch() {
    if (started) return;
    started = true;
    loadHeroBlob().catch(failVideo);
  }

  function pickSource() {
    return window.matchMedia(PORTRAIT).matches ? SOURCES.mobile : SOURCES.desktop;
  }

  function loadHeroBlob() {
    var src = pickSource();
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var watchdog = null;
    function arm() {
      clearTimeout(watchdog);
      if (ctrl) watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
    }
    arm();
    var opts = ctrl ? { signal: ctrl.signal, priority: "low" } : {};
    return fetch(src.url, opts).then(function (res) {
      if (!res.ok) throw new Error("video " + res.status);
      var total = Number(res.headers.get("Content-Length")) || src.bytes;
      if (!res.body || !res.body.getReader) {
        return res.blob();
      }
      var reader = res.body.getReader();
      var chunks = [];
      var got = 0;
      var lastRing = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return new Blob(chunks, { type: "video/mp4" });
          arm();
          chunks.push(r.value);
          got += r.value.length;
          var frac = Math.min(1, got / total);
          var now = performance.now();
          if (now - lastRing > 100 || frac === 1) {
            lastRing = now;
            ring.style.setProperty("--ld", Math.round(126 * (1 - frac)));
          }
          return pump();
        });
      }
      return pump();
    }).then(function (blob) {
      clearTimeout(watchdog);
      ring.style.setProperty("--ld", 0);
      video.src = URL.createObjectURL(blob);
      video.load();
      video.addEventListener("canplay", function () {
        var primed = video.play();
        var afterPrime = function () {
          video.pause();
          requestSeek(heroProgress() * video.duration);
          hero.classList.add("video-ready");
        };
        if (primed && primed.then) primed.then(afterPrime, afterPrime);
        else afterPrime();
      }, { once: true });
    });
  }

  function failVideo() {
    hero.classList.add("video-failed");
  }

  var initialized = false;
  function initHeroOnce() {
    if (initialized) return;
    initialized = true;
    var src = pickSource();
    poster.style.backgroundImage = "url('" + src.poster + "')";
    var conn = navigator.connection || {};
    // Con ahorro de datos activado no se descarga el video: queda la imagen y las frases igual avanzan
    if (conn.saveData) {
      failVideo();
      return;
    }
    if (src === SOURCES.mobile) {
      // En celular el video espera al primer gesto (o unos segundos), así quien solo mira no gasta datos
      var go = function () {
        window.removeEventListener("scroll", go);
        window.removeEventListener("touchstart", go);
        startBlobFetch();
      };
      window.addEventListener("scroll", go, { passive: true, once: true });
      window.addEventListener("touchstart", go, { passive: true, once: true });
      setTimeout(go, 3500);
      return;
    }
    var img = new Image();
    img.onload = startBlobFetch;
    img.onerror = startBlobFetch;
    img.src = src.poster;
    setTimeout(startBlobFetch, 4000);
  }


  function clearInlineBandStyles() {
    steps.forEach(function (el, i) { el.style.removeProperty("--f"); stepF[i] = -1; });
    bands.forEach(function (band) {
      band.el.style.removeProperty("opacity");
      band.el.style.removeProperty("--k");
      band.el.classList.remove("is-live");
      band.op = -1;
      band.k = -1;
      band.live = null;
    });
  }

  function enableScrub() {
    if (scrubOn) return;
    scrubOn = true;
    initHeroOnce();
    window.addEventListener("scroll", onScroll, { passive: true });
    clearInlineBandStyles();
    shown = target = heroProgress();
    updateCaptions(shown);
    requestAnimationFrame(runLoadRamp);
    onScroll();
  }

  function disableScrub() {
    if (!scrubOn) return;
    scrubOn = false;
    window.removeEventListener("scroll", onScroll);
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
    clearInlineBandStyles();
  }

  function applyHeroMode() {
    if (GATES.some(function (q) { return window.matchMedia(q).matches; })) disableScrub();
    else enableScrub();
  }

  var MQLS = GATES.map(function (q) { return window.matchMedia(q); });
  MQLS.forEach(function (m) {
    if (m.addEventListener) m.addEventListener("change", applyHeroMode);
    else if (m.addListener) m.addListener(applyHeroMode);
  });
  applyHeroMode();
})();
