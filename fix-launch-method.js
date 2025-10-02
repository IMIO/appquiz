/**
 * Script pour remplacer entièrement la méthode launchGame par une version corrigée
 */
const fs = require('fs');
const path = require('path');

const componentFilePath = path.join(__dirname, 'src', 'app', 'presentation', 'presentation.component.ts');
const fixedMethodPath = path.join(__dirname, 'launchGame-fixed.txt');

try {
    console.log('Lecture des fichiers...');
    let content = fs.readFileSync(componentFilePath, 'utf8');
    const fixedMethod = fs.readFileSync(fixedMethodPath, 'utf8');

    // Définir une regex pour trouver toute déclaration de méthode launchGame
    // Cette expression est plus robuste pour trouver n'importe quelle forme de la méthode launchGame
    const launchGameRegex = /async\s+launchGame\(\)\s*\{[\s\S]*?(?=\n\s*\/\/\s*Méthode|\/\*\*|\n\s*[a-zA-Z]|\}[\s\n]*$)/g;
    
    // Trouver toutes les occurrences
    const matches = content.match(launchGameRegex);
    console.log(`Trouvé ${matches ? matches.length : 0} occurrences de la méthode launchGame`);

    if (matches && matches.length > 0) {
        // Remplacer chaque occurrence par la version corrigée
        matches.forEach(match => {
            content = content.replace(match, fixedMethod);
        });
        
        // Écrire le fichier mis à jour
        fs.writeFileSync(componentFilePath, content, 'utf8');
        console.log('Fichier sauvegardé avec succès!');
        
        console.log('\nCorrections appliquées:');
        console.log('- Remplacement complet de la méthode launchGame avec une version où toutes les chaînes de caractères sont correctement formatées');
    } else {
        console.log('Aucune occurrence de la méthode launchGame trouvée - vérifiez le fichier manuellement');
    }

} catch (error) {
    console.error('Erreur lors de la mise à jour du fichier:', error);
}