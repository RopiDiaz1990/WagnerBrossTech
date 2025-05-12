// Cargar ventas al iniciar
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const response = await fetch('/api/ventas');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const ventas = await response.json();
        mostrarVentas(ventas);
    } catch (error) {
        console.error('Error al cargar ventas:', error);
        alert('Error al cargar el historial de ventas');
    }
});

// Función para mostrar las ventas en la tabla
function mostrarVentas(ventas) {
    const tbody = document.getElementById('ventas-body');
    tbody.innerHTML = '';
    
    ventas.forEach(venta => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        
        // Separar fecha y hora
        const fecha = new Date(venta.fecha);
        const fechaStr = fecha.toLocaleDateString();
        const horaStr = fecha.toLocaleTimeString();
        
        // Manejar ventas sin datos de cliente
        const nombreCliente = venta.cliente_nombre ? 
            `${venta.cliente_nombre} ${venta.cliente_apellido || ''}`.trim() : 
            'Cliente no registrado';
        
        tr.innerHTML = `
            <td>${fechaStr}</td>
            <td>${nombreCliente}</td>
            <td>$${venta.total.toFixed(2)}</td>
            <td>${venta.forma_pago}</td>
        `;
        
        // Agregar evento de doble click
        tr.addEventListener('dblclick', () => mostrarDetalleVenta(venta));
        
        tbody.appendChild(tr);
    });
}

// Función para mostrar el detalle de una venta
function mostrarDetalleVenta(venta) {
    // Actualizar fecha
    const fecha = new Date(venta.fecha);
    document.getElementById('detalleFecha').textContent = fecha.toLocaleString();
    
    // Actualizar datos del cliente
    document.getElementById('detalleClienteNombre').textContent = venta.cliente_nombre || 'No especificado';
    document.getElementById('detalleClienteApellido').textContent = venta.cliente_apellido || 'No especificado';
    document.getElementById('detalleClienteCelular').textContent = venta.cliente_celular || 'No especificado';
    document.getElementById('detalleClienteEmail').textContent = venta.cliente_email || 'No especificado';
    
    // Actualizar productos
    const tbody = document.getElementById('detalleProductos');
    tbody.innerHTML = '';
    
    venta.detalles.forEach(detalle => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${detalle.producto_nombre}</td>
            <td>${detalle.cantidad}</td>
            <td>$${detalle.precio_unitario.toFixed(2)}</td>
            <td>$${detalle.subtotal.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });
    
    // Actualizar total
    document.getElementById('detalleTotal').textContent = `$${venta.total.toFixed(2)}`;
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('modalDetalleVenta'));
    modal.show();
}

// Función para imprimir el detalle de la venta
function imprimirDetalleVenta() {
    const contenido = document.getElementById('detalleVentaContenido').innerHTML;
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
    }, 250);
}

// Función para exportar estadísticas
function exportarEstadisticas() {
    window.location.href = '/api/ventas/exportar';
} 