// Funciones para la gestión de productos
async function editarProducto(id) {
    try {
        const response = await fetch(`/api/productos/${id}`);
        const producto = await response.json();
        
        document.getElementById('productoId').value = producto.id;
        document.getElementById('nombre').value = producto.nombre;
        document.getElementById('stock').value = producto.stock;
        document.getElementById('precioEfectivo').value = producto.precio_efectivo;
        document.getElementById('precioTarjeta').value = producto.precio_tarjeta;
        document.getElementById('observaciones').value = producto.observaciones;
        
        // Mostrar imagen actual si existe
        const previewImagen = document.getElementById('previewImagen');
        if (producto.imagen) {
            previewImagen.innerHTML = `
                <img src="/static/uploads/${producto.imagen}" alt="Preview" class="img-thumbnail" style="max-width: 200px;">
                <input type="hidden" name="imagen_actual" value="${producto.imagen}">
            `;
        } else {
            previewImagen.innerHTML = '';
        }
        
        document.getElementById('modalTitle').textContent = 'Editar Producto';
        new bootstrap.Modal(document.getElementById('modalProducto')).show();
    } catch (error) {
        console.error('Error:', error);
        alert('Error al cargar el producto');
    }
}

async function eliminarProducto(id) {
    if (!confirm('¿Está seguro de que desea eliminar este producto?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/productos/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            window.location.reload();
        } else {
            throw new Error('Error al eliminar el producto');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al eliminar el producto');
    }
}

async function guardarProducto() {
    try {
        const formData = new FormData();
        const productoId = document.getElementById('productoId').value;
        
        // Validar campos requeridos
        const nombre = document.getElementById('nombre').value.trim();
        const stock = document.getElementById('stock').value.trim();
        const precioEfectivo = document.getElementById('precioEfectivo').value.trim();
        const precioTarjeta = document.getElementById('precioTarjeta').value.trim();
        
        console.log('Validando campos:', { nombre, stock, precioEfectivo, precioTarjeta });
        
        if (!nombre || !stock || !precioEfectivo || !precioTarjeta) {
            alert('Por favor complete todos los campos requeridos');
            return;
        }
        
        // Validar que los valores numéricos sean válidos
        if (isNaN(stock) || isNaN(precioEfectivo) || isNaN(precioTarjeta)) {
            alert('Los valores de stock y precios deben ser números válidos');
            return;
        }
        
        formData.append('nombre', nombre);
        formData.append('stock', stock);
        formData.append('precio_efectivo', precioEfectivo);
        formData.append('precio_tarjeta', precioTarjeta);
        formData.append('observaciones', document.getElementById('observaciones').value.trim());
        
        const imagenInput = document.getElementById('imagen');
        if (imagenInput.files.length > 0) {
            formData.append('imagen', imagenInput.files[0]);
        }
        
        console.log('Enviando datos al servidor...');
        const url = productoId ? `/api/productos/${productoId}` : '/api/productos';
        const method = productoId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            body: formData
        });
        
        const data = await response.json();
        console.log('Respuesta del servidor:', data);
        
        if (response.ok) {
            alert('Producto guardado exitosamente');
            window.location.reload();
        } else {
            throw new Error(data.error || 'Error al guardar el producto');
        }
    } catch (error) {
        console.error('Error completo:', error);
        alert(error.message || 'Error al guardar el producto');
    }
}

// Función para exportar a Excel
function exportarExcel() {
    const tabla = document.getElementById('tabla-productos');
    
    // Crear una copia de la tabla para modificar
    const tablaTemp = tabla.cloneNode(true);
    
    // Eliminar la columna de acciones y la columna de selección si existe
    const headers = tablaTemp.querySelectorAll('th');
    const rows = tablaTemp.querySelectorAll('tbody tr');
    
    // Eliminar la última columna (acciones)
    headers[headers.length - 1].remove();
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        cells[cells.length - 1].remove();
    });
    
    // Eliminar la columna de selección si existe
    if (headers[0].textContent === 'Seleccionar') {
        headers[0].remove();
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells[0].remove();
        });
    }
    
    // Convertir la tabla a libro de Excel
    const wb = XLSX.utils.table_to_book(tablaTemp, {sheet: "Productos"});
    
    // Obtener la hoja de trabajo
    const ws = wb.Sheets["Productos"];
    
    // Ajustar el ancho de las columnas
    const wscols = [
        {wch: 5},  // ID
        {wch: 15}, // Imagen
        {wch: 30}, // Nombre
        {wch: 10}, // Stock
        {wch: 15}, // Precio Efectivo
        {wch: 15}, // Precio Tarjeta
        {wch: 30}  // Observaciones
    ];
    ws['!cols'] = wscols;
    
    // Guardar el archivo
    XLSX.writeFile(wb, "productos.xlsx");
}

