const sqlite3 = require('sqlite3').verbose();
const path = require('path');

async function addImageColumns() {
  console.log('🔧 Ajout des colonnes d\'images à la base de données...');
  
  const dbPath = path.join(__dirname, 'quiz.db');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Erreur lors de l\'ouverture de la base:', err.message);
        reject(err);
        return;
      }
      console.log('📁 Base de données ouverte:', dbPath);
    });
    
    // Vérifier d'abord si les colonnes existent déjà
    db.all("PRAGMA table_info(questions)", (err, tableInfo) => {
      if (err) {
        console.error('❌ Erreur lors de la lecture de la structure:', err.message);
        db.close();
        reject(err);
        return;
      }
      
      const existingColumns = tableInfo.map(col => col.name);
      console.log('📋 Colonnes existantes:', existingColumns);
      
      // Ajouter les colonnes d'images si elles n'existent pas
      const columnsToAdd = [
        { name: 'imageUrl', type: 'TEXT' },
        { name: 'imageUrlResult', type: 'TEXT' },
        { name: 'imageUrlEnd', type: 'TEXT' }
      ];
      
      let addedCount = 0;
      let totalToAdd = columnsToAdd.filter(col => !existingColumns.includes(col.name)).length;
      
      if (totalToAdd === 0) {
        console.log('ℹ️  Toutes les colonnes d\'images existent déjà');
        
        // Vérifier la structure finale
        db.all("PRAGMA table_info(questions)", (err, finalTableInfo) => {
          if (err) {
            console.error('❌ Erreur lors de la vérification finale:', err.message);
            db.close();
            reject(err);
            return;
          }
          
          console.log('📋 Structure finale de la table questions:');
          finalTableInfo.forEach(col => {
            console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
          });
          
          db.close();
          console.log('✅ Mise à jour de la structure de la base de données terminée !');
          resolve();
        });
        return;
      }
      
      for (const column of columnsToAdd) {
        if (!existingColumns.includes(column.name)) {
          console.log(`➕ Ajout de la colonne ${column.name}...`);
          db.run(`ALTER TABLE questions ADD COLUMN ${column.name} ${column.type}`, (err) => {
            if (err) {
              console.error(`❌ Erreur lors de l'ajout de la colonne ${column.name}:`, err.message);
              db.close();
              reject(err);
              return;
            }
            
            console.log(`✅ Colonne ${column.name} ajoutée avec succès`);
            addedCount++;
            
            if (addedCount === totalToAdd) {
              // Vérifier la structure finale
              db.all("PRAGMA table_info(questions)", (err, finalTableInfo) => {
                if (err) {
                  console.error('❌ Erreur lors de la vérification finale:', err.message);
                  db.close();
                  reject(err);
                  return;
                }
                
                console.log('📋 Structure finale de la table questions:');
                finalTableInfo.forEach(col => {
                  console.log(`  - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
                });
                
                db.close();
                console.log('✅ Mise à jour de la structure de la base de données terminée !');
                resolve();
              });
            }
          });
        } else {
          console.log(`ℹ️  La colonne ${column.name} existe déjà`);
        }
      }
    });
  });
}

addImageColumns().catch(console.error);