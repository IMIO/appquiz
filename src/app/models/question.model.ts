export interface Question {
  id: number;
  text: string;
  options: string[];        // 4 réponses
  correctIndex: number;     // index de la bonne réponse
}