// Función para importar desde Excel
async function importarExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            // Función auxiliar para limpiar valores monetarios
            const limpiarValorMonetario = (valor) => {
                if (typeof valor === 'string') {
                    // Eliminar símbolos de moneda, comas y espacios
                    return parseFloat(valor.replace(/[$,]/g, '').trim()) || 0;
                }
                return parseFloat(valor) || 0;
            };

            // Validar y procesar los datos
            const productos = jsonData.map(row => {
                // Intentar diferentes nombres de columnas posibles
                const precioEfectivo = limpiarValorMonetario(
                    row['Precio Efectivo'] || 
                    row['Precio efectivo'] || 
                    row['precio_efectivo'] || 
                    row['PrecioEfectivo'] || 
                    0
                );

                const precioTarjeta = limpiarValorMonetario(
                    row['Precio Tarjeta'] || 
                    row['Precio tarjeta'] || 
                    row['precio_tarjeta'] || 
                    row['PrecioTarjeta'] || 
                    0
                );

                return {
                    nombre: row.Nombre || row.nombre || '',
                    stock: parseInt(row.Stock || row.stock) || 0,
                    precio_efectivo: precioEfectivo,
                    precio_tarjeta: precioTarjeta,
                    observaciones: row.Observaciones || row.observaciones || ''
                };
            });

            console.log('Datos procesados:', productos); // Para debugging

            // Enviar los productos al servidor
            const response = await fetch('/api/productos/importar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ productos })
            });

            if (response.ok) {
                alert('Productos importados con éxito');
                window.location.reload();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al importar productos');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al importar productos: ' + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// Preview de imagen al seleccionar
document.getElementById('imagen').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const previewImagen = document.getElementById('previewImagen');
            previewImagen.innerHTML = `
                <img src="${e.target.result}" alt="Preview" class="img-thumbnail" style="max-width: 200px;">
            `;
        };
        reader.readAsDataURL(file);
    }
});

// Limpiar formulario al abrir modal para nuevo producto
document.getElementById('modalProducto').addEventListener('show.bs.modal', function (event) {
    if (!event.relatedTarget) return; // Si no se abrió con el botón "Nuevo Producto"
    
    document.getElementById('formProducto').reset();
    document.getElementById('productoId').value = '';
    document.getElementById('modalTitle').textContent = 'Nuevo Producto';
    document.getElementById('previewImagen').innerHTML = '';
});

function toggleBulkDelete() {
    const bulkDeleteControls = document.getElementById('bulkDeleteControls');
    const bulkDeleteColumns = document.querySelectorAll('.bulk-delete-column');
    
    if (bulkDeleteControls && bulkDeleteColumns) {
        if (bulkDeleteControls.style.display === 'none') {
            bulkDeleteControls.style.display = 'block';
            bulkDeleteColumns.forEach(col => col.style.display = 'table-cell');
        } else {
            bulkDeleteControls.style.display = 'none';
            bulkDeleteColumns.forEach(col => col.style.display = 'none');
            // Desmarcar todos los checkboxes
            document.querySelectorAll('.product-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
    }
}

function selectAllProducts() {
    const checkboxes = document.querySelectorAll('.product-checkbox');
    const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = !allChecked;
    });
}

