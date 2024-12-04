// sessionCleaner.js
const fs = require('fs');
const path = require('path');

// Directorio donde se almacenan los archivos de sesión
const sessionDir = './bot_sessions'; // Cambia esto por tu directorio real
const excludeFiles = ['baileys_store.json','creds.json']; // Archivos que no deben ser eliminados

// Definir una función printer para indicar que la función se ejecutó
const printer = (message) => {
    console.log(message); // Actualmente solo imprime en consola
};

// Función para detectar la sesión activa y limpiar claves antiguas
const cleanOldSessions = () => {
    fs.readdir(sessionDir, (err, files) => {
        if (err) {
            return;
        }

        // Filtrar los archivos de sesión (excluyendo archivos protegidos como baileys_store.json)
        const sessionFiles = files.filter(file => file.endsWith('.json') && !excludeFiles.includes(file));

        if (sessionFiles.length === 0) {
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

        // Eliminar todos los archivos pre-key-XX y las sesiones antiguas, excepto el más reciente
        sessionFiles.forEach(file => {
            if (file !== latestFile) {
                const filePath = path.join(sessionDir, file);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        return;
                    }
                });
            }
        });
    });

    // Indicar que la función se ejecutó
    printer('La función cleanOldSessions se ejecutó correctamente');
};

// Exporta la función correctamente
module.exports = { cleanOldSessions };
