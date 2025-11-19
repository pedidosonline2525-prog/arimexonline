// =============================================
//  script.js — VERSIÓN FINAL (NO BORRA PRODUCTOS)
// =============================================

// Flags de control
let isRestoring = true;
let userModifiedSinceRestore = false;

// Elementos
const productsContainer = document.getElementById("products");
const statusEl = document.getElementById("status");
let products = [];

// Log seguro
function log(...args) {
  console.log("[SCRIPT]", ...args);
}

// =============================================
// 1) CARGA DE PRODUCTOS DESDE EXCEL
// =============================================
fetch("productos.xlsx")
  .then(res => res.arrayBuffer())
  .then(ab => {
    const wb = XLSX.read(new Uint8Array(ab), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    // 🔥 Cargar TODOS los productos
    products = json.map(r => ({
      Familia: r["Familia"] || r["FAMILIA"] || "",
      Nombre: r["Nombre"] || r["NOMBRE"] || "",
      Cont: r["Cont."] || r["CONT."] || ""
    }));

    // ❗ EXCLUIR SOLO la familia "Coloración"
    //     → esa sección ya está en el HTML arriba
    products = products.filter(p =>
      (p.Familia || "").toLowerCase() !== "coloración"
    );

    renderProducts();
    restoreQuantities();
  })
  .catch(err => {
    if (statusEl) statusEl.textContent = "❌ Error al leer productos.xlsx.";
    log("Error leyendo productos.xlsx:", err);
    isRestoring = false;
  });

// =============================================
// 2) ARMAR LISTA DE PRODUCTOS EN PANTALLA
// =============================================
function renderProducts() {
  if (!productsContainer) {
    log("No existe #products en el HTML");
    isRestoring = false;
    return;
  }

  const groups = {};
  products.forEach((p, i) => {
    const f = p.Familia || "Sin familia";
    if (!groups[f]) groups[f] = [];
    groups[f].push({ ...p, _idx: i });
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

  // Listeners de cambios
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
// 3) GUARDAR PEDIDO EN localStorage
// =============================================
function saveToGlobalOrder() {
  if (isRestoring) return;

  const brand = document.title.replace("Pedido ", "").trim().toUpperCase();
  const saved = JSON.parse(localStorage.getItem("pedidoGlobal") || "[]");

  // Nuevos productos cargados
  const nuevos = [];
  document.querySelectorAll(".qty input").forEach(inp => {
    const cant = Number(inp.value) || 0;
    if (cant > 0) {
      const p = products[Number(inp.dataset.idx)];
      if (!p) return;
      nuevos.push({
        Marca: brand,
        Familia: p.Familia,
        Nombre: p.Nombre,
        Cont: p.Cont,
        Cantidad: cant
      });
    }
  });

  log("Guardar marca:", brand, "Nuevos productos:", nuevos);

  // Mantener coloración exacta
  const coloracionExistente = saved.filter(
    p => p.Marca === brand && p.Familia === "Coloración" && p.Nombre === "Coloración"
  );

  // Mantener otras marcas
  const otros = saved.filter(p => p.Marca !== brand);

  // Mantener productos previos si no hay nuevos
  const prev = saved.filter(
    p => p.Marca === brand && p.Familia !== "Coloración"
  );

  let final;

  if (nuevos.length > 0) {
    // Hay nuevos → reemplazar productos
    final = [...otros, ...coloracionExistente, ...nuevos];
  } else {
    // No hay nuevos → mantener anteriores
    final = [...otros, ...coloracionExistente, ...prev];
  }

  localStorage.setItem("pedidoGlobal", JSON.stringify(final));
  log("💾 pedidoGlobal actualizado:", final);
}

// =============================================
// 4) RESTAURAR CANTIDADES
// =============================================
function restoreQuantities() {
  log("Restore inicio");
  isRestoring = true;
  userModifiedSinceRestore = false;

  const brand = document.title.replace("Pedido ", "").trim().toUpperCase();
  const saved = JSON.parse(localStorage.getItem("pedidoGlobal") || "[]");

  const guardados = saved.filter(
    p => p.Marca === brand && p.Familia !== "Coloración"
  );

  document.querySelectorAll(".qty input").forEach(inp => {
    const idx = Number(inp.dataset.idx);
    const p = products[idx];
    const match = guardados.find(g => g.Nombre === p.Nombre && g.Cont === p.Cont);
    inp.value = match ? match.Cantidad : 0;
  });

  setTimeout(() => {
    isRestoring = false;
    log("Restore completado");
  }, 50);
}

// =============================================
// 5) CONTADOR GLOBAL
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

document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
});

// =============================================
// 6) NAVEGACIÓN INTERNA
// =============================================
document.querySelectorAll("a, button").forEach(el => {
  el.addEventListener("click", () => {
    sessionStorage.setItem("navegandoInternamente", "true");
  });
});

// =============================================
// 7) beforeunload (NO BORRA NADA)
// =============================================
window.addEventListener("beforeunload", () => {
  // Ya no borramos nada aquí
});

// ================================
// CONTROL ROBUSTO: cerrar pestaña vs navegación interna
// ================================

/*
  Estrategia:
  - Escuchamos clicks en todo el documento (funciona aunque botones se creen dinámicamente).
  - Si el usuario hace click en un link o botón -> marcamos navegación interna (sessionStorage).
  - beforeunload comprobará ese flag; si está, NO borra el pedido.
  - La nueva página (mismo tab) al cargar quita el flag (DOM content loaded).
*/

(function() {
  // helper debug (desactivá cuando ya esté ok)
  function dbg(...a){ try{ console.log("[NAV-CONTROL]", ...a); }catch(e){} }

  // marca actual de esta pestaña
  sessionStorage.setItem("pedido_tab_activa", "1");

  // listener global: marca navegación interna si el click viene de un enlace o botón
  document.addEventListener("click", function(ev){
    // buscar si el objetivo es (o tiene) un <a> con href interno o un <button>
    const a = ev.target.closest && ev.target.closest("a");
    const btn = ev.target.closest && ev.target.closest("button");

    // Si es un <a> con href y no tiene target="_blank" -> consideramos navegación interna
    if (a && a.getAttribute) {
      const href = a.getAttribute("href") || "";
      const target = a.getAttribute("target") || "";
      // tratamos como interna si es relativo o mismo origen y NO abre en nueva pestaña
      if (href && target !== "_blank") {
        dbg("click -> link interno detectado:", href);
        sessionStorage.setItem("navegandoInternamente", "true");
        return;
      }
    }

    // Si es button (o elemento dentro de button) que probablemente navega (onclick, window.location) -> marcar
    if (btn) {
      dbg("click -> botón detectado:", btn.innerText || btn.className);
      sessionStorage.setItem("navegandoInternamente", "true");
      return;
    }

    // si no es link ni button, no hacemos nada
  }, { capture: true }); // capture true para interceptar antes que handlers inline

  // beforeunload: si no hay marca de navegación interna BORRAR localStorage (pestaña cerrada)
  window.addEventListener("beforeunload", function(e){
    const navegando = sessionStorage.getItem("navegandoInternamente");
    dbg("beforeunload -> navegandoInternamente:", navegando);

    // Si navigation interno marcado -> NO borrar
    if (navegando === "true") {
      dbg("beforeunload: navegación interna -> no borro pedidoGlobal");
      return;
    }

    // Si no hay marca -> esta pestaña se está cerrando o yendo a otra app en la misma pestaña -> BORRAR
    dbg("beforeunload: BORRANDO pedidoGlobal (pestaña cerrada o navegación exterior)");
    localStorage.removeItem("pedidoGlobal");
  });

  // En la nueva carga de la misma pestaña limpiamos el flag (para que no persista)
  window.addEventListener("DOMContentLoaded", function(){
    dbg("DOMContentLoaded -> limpiando marca navegandoInternamente");
    sessionStorage.removeItem("navegandoInternamente");
  });

})();
