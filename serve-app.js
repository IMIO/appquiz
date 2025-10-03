const express = require('express');
const path = require('path');
const app = express();

// Définir le dossier de build comme statique
app.use(express.static(path.join(__dirname, 'dist/quiz-app')));

// Toutes les requêtes doivent être redirigées vers index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/quiz-app/index.html'));
});

// Démarrer le serveur
const port = process.env.PORT || 4200;
app.listen(port, () => {
  console.log(`Application disponible sur http://localhost:${port}`);
});