import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { QuizService } from '../services/quiz-secure.service';

@Component({
  selector: 'app-reset',
  standalone: true,
  template: `
    <div style="
      display: flex; 
      align-items: center; 
      justify-content: center; 
      height: 100vh; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-family: Arial, sans-serif;
    ">
      <div style="
        text-align: center; 
        padding: 2rem; 
        border-radius: 12px; 
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
      ">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🔄</div>
        <h2 style="margin-bottom: 1rem; font-size: 1.5rem;">Réinitialisation en cours...</h2>
        <p style="margin: 0; opacity: 0.8;">Remise à zéro complète du quiz</p>
        <div style="
          margin-top: 2rem;
          width: 200px;
          height: 4px;
          background: rgba(255,255,255,0.2);
          border-radius: 2px;
          overflow: hidden;
        ">
          <div style="
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, #ff6b6b, #4ecdc4, #45b7d1);
            animation: loading 2s ease-in-out infinite;
          "></div>
        </div>
      </div>
    </div>
    <style>
      @keyframes loading {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(200%); }
      }
    </style>
  `
})
export class ResetComponent implements OnInit {

  constructor(
    private quizService: QuizService,
    private router: Router
  ) {}

  ngOnInit() {
    console.log('🔄 Route /reset activée - Réinitialisation complète du quiz...');
    
    // Effectuer la réinitialisation complète
    this.performReset();
  }

  private async performReset() {
    try {
      console.log('🔄 Début de la réinitialisation...');
      
      // Appeler la méthode de reset du service
      await this.quizService.resetParticipants();
      
      console.log('✅ Réinitialisation complète terminée');
      
      // Attendre un peu pour montrer l'animation
      setTimeout(() => {
        console.log('➡️ Redirection vers /presentation...');
        // Rediriger vers la présentation
        this.router.navigate(['/presentation']);
      }, 2000);
      
    } catch (error) {
      console.error('❌ Erreur lors de la réinitialisation:', error);
      
      // Afficher l'erreur dans l'interface
      document.body.innerHTML += `
        <div style="position: fixed; bottom: 20px; right: 20px; background: #ff4444; color: white; padding: 1rem; border-radius: 8px; z-index: 99999;">
          ❌ Erreur: ${error}
        </div>
      `;
      
      // En cas d'erreur, rediriger quand même vers la présentation après un délai
      setTimeout(() => {
        this.router.navigate(['/presentation']);
      }, 5000);
    }
  }
}