from flask import Flask, render_template, request, jsonify, session, redirect, url_for, flash, send_file
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import json
import os
import pandas as pd
from io import BytesIO
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = 'tu_clave_secreta_aqui'  # Necesario para las sesiones
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///ventas.db'
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=24)  # Sesión de 24 horas
db = SQLAlchemy(app)

# Asegurarse de que exista el directorio de uploads
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Modelos de la base de datos
class Producto(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    stock = db.Column(db.Integer, nullable=False)
    precio_efectivo = db.Column(db.Float, nullable=False)
    precio_tarjeta = db.Column(db.Float, nullable=False)
    observaciones = db.Column(db.Text)
    imagen = db.Column(db.String(200))

class Venta(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    fecha = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    total = db.Column(db.Float, nullable=False)
    forma_pago = db.Column(db.String(20), nullable=False)
    cliente_nombre = db.Column(db.String(100))
    cliente_apellido = db.Column(db.String(100))
    cliente_celular = db.Column(db.String(20))
    cliente_email = db.Column(db.String(100))
    detalles = db.relationship('DetalleVenta', backref='venta', lazy=True, cascade='all, delete-orphan')

class DetalleVenta(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    venta_id = db.Column(db.Integer, db.ForeignKey('venta.id'), nullable=False)
    producto_nombre = db.Column(db.String(100), nullable=False)  # Guardamos el nombre del producto
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Float, nullable=False)
    subtotal = db.Column(db.Float, nullable=False)

# Modelo de Usuario
class Usuario(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    nombre = db.Column(db.String(100))
    rol = db.Column(db.String(20), default='usuario')  # admin o usuario

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# Crear todas las tablas al iniciar la aplicación
with app.app_context():
    db.create_all()
    
    # Crear usuario admin si no existe
    admin = Usuario.query.filter_by(username='admin').first()
    if not admin:
        admin = Usuario(
            username='admin',
            nombre='Administrador',
            rol='admin'
        )
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
        print("Usuario administrador creado exitosamente")

# Rutas de autenticación
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = Usuario.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            session.permanent = True  # Hacer la sesión permanente
            session['user_id'] = user.id
            session['username'] = user.username
            session['rol'] = user.rol
            return redirect(url_for('index'))
        flash('Usuario o contraseña incorrectos')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# Decorador para requerir login
def login_required(f):
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function

# Rutas principales
@app.route('/')
@login_required
def index():
    return render_template('index.html')

@app.route('/productos')
@login_required
def productos():
    try:
        productos = Producto.query.all()
        return render_template('productos.html', productos=productos)
    except Exception as e:
        print(f"Error al cargar productos: {str(e)}")
        return render_template('productos.html', productos=[])

@app.route('/ventas')
@login_required
def ventas():
    try:
        ventas = Venta.query.order_by(Venta.fecha.desc()).all()
        total_ventas = sum(venta.total for venta in ventas)
        
        # Estadísticas
        hoy = datetime.now().date()
        semana = hoy - timedelta(days=7)
        mes = hoy - timedelta(days=30)
        
        ventas_hoy = Venta.query.filter(Venta.fecha >= hoy).all()
        ventas_semana = Venta.query.filter(Venta.fecha >= semana).all()
        ventas_mes = Venta.query.filter(Venta.fecha >= mes).all()
        
        # Calcular totales
        total_hoy = sum(v.total for v in ventas_hoy)
        total_semana = sum(v.total for v in ventas_semana)
        total_mes = sum(v.total for v in ventas_mes)
        
        # Productos más vendidos
        productos_mas_vendidos = db.session.query(
            DetalleVenta.producto_nombre,
            db.func.sum(DetalleVenta.cantidad).label('total_vendido')
        ).group_by(DetalleVenta.producto_nombre).order_by(db.desc('total_vendido')).limit(5).all()
        
        # Clientes que más compran
        clientes_mas_compras = db.session.query(
            Venta.cliente_nombre,
            Venta.cliente_apellido,
            db.func.count(Venta.id).label('total_compras'),
            db.func.sum(Venta.total).label('total_gastado')
        ).group_by(Venta.cliente_nombre, Venta.cliente_apellido).order_by(db.desc('total_gastado')).limit(5).all()
        
        return render_template('ventas.html',
            ventas=ventas,
            total_ventas=total_ventas,
            ventas_hoy=len(ventas_hoy),
            total_hoy=total_hoy,
            ventas_semana=len(ventas_semana),
            total_semana=total_semana,
            ventas_mes=len(ventas_mes),
            total_mes=total_mes,
            productos_mas_vendidos=productos_mas_vendidos,
            clientes_mas_compras=clientes_mas_compras
        )
    except Exception as e:
        print(f"Error al cargar ventas: {str(e)}")
        # Proporcionar valores por defecto en caso de error
        return render_template('ventas.html',
            ventas=[],
            total_ventas=0,
            ventas_hoy=0,
            total_hoy=0,
            ventas_semana=0,
            total_semana=0,
            ventas_mes=0,
            total_mes=0,
            productos_mas_vendidos=[],
            clientes_mas_compras=[]
        )

# API endpoints para productos
@app.route('/api/productos', methods=['GET'])
def get_productos():
    try:
        productos = Producto.query.all()
        return jsonify([{
            'id': p.id,
            'nombre': p.nombre,
            'stock': p.stock,
            'precio_efectivo': p.precio_efectivo,
            'precio_tarjeta': p.precio_tarjeta,
            'observaciones': p.observaciones,
            'imagen': p.imagen
        } for p in productos])
    except Exception as e:
        print(f"Error al obtener productos: {str(e)}")
        return jsonify({'error': 'Error al obtener productos'}), 500

@app.route('/api/productos/<int:id>', methods=['GET'])
def get_producto(id):
    producto = Producto.query.get_or_404(id)
    return jsonify({
        'id': producto.id,
        'nombre': producto.nombre,
        'stock': producto.stock,
        'precio_efectivo': producto.precio_efectivo,
        'precio_tarjeta': producto.precio_tarjeta,
        'observaciones': producto.observaciones,
        'imagen': producto.imagen
    })

@app.route('/api/productos', methods=['POST'])
def create_producto():
    try:
        print("Iniciando creación de producto...")
        data = request.form
        print(f"Datos recibidos: {data}")
        imagen = request.files.get('imagen')
        
        # Validar datos requeridos
        if not data.get('nombre'):
            print("Error: nombre faltante")
            return jsonify({'error': 'El nombre es requerido'}), 400
        if not data.get('stock'):
            print("Error: stock faltante")
            return jsonify({'error': 'El stock es requerido'}), 400
        if not data.get('precio_efectivo'):
            print("Error: precio_efectivo faltante")
            return jsonify({'error': 'El precio en efectivo es requerido'}), 400
        if not data.get('precio_tarjeta'):
            print("Error: precio_tarjeta faltante")
            return jsonify({'error': 'El precio con tarjeta es requerido'}), 400
        
        try:
            stock = int(data['stock'])
            precio_efectivo = float(data['precio_efectivo'])
            precio_tarjeta = float(data['precio_tarjeta'])
        except ValueError as e:
            print(f"Error al convertir valores numéricos: {str(e)}")
            return jsonify({'error': 'Los valores de stock y precios deben ser números válidos'}), 400
        
        print("Creando objeto Producto...")
        producto = Producto(
            nombre=data['nombre'],
            stock=stock,
            precio_efectivo=precio_efectivo,
            precio_tarjeta=precio_tarjeta,
            observaciones=data.get('observaciones', '')
        )
        
        if imagen:
            print("Procesando imagen...")
            try:
                filename = secure_filename(imagen.filename)
                imagen.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
                producto.imagen = filename
                print(f"Imagen guardada como: {filename}")
            except Exception as e:
                print(f"Error al guardar imagen: {str(e)}")
                return jsonify({'error': 'Error al guardar la imagen'}), 500
        
        print("Guardando en la base de datos...")
        db.session.add(producto)
        db.session.commit()
        print(f"Producto creado exitosamente con ID: {producto.id}")
        return jsonify({'id': producto.id}), 201
        
    except ValueError as e:
        print(f"Error de valor: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Error en los datos: {str(e)}'}), 400
    except Exception as e:
        print(f"Error inesperado al crear producto: {str(e)}")
        db.session.rollback()
        return jsonify({'error': f'Error al crear el producto: {str(e)}'}), 500

@app.route('/api/productos/<int:id>', methods=['PUT'])
def update_producto(id):
    producto = Producto.query.get_or_404(id)
    data = request.form
    imagen = request.files.get('imagen')
    
    producto.nombre = data['nombre']
    producto.stock = int(data['stock'])
    producto.precio_efectivo = float(data['precio_efectivo'])
    producto.precio_tarjeta = float(data['precio_tarjeta'])
    producto.observaciones = data.get('observaciones', '')
    
    if imagen:
        # Eliminar imagen anterior si existe
        if producto.imagen:
            try:
                os.remove(os.path.join(app.config['UPLOAD_FOLDER'], producto.imagen))
            except:
                pass
        
        filename = secure_filename(imagen.filename)
        imagen.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        producto.imagen = filename
    
    db.session.commit()
    return jsonify({'id': producto.id})

@app.route('/api/productos/<int:id>', methods=['DELETE'])
def delete_producto(id):
    producto = Producto.query.get_or_404(id)
    
    # Eliminar imagen si existe
    if producto.imagen:
        try:
            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], producto.imagen))
        except:
            pass
    
    db.session.delete(producto)
    db.session.commit()
    return '', 204

@app.route('/api/productos/importar', methods=['POST'])
def importar_productos():
    try:
        data = request.json
        productos = data.get('productos', [])
        
        for producto_data in productos:
            # Convertir los precios de formato moneda a float
            try:
                # Asegurarse de que los valores sean strings antes de procesarlos
                precio_efectivo_str = str(producto_data.get('precio_efectivo', '0')).strip()
                precio_tarjeta_str = str(producto_data.get('precio_tarjeta', '0')).strip()
                
                # Eliminar símbolos de moneda y comas
                precio_efectivo_str = precio_efectivo_str.replace('$', '').replace(',', '')
                precio_tarjeta_str = precio_tarjeta_str.replace('$', '').replace(',', '')
                
                # Convertir a float
                precio_efectivo = float(precio_efectivo_str) if precio_efectivo_str else 0
                precio_tarjeta = float(precio_tarjeta_str) if precio_tarjeta_str else 0
                
                print(f"Procesando precios - Efectivo: {precio_efectivo}, Tarjeta: {precio_tarjeta}")
                
                producto = Producto(
                    nombre=producto_data.get('nombre', ''),
                    stock=int(producto_data.get('stock', 0)),
                    precio_efectivo=precio_efectivo,
                    precio_tarjeta=precio_tarjeta,
                    observaciones=producto_data.get('observaciones', '')
                )
                db.session.add(producto)
            except Exception as e:
                print(f"Error procesando producto: {str(e)}")
                print(f"Datos del producto: {producto_data}")
                continue
        
        db.session.commit()
        return jsonify({'message': 'Productos importados con éxito'}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error general en importación: {str(e)}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/productos/bulk-delete', methods=['POST'])
@login_required
def bulk_delete_productos():
    try:
        # Verificar que el usuario esté autenticado
        if 'user_id' not in session:
            return jsonify({'error': 'No autorizado'}), 401

        data = request.get_json()
        if not data or 'ids' not in data:
            return jsonify({'error': 'No se proporcionaron IDs de productos'}), 400

        ids = data['ids']
        if not isinstance(ids, list):
            return jsonify({'error': 'Los IDs deben ser proporcionados en una lista'}), 400

        # Verificar que todos los IDs sean números
        try:
            ids = [int(id) for id in ids]
        except ValueError:
            return jsonify({'error': 'Los IDs deben ser números válidos'}), 400

        # Eliminar los productos
        productos_eliminados = 0
        for id in ids:
            producto = Producto.query.get(id)
            if producto:
                try:
                    # Eliminar la imagen si existe
                    if producto.imagen:
                        try:
                            os.remove(os.path.join(app.config['UPLOAD_FOLDER'], producto.imagen))
                        except Exception as e:
                            print(f"Error al eliminar imagen: {str(e)}")
                    
                    db.session.delete(producto)
                    productos_eliminados += 1
                except Exception as e:
                    print(f"Error al eliminar producto {id}: {str(e)}")
                    continue

        if productos_eliminados > 0:
            db.session.commit()
            return jsonify({
                'message': f'Se eliminaron {productos_eliminados} productos exitosamente',
                'eliminados': productos_eliminados
            }), 200
        else:
            return jsonify({'error': 'No se pudo eliminar ningún producto'}), 400

    except Exception as e:
        db.session.rollback()
        print(f"Error al eliminar productos: {str(e)}")
        return jsonify({'error': 'Error al eliminar los productos'}), 500

# API endpoints para ventas
@app.route('/api/ventas', methods=['GET'])
def get_ventas():
    try:
        ventas = Venta.query.order_by(Venta.fecha.desc()).all()
        return jsonify([{
            'id': v.id,
            'fecha': v.fecha.isoformat(),
            'cliente_nombre': v.cliente_nombre,
            'cliente_apellido': v.cliente_apellido,
            'cliente_celular': v.cliente_celular,
            'cliente_email': v.cliente_email,
            'detalles': [{
                'id': d.id,
                'producto_nombre': d.producto_nombre,
                'cantidad': d.cantidad,
                'precio_unitario': d.precio_unitario,
                'subtotal': d.subtotal
            } for d in v.detalles],
            'total': v.total,
            'forma_pago': v.forma_pago
        } for v in ventas])
    except Exception as e:
        print(f"Error al obtener ventas: {str(e)}")
        return jsonify({'error': 'Error al obtener ventas'}), 500

@app.route('/api/ventas', methods=['POST'])
def create_venta():
    try:
        print("Iniciando creación de venta...")
        data = request.json
        print(f"Datos recibidos: {data}")
        
        if not data:
            return jsonify({'error': 'No se recibieron datos'}), 400

        # Validar datos requeridos
        if 'forma_pago' not in data:
            return jsonify({'error': 'Forma de pago no especificada'}), 400
        if 'productos' not in data or not data['productos']:
            return jsonify({'error': 'No hay productos en la venta'}), 400
        if 'cliente' not in data:
            return jsonify({'error': 'Datos del cliente no especificados'}), 400

        productos_data = data.get('productos', [])
        cliente_data = data.get('cliente', {})
        
        print(f"Productos a procesar: {productos_data}")
        print(f"Datos del cliente: {cliente_data}")
        
        if not cliente_data.get('nombre') or not cliente_data.get('apellido'):
            return jsonify({'error': 'Nombre y apellido del cliente son requeridos'}), 400

        # Crear la venta principal
        venta = Venta(
            total=0,  # Se actualizará después
            forma_pago=data['forma_pago'],
            cliente_nombre=cliente_data.get('nombre'),
            cliente_apellido=cliente_data.get('apellido'),
            cliente_celular=cliente_data.get('celular', ''),
            cliente_email=cliente_data.get('email', '')
        )
        db.session.add(venta)
        db.session.flush()  # Para obtener el ID de la venta
        
        total_venta = 0
        productos_no_encontrados = []
        productos_sin_stock = []
        
        # Procesar cada producto
        for prod_data in productos_data:
            try:
                print(f"Procesando producto: {prod_data}")
                producto = Producto.query.get(prod_data['id'])
                if not producto:
                    print(f"Producto no encontrado: {prod_data['id']}")
                    productos_no_encontrados.append(prod_data['id'])
                    continue
                
                if producto.stock < prod_data['cantidad']:
                    print(f"Stock insuficiente para producto {producto.nombre}: Stock={producto.stock}, Solicitado={prod_data['cantidad']}")
                    productos_sin_stock.append({
                        'id': producto.id,
                        'nombre': producto.nombre,
                        'stock_disponible': producto.stock,
                        'cantidad_solicitada': prod_data['cantidad']
                    })
                    continue
                
                precio = producto.precio_efectivo if data['forma_pago'] == 'efectivo' else producto.precio_tarjeta
                subtotal = precio * prod_data['cantidad']
                total_venta += subtotal
                
                print(f"Producto procesado: {producto.nombre}, Cantidad: {prod_data['cantidad']}, Precio: {precio}, Subtotal: {subtotal}")
                
                # Guardar el detalle con el nombre del producto
                detalle = DetalleVenta(
                    venta_id=venta.id,
                    producto_nombre=producto.nombre,
                    cantidad=prod_data['cantidad'],
                    precio_unitario=precio,
                    subtotal=subtotal
                )
                
                producto.stock -= prod_data['cantidad']
                db.session.add(detalle)
                
            except Exception as e:
                print(f"Error procesando producto {prod_data.get('id')}: {str(e)}")
                continue
        
        # Verificar si hubo errores en el procesamiento
        if productos_no_encontrados:
            db.session.rollback()
            return jsonify({
                'error': 'Algunos productos no fueron encontrados',
                'productos_no_encontrados': productos_no_encontrados
            }), 400
            
        if productos_sin_stock:
            db.session.rollback()
            return jsonify({
                'error': 'Stock insuficiente para algunos productos',
                'productos_sin_stock': productos_sin_stock
            }), 400
        
        # Actualizar el total de la venta
        venta.total = total_venta
        
        db.session.commit()
        print(f"Venta creada exitosamente. ID: {venta.id}, Total: {total_venta}")
        return jsonify({
            'id': venta.id,
            'message': 'Venta realizada con éxito',
            'total': total_venta
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error al crear venta: {str(e)}")
        import traceback
        print(f"Traceback completo: {traceback.format_exc()}")
        return jsonify({'error': f'Error al procesar la venta: {str(e)}'}), 500

@app.route('/api/ventas/<int:id>', methods=['GET'])
@login_required
def get_venta(id):
    try:
        venta = Venta.query.get_or_404(id)
        return jsonify({
            'id': venta.id,
            'fecha': venta.fecha.isoformat(),
            'cliente_nombre': venta.cliente_nombre,
            'cliente_apellido': venta.cliente_apellido,
            'cliente_celular': venta.cliente_celular,
            'cliente_email': venta.cliente_email,
            'detalles': [{
                'id': d.id,
                'producto_nombre': d.producto_nombre,  # Usamos el nombre guardado
                'cantidad': d.cantidad,
                'precio_unitario': d.precio_unitario,
                'subtotal': d.subtotal
            } for d in venta.detalles],
            'total': venta.total,
            'forma_pago': venta.forma_pago
        })
    except Exception as e:
        print(f"Error al obtener venta: {str(e)}")
        return jsonify({'error': 'Error al obtener la venta'}), 500

@app.route('/api/ventas/exportar', methods=['GET'])
@login_required
def exportar_ventas():
    try:
        # Obtener datos para exportar
        hoy = datetime.now().date()
        semana = hoy - timedelta(days=7)
        mes = hoy - timedelta(days=30)
        
        ventas_hoy = Venta.query.filter(Venta.fecha >= hoy).all()
        ventas_semana = Venta.query.filter(Venta.fecha >= semana).all()
        ventas_mes = Venta.query.filter(Venta.fecha >= mes).all()
        
        # Crear un archivo Excel en memoria
        output = BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            # Hoja de Resumen
            resumen_data = {
                'Período': ['Hoy', 'Esta Semana', 'Este Mes'],
                'Cantidad de Ventas': [
                    len(ventas_hoy),
                    len(ventas_semana),
                    len(ventas_mes)
                ],
                'Total Vendido': [
                    sum(v.total for v in ventas_hoy),
                    sum(v.total for v in ventas_semana),
                    sum(v.total for v in ventas_mes)
                ]
            }
            pd.DataFrame(resumen_data).to_excel(writer, sheet_name='Resumen', index=False)
            
            # Hoja de Productos más vendidos
            productos_mas_vendidos = db.session.query(
                Producto.nombre,
                db.func.sum(DetalleVenta.cantidad).label('total_vendido')
            ).join(DetalleVenta).group_by(Producto.id).order_by(db.desc('total_vendido')).all()
            
            pd.DataFrame([
                {'Producto': p.nombre, 'Unidades Vendidas': p.total_vendido}
                for p in productos_mas_vendidos
            ]).to_excel(writer, sheet_name='Productos Más Vendidos', index=False)
            
            # Hoja de Clientes más frecuentes
            clientes_mas_compras = db.session.query(
                Venta.cliente_nombre,
                Venta.cliente_apellido,
                db.func.count(Venta.id).label('total_compras'),
                db.func.sum(Venta.total).label('total_gastado')
            ).group_by(Venta.cliente_nombre, Venta.cliente_apellido).order_by(db.desc('total_gastado')).all()
            
            pd.DataFrame([
                {
                    'Cliente': f"{c.cliente_nombre} {c.cliente_apellido}",
                    'Total Compras': c.total_compras,
                    'Total Gastado': c.total_gastado
                }
                for c in clientes_mas_compras
            ]).to_excel(writer, sheet_name='Clientes Más Frecuentes', index=False)
            
            # Hoja de Ventas detalladas
            ventas_detalladas = []
            for venta in Venta.query.order_by(Venta.fecha.desc()).all():
                for detalle in venta.detalles:
                    ventas_detalladas.append({
                        'Fecha': venta.fecha,
                        'Cliente': f"{venta.cliente_nombre} {venta.cliente_apellido}",
                        'Producto': detalle.producto_nombre,
                        'Cantidad': detalle.cantidad,
                        'Precio Unitario': detalle.precio_unitario,
                        'Subtotal': detalle.subtotal,
                        'Forma de Pago': venta.forma_pago
                    })
            
            pd.DataFrame(ventas_detalladas).to_excel(writer, sheet_name='Ventas Detalladas', index=False)
        
        output.seek(0)
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=f'ventas_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        )
        
    except Exception as e:
        print(f"Error al exportar ventas: {str(e)}")
        return jsonify({'error': 'Error al exportar las ventas'}), 500

@app.route('/api/productos/actualizar', methods=['POST'])
def actualizar_productos():
    try:
        data = request.json
        productos_data = data.get('productos', [])
        
        actualizados = 0
        agregados = 0
        
        for producto_data in productos_data:
            # Buscar producto existente por nombre
            producto_existente = Producto.query.filter_by(nombre=producto_data['nombre']).first()
            
            try:
                # Convertir los precios de formato moneda a float
                precio_efectivo_str = str(producto_data.get('precio_efectivo', '0')).strip()
                precio_tarjeta_str = str(producto_data.get('precio_tarjeta', '0')).strip()
                
                # Eliminar símbolos de moneda y comas
                precio_efectivo_str = precio_efectivo_str.replace('$', '').replace(',', '')
                precio_tarjeta_str = precio_tarjeta_str.replace('$', '').replace(',', '')
                
                # Convertir a float
                precio_efectivo = float(precio_efectivo_str) if precio_efectivo_str else 0
                precio_tarjeta = float(precio_tarjeta_str) if precio_tarjeta_str else 0
                
                if producto_existente:
                    # Actualizar producto existente
                    producto_existente.stock = int(producto_data.get('stock', 0))
                    producto_existente.precio_efectivo = precio_efectivo
                    producto_existente.precio_tarjeta = precio_tarjeta
                    producto_existente.observaciones = producto_data.get('observaciones', '')
                    actualizados += 1
                else:
                    # Crear nuevo producto
                    nuevo_producto = Producto(
                        nombre=producto_data['nombre'],
                        stock=int(producto_data.get('stock', 0)),
                        precio_efectivo=precio_efectivo,
                        precio_tarjeta=precio_tarjeta,
                        observaciones=producto_data.get('observaciones', '')
                    )
                    db.session.add(nuevo_producto)
                    agregados += 1
                    
            except Exception as e:
                print(f"Error procesando producto {producto_data.get('nombre', '')}: {str(e)}")
                continue
        
        db.session.commit()
        return jsonify({
            'message': 'Productos actualizados con éxito',
            'actualizados': actualizados,
            'agregados': agregados
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error general en actualización: {str(e)}")
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True) 