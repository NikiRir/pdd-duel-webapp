diff --git a/script.js b/script.js
index aef133ae7025195b403168d59632e46c8c077974..230547a690cf7aabb69d218aafbf3c414c1556ed 100644
--- a/script.js
+++ b/script.js
@@ -62,50 +62,52 @@ function renderHome(){
   setActive(null);
   setView(`
     <div class="card">
       <h3>Выбери режим сверху</h3>
       <p style="margin:.35rem 0 0;color:var(--muted)">⚡ Быстрая дуэль, 📚 Темы, 🎟️ Билеты</p>
     </div>
   `, { subpage: false });
 }
 function setActive(id){
   qsa("[data-action]").forEach(b=>b.classList.remove("active"));
   if(id) qs("#"+id)?.classList.add("active");
 }
 
 /* =======================
    Меню
 ======================= */
 function bindMenu(){
   qsa("[data-action]").forEach(btn=>{
     btn.addEventListener("click", e=>{
       const act = e.currentTarget.dataset.action;
       setActive(e.currentTarget.id);
       if (act==="quick")    startDuel({mode:"quick"});
       if (act==="topics")   uiTopics();
       if (act==="tickets")  uiTickets();
       if (act==="stats")    uiStats();
+      if (act==="markup")   uiMarkup();
+      if (act==="penalties")uiPenalties();
     }, { passive:true });
   });
 }
 
 /* =======================
    Делегация событий
 ======================= */
 function bindDelegation(){
   const screen = qs("#screen");
   screen.addEventListener("touchstart", handleTap, { passive:false });
   screen.addEventListener("click", e=>{
     if (Date.now() - State.lastTouchTs < 350) return;
     handleTap(e);
   }, { passive:false });
 }
 
 function handleTap(e){
   if (e.type === "touchstart") State.lastTouchTs = Date.now();
 
   const ans = e.target.closest("button.answer");
   if (ans && ans.dataset.i != null){ e.preventDefault(); onAnswer(+ans.dataset.i); return; }
   const ticket = e.target.closest("[data-n]");
   if (ticket){ e.preventDefault(); startTicket(+ticket.dataset.n); return; }
   const topic = e.target.closest("[data-t]");
   if (topic){ e.preventDefault(); startDuel({mode:"topic", topic: topic.dataset.t}); return; }
@@ -201,50 +203,175 @@ function uiTopics(){
   const list=[...State.topics.keys()].sort((a,b)=>a.localeCompare(b,'ru'));
   if(!list.length){ setView(`<div class="card"><h3>Темы</h3><p>❌ Темы не найдены</p></div>`, { subpage: true }); return; }
   setView(`
     <div class="card"><h3>Темы</h3></div>
     <div class="card"><div class="grid auto">
       ${list.map(t=>`<button type="button" class="answer" data-t="${esc(t)}">${esc(t)}</button>`).join("")}
     </div></div>
   `, { subpage: true });
 }
 
 function uiTickets(){
   const ids=[...State.byTicket.keys()].sort((a,b)=>a-b);
   if(!ids.length){ setView(`<div class="card"><h3>Билеты</h3><p>❌ Билеты не найдены</p></div>`, { subpage: true }); return; }
   setView(`
     <div class="card"><h3>Билеты</h3></div>
     <div class="card"><div class="grid auto">
       ${ids.map(n=>`<button type="button" class="answer" data-n="${n}">Билет ${n}</button>`).join("")}
     </div></div>
   `, { subpage: true });
 }
 
 function uiStats(){
   setView(`<div class="card"><h3>Статистика</h3><p>Скоро здесь будет прогресс дуэлей.</p></div>`, { subpage: true });
 }
 
+async function uiMarkup(){
+  setView(`
+    <div class="card">
+      <h3>Дорожная разметка</h3>
+      <p style="margin-top:.35rem;color:var(--muted,rgba(255,255,255,0.6))">Загружаем справочник…</p>
+    </div>
+  `, { subpage: true });
+
+  try {
+    const data = await loadReferenceJson("markup/markup.json");
+    const sections = Object.entries(data || {});
+    if (!sections.length) throw new Error("Пустой справочник");
+
+    const htmlSections = sections.map(([title, entries]) => {
+      const list = Object.entries(entries || {}).map(([code, item]) => ({
+        code,
+        ...item
+      }));
+      list.sort((a,b)=>String(a.number||a.code||"").localeCompare(String(b.number||b.code||""), "ru", { numeric:true, sensitivity:"base" }));
+
+      const itemsHtml = list.map((item, idx) => {
+        const number = item.number || item.code || "—";
+        const imagePath = typeof item.image === "string" ? item.image : "";
+        const hasImage = !!imagePath;
+        return `
+          <li style="padding:.75rem 0;${idx?"border-top:1px solid rgba(255,255,255,0.08);":""}">
+            <div style="font-weight:600;font-size:1rem;">${esc(number)}</div>
+            ${hasImage?`<img src="${esc(imagePath)}" alt="Разметка ${esc(number)}" loading="lazy" style="max-width:180px;width:100%;height:auto;margin:.5rem 0;object-fit:contain;" />`:""}
+            <p style="margin:.35rem 0 0;line-height:1.5;">${esc(item.description || "Описание отсутствует")}</p>
+          </li>
+        `;
+      }).join("");
+
+      return `
+        <section class="card">
+          <h3>${esc(title)}</h3>
+          <ul style="list-style:none;margin:.75rem 0 0;padding:0;">
+            ${itemsHtml}
+          </ul>
+        </section>
+      `;
+    }).join("");
+
+    setView(`
+      <div class="card">
+        <h3>Дорожная разметка</h3>
+        <p style="margin-top:.35rem;color:var(--muted,rgba(255,255,255,0.6))">Горизонтальная и вертикальная разметка по ГОСТ.</p>
+      </div>
+      ${htmlSections}
+    `, { subpage: true });
+  } catch(err) {
+    console.error("Ошибка загрузки разметки:", err);
+    setView(`
+      <div class="card">
+        <h3>Дорожная разметка</h3>
+        <p>Не удалось загрузить справочник разметки. Проверьте соединение и попробуйте ещё раз.</p>
+        <p style="margin-top:.35rem;color:var(--muted,rgba(255,255,255,0.6))">${esc(err?.message || "Неизвестная ошибка")}</p>
+      </div>
+    `, { subpage: true });
+  }
+}
+
+async function uiPenalties(){
+  setView(`
+    <div class="card">
+      <h3>Штрафы</h3>
+      <p style="margin-top:.35rem;color:var(--muted,rgba(255,255,255,0.6))">Загружаем справочник…</p>
+    </div>
+  `, { subpage: true });
+
+  try {
+    const raw = await loadReferenceJson("penalties/penalties.json");
+    const list = Array.isArray(raw) ? raw : (raw?.list || raw?.data || raw?.penalties || []);
+    if (!Array.isArray(list) || !list.length) throw new Error("Пустой справочник");
+
+    const grouped = new Map();
+    for (const entry of list){
+      if (!entry || typeof entry !== "object") continue;
+      const articleRaw = String(entry.article_part || "Прочие положения").trim();
+      const articleKey = articleRaw.split(/\s+/)[0] || articleRaw;
+      if (!grouped.has(articleKey)) grouped.set(articleKey, []);
+      grouped.get(articleKey).push(entry);
+    }
+
+    const sections = [...grouped.entries()].sort((a,b)=>String(a[0]).localeCompare(String(b[0]), "ru", { numeric:true, sensitivity:"base" }));
+
+    const htmlSections = sections.map(([article, items]) => {
+      const sorted = items.slice().sort((a,b)=>String(a.article_part||"").localeCompare(String(b.article_part||""), "ru", { numeric:true, sensitivity:"base" }));
+      const itemsHtml = sorted.map((item, idx) => `
+        <li style="padding:.75rem 0;${idx?"border-top:1px solid rgba(255,255,255,0.08);":""}">
+          <div style="font-weight:600;font-size:1rem;">${esc(item.article_part || article)}</div>
+          <p style="margin:.35rem 0 0;line-height:1.5;">${esc(item.text || "Описание отсутствует")}</p>
+          <p style="margin:.35rem 0 0;color:var(--accent,#ffde7a);">💸 ${esc(item.penalty || "—")}</p>
+        </li>
+      `).join("");
+
+      return `
+        <section class="card">
+          <h3>Статья ${esc(article)}</h3>
+          <ul style="list-style:none;margin:.75rem 0 0;padding:0;">
+            ${itemsHtml}
+          </ul>
+        </section>
+      `;
+    }).join("");
+
+    setView(`
+      <div class="card">
+        <h3>Штрафы</h3>
+        <p style="margin-top:.35rem;color:var(--muted,rgba(255,255,255,0.6))">Справочник наказаний по КоАП и УК РФ.</p>
+      </div>
+      ${htmlSections}
+    `, { subpage: true });
+  } catch(err) {
+    console.error("Ошибка загрузки штрафов:", err);
+    setView(`
+      <div class="card">
+        <h3>Штрафы</h3>
+        <p>Не удалось загрузить список штрафов. Попробуйте обновить экран.</p>
+        <p style="margin-top:.35rem;color:var(--muted,rgba(255,255,255,0.6))">${esc(err?.message || "Неизвестная ошибка")}</p>
+      </div>
+    `, { subpage: true });
+  }
+}
+
 /* =======================
    Викторина
 ======================= */
 function startDuel({mode,topic=null}){
   const src = topic ? (State.topics.get(topic)||[]) : State.pool;
   if(!src.length){ setView(`<div class="card"><h3>Дуэль</h3><p>⚠️ Нет данных</p></div>`, { subpage: true }); return; }
   const q = shuffle(src).slice(0,20);
   State.duel = { mode, topic, i:0, me:0, q };
   renderQuestion();
 }
 function startTicket(n){
   const arr = State.byTicket.get(n) || [];
   if(!arr.length){ setView(`<div class="card"><h3>Билет ${n}</h3><p>⚠️ Нет вопросов</p></div>`, { subpage: true }); return; }
   const q = arr.length>20 ? shuffle(arr).slice(0,20) : arr.slice(0,20);
   State.duel = { mode:"ticket", topic:null, i:0, me:0, q };
   renderQuestion();
 }
 
 function renderQuestion(){
   const d = State.duel, q = d.q[d.i];
   setView(`
     <div class="card">
       <div class="meta">Вопрос ${d.i+1}/${d.q.length} • Билет ${q.ticket}</div>
       <h3>${esc(q.question)}</h3>
       ${q.image?`<img src="${q.image}" class="qimg" onerror="this.style.display='none'"/>`:""}
@@ -280,35 +407,56 @@ function onAnswer(i){
 }
 
 function finishDuel(){
   const d=State.duel;
   setView(`
     <div class="card">
       <h3>${d.me>=Math.ceil(d.q.length*0.6)?"🏆 Отлично!":"🏁 Завершено"}</h3>
       <p>Верных: <b>${d.me}</b> из ${d.q.length}</p>
       <div class="grid two" style="margin-top:10px">
         <button class="btn btn-primary" id="again">Ещё раз</button>
         <button class="btn" id="home">На главную</button>
       </div>
     </div>
   `, { subpage: true });
 }
 
 /* =======================
    Утилиты
 ======================= */
 const qs=s=>document.querySelector(s);
 const qsa=s=>[...document.querySelectorAll(s)];
 function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
 function shuffle(a){return a.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);}
 function toast(t){const el=qs("#toast");el.innerHTML=`<div class="toast">${t}</div>`;el.style.opacity=1;setTimeout(()=>el.style.opacity=0,1500);}
 function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
+async function loadReferenceJson(url){
+  const res = await fetch(url, { cache:"no-store" });
+  if(!res.ok) throw new Error(`Ошибка ${res.status}`);
+  const text = await res.text();
+  const trimmed = text.trim();
+  if(!trimmed) throw new Error("Пустой ответ");
+  try {
+    return JSON.parse(trimmed);
+  } catch(parseErr){
+    const lines = trimmed.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
+    if(lines.length > 1){
+      try {
+        return lines.map(line => JSON.parse(line));
+      } catch(ndjsonErr){
+        console.error("Ошибка разбора NDJSON:", ndjsonErr);
+      }
+    }
+    console.error("Ошибка разбора JSON:", parseErr);
+    throw new Error("Некорректный формат справочника");
+  }
+}
 function updateStatsCounters(){
   setStat("statQuestions", State.pool.length);
   setStat("statTopics", State.topics.size);
   setStat("statTickets", State.byTicket.size);
 }
 function setStat(id, value){
   const el = qs(`#${id}`);
   if(!el) return;
   el.textContent = value ? value.toLocaleString("ru-RU") : "0";
 }
