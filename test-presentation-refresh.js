#!/usr/bin/env node

// Test automatisé pour vérifier que les participants apparaissent immédiatement après rafraîchissement
const { chromium } = require('playwright');

async function testPresentationRefresh() {
  console.log('🧪 Test de rafraîchissement de la page présentation...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Aller sur la page de présentation
    console.log('📍 Navigation vers /presentation');
    await page.goto('http://localhost:4200/presentation');
    
    // Attendre que la page soit chargée
    await page.waitForTimeout(2000);
    
    // Vérifier que le participant apparaît
    console.log('🔍 Recherche des participants...');
    const participantsBefore = await page.$$('li.step-list-item');
    console.log(`✅ Participants trouvés avant rafraîchissement: ${participantsBefore.length}`);
    
    // Rafraîchir la page
    console.log('🔄 Rafraîchissement de la page...');
    await page.reload();
    
    // Attendre un court délai (moins que les 6 secondes de polling)
    await page.waitForTimeout(1000);
    
    // Vérifier que les participants apparaissent toujours immédiatement
    console.log('🔍 Vérification des participants après rafraîchissement...');
    const participantsAfter = await page.$$('li.step-list-item');
    console.log(`✅ Participants trouvés après rafraîchissement: ${participantsAfter.length}`);
    
    if (participantsAfter.length > 0) {
      console.log('✅ SUCCESS: Les participants apparaissent immédiatement après rafraîchissement !');
    } else {
      console.log('❌ FAILED: Les participants n\'apparaissent pas après rafraîchissement');
    }
    
  } catch (error) {
    console.error('❌ Erreur pendant le test:', error);
  } finally {
    await browser.close();
  }
}

// Exécuter uniquement si playwright est disponible
(async () => {
  try {
    await testPresentationRefresh();
  } catch (error) {
    console.log('⚠️  Playwright non disponible, test manuel requis');
    console.log('📋 Instructions pour test manuel:');
    console.log('1. Aller sur http://localhost:4200/presentation');
    console.log('2. Vérifier que "TestUser" apparaît dans la liste');
    console.log('3. Rafraîchir la page (F5)');
    console.log('4. Vérifier que "TestUser" apparaît immédiatement (sans attendre 6 secondes)');
  }
})();