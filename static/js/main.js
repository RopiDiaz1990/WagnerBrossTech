let carrito = [];
let productos = [];

// Cargar productos al iniciar
document.addEventListener('DOMContentLoaded', async function() {
    // Verificar que los elementos necesarios existan
    const buscador = document.getElementById('buscadorProductos');
    const sugerencias = document.getElementById('sugerencias');
    const cardBody = document.querySelector('.card-body');

    if (!buscador || !sugerencias || !cardBody) {
        console.error('No se encontraron elementos necesarios en el DOM');
        return;
    }

    try {
        const response = await fetch('/api/productos');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        productos = await response.json();
        
        // Configurar buscador
        buscador.addEventListener('input', filtrarProductos);
        
        // Cerrar sugerencias al hacer clic fuera
        document.addEventListener('click', function(e) {
            if (!buscador.contains(e.target) && !sugerencias.contains(e.target)) {
                sugerencias.style.display = 'none';
            }
        });

    } catch (error) {
        console.error('Error al cargar productos:', error);
        const errorMessage = document.createElement('div');
        errorMessage.className = 'alert alert-danger mt-3';
        errorMessage.innerHTML = `
            <strong>Error al cargar los productos</strong>
            <p>Por favor, verifica que el servidor esté funcionando correctamente.</p>
            <button class="btn btn-outline-danger btn-sm" onclick="window.location.reload()">
                Reintentar
            </button>
        `;
        cardBody.appendChild(errorMessage);
    }
});

// Función para filtrar productos
function filtrarProductos() {
    const buscador = document.getElementById('buscadorProductos');
    const sugerencias = document.getElementById('sugerencias');
    
    if (!buscador || !sugerencias) return;
    
    const busqueda = buscador.value.toLowerCase();
    
    if (busqueda.length === 0) {
        sugerencias.style.display = 'none';
        return;
    }
    
    // Filtrar productos que coincidan con la búsqueda
    const productosFiltrados = productos.filter(producto => 
        producto.nombre.toLowerCase().includes(busqueda)
    );
    
    // Mostrar sugerencias
    sugerencias.innerHTML = '';
    productosFiltrados.forEach(producto => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action';
        item.innerHTML = `
            <div class="d-flex align-items-center">
                ${producto.imagen ? 
                    `<img src="/static/uploads/${producto.imagen}" alt="${producto.nombre}" class="img-thumbnail me-2" style="max-width: 30px;">` :
                    `<i class="bi bi-image text-muted me-2"></i>`
                }
                <div>
                    <div>${producto.nombre}</div>
                    <small class="text-muted">
                        Stock: ${producto.stock} | 
                        Efectivo: $${producto.precio_efectivo.toFixed(2)} | 
                        Tarjeta: $${producto.precio_tarjeta.toFixed(2)}
                    </small>
                </div>
            </div>
        `;
        
        // Agregar evento click para seleccionar el producto
        item.addEventListener('click', (e) => {
            e.preventDefault();
            agregarAlCarrito(producto);
            buscador.value = '';
            sugerencias.style.display = 'none';
        });

        // Agregar evento click derecho para ver imagen
        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (producto.imagen) {
                const modal = new bootstrap.Modal(document.getElementById('modalImagen'));
                document.getElementById('imagenModal').src = `/static/uploads/${producto.imagen}`;
                modal.show();
            }
        });
        
        sugerencias.appendChild(item);
    });
    
    sugerencias.style.display = productosFiltrados.length > 0 ? 'block' : 'none';
}

// Función para agregar al carrito
function agregarAlCarrito(producto) {
    const cantidad = 1; // Cantidad fija de 1
    
    if (cantidad > producto.stock) {
        alert('No hay suficiente stock');
        return;
    }
    
    const formaPago = document.querySelector('input[name="formaPago"]:checked').value;
    const precio = formaPago === 'efectivo' ? producto.precio_efectivo : producto.precio_tarjeta;
    
    // Verificar si el producto ya está en el carrito
    const index = carrito.findIndex(item => item.id === producto.id);
    if (index !== -1) {
        // Si ya existe, actualizar cantidad
        carrito[index].cantidad += cantidad;
        carrito[index].precio = precio;
    } else {
        // Si no existe, agregar nuevo item
        carrito.push({
            id: producto.id,
            nombre: producto.nombre,
            cantidad: cantidad,
            precio: precio,
            observaciones: producto.observaciones || ''
        });
    }
    
    actualizarCarrito();
}

