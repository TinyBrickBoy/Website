(function () {
  var root = document.documentElement;
  var glass = document.getElementById("glass");
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var T = {};
  try { T = JSON.parse(document.getElementById("konsole-i18n").textContent); } catch (e) {}
  function t(key, arg) { return (T[key] || key).replace("%s", arg == null ? "" : arg); }

  // ---- Shell (home page only) ----
  var output = document.getElementById("output");
  var form = document.getElementById("prompt");
  if (!output || !form) return;

  var input = document.getElementById("cmd");
  var label = form.querySelector("label");
  var history = [], hIdx = 0, lastWasTab = false;

  var langs = Object.keys(T.langs || {});
  var aliases = {
    "?": "help", hilfe: "help", dir: "ls", type: "cat", projekte: "projects", kontakt: "contact",
    about: "whoami", lang: "language", sprache: "language", cls: "clear", statistik: "stats", neofetch: "stats", recherche: "research", forschung: "research", as210881: "asn", bgp: "asn", impressum: "imprint", legal: "imprint", datenschutz: "privacy"
  };
  function commandList() {
    var list = [];
    document.querySelectorAll("template[data-cmd]").forEach(function (tpl) { list.push(tpl.dataset.cmd); });
    return list.concat(["ls", "cat", "cd", "language", "clear", "open", "imprint", "privacy"]).sort();
  }
  function slugs() {
    var s = [];
    document.querySelectorAll("template").forEach(function (tpl) {
      tpl.content.querySelectorAll("[data-slug]").forEach(function (a) { if (s.indexOf(a.dataset.slug) < 0) s.push(a.dataset.slug); });
    });
    return s.sort();
  }

  // ---- tiny virtual filesystem ----
  var cwd = "~";
  var FILES = { "about.txt": "whoami", "skills.txt": "skills", "stats.txt": "stats", "research.txt": "research", "asn.txt": "asn", "contact.txt": "contact" };
  function dirs() {
    var d = {};
    document.querySelectorAll("template[data-cmd]").forEach(function (tpl) {
      var items = tpl.content.querySelectorAll("[data-slug]");
      if (items.length) d[tpl.dataset.cmd] = Array.prototype.map.call(items, function (a) { return a; });
    });
    return d;
  }
  function entries(path) {
    var d = dirs();
    if (path === "~") return Object.keys(FILES).concat(Object.keys(d).map(function (k) { return k + "/"; })).sort();
    var name = path.replace(/^~\//, "");
    return d[name] ? d[name].map(function (a) { return a.dataset.slug + "/"; }) : null;
  }
  function resolve(arg) {
    var p = (arg || "").replace(/\/+$/, "");
    if (!p || p === "." ) return cwd;
    if (p === "~" || p === "/" || p === "..") return "~";
    if (p.indexOf("~/") === 0) p = p.slice(2);
    return cwd === "~" ? "~/" + p : cwd + "/" + p;
  }
  function setCwd(path) {
    cwd = path;
    document.querySelectorAll("#prompt .cwd").forEach(function (el) { el.textContent = cwd; });
  }
  function slugLink(path, slug) {
    var d = dirs(), name = path.replace(/^~\//, ""), hit = null;
    (d[name] || []).forEach(function (a) { if (a.dataset.slug === slug) hit = a; });
    return hit;
  }
  function ls(args) {
    var long = args.some(function (a) { return a.charAt(0) === "-" && a.indexOf("l") > -1; });
    var target = resolve(args.filter(function (a) { return a.charAt(0) !== "-"; })[0]);
    var list = entries(target);
    if (!list) {
      var parent = target.slice(0, target.lastIndexOf("/")), leaf = target.slice(target.lastIndexOf("/") + 1);
      if (target.indexOf("/") > -1 && slugLink(parent, leaf)) list = [leaf + "/"];
      else if (target.indexOf("/") > -1 && FILES[leaf] && parent === "~") list = [leaf];
      else { line(t("noSuchFile", "ls: " + esc(target.replace(/^~\/?/, "") || "~"))); return; }
    }
    var html = list.map(function (e) {
      var isDir = /\/$/.test(e), name = e.replace(/\/$/, "");
      var cmd = isDir ? (target === "~" ? "cd " + name : "open " + name) : "cat " + name;
      var link = '<a href="#" data-run="' + esc(cmd) + '">' + esc(e) + "</a>";
      return long ? '<span class="dim">' + (isDir ? "drwxr-xr-x" : "-rw-r--r--") + "  leo  leo</span>  " + link : link;
    });
    var block = document.createElement("pre");
    block.className = long ? "table out-block" : "table out-block ls-grid";
    block.innerHTML = long ? html.join("\n") : html.map(function (h) { return "<span>" + h + "</span>"; }).join("");
    output.appendChild(block);
  }
  function cat(arg) {
    if (!arg) { line("cat: ?"); return; }
    var target = resolve(arg), leaf = target.slice(target.lastIndexOf("/") + 1), parent = target.slice(0, target.lastIndexOf("/")) || "~";
    if (entries(target) && target !== "~") { line("cat: " + esc(arg) + ": Is a directory"); return; }
    if (parent === "~" && FILES[leaf]) return showTemplate(FILES[leaf]);
    var a = slugLink(parent, leaf.replace(/\.md$/, ""));
    if (a) { line(t("opening", esc(a.dataset.slug))); location.href = a.getAttribute("href"); return; }
    line(t("noSuchFile", "cat: " + esc(arg)));
  }
  function cd(arg) {
    var target = resolve(arg || "~");
    if (target === "~" || entries(target)) { setCwd(target); return; }
    var parent = target.slice(0, target.lastIndexOf("/")), leaf = target.slice(target.lastIndexOf("/") + 1);
    var a = slugLink(parent, leaf);
    if (a) { line(t("opening", esc(leaf))); location.href = a.getAttribute("href"); return; }
    line(t("noSuchFile", "cd: " + esc(arg)));
  }
  function showTemplate(name) {
    var tpl = document.querySelector('template[data-cmd="' + name + '"]');
    if (!tpl) return false;
    var block = document.createElement("div");
    block.className = "out-block";
    block.appendChild(tpl.content.cloneNode(true));
    output.appendChild(block);
    block.querySelectorAll(".heat-wrap").forEach(function (w) { w.scrollLeft = w.scrollWidth; });
    return true;
  }

  function scrollDown() { glass.scrollTop = glass.scrollHeight; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function line(html, cls) {
    var p = document.createElement("p");
    if (cls) p.className = cls;
    p.innerHTML = html;
    output.appendChild(p);
    return p;
  }
  function echo(text) { line(label.innerHTML + " " + esc(text), "echo"); }

  function switchLanguage(arg) {
    var target = (arg || "").toLowerCase();
    if (!target) target = langs.filter(function (l) { return l !== T.lang; })[0];
    if (!T.langs || !T.langs[target]) { line(t("langUsage")); return; }
    if (target === T.lang) { line("language: " + target); return; }
    line(t("switching", target));
    try { sessionStorage.setItem("konsole-boot", "1"); } catch (e) {}
    var a = document.querySelector('.langs a[data-lang="' + target + '"]');
    var url = a ? a.href : T.langs[target];
    setTimeout(function () { location.href = url; }, reduced ? 0 : 350);
  }

  function run(raw) {
    var cmdline = raw.trim();
    echo(cmdline);
    if (!cmdline) return scrollDown();
    history.push(cmdline); hIdx = history.length;

    var parts = cmdline.replace(/^\//, "").split(/\s+/);
    var name = parts[0].toLowerCase();
    name = aliases[name] || name;
    var arg = parts.slice(1).join(" ");

    switch (name) {
      case "clear": output.innerHTML = ""; document.getElementById("intro").hidden = true; return;
      case "language": switchLanguage(arg); break;
      case "imprint":
      case "privacy":
        var legal = document.querySelector('.legal a[data-legal="' + name + '"]');
        if (legal) { line(t("opening", name)); location.href = legal.href; }
        break;
      case "sudo": line(t("sudo")); break;
      case "exit": line(t("exit")); break;
      case "echo": line(esc(arg)); break;
      case "whois": showTemplate(/^(as)?210881$/i.test(arg) || !arg ? "asn" : "") || line("whois: " + esc(arg) + ": try <a href=\"#\" data-run=\"whois AS210881\">whois AS210881</a>"); break;
      case "ls": ls(parts.slice(1)); break;
      case "cat": cat(arg); break;
      case "cd": cd(arg); break;
      case "pwd": line("/home/" + esc(cwd.replace("~", "leo"))); break;
      case "open":
        var a = null, q = arg.toLowerCase();
        document.querySelectorAll("template").forEach(function (tpl) {
          tpl.content.querySelectorAll("[data-slug]").forEach(function (el) {
            if (!a && q && el.dataset.slug.toLowerCase() === q) a = el;
          });
        });
        if (a) { line(t("opening", esc(a.dataset.slug))); location.href = a.getAttribute("href"); }
        else line(t("openNotFound", esc(arg || "?")));
        break;
      default:
        if (!showTemplate(name)) line(t("notFound", esc(name)));
    }
    scrollDown();
  }

  // ---- Tab completion like bash: Tab completes, Tab Tab lists ----
  function commonPrefix(list) {
    if (!list.length) return "";
    var p = list[0];
    list.forEach(function (w) { while (w.indexOf(p) !== 0) p = p.slice(0, -1); });
    return p;
  }
  function complete() {
    var value = input.value;
    var slash = value.charAt(0) === "/" ? "/" : "";
    var body = value.slice(slash.length);
    var m = body.match(/^(\S*)(\s+)(\S*)$/);
    var head, word, candidates;

    if (!m && body.indexOf(" ") === -1) {            // completing the command itself
      head = slash; word = body;
      candidates = commandList();
    } else if (m) {                                  // completing the argument
      var cmd = aliases[m[1].toLowerCase()] || m[1].toLowerCase();
      head = slash + m[1] + m[2]; word = m[3];
      if (cmd === "open") candidates = slugs();
      else if (cmd === "language") candidates = langs;
      else if (cmd === "ls" || cmd === "cat" || cmd === "cd") {
        var dirPart = word.indexOf("/") > -1 ? word.slice(0, word.lastIndexOf("/") + 1) : "";
        var base = dirPart ? resolve(dirPart) : cwd;
        var list = entries(base) || [];
        if (cmd === "cd") list = list.filter(function (e) { return /\/$/.test(e); });
        candidates = list.map(function (e) { return dirPart + e; });
        if (cmd !== "cat" && base !== "~" && !dirPart) candidates.push("../");
      }
      else candidates = [];
    } else { return; }

    var hits = candidates.filter(function (c) { return c.indexOf(word.toLowerCase()) === 0; });
    if (!hits.length) return;
    if (hits.length === 1) { input.value = head + hits[0] + (/\/$/.test(hits[0]) ? "" : " "); lastWasTab = false; return; }

    var prefix = commonPrefix(hits);
    if (prefix.length > word.length) { input.value = head + prefix; lastWasTab = false; return; }
    if (lastWasTab) {                                // second Tab: list options
      echo(value);
      line(hits.join("   "), "dim");
      scrollDown();
    }
    lastWasTab = true;
  }

  function sync() { input.style.width = Math.max(1, input.value.length) + "ch"; }
  input.addEventListener("input", sync);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var v = input.value; input.value = ""; sync(); run(v);
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Tab") { e.preventDefault(); complete(); sync(); return; }
    lastWasTab = false;
    if (e.key === "ArrowUp" && hIdx > 0) { input.value = history[--hIdx]; e.preventDefault(); }
    else if (e.key === "ArrowDown") { hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ""; e.preventDefault(); }
    else if (e.ctrlKey && e.key === "l") { e.preventDefault(); output.innerHTML = ""; }
    else if (e.ctrlKey && e.key === "c") { e.preventDefault(); echo(input.value + "^C"); input.value = ""; scrollDown(); }
    else return;
    sync();
  });

  // Clickable commands
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-run]");
    if (a) { e.preventDefault(); run(a.dataset.run); input.focus({ preventScroll: true }); return; }
    if (!e.target.closest("a, button") && !getSelection().toString()) input.focus({ preventScroll: true });
  });

  // ---- Boot sequence (once per session) ----
  var intro = document.getElementById("intro");
  var boot = document.getElementById("boot");
  var seen = false;
  try { seen = sessionStorage.getItem("konsole-boot") === "1"; } catch (e) {}

  function ready() {
    boot.innerHTML = ""; boot.hidden = true;
    intro.hidden = false; form.hidden = false;
    input.focus({ preventScroll: true });
    try { sessionStorage.setItem("konsole-boot", "1"); } catch (e) {}
  }
  if (seen || reduced) return ready();

  intro.hidden = true;
  var steps = [(T.os || "TERM") + " BIOS v2.6  (c) 1987", "", t("boot1"), t("boot2"), t("boot3"), t("boot4"), t("boot5"), ""];
  var i = 0, timer;
  (function next() {
    if (i >= steps.length) { timer = setTimeout(ready, 250); return; }
    var p = document.createElement("p");
    p.textContent = steps[i++] || " ";
    boot.appendChild(p);
    timer = setTimeout(next, 90 + Math.random() * 140);
  })();
  function skip() { clearTimeout(timer); ready(); document.removeEventListener("keydown", skip); document.removeEventListener("pointerdown", skip); }
  document.addEventListener("keydown", skip);
  document.addEventListener("pointerdown", skip);
})();
