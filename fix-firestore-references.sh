#!/bin/bash

# Script pour commenter les références Firestore obsolètes dans l'architecture HTTP

echo "🔧 Nettoyage des références Firestore obsolètes..."

# Fichiers à traiter
files=(
  "src/app/presentation/presentation.component.ts"
  "src/app/participant/participant.component.ts" 
  "src/app/participant/qr-step/qr-step.component.ts"
  "src/app/quiz.component.ts"
)

for file in "${files[@]}"; do
  if [[ -f "$file" ]]; then
    echo "📝 Traitement de $file..."
    
    # Sauvegarder l'original
    cp "$file" "$file.backup"
    
    # Commenter les lignes avec quizService['firestore']
    sed -i '' 's/.*quizService\[\x27firestore\x27\]/\/\/ DISABLED: &/' "$file"
    
    # Commenter les lignes avec quizService['injector']  
    sed -i '' 's/.*quizService\[\x27injector\x27\]/\/\/ DISABLED: &/' "$file"
    
    # Commenter les imports Firebase
    sed -i '' 's/^import.*firebase\/firestore.*/\/\/ DISABLED: &/' "$file"
    
    echo "✅ $file traité"
  else
    echo "❌ $file non trouvé"
  fi
done

echo "🎉 Nettoyage terminé!"