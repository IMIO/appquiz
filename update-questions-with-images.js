const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ouvrir la base de données
const dbPath = path.join(__dirname, 'quiz.db');
const db = new sqlite3.Database(dbPath);

// Images thématiques pour l'accessibilité web
const questionImages = [
  'https://picsum.photos/800/600?random=1', // Navigation clavier
  'https://picsum.photos/800/600?random=2', // Lien vs Bouton  
  'https://picsum.photos/800/600?random=3', // Attributs ARIA
  'https://picsum.photos/800/600?random=4', // Liens nouvel onglet
  'https://picsum.photos/800/600?random=5', // Images alt
  'https://picsum.photos/800/600?random=6', // Vidéos intégrées
  'https://picsum.photos/800/600?random=7', // Mentions légales
  'https://picsum.photos/800/600?random=8', // Boutons consentement
  'https://picsum.photos/800/600?random=9', // Multilingue
  'https://picsum.photos/800/600?random=10' // Navigation attributs
];

const resultImages = [
  'https://picsum.photos/800/600?random=11', // Navigation clavier - résultat
  'https://picsum.photos/800/600?random=12', // Lien vs Bouton - résultat
  'https://picsum.photos/800/600?random=13', // Attributs ARIA - résultat
  'https://picsum.photos/800/600?random=14', // Liens nouvel onglet - résultat
  'https://picsum.photos/800/600?random=15', // Images alt - résultat
  'https://picsum.photos/800/600?random=16', // Vidéos intégrées - résultat
  'https://picsum.photos/800/600?random=17', // Mentions légales - résultat
  'https://picsum.photos/800/600?random=18', // Boutons consentement - résultat
  'https://picsum.photos/800/600?random=19', // Multilingue - résultat
  'https://picsum.photos/800/600?random=20'  // Navigation attributs - résultat
];

// Fonction pour mettre à jour les questions avec des images
function updateQuestionsWithImages() {
  return new Promise((resolve, reject) => {
    // Récupérer toutes les questions
    db.all("SELECT id FROM questions ORDER BY id", (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      console.log(`📸 Mise à jour de ${rows.length} questions avec des images...`);
      
      let completed = 0;
      
      rows.forEach((row, index) => {
        const questionImageUrl = questionImages[index] || questionImages[index % questionImages.length];
        const resultImageUrl = resultImages[index] || resultImages[index % resultImages.length];
        
        const updateQuery = `
          UPDATE questions 
          SET imageUrl = ?, imageUrlResult = ?
          WHERE id = ?
        `;
        
        db.run(updateQuery, [questionImageUrl, resultImageUrl, row.id], function(err) {
          if (err) {
            console.error(`❌ Erreur lors de la mise à jour de la question ${row.id}:`, err);
          } else {
            console.log(`✅ Question ${row.id} mise à jour avec images`);
          }
          
          completed++;
          if (completed === rows.length) {
            resolve();
          }
        });
      });
    });
  });
}

// Fonction pour vérifier les images
function verifyImages() {
  return new Promise((resolve, reject) => {
    db.all("SELECT id, text, imageUrl, imageUrlResult FROM questions ORDER BY id", (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      console.log('\n📊 Vérification des images ajoutées:');
      console.log('='.repeat(80));
      
      rows.forEach(row => {
        console.log(`Question ${row.id}: ${row.text.substring(0, 50)}...`);
        console.log(`  📷 Image question: ${row.imageUrl}`);
        console.log(`  🏆 Image résultat: ${row.imageUrlResult}`);
        console.log('');
      });
      
      console.log(`✅ ${rows.length} questions mises à jour avec succès!`);
      resolve();
    });
  });
}

// Exécuter la mise à jour
async function main() {
  try {
    console.log('🚀 Démarrage de la mise à jour des images...\n');
    
    await updateQuestionsWithImages();
    await verifyImages();
    
    console.log('🎉 Mise à jour terminée avec succès!');
    console.log('\n📝 Notes:');
    console.log('- Les images sont fournies par Picsum Photos (service gratuit)');
    console.log('- Format: 800x600 pixels, optimisées pour l\'affichage');
    console.log('- Chaque question a une image unique pour la question et le résultat');
    console.log('- Redémarrez votre application pour voir les changements');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    db.close();
  }
}

main();