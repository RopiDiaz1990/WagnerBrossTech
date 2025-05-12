from app import app, db, Usuario

def init_admin():
    with app.app_context():
        # Crear las tablas si no existen
        db.create_all()
        
        # Verificar si ya existe un usuario admin
        admin = Usuario.query.filter_by(username='admin').first()
        if not admin:
            admin = Usuario(
                username='admin',
                nombre='Administrador',
                rol='admin'
            )
            admin.set_password('admin123')  # Cambiar esta contraseña en producción
            db.session.add(admin)
            db.session.commit()
            print("Usuario administrador creado exitosamente")
        else:
            print("El usuario administrador ya existe")

if __name__ == '__main__':
    init_admin() 