async function confirmarEliminacion() {
    const selectedProducts = Array.from(document.querySelectorAll('.product-checkbox:checked')).map(checkbox => checkbox.value);
    
    if (selectedProducts.length === 0) {
        alert('Por favor, seleccione al menos un producto para eliminar');
        return;
    }

    if (!confirm(`¿Está seguro que desea eliminar ${selectedProducts.length} producto(s)?`)) {
        return;
    }

    try {
        const response = await fetch('/api/productos/bulk-delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids: selectedProducts })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Error al eliminar los productos');
        }

        // Mostrar mensaje de éxito
        alert(data.message || 'Productos eliminados exitosamente');
        
        // Recargar la página después de eliminar exitosamente
        window.location.reload();
    } catch (error) {
        console.error('Error:', error);
        alert(error.message || 'Error al eliminar los productos');
    } finally {
        // Ocultar los controles de eliminación masiva
        const bulkDeleteControls = document.getElementById('bulkDeleteControls');
        const bulkDeleteColumns = document.querySelectorAll('.bulk-delete-column');
        
        if (bulkDeleteControls) {
            bulkDeleteControls.style.display = 'none';
        }
        
        if (bulkDeleteColumns) {
            bulkDeleteColumns.forEach(col => {
                if (col) col.style.display = 'none';
            });
        }
        
        // Desmarcar todos los checkboxes
        document.querySelectorAll('.product-checkbox').forEach(checkbox => {
            if (checkbox) checkbox.checked = false;
        });
    }
}

// Función para mostrar imagen en modal
function mostrarImagen(url, nombre) {
    const modalImagen = new bootstrap.Modal(document.getElementById('modalImagen'));
    document.getElementById('modalImagenTitle').textContent = nombre;
    document.getElementById('imagenAmpliada').src = url;
    modalImagen.show();
}

// Función para filtrar productos
function filtrarProductos() {
    const input = document.getElementById('searchInput');
    const filtro = input.value.toLowerCase();
    const tabla = document.getElementById('tabla-productos');
    const filas = tabla.getElementsByTagName('tr');

    // Empezar desde 1 para saltar el encabezado
    for (let i = 1; i < filas.length; i++) {
        const fila = filas[i];
        const celdas = fila.getElementsByTagName('td');
        let encontrado = false;

        // Buscar en todas las celdas excepto la última (acciones)
        for (let j = 0; j < celdas.length - 1; j++) {
            const celda = celdas[j];
            if (celda) {
                const texto = celda.textContent || celda.innerText;
                if (texto.toLowerCase().indexOf(filtro) > -1) {
                    encontrado = true;
                    break;
                }
            }
        }

        // Mostrar u ocultar la fila según si coincide con el filtro
        fila.style.display = encontrado ? '' : 'none';
    }
}

// Función para actualizar productos desde Excel
async function actualizarProductos(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            // Función auxiliar para limpiar valores monetarios
            const limpiarValorMonetario = (valor) => {
                if (typeof valor === 'string') {
                    return parseFloat(valor.replace(/[$,]/g, '').trim()) || 0;
                }
                return parseFloat(valor) || 0;
            };

            // Validar y procesar los datos
            const productos = jsonData.map(row => {
                const precioEfectivo = limpiarValorMonetario(
                    row['Precio Efectivo'] || 
                    row['Precio efectivo'] || 
                    row['precio_efectivo'] || 
                    row['PrecioEfectivo'] || 
                    0
                );

                const precioTarjeta = limpiarValorMonetario(
                    row['Precio Tarjeta'] || 
                    row['Precio tarjeta'] || 
                    row['precio_tarjeta'] || 
                    row['PrecioTarjeta'] || 
                    0
                );

                return {
                    nombre: row.Nombre || row.nombre || '',
                    stock: parseInt(row.Stock || row.stock) || 0,
                    precio_efectivo: precioEfectivo,
                    precio_tarjeta: precioTarjeta,
                    observaciones: row.Observaciones || row.observaciones || ''
                };
            });

            // Enviar datos al servidor para actualización
            const response = await fetch('/api/productos/actualizar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ productos: productos })
            });

            const result = await response.json();
            
            if (response.ok) {
                alert(`Actualización completada:\n${result.actualizados} productos actualizados\n${result.agregados} productos nuevos agregados`);
                window.location.reload();
            } else {
                throw new Error(result.error || 'Error al actualizar productos');
            }
        } catch (error) {
            console.error('Error:', error);
            alert('Error al procesar el archivo: ' + error.message);
        }
    };
    reader.readAsArrayBuffer(file);
} 