const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Assure-toi que ce fichier existe

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateQuestions() {
  const questionsRef = db.collection('questions');
  const snapshot = await questionsRef.get();

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.question && data.reponses && typeof data.bonneReponseIndex === 'number') {
      const migrated = {
        id: data.id ?? doc.id,
        text: data.question,
        options: data.reponses,
        correctIndex: data.bonneReponseIndex
      };
      await doc.ref.set(migrated, { merge: true });
      console.log(`Question ${doc.id} migrée :`, migrated);
    } else {
      console.log(`Question ${doc.id} déjà au bon format ou incomplète.`);
    }
  }
  console.log('Migration terminée.');
}

migrateQuestions().catch(console.error);