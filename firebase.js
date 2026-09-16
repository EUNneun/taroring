const config = window.TARORING_FIREBASE_CONFIG;

if (config?.apiKey && config?.projectId) {
  const [{ initializeApp }, authSdk, firestore] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')
  ]);

  const app = initializeApp(config);
  const auth = authSdk.getAuth(app);
  const db = firestore.getFirestore(app);

  window.taroringCloud = {
    signInWithGoogle() {
      return authSdk.signInWithPopup(auth, new authSdk.GoogleAuthProvider());
    },
    signOut() {
      return authSdk.signOut(auth);
    },
    async saveSession(state) {
      const user = auth.currentUser;
      if (!user || !state.sessionId) throw new Error('로그인이 필요합니다.');
      await firestore.setDoc(
        firestore.doc(db, 'users', user.uid, 'sessions', state.sessionId),
        { ...structuredClone(state), updatedAt: firestore.serverTimestamp() },
        { merge: true }
      );
    },
    async loadLatestSession() {
      const user = auth.currentUser;
      if (!user) return null;
      const snapshot = await firestore.getDocs(firestore.query(
        firestore.collection(db, 'users', user.uid, 'sessions'),
        firestore.orderBy('updatedAt', 'desc'),
        firestore.limit(1)
      ));
      return snapshot.empty ? null : snapshot.docs[0].data();
    }
  };

  authSdk.onAuthStateChanged(auth, user => {
    window.dispatchEvent(new CustomEvent('taroring-auth', {
      detail: user ? { uid: user.uid, name: user.displayName || '내 계정' } : null
    }));
  });
}
