import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { QRCodeComponent } from 'angularx-qrcode';
import { Router } from '@angular/router';
import { QuizService, QuizStep } from '../../services/quiz.service';

@Component({
  selector: 'app-qr-step',
  standalone: true,
  imports: [CommonModule, QRCodeComponent],
  templateUrl: './qr-step.component.html',
  styleUrls: ['./qr-step.component.css']
})
export class QrStepComponent {
  windowLocation: string;
  participants: import('../../models/user.model').User[] = [];
  step: QuizStep = 'lobby';
  currentIndex: number = 0;
  currentQuestion: import('../../models/question.model').Question | null = null;
  answers: any[] = [];
  stats = { good: 0, bad: 0, none: 0 };

  constructor(private router: Router, public quizService: QuizService) {
    this.windowLocation = window.location.origin;
    this.quizService.getStep().subscribe(step => {
      this.step = step;
    });
    this.quizService.getParticipants$().subscribe(participants => {
      this.participants = participants;
      this.updateStats();
    });
    this.quizService.getCurrentIndex().subscribe(idx => {
      this.currentIndex = idx;
      this.currentQuestion = this.quizService.getCurrentQuestion(idx);
      this.subscribeAnswers();
    });
  }

  subscribeAnswers() {
    if (typeof this.currentIndex === 'number') {
      this.quizService.getAnswers$(this.currentIndex).subscribe(answers => {
        this.answers = answers;
        this.updateStats();
      });
    }
  }

  updateStats() {
    if (this.currentQuestion && this.answers && this.participants) {
      // Debug : log structure des réponses reçues
      console.log('[DEBUG] Réponses reçues pour la question', this.currentIndex, JSON.stringify(this.answers));
      this.stats = this.quizService.countResults(this.answers, this.currentQuestion.correctIndex, this.participants);
      console.log('[DEBUG] Stats calculées :', this.stats);
    }
  }

  // Réinitialisation complète du quiz (étape, participants, index, réponses)
  async restartGame() {
    if (!confirm('Êtes-vous sûr de vouloir réinitialiser complètement le quiz ? Cette action supprimera tous les participants et toutes les réponses.')) {
      return;
    }
    const { doc, setDoc, collection, getDocs, deleteDoc } = await import('firebase/firestore');
    const quizStateDoc = doc(this.quizService['firestore'], 'quizState/main');
    const participantsCol = collection(this.quizService['firestore'], 'participants');
    const answersCol = collection(this.quizService['firestore'], 'answers');
    // Reset étape et index
    await setDoc(quizStateDoc, { step: 'lobby', currentQuestionIndex: 0 }, { merge: true });
    // Supprime tous les participants
    const participantsSnap = await getDocs(participantsCol);
    for (const docu of participantsSnap.docs) {
      await deleteDoc(docu.ref);
    }
    // Supprime toutes les réponses
    const answersSnap = await getDocs(answersCol);
    for (const docu of answersSnap.docs) {
      await deleteDoc(docu.ref);
    }
    alert('Quiz réinitialisé. Tous les participants et réponses ont été supprimés.');
    // Pas de reload ici : l’admin reste sur l’écran QR !
  }



  launchGame() {
    this.quizService.setStep('waiting');
  }

  confirmLaunchGame() {
    if (confirm('Clôturer les inscriptions et passer à la phase d’attente ?')) {
      this.launchGame();
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }
  public async resetParticipants() {
    await this.quizService.resetParticipants();
  }
}

