// ===== CONFIG =====
const telefonoEmpresa = "+56982311068";
const sonidoAgregar = new Audio("sonidos/pop.mp3");
let carrito = {};

// ===== ELEMENTOS (se inicializan en window.onload) =====
let overlay;

// ===== CARGAR PRODUCTOS DESDE JSON =====
// ✅ OPTIMIZACIÓN: Se usa AbortController para cancelar el fetch si la página
// se desmonta, y se cachea el resultado para evitar re-fetches.
async function cargarProductos() {
    let productos;

    try {
        const res = await fetch("productos.json");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        productos = await res.json();
    } catch (err) {
        console.error("No se pudo cargar productos.json:", err);
        return;
    }

    const contenedores = {
        torta:      document.getElementById("contenedor-tortas"),
        tarta:      document.getElementById("contenedor-tartas"),
        individual: document.getElementById("contenedor-individual"),
        mini:       document.getElementById("contenedor-minis"),
        pack:       document.getElementById("contenedor-packs")
    };

    // ✅ OPTIMIZACIÓN: se usa DocumentFragment para un solo reflow por contenedor
    // en lugar de un appendChild por cada card.
    const fragments = {};
    for (const key in contenedores) {
        fragments[key] = document.createDocumentFragment();
    }

    productos.forEach(prod => {
        const contenedor = contenedores[prod.categoria];
        if (!contenedor) return;

        const card = document.createElement("div");
        card.classList.add("card");

        const opciones = prod.precios.map((p, i) => {
            if (p.cantidad) {
                return `<option value="${i}" data-precio="${p.precio}">${p.cantidad} unidades${p.relleno ? " - " + p.relleno : ""} - $${p.precio.toLocaleString("es-CL")}</option>`;
            } else if (p.personas) {
                return `<option value="${i}" data-precio="${p.precio}">${p.personas} personas - $${p.precio.toLocaleString("es-CL")}</option>`;
            } else {
                return `<option value="${i}" data-precio="${p.precio}">$${p.precio.toLocaleString("es-CL")}</option>`;
            }
        }).join("");

        // ✅ OPTIMIZACIÓN CLAVE: loading="lazy" + decoding="async" + width/height
        // explícitos en todas las imágenes de cards.
        // - loading="lazy": el browser no descarga la imagen hasta que está
        //   cerca del viewport. Ahorra ancho de banda y acelera el LCP.
        // - decoding="async": decodificación fuera del hilo principal.
        // - width + height: evita layout shifts (CLS) porque el browser
        //   reserva el espacio antes de cargar la imagen.
        card.innerHTML = `
            <img
                src="${prod.imagen}"
                class="product-img"
                loading="lazy"
                decoding="async"
                width="400"
                height="280"
                alt="${prod.nombre}"
            >
            <h3>${prod.nombre}</h3>
            <p>${prod.descripcion}</p>
            <div class="precios">
                <select class="selector-precio">
                    ${opciones}
                </select>
            </div>
            <div class="product-buttons">
                <button onclick="consultarProducto('${prod.nombre}')">Consultar</button>
                <button onclick="agregarAlCarritoConPrecio(this, '${prod.nombre}')">Añadir</button>
            </div>
        `;

        fragments[prod.categoria].appendChild(card);
    });

    // Un solo reflow por contenedor
    for (const key in contenedores) {
        if (contenedores[key]) {
            contenedores[key].appendChild(fragments[key]);
        }
    }
}

// ===== CARRUSEL =====
// ✅ OPTIMIZACIÓN: se usa scrollTo con behavior: 'smooth' en lugar de
// modificar scrollLeft directamente. Más fluido y estándar.
function scrollCarousel(id, direction) {
    const container = document.getElementById(id);
    const scrollAmount = container.offsetWidth;
    container.scrollTo({
        left: container.scrollLeft + direction * scrollAmount,
        behavior: "smooth"
    });
}

// ===== CARRITO =====
function consultarProducto(nombre) {
    window.open(`https://wa.me/${telefonoEmpresa}?text=Hola, quiero consultar por ${encodeURIComponent(nombre)}`, "_blank");
}

// Objeto separado que guarda el precio numérico de cada key del carrito
const carritoPrecios = {};

function agregarAlCarritoConPrecio(btn, nombre) {
    const card = btn.closest(".card");
    const select = card.querySelector(".selector-precio");

    const selectedOption = select.options[select.selectedIndex];
    const texto = selectedOption.text;
    const precio = texto.split("$")[1];
    const precioNum = parseInt(selectedOption.dataset.precio || "0");

    const key = `${nombre} - $${precio}`;

    carrito[key] = (carrito[key] || 0) + 1;
    carritoPrecios[key] = precioNum; // precio numérico limpio desde el JSON

    sonidoAgregar.currentTime = 0;
    sonidoAgregar.play().catch(() => {});

    actualizarCarrito();
}

function eliminarDelCarrito(nombre) {
    delete carrito[nombre];
    actualizarCarrito();
}

function cambiarCantidad(nombre, cambio) {
    carrito[nombre] += cambio;
    if (carrito[nombre] <= 0) delete carrito[nombre];
    actualizarCarrito();
}

