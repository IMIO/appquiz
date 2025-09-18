#!/bin/bash

echo "🔧 Transformation des composants pour l'architecture HTTP..."

# Fonction pour transformer participant.component.ts
fix_participant_component() {
  echo "📝 Transformation de src/app/participant/participant.component.ts..."
  
  # Supprimer l'import Firebase Firestore
  sed -i '' '/import.*firebase\/firestore/d' src/app/participant/participant.component.ts
  
  # Remplacer la méthode checkQuizState qui utilise Firestore
  cat > temp_participant_fix.ts << 'EOF'
  private checkQuizState() {
    // Dans l'architecture HTTP, nous utilisons les observables du service
    this.quizService.getStep().subscribe(step => {
      if (step) {
        this.quizStep = step as QuizStep;
        this.cdr.markForCheck();
      }
    });
  }

  async submitName() {
    if (this.nameInput.trim() && this.nameInput.trim().length > 0) {
      // Via l'API HTTP sécurisée
      const user: User = {
        id: this.userId,
        name: this.nameInput.trim(),
        score: 0,
        answers: []
      };
      
      await this.quizService.addParticipant(user);
      this.router.navigate(['/participant/quiz']);
    }
  }
EOF

  # Remplacer les méthodes problématiques 
  sed -i '' '/private checkQuizState()/,/^  }/c\
  private checkQuizState() {\
    \/\/ Dans l'architecture HTTP, nous utilisons les observables du service\
    this.quizService.getStep().subscribe(step => {\
      if (step) {\
        this.quizStep = step as QuizStep;\
        this.cdr.markForCheck();\
      }\
    });\
  }' src/app/participant/participant.component.ts

  sed -i '' '/async submitName()/,/^  }/c\
  async submitName() {\
    if (this.nameInput.trim() && this.nameInput.trim().length > 0) {\
      \/\/ Via l API HTTP sécurisée\
      const user: User = {\
        id: this.userId,\
        name: this.nameInput.trim(),\
        score: 0,\
        answers: []\
      };\
      \
      await this.quizService.addParticipant(user);\
      this.router.navigate(["/participant/quiz"]);\
    }\
  }' src/app/participant/participant.component.ts
  
  echo "✅ participant.component.ts traité"
}

# Fonction pour transformer qr-step.component.ts
fix_qr_step_component() {
  echo "📝 Transformation de src/app/participant/qr-step/qr-step.component.ts..."
  
  # Supprimer l'import Firebase Firestore
  sed -i '' '/import.*firebase\/firestore/d' src/app/participant/qr-step/qr-step.component.ts
  
  # Remplacer la méthode reset qui utilise Firestore
  sed -i '' '/async reset()/,/^  }/c\
  async reset() {\
    \/\/ Dans l architecture HTTP, utiliser la méthode du service\
    await this.quizService.resetParticipants();\
    console.log("Game reset via HTTP API");\
  }' src/app/participant/qr-step/qr-step.component.ts
  
  echo "✅ qr-step.component.ts traité"
}

# Fonction pour transformer presentation.component.ts
fix_presentation_component() {
  echo "📝 Transformation de src/app/presentation/presentation.component.ts..."
  
  # Supprimer l'import Firebase Firestore
  sed -i '' '/import.*firebase\/firestore/d' src/app/presentation/presentation.component.ts
  
  # Simplifier fetchQuestionStartTimes
  sed -i '' '/fetchQuestionStartTimes()/,/^  }/c\
  public async fetchQuestionStartTimes(): Promise<void> {\
    \/\/ Dans l architecture HTTP, les timestamps sont gérés côté serveur\
    console.log("fetchQuestionStartTimes: géré côté serveur HTTP");\
  }' src/app/presentation/presentation.component.ts
  
  # Simplifier nextQuestion pour supprimer la partie Firestore
  sed -i '' '/nextQuestion()/,/^  }/c\
  nextQuestion() {\
    \/\/ Via l API HTTP sécurisée\
    this.quizService.nextQuestion(this.currentIndex);\
  }' src/app/presentation/presentation.component.ts
  
  # Simplifier restartGame
  sed -i '' '/async restartGame()/,/^  }/c\
  async restartGame() {\
    \/\/ Via l API HTTP sécurisée\
    await this.quizService.resetParticipants();\
    this.step = "lobby";\
    this.currentIndex = 0;\
    this.currentQuestion = null;\
    this.answersCount = [];\
    this.leaderboard = [];\
    this.timerValue = 15;\
    this.voters = [];\
    this.refresh();\
  }' src/app/presentation/presentation.component.ts
  
  echo "✅ presentation.component.ts traité"
}

# Fonction pour transformer quiz.component.ts
fix_quiz_component() {
  echo "📝 Transformation de src/app/quiz.component.ts..."
  
  # Supprimer l'import Firebase Firestore
  sed -i '' '/import.*firebase\/firestore/d' src/app/quiz.component.ts
  
  # Simplifier checkQuizState
  sed -i '' '/private checkQuizState()/,/^  }/c\
  private checkQuizState() {\
    \/\/ Dans l architecture HTTP, utiliser les observables du service\
    this.quizService.getStep().subscribe(step => {\
      this.quizStep = step as QuizStep;\
      this.cdr.markForCheck();\
    });\
  }' src/app/quiz.component.ts
  
  echo "✅ quiz.component.ts traité"
}

# Exécuter toutes les transformations
fix_participant_component
fix_qr_step_component  
fix_presentation_component
fix_quiz_component

echo "🎉 Transformation terminée!"