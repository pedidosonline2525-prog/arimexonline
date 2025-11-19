document.addEventListener("DOMContentLoaded", () => {
  const resumenEl = document.getElementById("resumen");
  const hiddenInput = document.getElementById("pedidoTexto");
  const form = document.getElementById("pedidoForm");
  const ccField = document.getElementById("ccEmail");

  const items = JSON.parse(localStorage.getItem("pedidoGlobal") || "[]");

  if (!items.length) {
    resumenEl.innerHTML = "<p>No hay productos seleccionados.</p>";
    return;
  }

  // Agrupar por marca
  const grupos = {};
  items.forEach(it => {
    if (!grupos[it.Marca]) grupos[it.Marca] = [];
    grupos[it.Marca].push(it);
  });

  resumenEl.innerHTML = "";
  let pedidoTexto = "";

  // === NUEVO FORMATO VISUAL ===
  for (const marca in grupos) {
    const bloque = document.createElement("div");
    bloque.className = "marca-bloque";
    bloque.innerHTML = `<h2>${marca}</h2>`;

    grupos[marca].forEach(it => {
      // 🎨 Coloración con detalle
      if (it.Familia === "Coloración" && Array.isArray(it.Detalle) && it.Detalle.length > 0) {
        const contenedorColor = document.createElement("div");
        contenedorColor.className = "coloracion-bloque";
        contenedorColor.innerHTML = `<h3>Coloración</h3>`;

        it.Detalle.forEach(d => {
          const fila = document.createElement("div");
          fila.className = "coloracion-linea";
          fila.innerHTML = `
            <span class="tono">${d.Tono}</span>
            <span class="cantidad">x${d.Cantidad}</span>
          `;
          contenedorColor.appendChild(fila);
          pedidoTexto += `${marca} - ${d.Tono} x ${d.Cantidad}\n`;
        });

        bloque.appendChild(contenedorColor);
      }

      // 🧴 Productos normales
      else {
        const prod = document.createElement("div");
        prod.className = "producto-linea";
        prod.innerHTML = `
          <span class="nombre">${it.Nombre}</span>
          <span class="cont">${it.Cont || ""}</span>
          <span class="cantidad">x${it.Cantidad}</span>
        `;
        bloque.appendChild(prod);
        pedidoTexto += `${marca} - ${it.Nombre} ${it.Cont || ""} x ${it.Cantidad}\n`;
      }
    });

    resumenEl.appendChild(bloque);
    pedidoTexto += "\n";
  }

  hiddenInput.value = pedidoTexto.trim();

  // Copia al cliente
  form.addEventListener("submit", e => {
    const emailCliente = document.getElementById("client_email").value.trim();
    if (emailCliente) ccField.value = emailCliente;
    setTimeout(() => localStorage.removeItem("pedidoGlobal"), 2000);
  });

  // Limpieza en cierre
  window.addEventListener("beforeunload", e => {
    if (!sessionStorage.getItem("navegandoInternamente")) {
      localStorage.removeItem("pedidoGlobal");
    }
    sessionStorage.removeItem("navegandoInternamente");
  });

  document.querySelectorAll("a, button").forEach(el => {
    el.addEventListener("click", () => {
      sessionStorage.setItem("navegandoInternamente", "true");
    });
  });
});

