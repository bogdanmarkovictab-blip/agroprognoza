/* Agroprognoza: animacije (GSAP)
   - ulazak kartica i redova kad stignu podaci
   - temperatura "odbrojava" do prave vrednosti
   - trake temperature i stubići bilansa vode rastu
   - prelaz između prikaza (Vreme / Lokacije / Agro / Prskanje)
   Sve je opciono: bez GSAP-a ili uz "smanji pokrete" na telefonu aplikacija radi kao ranije. */
(function () {
  const g = window.gsap;
  const calm = () => !g || matchMedia("(prefers-reduced-motion: reduce)").matches || document.hidden;
  const q = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const done = { clearProps: "transform,opacity" };

  function cards(list, opts) {
    if (!list.length) return;
    g.killTweensOf(list);
    g.from(list, Object.assign({ y: 14, opacity: 0, duration: 0.45, ease: "power3.out", stagger: 0.04 }, done, opts || {}));
  }

  function countUp(el) {
    if (!el) return;
    const m = el.textContent.match(/-?\d+/);
    if (!m) return;
    const end = +m[0], o = { v: end - Math.max(6, Math.min(Math.abs(end), 15)) * Math.sign(end || 1) };
    g.to(o, { v: end, duration: 0.9, ease: "power2.out",
      onUpdate: () => { el.textContent = Math.round(o.v) + "°"; },
      onComplete: () => { el.textContent = end + "°"; } });
  }

  function grow(list, axis, origin, delay) {
    if (!list.length) return;
    g.killTweensOf(list);
    g.from(list, { [axis]: 0, transformOrigin: origin, duration: 0.7, ease: "power3.out", stagger: 0.03, delay: delay || 0, clearProps: "transform" });
  }

  const byView = {
    vreme(v) {
      countUp(v.querySelector("#sky .t"));
      g.from(q("#sky .c, #sky .hl", v), Object.assign({ y: 10, opacity: 0, duration: 0.5, ease: "power2.out", stagger: 0.08, delay: 0.15 }, done));
      cards(q("#qtiles .qt", v), { delay: 0.1 });
      cards(q("#ten .trow", v), { y: 10, stagger: 0.035, delay: 0.2 });
      grow(q("#ten .rng", v), "scaleX", "left center", 0.35);
    },
    agro(v) {
      cards(q("#alerts .alert", v));
      cards(q(":scope > section, :scope > .panel", v).slice(1), { stagger: 0.06, delay: 0.1 });
      grow(q("#bal .bar-p", v), "scaleY", "center bottom", 0.25);
      grow(q("#bal .bar-e", v), "scaleY", "center top", 0.25);
    },
    okolina(v) { cards(q("#nearList > *", v), { stagger: 0.03 }); },
    prskanje(v) { cards(q(":scope > *", v).length === 1 ? q(":scope > * > *", v) : q(":scope > *", v), { stagger: 0.05 }); }
  };

  function run(name) {
    if (calm()) return;
    const v = document.querySelector('.view[data-view="' + name + '"]');
    if (!v || !byView[name]) return;
    try { byView[name](v); } catch (e) { /* animacija nikad ne sme da sruši prikaz */ }
  }

  window.Anim = {
    /* posle učitavanja prognoze: animira samo prikaz koji je trenutno otvoren */
    intro() { run(document.querySelector(".view.on")?.dataset.view || "vreme"); },
    /* pri prelasku na drugi prikaz; "okolina" se animira tek kad stigne spisak */
    view(name) { if (name !== "okolina") run(name); },
    near() { run("okolina"); }
  };
})();
