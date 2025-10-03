export interface LeaderboardEntry {
  id: string;
  name: string;
  avatarUrl?: string;
  score: number;
  totalTime: number;
  currentQuestionCorrect?: boolean; // Indique si le participant a correctement répondu à la question courante
}
