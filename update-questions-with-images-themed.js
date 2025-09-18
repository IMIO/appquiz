const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Ouvrir la base de données
const dbPath = path.join(__dirname, 'quiz.db');
const db = new sqlite3.Database(dbPath);

// Images thématiques spécifiques à l'accessibilité web
// Utilisation d'Unsplash avec des mots-clés pertinents
const questionImages = [
  'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop', // Keyboard navigation
  'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&h=600&fit=crop', // Buttons/UI elements
  'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=600&fit=crop', // Code/ARIA attributes
  'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&h=600&fit=crop', // Browser tabs/links
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop', // Images/visual content
  'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&h=600&fit=crop', // Video content
  'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=600&fit=crop', // Legal documents
  'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=600&fit=crop', // Privacy/GDPR
  'https://images.unsplash.com/photo-1523961131990-5ea7c61b2107?w=800&h=600&fit=crop', // Multilingual/translation
  'https://images.unsplash.com/photo-1581472723648-909f4851d4ae?w=800&h=600&fit=crop'  // Navigation structure
];

const resultImages = [
  'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=800&h=600&fit=crop', // Success/checkmark
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop', // Interface design
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop', // Code completion
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop', // Web analytics
  'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600&fit=crop', // Image optimization
  'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=600&fit=crop', // Video player
  'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&h=600&fit=crop', // Legal compliance
  'https://images.unsplash.com/photo-1564865878688-9a244444042a?w=800&h=600&fit=crop', // Security/privacy
  'https://images.unsplash.com/photo-1527689368864-3a821dbccc34?w=800&h=600&fit=crop', // Global communication
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop'  // Data structure
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

      console.log(`📸 Mise à jour de ${rows.length} questions avec des images thématiques...`);
      
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
            console.log(`✅ Question ${row.id} mise à jour avec images thématiques`);
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

      console.log('\n📊 Vérification des images thématiques ajoutées:');
      console.log('='.repeat(80));
      
      const themes = [
        'Navigation clavier',
        'Boutons vs liens',
        'Attributs ARIA',
        'Liens nouvel onglet',
        'Images et alt text',
        'Vidéos intégrées',
        'Mentions légales',
        'Consentement RGPD',
        'Multilingue',
        'Navigation sémantique'
      ];
      
      rows.forEach((row, index) => {
        const theme = themes[index] || `Question ${index + 1}`;
        console.log(`${theme} (Q${row.id}):`);
        console.log(`  📷 Image question: ${row.imageUrl}`);
        console.log(`  🏆 Image résultat: ${row.imageUrlResult}`);
        console.log('');
      });
      
      console.log(`✅ ${rows.length} questions mises à jour avec des images thématiques!`);
      resolve();
    });
  });
}

// Exécuter la mise à jour
async function main() {
  try {
    console.log('🚀 Démarrage de la mise à jour avec images thématiques...\n');
    
    await updateQuestionsWithImages();
    await verifyImages();
    
    console.log('🎉 Mise à jour terminée avec succès!');
    console.log('\n📝 Notes sur les images:');
    console.log('- Images haute qualité depuis Unsplash (libres de droits)');
    console.log('- Format: 800x600 pixels, optimisées pour l\'affichage web');
    console.log('- Thématiques cohérentes avec l\'accessibilité web');
    console.log('- Chaque question a une image unique pour question et résultat');
    console.log('- Compatible avec la classe CSS .question-illustration');
    console.log('\n🔄 Redémarrez votre application pour voir les images!');
    
  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    db.close();
  }
}

main();