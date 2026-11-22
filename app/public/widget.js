/*! Shor's Reach widget v1 — MIT. https://shors-reach.vercel.app/#/developers
 *
 *   <div data-shors-reach data-input="bc1q…" data-theme="dark"></div>
 *   <script src="https://shors-reach.vercel.app/widget.js" async></script>
 *
 * data-input  optional; without it the widget shows its own input box
 * data-theme  "dark" (default) | "light"
 * Events: the element fires "shorsreach:result" with detail { verdict, score, exposedUsd }.
 * The scan runs inside the iframe, in the visitor's browser: your page never handles the address data,
 * and Shor's Reach servers don't receive it.
 */
(function () {
  var script = document.currentScript;
  var ORIGIN = script && script.src ? new URL(script.src).origin : "https://shors-reach.vercel.app";
  var frames = [];

  function mount(el) {
    if (!el || el.__shorsReach) return;
    el.__shorsReach = true;
    var input = (el.getAttribute("data-input") || "").trim();
    var theme = el.getAttribute("data-theme") === "light" ? "light" : "dark";
    var f = document.createElement("iframe");
    f.src = ORIGIN + "/?theme=" + theme + "#/embed" + (input ? "/" + encodeURIComponent(input) : "");
    f.title = "Shor's Reach — quantum exposure check";
    f.loading = "lazy";
    f.style.cssText = "display:block;width:100%;max-width:520px;border:0;border-radius:16px;height:" + (input ? 190 : 170) + "px;background:transparent;color-scheme:normal";
    el.appendChild(f);
    frames.push({ frame: f, el: el });
  }

  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN || !e.data || e.data.source !== "shors-reach") return;
    for (var i = 0; i < frames.length; i++) {
      var w = frames[i];
      if (w.frame.contentWindow !== e.source) continue;
      if (e.data.type === "shors-reach:resize" && e.data.height > 0) w.frame.style.height = Math.ceil(e.data.height) + "px";
      if (e.data.type === "shors-reach:result")
        w.el.dispatchEvent(new CustomEvent("shorsreach:result", { bubbles: true, detail: { verdict: e.data.verdict, score: e.data.score, exposedUsd: e.data.exposedUsd } }));
    }
  });

  function scanPage() {
    var els = document.querySelectorAll("[data-shors-reach]");
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }
  window.ShorsReach = { mount: mount, scan: scanPage };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scanPage);
  else scanPage();
})();
