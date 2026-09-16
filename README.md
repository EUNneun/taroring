# 타로링 MVP

사용자가 질문을 입력하면 타로링이 카드 수를 정하고, 사용자가 겹쳐진 덱에서 직접 카드를 뽑아 상담을 이어가는 모바일 우선 웹앱입니다.

## 현재 구현

- 질문에 따라 1장 또는 3장 안내
- 부채꼴 카드 덱에서 직접 선택
- 정방향·역방향 결과
- 질문에 답하는 서술형 해석
- 후속 질문 3개 추천 및 직접 질문
- 이전 상담 전체를 대화처럼 위로 스크롤해 확인
- LocalStorage 저장
- Firebase 익명 인증·Firestore 저장 골격
- Vercel Serverless API를 통한 OpenAI Responses API 연동

OpenAI API가 설정되지 않았거나 로컬 HTML 파일로 열었을 때는 샘플 해석으로 동작합니다.

## 실행

1. `.env.example`을 참고해 Vercel 환경변수에 `OPENAI_API_KEY`를 등록합니다.
2. `firebase-config.js`에 Firebase Web App 설정을 입력합니다.
3. Firebase Authentication에서 익명 로그인을 활성화합니다.
4. Firestore를 생성하고 `firestore.rules` 내용을 배포합니다.
5. `npm install` 후 `npm run dev`로 실행합니다.

OpenAI 키는 `firebase-config.js`나 HTML에 입력하지 않습니다.
