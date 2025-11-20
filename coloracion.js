// =============================================
//  coloracion.js — VERSIÓN FINAL ESTABLE
// =============================================

document.addEventListener("DOMContentLoaded", async () => {

    const contenedor = document.getElementById("tonos-container");
    const guardarBtn = document.getElementById("guardarColor");
    const cancelarBtn = document.getElementById("cancelarColor");

    if (!contenedor) return;
    contenedor.textContent = "Cargando tonos disponibles...";

    // ------------------------------------------
    // 1) Detectar marca desde URL o pedido previo
    // ------------------------------------------
    const params = new URLSearchParams(window.location.search);
    let marca = params.get("marca")?.toUpperCase() || "";

    if (!marca) {
        const pedidoPrev = JSON.parse(localStorage.getItem("pedidoGlobal") || "[]");
        if (pedidoPrev.length) marca = pedidoPrev[pedidoPrev.length - 1].Marca || "";
    }

    if (!marca) marca = "wella";

    const archivo = `/${marca}/coloracion.xlsx`;
    let tonos = [];

    // ------------------------------------------
    // 2) Cargar Excel de tonos
    // ------------------------------------------
    try {
        const res = await fetch(archivo, { cache: "no-store" });
        if (!res.ok) throw new Error("No existe archivo: " + archivo);

        const ab = await res.arrayBuffer();
        const workbook = XLSX.read(ab, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        tonos = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    } catch (err) {
        console.error("❌ Error cargando archivo de tonos:", err);
        contenedor.textContent = `⚠️ No se pudo cargar ${archivo}`;
        return;
    }

    // ------------------------------------------
    // 3) Renderizar interfaz
    // ------------------------------------------
    contenedor.innerHTML = "";

    // ------------------------------------------
// 3) Renderizar interfaz (agrupado por LÍNEA)
// ------------------------------------------
contenedor.innerHTML = "";

// Agrupar por "Linea"
const gruposPorLinea = {};
tonos.forEach(t => {
    const linea = (t.Linea || t.Descripcion || "SIN LÍNEA").trim();
    if (!gruposPorLinea[linea]) gruposPorLinea[linea] = [];
    gruposPorLinea[linea].push(t);
});

// Crear grupos colapsables
for (const linea in gruposPorLinea) {

    // 📌 Encabezado colapsable
    const header = document.createElement("div");
    header.className = "linea-header";
    header.textContent = linea;
    header.style.cssText = `
        font-weight: bold;
        font-size: 18px;
        margin: 12px 0 6px;
        cursor: pointer;
        padding: 6px;
        background: #f0f0f0;
        border-radius: 6px;
    `;

    // 📌 Contenedor interno (colapsable)
    const body = document.createElement("div");
    body.className = "linea-body";
    body.style.display = "none"; // comienza cerrado

    // Renderizar tonos dentro de la línea
    gruposPorLinea[linea].forEach((t, i) => {
        const nombre = (t.Tono || t.Nombre || t.Color || `Tono ${i + 1}`).trim();

        const row = document.createElement("div");
        row.className = "tono-item";
        row.style.cssText = `
            display: flex;
            align-items: center;
            margin: 4px 0;
        `;
        row.innerHTML = `
            <span style="flex:1">${nombre}</span>
            <input type="number" min="0" value="0"
                data-nombre="${nombre.replace(/"/g, '&quot;')}"
                style="width:80px;padding:6px;border:1px solid #ccc;border-radius:6px;text-align:center" />
        `;

        body.appendChild(row);
    });

    // Toggle colapsable
    header.addEventListener("click", () => {
        body.style.display = body.style.display === "none" ? "block" : "none";
    });

    // Añadir al contenedor principal
    contenedor.appendChild(header);
    contenedor.appendChild(body);
}


    // ------------------------------------------
    // 4) Restaurar tonos existentes
    // ------------------------------------------
    const pedidoPrevio = JSON.parse(localStorage.getItem("pedidoGlobal") || "[]");

    const colorPrev = pedidoPrevio.find(
        p => p.Marca === marca &&
        p.Familia === "Coloración" &&
        p.Nombre === "Coloración"
    );

    if (colorPrev && Array.isArray(colorPrev.Detalle)) {
        colorPrev.Detalle.forEach(d => {
            const inp = contenedor.querySelector(`input[data-nombre="${d.Tono}"]`);
            if (inp) inp.value = d.Cantidad;
        });
    }

    // ------------------------------------------
    // 5) Guardar coloración y volver
    // ------------------------------------------
    guardarBtn.addEventListener("click", () => {

        const inputs = contenedor.querySelectorAll("input[type='number']");
        const tonosSeleccionados = [];

        inputs.forEach(inp => {
            const cant = Number(inp.value) || 0;
            if (cant > 0) {
                tonosSeleccionados.push({
                    Tono: inp.dataset.nombre,
                    Cantidad: cant
                });
            }
        });

        if (tonosSeleccionados.length === 0) {
            alert("⚠️ No seleccionaste ningún tono.");
            return;
        }

        // ------------------------------------------
        // 6) Tomar pedido actual entero
        // ------------------------------------------
        const pedidoActual = JSON.parse(localStorage.getItem("pedidoGlobal") || "[]");

        // ------------------------------------------
        // ❗ 7) Filtrar solo la entrada EXACTA de coloración
        // NO BORRAR productos que contienen “COLOR”
        // ------------------------------------------
        const pedidoSinColoracion = pedidoActual.filter(
            p =>
                !(
                    p.Marca === marca &&
                    p.Familia === "Coloración" &&
                    p.Nombre === "Coloración"
                )
        );

        // ------------------------------------------
        // 8) Construir objeto de coloración actualizado
        // ------------------------------------------
        const coloracionObj = {
            Marca: marca,
            Familia: "Coloración",
            Nombre: "Coloración",
            Detalle: tonosSeleccionados,
            Cantidad: tonosSeleccionados.reduce((a, b) => a + b.Cantidad, 0)
        };

        // ------------------------------------------
        // 9) Guardar en localStorage
        // ------------------------------------------
        const final = [...pedidoSinColoracion, coloracionObj];
        localStorage.setItem("pedidoGlobal", JSON.stringify(final));

        console.log("💾 Coloración guardada correctamente:", final);

        // ------------------------------------------
        // 10) Volver al index de la marca
        // ------------------------------------------
        window.location.href = `./${marca}/index.html`;
    });

    // ------------------------------------------
    // 11) Cancelar sin guardar
    // ------------------------------------------
    cancelarBtn.addEventListener("click", () => {
        window.location.href = `./${marca}/index.html`;
    });
});
