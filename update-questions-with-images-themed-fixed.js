const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Images thématiques spécifiques à l'accessibilité web
// Utilisation d'Unsplash avec des mots-clés pertinents
const questionImages = [
  'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=800&h=600&fit=crop', // Keyboard navigation
  'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&h=600&fit=crop', // Screen reader
  'https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&h=600&fit=crop', // Visual impairment
  'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&h=600&fit=crop', // Hearing aid
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop', // Braille
  'https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800&h=600&fit=crop', // Voice control
  'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=600&fit=crop', // Data visualization
  'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=800&h=600&fit=crop', // Web development
  'https://images.unsplash.com/photo-1523961131990-5ea7c61b2107?w=800&h=600&fit=crop', // Mobile accessibility
  'https://images.unsplash.com/photo-1581472723648-909f4851d4ae?w=800&h=600&fit=crop'  // Inclusive design
];

const resultImages = [
  'https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=800&h=600&fit=crop', // Success/checkmark
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=600&fit=crop', // Technology
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&h=600&fit=crop', // Light bulb/idea
  'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=600&fit=crop', // Charts/analytics
  'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=600&fit=crop', // Target/goal
  'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&h=600&fit=crop', // Teamwork
  'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=800&h=600&fit=crop', // Interface design
  'https://images.unsplash.com/photo-1564865878688-9a244444042a?w=800&h=600&fit=crop', // Code quality
  'https://images.unsplash.com/photo-1527689368864-3a821dbccc34?w=800&h=600&fit=crop', // User experience
  'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=600&fit=crop'  // Learning/education
];

async function updateQuestions() {
  console.log('🚀 Démarrage de la mise à jour avec images thématiques...');
  
  const dbPath = path.join(__dirname, 'quiz.db');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Erreur lors de l\'ouverture de la base:', err.message);
        reject(err);
        return;
      }
      console.log('📁 Base de données ouverte');
    });
    
    // Récupérer toutes les questions
    db.all('SELECT id, text FROM questions ORDER BY id', (err, questions) => {
      if (err) {
        console.error('❌ Erreur lors de la récupération des questions:', err.message);
        db.close();
        reject(err);
        return;
      }
      
      console.log(`📸 Mise à jour de ${questions.length} questions avec des images thématiques...`);
      
      let processedCount = 0;
      let errors = [];
      
      questions.forEach((question, index) => {
        const questionImageUrl = questionImages[index % questionImages.length];
        const resultImageUrl = resultImages[index % resultImages.length];
        
        db.run(
          'UPDATE questions SET imageUrl = ?, imageUrlResult = ? WHERE id = ?',
          [questionImageUrl, resultImageUrl, question.id],
          function(err) {
            if (err) {
              console.error(`❌ Erreur lors de la mise à jour de la question ${question.id}:`, err.message);
              errors.push({ questionId: question.id, error: err.message });
            } else {
              console.log(`✅ Question ${question.id} mise à jour avec succès`);
            }
            
            processedCount++;
            
            if (processedCount === questions.length) {
              if (errors.length > 0) {
                console.log(`⚠️  ${errors.length} erreur(s) lors de la mise à jour`);
                errors.forEach(error => {
                  console.log(`   - Question ${error.questionId}: ${error.error}`);
                });
              }
              
              // Vérifier les images ajoutées
              db.all('SELECT id, text, imageUrl, imageUrlResult FROM questions ORDER BY id', (err, updatedQuestions) => {
                if (err) {
                  console.error('❌ Erreur lors de la vérification:', err.message);
                  db.close();
                  reject(err);
                  return;
                }
                
                console.log('\n📋 Vérification des images ajoutées:');
                updatedQuestions.forEach(q => {
                  console.log(`Question ${q.id}:`);
                  console.log(`  Texte: ${q.text.substring(0, 50)}...`);
                  console.log(`  Image question: ${q.imageUrl ? '✅' : '❌'} ${q.imageUrl || 'Aucune'}`);
                  console.log(`  Image réponse: ${q.imageUrlResult ? '✅' : '❌'} ${q.imageUrlResult || 'Aucune'}`);
                  console.log('');
                });
                
                db.close();
                console.log('🎉 Mise à jour terminée !');
                
                if (errors.length === 0) {
                  resolve();
                } else {
                  reject(new Error(`${errors.length} erreurs lors de la mise à jour`));
                }
              });
            }
          }
        );
      });
    });
  });
}

// Exécuter la mise à jour
updateQuestions().catch(console.error);