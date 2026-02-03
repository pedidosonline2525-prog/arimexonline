// =============================================
// 🚀 SISTEMA ANTI-BORRADO + BORRADO AL CERRAR 
// (adaptado para ARIMEX / multi-marca)
// =============================================

// 🔄 Control de navegación interna
(function () {

  function dbg(...a) { console.log("[NAV-CONTROL]", ...a); }

  // Registrar esta pestaña como activa
  sessionStorage.setItem("pedido_tab_activa", "1");

  // Cada click en <a> o <button> marca navegación interna
  document.addEventListener("click", function (ev) {
    const a = ev.target.closest?.("a");
    const btn = ev.target.closest?.("button");

    if (a) {
      const href = a.getAttribute("href") || "";
      const target = a.getAttribute("target") || "";

      if (href && target !== "_blank") {
        dbg("Click en link interno:", href);
        sessionStorage.setItem("navegandoInternamente", "true");
      }
      return;
    }

    if (btn) {
      dbg("Click en botón:", btn.innerText || btn.className);
      sessionStorage.setItem("navegandoInternamente", "true");
      return;
    }
  }, { capture: true });

  // beforeunload → borrar pedido SOLO si NO es navegación interna
  window.addEventListener("beforeunload", function () {
    const navegando = sessionStorage.getItem("navegandoInternamente");
    dbg("beforeunload → navegandoInternamente:", navegando);

    if (navegando === "true") {
      dbg("NO borro pedido (navegación interna)");
      return;
    }

    dbg("Borrando pedidoGlobal → pestaña cerrada o salida");
    localStorage.removeItem("pedidoGlobal");
  });

  // Nueva carga → eliminar marca
  window.addEventListener("DOMContentLoaded", function () {
    sessionStorage.removeItem("navegandoInternamente");
  });

})();


// =============================================
//  script.js — LÓGICA DE PRODUCTOS POR MARCA
// =============================================

// Flags
let isRestoring = true;
let userModifiedSinceRestore = false;

// Elementos
const productsContainer = document.getElementById("products");
const statusEl = document.getElementById("status");
let products = [];

// Helper
function log(...args) {
  console.log("[SCRIPT]", ...args);
}

// =============================================
// 1) Cargar productos desde productos.xlsx
// =============================================
fetch("productos.xlsx")
  .then(res => res.arrayBuffer())
  .then(ab => {
    const wb = XLSX.read(new Uint8Array(ab), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    products = json.map(r => ({
      Familia: r["Familia"] || r["FAMILIA"] || "",
      Nombre: r["Nombre"] || r["NOMBRE"] || "",
      Cont: r["Cont."] || r["CONT."] || ""
    }));

    products = products.filter(p =>
      (p.Familia || "").toLowerCase() !== "coloración"
    );

    renderProducts();
    restoreQuantities();
  })
  .catch(err => {
    log("❌ Error leyendo productos.xlsx:", err);
    if (statusEl) statusEl.textContent = "❌ Error al leer productos.xlsx.";
    isRestoring = false;
  });


// =============================================
// 2) Render de productos
// =============================================
function renderProducts() {
  if (!productsContainer) {
    log("No existe #products en el HTML");
    return;
  }

  const groups = {};
  products.forEach((p, i) => {
    const fam = p.Familia || "Sin familia";
    if (!groups[fam]) groups[fam] = [];
    groups[fam].push({ ...p, _idx: i });
  });

  productsContainer.innerHTML = "";

  for (const fam in groups) {
    const sec = document.createElement("section");
    sec.className = "group";
    sec.innerHTML = `<h2>${fam}</h2>`;

    groups[fam].forEach(p => {
      const div = document.createElement("div");
      div.className = "product";

      div.innerHTML = `
        <span class="name">${p.Nombre}</span>
        <span class="cont">${p.Cont}</span>
        <span class="qty"><input type="number" min="0" value="0" data-idx="${p._idx}"></span>
      `;

      sec.appendChild(div);
    });

    productsContainer.appendChild(sec);
  }

  document.querySelectorAll(".qty input").forEach(inp => {
    inp.addEventListener("input", () => {
      userModifiedSinceRestore = true;
      if (!isRestoring) {
        saveToGlobalOrder();
        updateCartCount();
      }
    });

    inp.addEventListener("blur", () => {
      if (userModifiedSinceRestore) {
        saveToGlobalOrder();
        updateCartCount();
        userModifiedSinceRestore = false;
      }
    });
  });
}


// =============================================
// 3) Guardar pedido (por marca)
// =============================================
function saveToGlobalOrder() {
  if (isRestoring) return;

  const brand = document.title.replace("Pedido ", "").trim().toUpperCase();
  const saved = JSON.parse(localStorage.getItem("pedidoGlobal") || "[]");

  const nuevos = [];
  document.querySelectorAll(".qty input").forEach(inp => {
    const cant = Number(inp.value) || 0;
    if (cant > 0) {
      const p = products[inp.dataset.idx];
      nuevos.push({
        Marca: brand,
        Familia: p.Familia,
        Nombre: p.Nombre,
        Cont: p.Cont,
        Cantidad: cant
      });
    }
  });

  const coloracionExistente = saved.filter(
    p => p.Marca === brand && p.Familia === "Coloración"
  );

  const otrasMarcas = saved.filter(p => p.Marca !== brand);
  const prev = saved.filter(p => p.Marca === brand && p.Familia !== "Coloración");

  let final = nuevos.length
    ? [...otrasMarcas, ...coloracionExistente, ...nuevos]
    : [...otrasMarcas, ...coloracionExistente, ...prev];

  localStorage.setItem("pedidoGlobal", JSON.stringify(final));
}


// =============================================
// 4) Restaurar cantidades
// =============================================
function restoreQuantities() {
  isRestoring = true;

  const brand = document.title.replace("Pedido ", "").trim().toUpperCase();
  const saved = JSON.parse(localStorage.getItem("pedidoGlobal") || "[]");

  const guardados = saved.filter(
    g => g.Marca === brand && g.Familia !== "Coloración"
  );

  document.querySelectorAll(".qty input").forEach(inp => {
    const p = products[inp.dataset.idx];
    const match = guardados.find(g => g.Nombre === p.Nombre && g.Cont === p.Cont);
    inp.value = match ? match.Cantidad : 0;
  });

  setTimeout(() => (isRestoring = false), 30);
}


// =============================================
// 5) Contador global
// =============================================
function updateCartCount() {
  const items = JSON.parse(localStorage.getItem("pedidoGlobal") || "[]");
  let total = 0;

  items.forEach(it => {
    if (it.Familia === "Coloración" && Array.isArray(it.Detalle)) {
      total += it.Detalle.reduce((s, d) => s + Number(d.Cantidad || 0), 0);
    } else {
      total += Number(it.Cantidad || 0);
    }
  });

  const badge = document.getElementById("cart-count");
  if (badge) badge.textContent = total;
}

document.addEventListener("DOMContentLoaded", updateCartCount);
