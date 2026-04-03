// ===== CONFIG =====
const telefonoEmpresa = "+56982311068";
const sonidoAgregar = new Audio("sonidos/pop.mp3");
let carrito = {};

// ===== ELEMENTOS (se inicializan después) =====
let overlay;

// ===== CARGAR PRODUCTOS DESDE JSON =====
async function cargarProductos() {
    const res = await fetch("productos.json");
    const productos = await res.json();

    const contenedores = {
        torta: document.getElementById("contenedor-tortas"),
        tarta: document.getElementById("contenedor-tartas"),
        individual: document.getElementById("contenedor-individual"),
        mini: document.getElementById("contenedor-minis"), 
        pack: document.getElementById("contenedor-packs")
    };

    productos.forEach(prod => {
        const card = document.createElement("div");
        card.classList.add("card");

        const opciones = prod.precios.map((p, i) => {
            if (p.cantidad) {
                return `<option value="${i}">
                    ${p.cantidad} unidades - ${p.relleno ? p.relleno + " - " : ""}$${p.precio.toLocaleString()}
                </option>`;
            }
            else if (p.personas) {
                return `<option value="${i}">
                    ${p.personas} personas - $${p.precio.toLocaleString()}
                </option>`;
            }
            else {
                return `<option value="${i}">
                    $${p.precio.toLocaleString()}
                </option>`;
            }
        }).join("");

        card.innerHTML = `
            <img src="${prod.imagen}" class="product-img">
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

        const contenedor = contenedores[prod.categoria];
        if (contenedor) {
            contenedor.appendChild(card);
        }
    });
}

// ===== CARRUSEL =====
function scrollCarousel(id, direction) {
    const container = document.getElementById(id);
    const scrollAmount = container.offsetWidth;
    container.scrollLeft += direction * scrollAmount;
}

// ===== CARRITO =====
function consultarProducto(nombre) {
    window.open(`https://wa.me/${telefonoEmpresa}?text=Hola, quiero consultar por ${nombre}`, "_blank");
}

function agregarAlCarritoConPrecio(btn, nombre) {
    const card = btn.closest(".card");
    const select = card.querySelector(".selector-precio");

    const texto = select.options[select.selectedIndex].text;
    const precio = texto.split("$")[1];

    const key = `${nombre} - $${precio}`;

    carrito[key] = (carrito[key] || 0) + 1;

    sonidoAgregar.currentTime = 0;
    sonidoAgregar.play();

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

    lista.innerHTML = "";
    let total = 0;

    for (let p in carrito) {
        total += carrito[p];

        const li = document.createElement("li");
        li.innerHTML = `
            <span>${p} x${carrito[p]}</span>
            <div class="controles-item">
                <button class="btn-cant" onclick="cambiarCantidad('${p}',1)">+</button>
                <button class="btn-cant" onclick="cambiarCantidad('${p}',-1)">−</button>
                <button class="btn-eliminar-item" onclick="eliminarDelCarrito('${p}')">🗑</button>
            </div>
        `;
        lista.appendChild(li);
    }

    contador.textContent = total;
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
    
    // El overlay solo debe cerrar el carrito
    if(panel && panel.classList.contains("activo")) {
        panel.classList.remove("activo");
        if(overlay) overlay.classList.remove("activo");
    }
}

// ===== HORARIOS =====
function generarHorarios() {
    const select = document.getElementById("hora-entrega");
    if (!select) return;
    for (let h = 9; h < 22; h += 2) {
        let inicio = String(h).padStart(2,"0")+":00";
        let fin = String(h+2).padStart(2,"0")+":00";
        let op = document.createElement("option");
        op.value = `${inicio} - ${fin}`;
        op.textContent = `${inicio} - ${fin}`;
        select.appendChild(op);
    }
}

function configurarFechaMinima() {
    const input = document.getElementById("fecha-entrega");
    if (!input) return;
    const d = new Date();
    d.setDate(d.getDate() + 1); 
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

    let mensaje = "Hola, quiero realizar el siguiente pedido:\n\n";

    for (let producto in carrito) {
        mensaje += `• ${producto} x${carrito[producto]}\n`;
    }

    mensaje += `\nFecha de entrega: ${fecha}`;
    mensaje += `\nHora: ${hora}`;

    const url = `https://wa.me/${telefonoEmpresa}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, "_blank");
}

// ===== MENÚ (OPTIMIZADO) =====
function toggleMenu() {
    // Solo activamos la clase del menú. 
    // NO activamos el overlay para que no bloquee los clics.
    document.getElementById("nav-menu").classList.toggle("activo");
}

function cerrarMenu() {
    document.getElementById("nav-menu").classList.remove("activo");
}

// ===== INIT =====
window.onload = () => {
    overlay = document.querySelector(".overlay");

    generarHorarios();
    configurarFechaMinima();
    cargarProductos();

    if (overlay) {
        overlay.addEventListener("click", cerrarTodo);
    }

    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            cerrarMenu();
        });
    });
};