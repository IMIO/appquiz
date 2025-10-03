
export interface Option {
  text: string;
  imageUrl?: string;
}

export interface Question {
  id: number;
  text: string;
  options: Option[];        // 4 réponses (texte + image)
  correctIndex: number;     // index de la bonne réponse
  imageUrl?: string;        // url d'illustration question
  imageUrlResult?: string;  // url d'illustration résultat
  originIndex?: number;     // index d'origine pour gérer les incohérences id/index
}