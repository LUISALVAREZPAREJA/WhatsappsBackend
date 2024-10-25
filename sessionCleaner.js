const fs = require('fs');
const path = require('path');

// Directorio donde se almacenan los archivos de sesión
const sessionDir = './bot_sessions'; // Cambia esto por tu directorio real

// Función para detectar la sesión activa y eliminar las anteriores
const cleanOldSessions = () => {
    fs.readdir(sessionDir, (err, files) => {
        if (err) {
            console.error('Error al leer el directorio de sesiones:', err);
            return;
        }

        // Filtar para obtener solo archivos .json (asumiendo que las sesiones se guardan como .json)
        const sessionFiles = files.filter(file => file.endsWith('.json'));

        if (sessionFiles.length === 0) {
            console.log('No se encontraron archivos de sesión.');
            return;
        }

        // Obtener el archivo más reciente basándonos en la fecha de modificación
        let latestFile = sessionFiles[0];
        let latestFileTime = fs.statSync(path.join(sessionDir, latestFile)).mtime;

        sessionFiles.forEach(file => {
            const fileTime = fs.statSync(path.join(sessionDir, file)).mtime;
            if (fileTime > latestFileTime) {
                latestFile = file;
                latestFileTime = fileTime;
            }
        });

        console.log(`La sesión activa es: ${latestFile}`);

        // Eliminar las sesiones antiguas
        sessionFiles.forEach(file => {
            if (file !== latestFile) {
                const filePath = path.join(sessionDir, file);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error(`Error al eliminar el archivo de sesión: ${file}`, err);
                    } else {
                        console.log(`Archivo de sesión eliminado: ${file}`);
                    }
                });
            }
        });
    });
};

module.exports = cleanOldSessions;
