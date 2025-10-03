/**
 * Ce module fournit des fonctions de diagnostic avancées pour le leaderboard
 * pour aider à identifier les problèmes de classement et de calcul de score
 * 
 * Ajouté comme partie des correctifs pour résoudre les problèmes d'affichage du classement
 */

import { LeaderboardEntry } from './models/leaderboard-entry.model';
import { User } from './models/user.model';

/**
 * Génère un rapport de diagnostic du leaderboard
 * @param leaderboard Le tableau des entrées du leaderboard
 * @param participants La liste complète des participants
 * @param goodAnswersTimesByUser L'objet contenant les temps de réponse par utilisateur
 * @param formatTime Fonction pour formater le temps (ms -> chaîne lisible)
 */
export function generateLeaderboardDiagnostic(
  leaderboard: LeaderboardEntry[],
  participants: User[],
  goodAnswersTimesByUser: { [userId: string]: number[] },
  formatTime: (ms: number) => string
): void {
  console.log('====== DIAGNOSTIC DU LEADERBOARD ======');

  console.log(`🔹 Total participants: ${participants.length}`);
  console.log(`🔹 Total entrées leaderboard: ${leaderboard.length}`);
  
  // Vérifier si tous les participants sont dans le leaderboard
  const participantIds = participants.map(p => String(p.id));
  const leaderboardIds = leaderboard.map(entry => String(entry.id));
  
  const missingParticipants = participants.filter(p => 
    !leaderboardIds.includes(String(p.id))
  );
  
  if (missingParticipants.length > 0) {
    console.warn(`⚠️ ALERTE: ${missingParticipants.length} participants ne sont pas dans le leaderboard:`);
    missingParticipants.forEach(p => {
      console.warn(`   → ${p.name} (ID: ${p.id})`);
    });
  } else {
    console.log('✅ Tous les participants sont présents dans le leaderboard');
  }
  
  // Vérifier si tous les participants ont des temps de réponse
  const participantsWithoutTimes = participants.filter(p => 
    !goodAnswersTimesByUser[p.id] || goodAnswersTimesByUser[p.id].length === 0
  );
  
  if (participantsWithoutTimes.length > 0) {
    console.warn(`⚠️ ALERTE: ${participantsWithoutTimes.length} participants n'ont aucun temps de réponse enregistré:`);
    participantsWithoutTimes.forEach(p => {
      console.warn(`   → ${p.name} (ID: ${p.id})`);
    });
  }
  
  // Détail du classement pour diagnostic
  console.log('\n📊 Détail du classement:');
  leaderboard.forEach((entry, idx) => {
    const times = goodAnswersTimesByUser[entry.id] || [];
    const validTimes = times.filter(time => typeof time === 'number' && !isNaN(time));
    const totalTime = validTimes.reduce((sum, time) => sum + time, 0);
    
    console.log(`${idx + 1}. ${entry.name} (ID: ${entry.id})`);
    console.log(`   → Score: ${entry.score} points`);
    console.log(`   → Temps total: ${formatTime(totalTime)}`);
    console.log(`   → Temps par question: ${validTimes.map((time, i) => time ? `Q${i}: ${formatTime(time)}` : '').filter(Boolean).join(', ')}`);
  });
  
  console.log('====================================');
}

/**
 * Vérifie la synchronisation entre les réponses et les questions
 * @param allAnswersDocs Les documents de réponses pour toutes les questions
 * @param questions La liste des questions
 */
export function checkAnswersQuestionsSynchronization(
  allAnswersDocs: any[],
  questions: any[]
): void {
  console.log('====== SYNCHRONISATION QUESTIONS / RÉPONSES ======');
  
  console.log(`🔹 Total questions: ${questions.length}`);
  console.log(`🔹 Total documents de réponses: ${allAnswersDocs.length}`);
  
  // Vérifier si le nombre de documents correspond au nombre de questions
  if (questions.length !== allAnswersDocs.length) {
    console.warn(`⚠️ Nombre de documents de réponses (${allAnswersDocs.length}) différent du nombre de questions (${questions.length})`);
  }
  
  // Vérifier la correspondance des IDs
  const mismatches = [];
  
  for (let i = 0; i < questions.length; i++) {
    if (i < allAnswersDocs.length) {
      const question = questions[i];
      const answerDoc = allAnswersDocs[i];
      
      if (question.id !== answerDoc.id) {
        mismatches.push({
          index: i,
          questionId: question.id,
          answerDocId: answerDoc.id
        });
      }
    }
  }
  
  if (mismatches.length > 0) {
    console.warn(`⚠️ ${mismatches.length} discordances entre IDs de questions et documents de réponses:`);
    mismatches.forEach(m => {
      console.warn(`   → Index ${m.index}: Question ID=${m.questionId}, Réponses ID=${m.answerDocId}`);
    });
  } else {
    console.log('✅ Correspondance parfaite entre les IDs de questions et les documents de réponses');
  }
  
  console.log('====================================');
}