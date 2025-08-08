export interface Question {
  id: number;
  text: string;
  options: string[];        // 4 réponses
  correctIndex: number;     // index de la bonne réponse
  imageUrl?: string;        // url d'illustration question
  imageUrlResult?: string;  // url d'illustration résultat
  imageUrlEnd?: string;     // url d'illustration fin
}