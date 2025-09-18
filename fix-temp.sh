#!/bin/bash

echo "🔧 Commentaire temporaire des lignes problématiques..."

# Commenter les imports Firebase
files=(
  "src/app/participant/participant.component.ts"
  "src/app/participant/qr-step/qr-step.component.ts"
  "src/app/presentation/presentation.component.ts"
  "src/app/quiz.component.ts"
)

for file in "${files[@]}"; do
  if [[ -f "$file" ]]; then
    echo "📝 Traitement de $file..."
    
    # Sauvegarder l'original
    cp "$file" "$file.backup"
    
    # Commenter les imports Firebase  
    sed -i '' 's/^import.*firebase\/firestore.*/\/\/ TEMP_DISABLED: &/' "$file"
    
    # Commenter les lignes avec doc(this.quizService['firestore']
    sed -i '' 's/.*doc(this\.quizService\[\x27firestore\x27\].*/\/\/ TEMP_DISABLED: &/' "$file"
    
    # Commenter les lignes avec collection(this.quizService['firestore']
    sed -i '' 's/.*collection(this\.quizService\[\x27firestore\x27\].*/\/\/ TEMP_DISABLED: &/' "$file"
    
    # Commenter les lignes avec runInInjectionContext(this.quizService['injector']
    sed -i '' 's/.*runInInjectionContext(this\.quizService\[\x27injector\x27\].*/\/\/ TEMP_DISABLED: &/' "$file"
    
    # Commenter les lignes avec onSnapshot
    sed -i '' 's/.*onSnapshot.*/\/\/ TEMP_DISABLED: &/' "$file"
    
    # Commenter les lignes avec getDoc
    sed -i '' 's/.*getDoc.*/\/\/ TEMP_DISABLED: &/' "$file"
    
    echo "✅ $file traité"
  else
    echo "❌ $file non trouvé"
  fi
done

echo "🎉 Commentaires temporaires appliqués!"