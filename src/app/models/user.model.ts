export interface User {
  id: string;
  name: string;
  score: number;
  answers: number[];        // index des réponses données
  avatarUrl?: string;       // URL de l'avatar (optionnel)
  userId?: string;          // Alias pour id (compatibilité)
  userName?: string;        // Alias pour name (compatibilité)
  currentQuestionCorrect?: boolean; // Indicateur de bonne réponse à la question courante
}