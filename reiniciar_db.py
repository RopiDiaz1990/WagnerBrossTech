import os
import glob
from app import app, db, Usuario

def reiniciar_base_datos():
    with app.app_context():
        # Eliminar la base de datos existente y archivos relacionados
        archivos_db = glob.glob('*.db*')  # Esto capturará ventas.db y ventas.db-journal si existe
        for archivo in archivos_db:
            try:
                os.remove(archivo)
                print(f"Archivo eliminado: {archivo}")
            except Exception as e:
                print(f"Error al eliminar {archivo}: {str(e)}")
        
        print("Limpiando la sesión de SQLAlchemy...")
        db.session.remove()
        db.drop_all()
        
        print("Creando nueva base de datos...")
        db.create_all()
        print("Nueva base de datos creada con la estructura actualizada.")
        
        print("Creando usuario administrador...")
        # Crear usuario admin
        admin = Usuario(
            username='admin',
            nombre='Administrador',
            rol='admin'
        )
        admin.set_password('admin123')
        db.session.add(admin)
        
        try:
            db.session.commit()
            print("Usuario administrador creado exitosamente.")
        except Exception as e:
            db.session.rollback()
            print(f"Error al crear usuario admin: {str(e)}")

if __name__ == '__main__':
    reiniciar_base_datos() 