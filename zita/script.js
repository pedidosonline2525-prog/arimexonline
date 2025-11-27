// =============================================
// CONTROL DE CIERRE DE PESTAÑA — NO MULTITAREA
// =============================================
(function () {
    function dbg(...a) { try { console.log("[NAV-MARCA]", ...a); } catch (e) {} }

    // Resetear navegación interna al cargar
    sessionStorage.removeItem("navegandoInternamente");

    // Detectar clicks en botones y links internos
    document.addEventListener("click", function (ev) {
        const a = ev.target.closest?.("a");
        const btn = ev.target.closest?.("button");

        if (a) {
            const target = a.getAttribute("target") || "";
            if (target !== "_blank") {
                dbg("click -> link interno");
                sessionStorage.setItem("navegandoInternamente", "true");
            }
        }

        if (btn) {
            dbg("click -> botón interno");
            sessionStorage.setItem("navegandoInternamente", "true");
        }
    }, { capture: true });

    // Cerrar pestaña: borrar pedido
    window.addEventListener("beforeunload", function () {
        const nav = sessionStorage.getItem("navegandoInternamente");

        if (nav === "true") {
            dbg("beforeunload: navegación interna → NO borro");
            return;
        }

        dbg("beforeunload: cierre real → BORRO pedidoGlobal");
        localStorage.removeItem("pedidoGlobal");
    });

    // Cada carga nueva = limpiar flag
    window.addEventListener("DOMContentLoaded", function () {
        sessionStorage.removeItem("navegandoInternamente");
    });
})();


// =============================================
// script.js — LÓGICA ORIGINAL (INTACTA Y PROBADA)
// =============================================

// Flags internos de trabajo
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

        products = json.map(r => ({
            Familia: r["Familia"] || r["FAMILIA"] || "",
            Nombre: r["Nombre"] || r["NOMBRE"] || "",
            Cont: r["Cont."] || r["CONT."] || ""
        }));

        products = products.filter(
            p => (p.Familia || "").toLowerCase() !== "coloración"
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
// 2) ARMAR LISTA DE PRODUCTOS
// =============================================
function renderProducts() {
    if (!productsContainer) return;

    const groups = {};
    products.forEach((p, i) => {
        const fam = p.Familia || "General";
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
                <span class="qty">
                    <input type="number" min="0" value="0" data-idx="${p._idx}">
                </span>
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
// 3) GUARDAR PEDIDO EN localStorage
// =============================================
function saveToGlobalOrder() {
    if (isRestoring) return;

    const brand = document.title.replace("Pedido ", "").trim().toUpperCase();
    const saved = JSON.parse(localStorage.getItem("pedidoGlobal") || "[]");

    const nuevos = [];
    document.querySelectorAll(".qty input").forEach(inp => {
        const cant = Number(inp.value) || 0;
        if (cant > 0) {
            const p = products[Number(inp.dataset.idx)];
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
        p => p.Marca === brand &&
             p.Familia === "Coloración" &&
             p.Nombre === "Coloración"
    );

    const otros = saved.filter(p => p.Marca !== brand);

    const prev = saved.filter(
        p => p.Marca === brand && p.Familia !== "Coloración"
    );

    let final;
    if (nuevos.length > 0) {
        final = [...otros, ...coloracionExistente, ...nuevos];
    } else {
        final = [...otros, ...coloracionExistente, ...prev];
    }

    localStorage.setItem("pedidoGlobal", JSON.stringify(final));
}

// =============================================
// 4) RESTAURAR CANTIDADES
// =============================================
function restoreQuantities() {
    isRestoring = true;
    userModifiedSinceRestore = false;

    const brand = document.title.replace("Pedido ", "").trim().toUpperCase();
    const saved = JSON.parse(localStorage.getItem("pedidoGlobal") || "[]");

    const productosGuardados = saved.filter(
        p => p.Marca === brand && p.Familia !== "Coloración"
    );

    document.querySelectorAll(".qty input").forEach(inp => {
        const p = products[Number(inp.dataset.idx)];
        const match = productosGuardados.find(
            g => g.Nombre === p.Nombre && g.Cont === p.Cont
        );
        inp.value = match ? match.Cantidad : 0;
    });

    setTimeout(() => {
        isRestoring = false;
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

document.addEventListener("DOMContentLoaded", updateCartCount);
