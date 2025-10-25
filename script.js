diff --git a/script.js b/script.js
index 3726e304ece546a127aa3b89cb2079c7f57439a7..cee00015fbcdd89207d20068d2a4ad3920bf6862 100644
--- a/script.js
+++ b/script.js
@@ -17,51 +17,55 @@ const State = {
    Запуск
 ======================= */
 document.addEventListener("DOMContentLoaded", () => {
   bindMenu();
   bindDelegation();
   boot();
 });
 
 async function boot(){
   showLoader(true);
   setLoader(5);
   try {
     await loadTickets(p => setLoader(5 + Math.floor(p * 85)));
   } catch(e) {
     console.error("Ошибка загрузки билетов:", e);
   }
   setLoader(100);
   setTimeout(()=>showLoader(false), 250);
   renderHome();
   updateStatsCounters();
 }
 
 /* =======================
    Лоадер
 ======================= */
+function showLoader(v){
+  const isVisible = !!v;
+  qs("#loader").classList.toggle("hidden", !isVisible);
+  document.body.classList.toggle("is-loading", isVisible);
}
 function setLoader(p){ qs("#loaderBar").style.width = Math.max(0,Math.min(100,p))+"%"; }
 
 /* =======================
    Навигация
 ======================= */
 function toggleSubpage(isSub){
   const appRoot = qs(".app");
   const isSubpage = !!isSub;
   appRoot?.classList.toggle("app--subpage", isSubpage);
   setActive(null);
   if (!isSubpage) return;
 
   const screen = document.querySelector("#screen");
   screen?.scrollIntoView({ block: "start", behavior: "smooth" });
 }
 
 function setView(html, { subpage = true } = {}){
   toggleSubpage(subpage);
   const host = qs("#screen");
   host.scrollTop = 0;
   host.innerHTML = `<div class="view">${html}</div>`;
 }
 function renderHome(){
   setActive(null);
   setView(`
