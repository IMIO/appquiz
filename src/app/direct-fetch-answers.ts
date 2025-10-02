/**
 * Correctif pour le problème de discordance entre les IDs des questions et les indices
 * 
 * Ce fichier contient des fonctions d'aide qui peuvent être utilisées pour résoudre
 * les problèmes de synchronisation entre les IDs des questions et les indices utilisés
 * dans l'application quiz.
 */

/**
 * Récupère toutes les réponses pour toutes les questions directement depuis l'API
 * en contournant le système de cache et en utilisant les IDs corrects.
 * 
 * @param apiUrl L'URL de base de l'API (normalement environment.apiUrl)
 * @param questions La liste des questions avec leurs IDs
 * @returns Une promesse qui se résout en un tableau de documents de réponses
 */
export async function fetchAllAnswersDirectly(apiUrl: string, questions: any[]): Promise<any[]> {
  const answersDocs: any[] = [];
  console.log(`[DIRECT-FETCH] 🚀 Récupération directe des réponses pour ${questions.length} questions`);
  
  // Pour chaque question, récupérer les réponses par ID et par index
  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const questionId = question?.id;
    
    if (questionId === undefined) {
      console.warn(`[DIRECT-FETCH] ⚠️ Question à l'index ${i} n'a pas d'ID défini`);
      continue;
    }
    
    console.log(`[DIRECT-FETCH] 📝 Question ${i} (ID: ${questionId})`);
    
    try {
      // Récupérer les réponses par l'ID de la question
      const responseById = await fetch(`${apiUrl}/answers/${questionId}`);
      const dataById = await responseById.json();
      
      if (dataById && dataById.answers && dataById.answers.length > 0) {
        console.log(`[DIRECT-FETCH] ✅ Réponses trouvées par ID=${questionId}: ${dataById.answers.length} réponses`);
        answersDocs.push({
          id: questionId,
          questionId: questionId,
          index: i,
          answers: dataById.answers,
          source: 'id'
        });
        // On a trouvé des réponses, on peut passer à la question suivante
        continue;
      }
      
      // Si pas de réponses par ID, essayer par index
      const responseByIndex = await fetch(`${apiUrl}/answers/${i}`);
      const dataByIndex = await responseByIndex.json();
      
      if (dataByIndex && dataByIndex.answers && dataByIndex.answers.length > 0) {
        console.log(`[DIRECT-FETCH] ✅ Réponses trouvées par index=${i}: ${dataByIndex.answers.length} réponses`);
        answersDocs.push({
          id: i,
          questionId: questionId,
          index: i,
          answers: dataByIndex.answers,
          source: 'index'
        });
        continue;
      }
      
      // Aucune réponse trouvée pour cette question
      console.log(`[DIRECT-FETCH] ℹ️ Aucune réponse trouvée pour la question ${i} (ID: ${questionId})`);
      answersDocs.push({
        id: questionId,
        questionId: questionId,
        index: i,
        answers: [],
        source: 'empty'
      });
      
    } catch (error) {
      console.error(`[DIRECT-FETCH] ❌ Erreur lors de la récupération des réponses pour la question ${i} (ID: ${questionId}):`, error);
      answersDocs.push({
        id: questionId,
        questionId: questionId,
        index: i,
        answers: [],
        error: true
      });
    }
  }
  
  console.log(`[DIRECT-FETCH] 📊 Récupération terminée: ${answersDocs.length} documents de réponses`);
  return answersDocs;
}