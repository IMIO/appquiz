/**
 * Script pour corriger les problèmes d'apostrophes dans les chaînes en français
 * Résout les erreurs de compilation TypeScript liées aux caractères spéciaux
 */
const fs = require('fs');
const path = require('path');

const componentFilePath = path.join(__dirname, 'src', 'app', 'presentation', 'presentation.component.ts');

try {
    console.log('Lecture du fichier component...');
    let content = fs.readFileSync(componentFilePath, 'utf8');

    // Remplacement des chaînes problématiques par des versions avec guillemets doubles ou apostrophes échappées
    const replacements = [
        {
            search: /console\.log\(\'\[DEBUG\] launchGame\(\) appelé - Passage à l\'étape "waiting"\'\);/g,
            replace: 'console.log("[DEBUG] launchGame() appelé - Passage à l\'étape \\"waiting\\"");'
        },
        {
            search: /console\.log\(\'\[DEBUG\] Étape "waiting" définie avec succès =\'.*?\);/g,
            replace: 'console.log("[DEBUG] Étape \\"waiting\\" définie avec succès =", success);'
        },
        {
            search: /console\.log\(\'\[DEBUG\] Vérification d\'état après transition: step =\'.*?\);/g,
            replace: 'console.log("[DEBUG] Vérification d\'état après transition: step =", currentStep);'
        },
        {
            search: /console\.error\(\'\[DEBUG\] ERREUR: L\'état n\'est pas passé à "waiting" comme prévu\'\);/g,
            replace: 'console.error("[DEBUG] ERREUR: L\'état n\'est pas passé à \\"waiting\\" comme prévu");'
        },
        {
            search: /console\.log\(\'\[DEBUG\] Nouvelle tentative de passage à l\'étape "waiting"\'\);/g,
            replace: 'console.log("[DEBUG] Nouvelle tentative de passage à l\'étape \\"waiting\\"");'
        },
        {
            search: /console\.error\(\'\[ERROR\] Erreur lors du passage à l\'étape "waiting":\',.*?\);/g,
            replace: 'console.error("[ERROR] Erreur lors du passage à l\'étape \\"waiting\\":", error);'
        }
    ];

    // Appliquer tous les remplacements
    replacements.forEach(({search, replace}) => {
        content = content.replace(search, replace);
    });

    // Vérifier s'il y a encore des problèmes de chaîne avec apostrophes non échappées
    const problematicStrings = [
        "l'étape",
        "d'état",
        "l'état",
        "n'est"
    ];

    let anyRemainingIssue = false;
    problematicStrings.forEach(str => {
        const regex = new RegExp(`'[^']*${str}[^']*'`, 'g');
        const matches = content.match(regex);
        if (matches) {
            console.log(`⚠️ Problème potentiel restant avec "${str}" dans: `, matches);
            anyRemainingIssue = true;
        }
    });

    if (!anyRemainingIssue) {
        console.log('✅ Aucun problème d\'apostrophe restant détecté');
    }

    // Vérifier qu'il n'y a pas de caractères spéciaux malformés
    if (content.includes('��')) {
        console.log('⚠️ Caractères malformés détectés (��)');
    }

    // Écrire le fichier mis à jour
    fs.writeFileSync(componentFilePath, content, 'utf8');
    console.log('Fichier sauvegardé avec succès!');
    
    console.log('\nCorrections appliquées:');
    console.log('- Remplacement des apostrophes problématiques dans les chaînes');
    console.log('- Utilisation de guillemets doubles pour les chaînes contenant des apostrophes');
    console.log('- Échappement des apostrophes internes aux chaînes');

} catch (error) {
    console.error('Erreur lors de la mise à jour du fichier:', error);
}