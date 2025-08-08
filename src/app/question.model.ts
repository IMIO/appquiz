export interface Question {
  text: string;
  options: string[];
  correctIndex: number;
  imageUrl?: string;
  imageUrlResult?: string;
  imageUrlEnd?: string;
}
