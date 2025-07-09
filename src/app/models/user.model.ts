export interface User {
  id: string;
  name: string;
  score: number;
  answers: number[];        // index des réponses données
  avatarUrl?: string;       // URL de l'avatar (optionnel)
}