// Función para actualizar el carrito
function actualizarCarrito() {
    const tbody = document.getElementById('carrito-body');
    tbody.innerHTML = '';
    let total = 0;
    
    carrito.forEach((item, index) => {
        const tr = document.createElement('tr');
        const subtotal = item.cantidad * item.precio;
        total += subtotal;
        
        // Buscar el producto completo para obtener la imagen
        const producto = productos.find(p => p.id === item.id);
        
        tr.innerHTML = `
            <td>
                <div class="d-flex align-items-center">
                    ${producto && producto.imagen ? 
                        `<img src="/static/uploads/${producto.imagen}" alt="${item.nombre}" class="img-thumbnail me-2" style="max-width: 30px; cursor: pointer;" 
                             oncontextmenu="event.preventDefault(); mostrarImagenProducto('${producto.imagen}', '${item.nombre}')">` :
                        `<i class="bi bi-image text-muted me-2"></i>`
                    }
                    <span>${item.nombre}</span>
                </div>
            </td>
            <td>
                <div class="input-group input-group-sm">
                    <button class="btn btn-outline-secondary" type="button" onclick="actualizarCantidad(${index}, -1)">-</button>
                    <input type="number" class="form-control text-center" value="${item.cantidad}" min="1" onchange="actualizarCantidad(${index}, this.value - item.cantidad)">
                    <button class="btn btn-outline-secondary" type="button" onclick="actualizarCantidad(${index}, 1)">+</button>
                </div>
            </td>
            <td>$${item.precio.toFixed(2)}</td>
            <td>$${subtotal.toFixed(2)}</td>
            <td>${item.observaciones || '-'}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="eliminarDelCarrito(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
    
    document.getElementById('total-carrito').textContent = `$${total.toFixed(2)}`;
}

// Función para actualizar cantidad
function actualizarCantidad(index, cambio) {
    const item = carrito[index];
    if (!item) return;
    
    const nuevaCantidad = item.cantidad + cambio;
    if (nuevaCantidad > 0) {
        item.cantidad = nuevaCantidad;
        actualizarCarrito();
    } else if (nuevaCantidad === 0) {
        eliminarDelCarrito(index);
    }
}

// Función para eliminar del carrito
function eliminarDelCarrito(index) {
    carrito.splice(index, 1);
    actualizarCarrito();
}

// Función para actualizar precios según forma de pago
function actualizarPrecios() {
    const formaPago = document.querySelector('input[name="formaPago"]:checked').value;
    carrito.forEach(item => {
        const producto = productos.find(p => p.id === item.id);
        if (producto) {
            item.precio = formaPago === 'efectivo' ? producto.precio_efectivo : producto.precio_tarjeta;
        }
    });
    actualizarCarrito();
}

// Función para finalizar venta
async function finalizarVenta() {
    if (carrito.length === 0) {
        alert('El carrito está vacío');
        return;
    }

    // Validar datos del cliente
    const nombre = document.getElementById('clienteNombre').value.trim();
    const apellido = document.getElementById('clienteApellido').value.trim();
    const celular = document.getElementById('clienteCelular').value.trim();
    const email = document.getElementById('clienteEmail').value.trim();

    if (!nombre || !apellido) {
        alert('Por favor, complete al menos el nombre y apellido del cliente');
        return;
    }
    
    const formaPago = document.querySelector('input[name="formaPago"]:checked').value;
    
    try {
        const response = await fetch('/api/ventas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                forma_pago: formaPago,
                cliente: {
                    nombre,
                    apellido,
                    celular,
                    email
                },
                productos: carrito.map(item => ({
                    id: item.id,
                    cantidad: item.cantidad
                }))
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (data.error) {
                if (data.productos_no_encontrados) {
                    throw new Error(`Productos no encontrados: ${data.productos_no_encontrados.join(', ')}`);
                } else if (data.productos_sin_stock) {
                    const mensaje = data.productos_sin_stock.map(p => 
                        `${p.nombre}: Stock disponible ${p.stock_disponible}, Solicitado ${p.cantidad_solicitada}`
                    ).join('\n');
                    throw new Error(`Stock insuficiente:\n${mensaje}`);
                } else {
                    throw new Error(data.error);
                }
            } else {
                throw new Error('Error al procesar la venta');
            }
        }
        
        // Mostrar modal de confirmación de impresión
        const modalConfirmar = new bootstrap.Modal(document.getElementById('modalConfirmarImpresion'));
        modalConfirmar.show();
        
        // Limpiar carrito
        carrito = [];
        actualizarCarrito();
        
        // Recargar productos para actualizar stock
        const responseProductos = await fetch('/api/productos');
        productos = await responseProductos.json();
        
    } catch (error) {
        console.error('Error:', error);
        alert(error.message);
    }
}

// Función para mostrar mensaje de éxito
function mostrarMensajeExito() {
    const modalExito = new bootstrap.Modal(document.getElementById('modalExito'));
    modalExito.show();
    carrito = [];
    actualizarCarrito();
    
    // Limpiar campos del cliente
    document.getElementById('clienteNombre').value = '';
    document.getElementById('clienteApellido').value = '';
    document.getElementById('clienteCelular').value = '';
    document.getElementById('clienteEmail').value = '';
}

// Función para mostrar el remito
function mostrarRemito() {
    // Cerrar el modal de confirmación
    const modalConfirmar = bootstrap.Modal.getInstance(document.getElementById('modalConfirmarImpresion'));
    modalConfirmar.hide();
    
    // Obtener datos del cliente
    const nombre = document.getElementById('clienteNombre').value.trim();
    const apellido = document.getElementById('clienteApellido').value.trim();
    const celular = document.getElementById('clienteCelular').value.trim();
    const email = document.getElementById('clienteEmail').value.trim();
    
    // Actualizar fecha
    const fecha = new Date().toLocaleString();
    document.getElementById('fechaRemito').textContent = fecha;
    
    // Actualizar datos del cliente en el remito
    document.getElementById('remitoClienteNombre').textContent = nombre;
    document.getElementById('remitoClienteApellido').textContent = apellido;
    document.getElementById('remitoClienteCelular').textContent = celular || 'No especificado';
    document.getElementById('remitoClienteEmail').textContent = email || 'No especificado';
    
    // Actualizar detalles
    const tbody = document.getElementById('remitoDetalles');
    tbody.innerHTML = '';
    let total = 0;
    
    carrito.forEach(item => {
        const producto = productos.find(p => p.id === item.id);
        if (!producto) return;
        
        const subtotal = item.cantidad * item.precio;
        total += subtotal;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td>$${item.precio.toFixed(2)}</td>
            <td>$${subtotal.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('remitoTotal').textContent = `$${total.toFixed(2)}`;
    
    // Mostrar modal del remito
    const modalRemito = new bootstrap.Modal(document.getElementById('modalRemito'));
    modalRemito.show();
}

// Función para imprimir el remito
function imprimirRemito() {
    const contenido = document.getElementById('remitoContenido').innerHTML;
    const ventana = window.open('', 'PRINT', 'height=600,width=800');
    
    ventana.document.write('<html><head><title>Comprobante de Venta</title>');
    ventana.document.write('<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">');
    ventana.document.write('</head><body>');
    ventana.document.write(contenido);
    ventana.document.write('</body></html>');
    
    ventana.document.close();
    ventana.focus();
    
    // Esperar a que se carguen los estilos
    setTimeout(() => {
        ventana.print();
        ventana.close();
        carrito = [];
        actualizarCarrito();
    }, 250);
}

// Función para mostrar la imagen del producto
function mostrarImagenProducto(imagen, nombre) {
    const modal = new bootstrap.Modal(document.getElementById('modalImagen'));
    document.getElementById('imagenModal').src = `/static/uploads/${imagen}`;
    document.getElementById('modalImagenTitle').textContent = nombre;
    modal.show();
} 