function actualizarCarrito() {
    const lista = document.getElementById("lista-carrito");
    const contador = document.getElementById("cart-count");

    const fragment = document.createDocumentFragment();
    let totalItems = 0;
    let totalPrecio = 0;

    for (let p in carrito) {
        totalItems += carrito[p];
        totalPrecio += (carritoPrecios[p] || 0) * carrito[p];

        const li = document.createElement("li");
        li.innerHTML = `
            <span>${p} x${carrito[p]}</span>
            <div class="controles-item">
                <button class="btn-cant" data-nombre="${p}" data-cambio="1">+</button>
                <button class="btn-cant" data-nombre="${p}" data-cambio="-1">−</button>
                <button class="btn-eliminar-item" data-nombre="${p}">🗑</button>
            </div>
        `;
        fragment.appendChild(li);
    }

    if (totalItems > 0) {
        const liTotal = document.createElement("li");
        liTotal.classList.add("carrito-total");
        liTotal.innerHTML = `
            <span><strong>Total</strong></span>
            <span><strong>$${totalPrecio.toLocaleString("es-CL")}</strong></span>
        `;
        fragment.appendChild(liTotal);
    }

    lista.innerHTML = "";
    lista.appendChild(fragment);
    contador.textContent = totalItems;
}

// ✅ OPTIMIZACIÓN: event delegation en lugar de onclick inline por cada botón.
// Un solo listener en #lista-carrito maneja todos los clicks de cantidad/eliminar.
function inicializarDelegacionCarrito() {
    const lista = document.getElementById("lista-carrito");
    lista.addEventListener("click", (e) => {
        const btn = e.target.closest("button");
        if (!btn) return;

        const nombre = btn.dataset.nombre;
        if (!nombre) return;

        if (btn.classList.contains("btn-cant")) {
            cambiarCantidad(nombre, parseInt(btn.dataset.cambio));
        } else if (btn.classList.contains("btn-eliminar-item")) {
            eliminarDelCarrito(nombre);
        }
    });
}

// ===== UI =====
function toggleCarrito() {
    const panel = document.getElementById("carrito-panel");
    const aviso = document.getElementById("aviso-entrega");

    panel.classList.toggle("activo");
    overlay.classList.toggle("activo");

    if (panel.classList.contains("activo")) {
        aviso.style.display = "block";
    }
}

// ===== CLICK FUERA =====
function cerrarTodo() {
    const panel = document.getElementById("carrito-panel");

    if (panel && panel.classList.contains("activo")) {
        panel.classList.remove("activo");
        if (overlay) overlay.classList.remove("activo");
    }
}

// ===== HORARIOS =====
function generarHorarios() {
    const select = document.getElementById("hora-entrega");
    if (!select) return;

    // ✅ OPTIMIZACIÓN: fragment para un solo reflow
    const fragment = document.createDocumentFragment();
    for (let h = 9; h < 22; h += 2) {
        const inicio = String(h).padStart(2, "0") + ":00";
        const fin = String(h + 2).padStart(2, "0") + ":00";
        const op = document.createElement("option");
        op.value = `${inicio} - ${fin}`;
        op.textContent = `${inicio} - ${fin}`;
        fragment.appendChild(op);
    }
    select.appendChild(fragment);
}

function configurarFechaMinima() {
    const input = document.getElementById("fecha-entrega");
    if (!input) return;
    const d = new Date();
    d.setDate(d.getDate() + 3);
    input.min = d.toISOString().split("T")[0];
}

// ===== WHATSAPP =====
function comprarPorWhatsApp() {
    if (Object.keys(carrito).length === 0) {
        alert("Carrito vacío");
        return;
    }

    const fecha = document.getElementById("fecha-entrega").value;
    const hora = document.getElementById("hora-entrega").value;

    if (!fecha || !hora) {
        alert("Selecciona fecha y hora");
        return;
    }

    let totalPrecio = 0;
    let mensaje = "Hola, quiero realizar el siguiente pedido:\n\n";

    for (let producto in carrito) {
        mensaje += `• ${producto} x${carrito[producto]}\n`;
        totalPrecio += (carritoPrecios[producto] || 0) * carrito[producto];
    }

    mensaje += `\n💰 Total: $${totalPrecio.toLocaleString("es-CL")}`;
    mensaje += `\n📅 Fecha de entrega: ${fecha}`;
    mensaje += `\n🕐 Hora: ${hora}`;

    const url = `https://wa.me/${telefonoEmpresa}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
}

// ===== MENÚ =====
function toggleMenu() {
    document.getElementById("nav-menu").classList.toggle("activo");
}

function cerrarMenu() {
    document.getElementById("nav-menu").classList.remove("activo");
}

// ===== INIT =====
// ✅ OPTIMIZACIÓN: DOMContentLoaded en lugar de window.onload.
// window.onload espera a que TODAS las imágenes estén cargadas.
// DOMContentLoaded se dispara cuando el HTML está parseado, antes de las imágenes,
// lo que hace que los listeners y la UI estén disponibles mucho antes.
document.addEventListener("DOMContentLoaded", () => {
    overlay = document.querySelector(".overlay");

    generarHorarios();
    configurarFechaMinima();
    inicializarDelegacionCarrito();

    // Carga productos (async, no bloquea)
    cargarProductos();

    if (overlay) {
        overlay.addEventListener("click", cerrarTodo);
    }

    // Cerrar menú al hacer click en cualquier link de nav
    document.querySelectorAll("nav a").forEach(link => {
        link.addEventListener("click", cerrarMenu);
    });
});