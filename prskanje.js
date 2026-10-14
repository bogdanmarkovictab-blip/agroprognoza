/* Agroprognoza · deo „Prskanje": prozor folijarne primene prema tački delikvescencije (POD).
   Koristi prognozu koju aplikacija već preuzima (medijana uključenih modela) i postojeća pravila
   za prskanje (sprayRate). Baza inputa je u inputi.json, podešavanja rastvora se pamte u pregledaču. */
"use strict";
window.Prskanje = (function () {
  const DEF = { sel: ["cano3"], manual: false, pod: 60, minwet: 4, dryh: 6 };
  let db = { kategorije: [], inputi: [], mesavine: [] }, dbErr = null, chart = null, mounted = false;
  let cfg = Object.assign({}, DEF, ls("ap.px", {}));
  let picked = {}; // izabrani sat po danu (za opis ispod trake)

  function ls(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch (e) { return d } }
  function save() { try { localStorage.setItem("ap.px", JSON.stringify(cfg)) } catch (e) { } }
  const p2 = n => String(n).padStart(2, "0");
  const q = s => document.querySelector(s);

  const ready = f => document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", f) : f();
  fetch("inputi.json").then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json() })
    .then(j => { db = j }, e => { dbErr = e.message })
    .then(() => ready(() => { mount(); render() }));

  /* ---------- proračun ---------- */
  function mixPod() {
    if (cfg.manual) return { pod: +cfg.pod, src: "ručno" };
    const salts = db.inputi.filter(x => cfg.sel.includes(x.id) && typeof x.pod === "number");
    if (!salts.length) return { pod: null, src: "nema soli" };
    const m = salts.reduce((a, b) => b.pod < a.pod ? b : a);
    return { pod: m.pod, src: salts.length > 1 ? "najniži u mešavini: " + m.naziv : m.naziv, multi: salts.length > 1 };
  }

  // Čista funkcija: ulaz su satni nizovi i pravila, izlaz klasa i obrazloženje za svaki sat
  function analyze(H, p) {
    const n = H.rh.length, wet = [], rain = [], run = new Array(n).fill(0), out = [];
    for (let i = 0; i < n; i++) {
      wet[i] = H.rh[i] != null && H.rh[i] >= p.pod;
      rain[i] = (H.p[i] || 0) >= 0.2 || (H.pop[i] != null && H.pop[i] >= 50);
    }
    for (let i = n - 1; i >= 0; i--) run[i] = wet[i] ? 1 + (i + 1 < n ? run[i + 1] : 0) : 0;
    for (let i = 0; i < n; i++) {
      const why = [];
      let rainAfter = false;
      for (let k = i; k < Math.min(n, i + p.dryh); k++) if (rain[k]) { rainAfter = true; break }
      const wx = H.rate[i] || { r: "na", why: [] };
      if (!wet[i]) why.push("vlažnost " + Math.round(H.rh[i] ?? 0) + " % je ispod POD " + p.pod + " %, kap se suši");
      else if (run[i] < p.minwet) why.push("kap ostaje tečna samo " + run[i] + " h");
      if (rainAfter) why.push("kiša u narednih " + p.dryh + " h spira rastvor");
      if (wx.r === "bad") why.push(...wx.why);
      let k;
      if ((H.p[i] || 0) >= 0.2) k = "rain";
      else if (wet[i] && run[i] >= p.minwet && !rainAfter && wx.r === "good") k = "go";
      else if (wet[i] && run[i] >= p.minwet && !rainAfter && wx.r === "warn") { k = "cond"; why.push(...wx.why) }
      else if (wet[i]) k = "wet";
      else k = "dry";
      out.push({ k, run: run[i], why, wet: wet[i] });
    }
    return out;
  }
  function windows(A, from, to, kinds) {
    const w = []; let s = -1;
    for (let i = from; i <= to; i++) {
      const g = i < to && kinds.includes(A[i].k);
      if (g && s < 0) s = i;
      if (!g && s >= 0) { w.push([s, i]); s = -1 }
    }
    return w;
  }

  /* ---------- prikaz ---------- */
  function mount() {
    const v = q("#vPrskanje"); if (!v || mounted) return; mounted = true;
    const st = document.createElement("style");
    st.textContent = `
#vPrskanje .pxgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px 18px}
#vPrskanje .pxf{display:flex;flex-direction:column;gap:6px;min-width:0}
#vPrskanje .pxf>label{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:600}
#vPrskanje .pxr{display:flex;align-items:center;gap:10px}
#vPrskanje .pxr input{flex:1;min-width:0;accent-color:var(--accent)}
#vPrskanje .pxr b{min-width:52px;text-align:right;font-variant-numeric:tabular-nums}
#vPrskanje .pxcat{display:flex;flex-direction:column;gap:6px}
#vPrskanje .pxcat h3{margin:0;font-size:13px;color:var(--ink-2);font-weight:600}
#vPrskanje .pxchips{display:flex;flex-wrap:wrap;gap:6px}
#vPrskanje .chip small{color:var(--muted);font-variant-numeric:tabular-nums}
#vPrskanje .pxpod{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
#vPrskanje .pxpod .big{font-family:var(--display);font-size:34px;font-weight:600;line-height:1}
#vPrskanje .pxpod span{color:var(--ink-2);font-size:13px}
#vPrskanje .pxk{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
#vPrskanje .pxk div{border-left:3px solid var(--line-2);padding:2px 0 2px 10px}
#vPrskanje .pxk .l{font-size:12px;color:var(--muted)}
#vPrskanje .pxk .n{font-family:var(--display);font-size:24px;font-weight:600;line-height:1.15}
#vPrskanje .pxk .g{border-color:var(--good)} #vPrskanje .pxk .w{border-color:var(--rain)}
#vPrskanje .pxleg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--ink-2)}
#vPrskanje .pxleg i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px}
#vPrskanje .pxchart{position:relative;height:250px}
#vPrskanje .pxday{display:grid;grid-template-columns:130px minmax(0,1fr);gap:12px;padding:12px 0;border-top:1px solid var(--line)}
#vPrskanje .pxday:first-child{border-top:0;padding-top:0}
#vPrskanje .pxdn{font-family:var(--display);font-size:19px;font-weight:600;line-height:1.1}
#vPrskanje .pxdn small{display:block;font-family:var(--body);font-size:12px;font-weight:400;color:var(--muted);margin:2px 0 6px}
#vPrskanje .pxstrip{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:2px}
#vPrskanje .pxstrip button{height:28px;border:0;border-radius:3px;padding:0;background:var(--surface-2);cursor:pointer}
#vPrskanje .pxstrip .go{background:var(--good)} #vPrskanje .pxstrip .cond{background:var(--warn)}
#vPrskanje .pxstrip .wet{background:var(--rain-soft)} #vPrskanje .pxstrip .rain{background:var(--rain)}
#vPrskanje .pxstrip .past{opacity:.3}
#vPrskanje .pxstrip .sel{outline:2px solid var(--ink);outline-offset:1px}
#vPrskanje .pxax{display:grid;grid-template-columns:repeat(24,minmax(0,1fr));font-size:10.5px;color:var(--muted);margin-top:2px}
#vPrskanje .pxax span{grid-column:span 3}
#vPrskanje .pxwin{font-size:13px;margin-top:6px}
#vPrskanje .pxwin b{font-weight:600}
#vPrskanje .pxwhy{font-size:12.5px;color:var(--ink-2);margin-top:4px}
#vPrskanje .pxinfo{font-size:12.5px;margin-top:6px;padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--surface)}
#vPrskanje .pxnote{font-size:12px;color:var(--muted);max-width:75ch;margin:0}
@media (max-width:600px){#vPrskanje .pxday{grid-template-columns:1fr;gap:6px}#vPrskanje .pxdn{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}#vPrskanje .pxdn small{margin:0}}`;
    document.head.appendChild(st);
    v.innerHTML = `
<section class="panel">
  <div class="panel-head"><div><div class="eyebrow">Folijarna primena</div><h2>Rastvor u rezervoaru</h2>
  <p>Izaberi soli i đubriva u rastvoru. Tačka delikvescencije (POD) je vlažnost vazduha iznad koje so na listu ostaje rastvorena i list je usvaja. Kad vlažnost padne ispod nje, kap se kristališe i usvajanje staje.</p></div></div>
  <div id="pxInputs"></div>
  <div class="pxpod"><span class="big num" id="pxPod">–</span><span id="pxPodSrc"></span></div>
  <div class="pxgrid">
    <div class="pxf"><label for="pxManual">POD ručno</label>
      <div class="pxr"><input type="checkbox" id="pxManual" style="flex:0 0 auto;width:18px;height:18px"><input type="range" id="pxPodR" min="20" max="98" step="1" aria-label="Ručni POD"><b id="pxPodO"></b></div></div>
    <div class="pxf"><label for="pxMinwet">Kap tečna najmanje</label>
      <div class="pxr"><input type="range" id="pxMinwet" min="1" max="12" step="1"><b id="pxMinwetO"></b></div></div>
    <div class="pxf"><label for="pxDry">Bez kiše posle prskanja</label>
      <div class="pxr"><input type="range" id="pxDry" min="2" max="24" step="1"><b id="pxDryO"></b></div></div>
  </div>
</section>
<section class="panel">
  <div class="panel-head"><div><div class="eyebrow" id="pxLoc">Prognoza</div><h2>Narednih 7 dana</h2>
  <p>Vlažnost je medijana uključenih modela. Zelena polja su sati kad kap ostaje tečna dovoljno dugo, nema kiše i vremenski uslovi su povoljni po istim pravilima kao u delu Agro.</p></div></div>
  <div class="pxk">
    <div><div class="l">POD rastvora</div><div class="n num" id="pxK1">–</div></div>
    <div class="w"><div class="l">Sati tečne kapi</div><div class="n num" id="pxK2">–</div></div>
    <div class="g"><div class="l">Sati za prskanje</div><div class="n num" id="pxK3">–</div></div>
    <div class="g"><div class="l">Sledeći prozor</div><div class="n num" id="pxK4">–</div></div>
  </div>
  <div class="pxleg"><span><i style="background:var(--rain)"></i>Relativna vlažnost</span><span><i style="height:0;border-top:2px dashed var(--warn);border-radius:0"></i>POD rastvora</span><span><i style="background:var(--good-soft);border:1px solid var(--good)"></i>Termin za prskanje</span></div>
  <div class="pxchart"><canvas id="pxChart" role="img" aria-label="Satna relativna vlažnost za narednih 7 dana u odnosu na POD rastvora">Grafik vlažnosti i POD linije.</canvas></div>
</section>
<section class="panel">
  <div class="panel-head"><div><div class="eyebrow">Po danima</div><h2>Termini za folijarnu primenu</h2><p>Dodirni sat za detalje.</p></div></div>
  <div class="pxleg"><span><i style="background:var(--good)"></i>Prskaj</span><span><i style="background:var(--warn)"></i>Uslovno</span><span><i style="background:var(--rain-soft)"></i>Kap tečna, ali nešto smeta</span><span><i style="background:var(--surface-2);border:1px solid var(--line-2)"></i>Kap se suši</span><span><i style="background:var(--rain)"></i>Kiša</span></div>
  <div id="pxDays"><div class="loading">Učitavam…</div></div>
</section>
<p class="pxnote">POD vrednosti su približne tačke delikvescencije čistih soli na 20–25 °C. Mešavina soli ima niži POD od najniže pojedinačne vrednosti, pa je proračun sa najnižim POD-om u mešavini na strani opreza: kap stvarno ostaje tečna bar onoliko koliko je prikazano. Okvašivači i humektanti dodatno spuštaju POD; za takvu mešavinu uključi ručni unos. Vlažnost na 2 m nije isto što i mikroklima u krošnji, gde je uz gust sklop i navodnjavanje obično viša.</p>`;
    q("#pxManual").checked = !!cfg.manual;
    q("#pxPodR").value = cfg.pod; q("#pxMinwet").value = cfg.minwet; q("#pxDry").value = cfg.dryh;
    q("#pxManual").addEventListener("change", e => { cfg.manual = e.target.checked; save(); render() });
    q("#pxPodR").addEventListener("input", e => { cfg.pod = +e.target.value; cfg.manual = true; q("#pxManual").checked = true; save(); render() });
    q("#pxMinwet").addEventListener("input", e => { cfg.minwet = +e.target.value; save(); render() });
    q("#pxDry").addEventListener("input", e => { cfg.dryh = +e.target.value; save(); render() });
    q("#pxInputs").addEventListener("click", e => {
      const b = e.target.closest("[data-in]"); if (!b) return;
      const id = b.dataset.in, i = cfg.sel.indexOf(id);
      if (i >= 0) cfg.sel.splice(i, 1); else cfg.sel.push(id);
      cfg.manual = false; q("#pxManual").checked = false; save(); render();
    });
    q("#pxDays").addEventListener("click", e => {
      const b = e.target.closest("[data-hi]"); if (!b) return;
      picked[b.dataset.day] = +b.dataset.hi; renderDays(last.A, last.p);
    });
    if (window.matchMedia) matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => render());
  }

  function renderInputs() {
    const box = q("#pxInputs"); if (!box) return;
    if (dbErr) { box.innerHTML = '<div class="err-box">Baza inputa nije učitana (' + esc(dbErr) + '). Uključi ručni POD.</div>'; return }
    box.innerHTML = '<div class="pxcat" style="gap:12px">' + db.kategorije.map(c => {
      const items = db.inputi.filter(x => x.kategorija === c.id); if (!items.length) return "";
      return `<div class="pxcat"><h3>${esc(c.naziv)}</h3><div class="pxchips">${items.map(x =>
        `<button type="button" class="chip" data-in="${esc(x.id)}" aria-pressed="${cfg.sel.includes(x.id) && !cfg.manual}">${esc(x.naziv)}${x.pod != null ? ` <small>${x.pod} %</small>` : ""}</button>`).join("")}</div></div>`;
    }).join("") + "</div>";
  }

  let last = { A: null, p: null };
  function render() {
    if (!mounted) mount(); if (!mounted || typeof esc !== "function") return;
    renderInputs();
    const mp = mixPod();
    q("#pxPod").textContent = mp.pod != null ? mp.pod + " %" : "–";
    q("#pxPodSrc").textContent = mp.pod != null ? "POD rastvora · " + mp.src : "Izaberi bar jednu so ili uključi ručni POD";
    q("#pxPodO").textContent = cfg.pod + " %"; q("#pxMinwetO").textContent = cfg.minwet + " h"; q("#pxDryO").textContent = cfg.dryh + " h";
    q("#pxPodR").style.opacity = cfg.manual ? 1 : .5;
    if (typeof state === "undefined" || !state.time || !state.time.length) return;
    q("#pxLoc").textContent = state.loc && state.loc.name ? state.loc.name : "Prognoza";
    if (mp.pod == null) { q("#pxDays").innerHTML = '<div class="loading">Izaberi so ili uključi ručni POD.</div>'; return }
    const H = { rh: consensus("relative_humidity_2m"), p: consensus("precipitation"), pop: consensus("precipitation_probability"), rate: [] };
    const C = { t: consensus("temperature_2m"), rh: H.rh, w: consensus("wind_speed_10m"), g: consensus("wind_gusts_10m"), p: H.p, pop: H.pop };
    H.t = C.t; H.w = C.w;
    for (let i = 0; i < state.time.length; i++) H.rate[i] = sprayRate(i, C);
    const p = { pod: mp.pod, minwet: cfg.minwet, dryh: cfg.dryh };
    const A = analyze(H, p);
    last = { A, p, H };
    const s = state.nowIdx, e = Math.min(state.time.length, dayStart(7));
    let wetH = 0, goH = 0, next = null;
    for (let i = s; i < e; i++) { if (A[i].wet) wetH++; if (A[i].k === "go") { goH++; if (next == null) next = i } }
    q("#pxK1").textContent = p.pod + " %"; q("#pxK2").textContent = wetH + " h"; q("#pxK3").textContent = goH + " h";
    q("#pxK4").textContent = next == null ? "Nema" : (state.time[next].slice(0, 10) === state.time[s].slice(0, 10) ? "Danas" : DOW[dateOf(state.time[next]).getUTCDay()]) + " " + state.time[next].slice(11, 16);
    if (q("#vPrskanje").classList.contains("on")) drawChart(A, p, H, e);
    renderDays(A, p);
  }
  function dayStart(d) { // indeks prvog sata d-tog dana od danas
    const keys = []; for (let i = 0; i < state.time.length; i++) { const k = state.time[i].slice(0, 10); if (!keys.includes(k)) { keys.push(k); if (keys.length === d + 1) return i } }
    return state.time.length;
  }

  function drawChart(A, p, H, end) {
    const N = end, T = state.time.slice(0, N);
    const band = { id: "pxBand", beforeDatasetsDraw(c) {
      const { ctx, chartArea: a, scales: { x } } = c, N = c.data.labels.length, w = (a.right - a.left) / N; ctx.save();
      ctx.fillStyle = css("--good-soft"); last.A.slice(0, N).forEach((o, i) => { if (o.k === "go") ctx.fillRect(x.getPixelForValue(i) - w / 2, a.top, w + .5, a.bottom - a.top) });
      ctx.fillStyle = css("--line"); c.data.labels.forEach((t, i) => { if (hourOf(t) === 0 && i) ctx.fillRect(x.getPixelForValue(i) - w / 2, a.top, 1, a.bottom - a.top) });
      if (state.nowIdx < N) { ctx.fillStyle = css("--ink-2"); ctx.fillRect(x.getPixelForValue(state.nowIdx), a.top, 1.5, a.bottom - a.top) }
      ctx.restore() } };
    const data = { labels: T.map(t => t), datasets: [
      { label: "RH", data: H.rh.slice(0, N), borderColor: css("--rain"), borderWidth: 2, pointRadius: 0, tension: .3, fill: false },
      { label: "POD", data: T.map(() => p.pod), borderColor: css("--warn"), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, fill: false }] };
    const opt = { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        title: it => dayLabel(T[it[0].dataIndex]) + " " + T[it[0].dataIndex].slice(11, 16),
        label: c => c.datasetIndex ? "POD " + p.pod + " %" : "Vlažnost " + r0(H.rh[c.dataIndex]) + " % · " + r1(H.t[c.dataIndex]) + " °C · vetar " + r0(H.w[c.dataIndex]) + " km/h",
        afterBody: it => { const o = last.A[it[0].dataIndex]; return o.k === "go" ? "Termin za prskanje, kap tečna " + o.run + " h" : o.why.slice(0, 2) } } } },
      scales: { y: { min: 0, max: 100, ticks: { color: css("--muted"), stepSize: 20, callback: v => v + " %" }, grid: { color: css("--line") } },
        x: { grid: { display: false }, ticks: { color: css("--muted"), autoSkip: false, maxRotation: 0, callback: (v, i) => { const t = T[i]; return hourOf(t) === 12 ? DOW[dateOf(t).getUTCDay()] : "" } } } } };
    if (chart) { chart.data = data; chart.options = opt; chart.update(); return }
    chart = new Chart(q("#pxChart"), { type: "line", data, options: opt, plugins: [band] });
  }

  function hhmm(i) { return i >= state.time.length ? "24:00" : state.time[i].slice(11, 16) }
  function renderDays(A, p) {
    const box = q("#pxDays"); if (!box || !A) return;
    const now = state.nowIdx; let html = "";
    for (let d = 0; d < 7; d++) {
      const s = dayStart(d), e = Math.min(dayStart(d + 1), state.time.length); if (s >= e || e - s < 20) break;
      const key = state.time[s].slice(0, 10), from = Math.max(s, now);
      const go = windows(A, from, e, ["go"]), cond = windows(A, from, e, ["cond"]);
      const goH = go.reduce((a, w) => a + w[1] - w[0], 0);
      const rh = last.H.rh.slice(s, e).filter(v => v != null);
      const pill = e <= now ? '<span class="pill info">Prošlo</span>' : goH >= 3 ? '<span class="pill good">Dobar dan</span>' : goH > 0 || cond.length ? '<span class="pill warn">Kratak ili uslovan</span>' : '<span class="pill bad">Nema prozora</span>';
      let win = "";
      if (go.length) win = `<div class="pxwin"><b>${go.map(w => hhmm(w[0]) + "–" + hhmm(w[1])).join(", ")}</b> · kap tečna do ${Math.max(...go.map(w => A[w[0]].run))} h</div>`;
      if (cond.length) win += `<div class="pxwhy">Uslovno: ${cond.map(w => hhmm(w[0]) + "–" + hhmm(w[1])).join(", ")}</div>`;
      if (!go.length && !cond.length && e > now) {
        const cnt = {};
        for (let i = from; i < e; i++) A[i].why.forEach(w => { const k = /ispod POD/.test(w) ? "vlažnost ispod POD" : /samo/.test(w) ? "kap se prebrzo suši" : /kiša|Kiša|verovatnoća/.test(w) ? "kiša" : /vetar|udari/.test(w) ? "vetar" : /temperatura/.test(w) ? "temperatura" : /Delta/.test(w) ? "Delta T" : w; cnt[k] = (cnt[k] || 0) + 1 });
        win = `<div class="pxwhy">Ograničava: ${Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => esc(x[0])).join(", ")}</div>`;
      }
      const sel = picked[key];
      let info = "";
      if (sel != null && sel >= s && sel < e) {
        const o = A[sel], H = last.H;
        const lab = { go: "Prskaj", cond: "Uslovno", wet: "Kap tečna, ali ne prskati", dry: "Kap se suši", rain: "Kiša" }[o.k];
        info = `<div class="pxinfo"><b>${hhmm(sel)} · ${lab}</b> · vlažnost ${r0(H.rh[sel])} %, ${r1(H.t[sel])} °C, vetar ${r0(H.w[sel])} km/h, kiša ${r1(H.p[sel] || 0)} mm${o.why.length && o.k !== "go" ? "<br>" + o.why.slice(0, 3).map(esc).join("; ") : o.k === "go" ? "<br>Kap ostaje tečna " + o.run + " h posle prskanja." : ""}</div>`;
      }
      const cells = []; for (let i = s; i < e; i++) cells.push(`<button type="button" data-day="${key}" data-hi="${i}" class="${A[i].k}${i < now ? " past" : ""}${i === sel ? " sel" : ""}" aria-label="${state.time[i].slice(11, 16)}"></button>`);
      const dt = dateOf(state.time[s]);
      html += `<div class="pxday"><div><div class="pxdn">${d === 0 ? "Danas" : d === 1 ? "Sutra" : DOWL[dt.getUTCDay()].replace(/^./, c => c.toUpperCase())}<small>${dt.getUTCDate()}.${dt.getUTCMonth() + 1}. · vlažnost ${rh.length ? Math.round(Math.min(...rh)) + "–" + Math.round(Math.max(...rh)) : "–"} %</small></div>${pill}</div>
        <div style="min-width:0"><div class="pxstrip">${cells.join("")}</div><div class="pxax"><span>00</span><span>03</span><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span></div>${win}${info}</div></div>`;
    }
    box.innerHTML = html || '<div class="loading">Nema podataka.</div>';
  }

  return { render, analyze, windows, onShow() { render() } };
})();
