const config = window.TARORING_FIREBASE_CONFIG;

if (config?.apiKey && config?.projectId) {
  const [{ initializeApp }, { getAuth, signInAnonymously }, firestore] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')
  ]);

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = firestore.getFirestore(app);
  let userPromise;

  async function getUser() {
    if (auth.currentUser) return auth.currentUser;
    userPromise ||= signInAnonymously(auth).then(result => result.user);
    return userPromise;
  }

  window.taroringCloud = {
    async saveSession(state) {
      const user = await getUser();
      const sessionId = state.sessionId || crypto.randomUUID();
      state.sessionId = sessionId;
      await firestore.setDoc(
        firestore.doc(db, 'users', user.uid, 'sessions', sessionId),
        { ...structuredClone(state), updatedAt: firestore.serverTimestamp() },
        { merge: true }
      );
    }
  };
}
