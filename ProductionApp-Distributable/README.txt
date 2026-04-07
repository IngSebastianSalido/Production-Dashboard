# Production Dashboard - Instalación

## Requisitos
- Windows 10/11 (64-bit)
- **NO requiere Node.js instalado**

## Instalación

1. **Copiar esta carpeta completa** a la ubicación deseada en la nueva PC

2. **Configurar el archivo .env**:
   - Abre el archivo .env con un editor de texto
   - Ajusta el puerto si es necesario: PORT=3000
   - Si quieres acceder desde otras PCs en la red, cambia HOST=0.0.0.0
   - Las rutas ya están configuradas como relativas y funcionarán automáticamente

3. **Ejecutar la aplicación**:
   - Doble clic en ackend.exe
   - O desde PowerShell: .\backend.exe

4. **Acceder a la aplicación**:
   - Abre tu navegador en: http://localhost:3000
   - Desde otra PC en la red: http://[IP-DEL-SERVIDOR]:3000

## Estructura de archivos

`
ProductionApp-Distributable/
├── backend.exe              # Aplicación principal (backend + frontend)
├── .env                     # Configuración
├── options.json             # Opciones de la app
├── categories.json          # Categorías
├── shifts.json              # Turnos
├── data/                    # Datos de producción
│   ├── paros.csv
│   ├── ProductionReport.csv
│   ├── efficiency.csv
│   └── ...
└── produccion-app/
    └── dist/                # Frontend compilado
`

## Notas importantes

- **Todos los archivos deben permanecer juntos** en la misma estructura
- Los datos se guardan en la carpeta data/
- Los backups automáticos se crean en data/paros_backup/
- El ejecutable NO expone el código fuente

## Problemas comunes

**Error: Puerto en uso**
- Cambia el PORT=3000 en el archivo .env a otro puerto (ej: 3001)

**No se puede acceder desde otra PC**
- Verifica que HOST=0.0.0.0 en el archivo .env
- Verifica el firewall de Windows (debe permitir conexiones entrantes en el puerto 3000)

**Archivos no encontrados**
- Verifica que todas las carpetas (data/, produccion-app/dist/) estén presentes
- Verifica que las rutas en .env sean relativas (comienzan con ./)

## Soporte

Para más información, contacta al administrador del sistema.
