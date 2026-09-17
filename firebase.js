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

  const NESTED_ARRAY_KEY = '__taroringNestedArray';

  function encodeForFirestore(value, insideArray = false) {
    if (Array.isArray(value)) {
      const encoded = value.map(item => encodeForFirestore(item, true));
      return insideArray ? { [NESTED_ARRAY_KEY]: encoded } : encoded;
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, encodeForFirestore(item, false)])
      );
    }

    return value;
  }

  function decodeFromFirestore(value) {
    if (Array.isArray(value)) {
      return value.map(decodeFromFirestore);
    }

    if (value && typeof value === 'object') {
      if (
        Object.prototype.hasOwnProperty.call(value, NESTED_ARRAY_KEY) &&
        Object.keys(value).length === 1 &&
        Array.isArray(value[NESTED_ARRAY_KEY])
      ) {
        return value[NESTED_ARRAY_KEY].map(decodeFromFirestore);
      }

      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, decodeFromFirestore(item)])
      );
    }

    return value;
  }

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
      const cloudState = encodeForFirestore(structuredClone(state));
      await firestore.setDoc(
        firestore.doc(db, 'users', user.uid, 'sessions', state.sessionId),
        { ...cloudState, updatedAt: firestore.serverTimestamp() },
        { merge: true }
      );
    },
    async listSessions() {
      const user = auth.currentUser;
      if (!user) return [];
      const snapshot = await firestore.getDocs(firestore.query(
        firestore.collection(db, 'users', user.uid, 'sessions'),
        firestore.orderBy('updatedAt', 'desc'),
        firestore.limit(50)
      ));
      return snapshot.docs.map(doc => {
        const data = doc.data();
        delete data.updatedAt;
        return decodeFromFirestore({ ...data, sessionId: doc.id });
      });
    }
  };

  authSdk.onAuthStateChanged(auth, user => {
    window.dispatchEvent(new CustomEvent('taroring-auth', {
      detail: user ? { uid: user.uid, name: user.displayName || '내 계정' } : null
    }));
  });
}
