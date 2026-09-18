# 삼성전자 · SK하이닉스 주가 대시보드

금융위원회_주식시세정보(공공데이터포털) API를 사용해 삼성전자(005930), SK하이닉스(000660)의
시세를 보여주는 대시보드입니다. Cloudflare Workers(정적 자산 + Worker 스크립트) 구조로,
무료로 배포할 수 있습니다.

## ⚠️ 데이터 성격 (중요)

이 API는 **실시간 시세가 아닌 일별 시세**입니다. 데이터는 기준일 다음 영업일 오후에 갱신되며,
화면을 새로고침해도 장중에는 숫자가 바뀌지 않습니다. 장중 실시간 체결가가 필요하다면
한국투자증권 Open API(웹소켓) 등 별도 연동이 필요합니다.

## 구조

```
public/        정적 프론트엔드 (HTML/CSS/JS) — Workers 정적 자산(ASSETS)으로 서빙됨
src/index.js   Worker 스크립트 — /api/* 요청만 처리, 서버 쪽에서 API 키를 들고 data.go.kr 호출
wrangler.toml  Worker 설정 (정적 자산 디렉터리, /api/* 라우팅 지정)
```

브라우저는 `/api/quotes`만 호출하고, 실제 공공데이터포털 API 키는 Cloudflare의
**Secret 환경변수**에만 저장됩니다. 프론트엔드 코드나 저장소 어디에도 키를 넣지 않습니다.

`wrangler.toml`의 `run_worker_first = ["/api/*"]` 설정 덕분에 `/api/`로 시작하는 요청만
`src/index.js`가 처리하고, 나머지 요청(`/`, `/app.js`, `/style.css` 등)은 Worker 코드 없이
`public/` 폴더 파일을 그대로 서빙합니다.

## 배포 방법 (Cloudflare — Workers & Pages)

1. Cloudflare 대시보드 → 왼쪽 메뉴 **Compute (Workers)** → **Workers and Pages** →
   **Import a repository** (또는 **Connect to Git**)를 선택하고 이 저장소를 연결합니다.
2. "Set up your application" 화면
   - Project name: 원하는 이름 (예: `stock-dashboard`)
   - Build command: 비워둠 (정적 파일이라 빌드 불필요)
   - **Deploy** 클릭
3. 배포가 끝나면 프로젝트의 **Settings → Variables and Secrets**로 이동해
   `STOCK_API_KEY`라는 이름으로 **Secret**을 추가하고, 공공데이터포털에서 발급받은
   서비스키(디코딩된 일반 인증키)를 값으로 입력합니다.
4. 저장 후 재배포(Deployments 탭 → Retry deployment, 또는 아무 커밋이나 다시 push)하면
   Secret이 반영됩니다.
5. 발급받은 `*.workers.dev` 주소로 접속해 정상 동작하는지 확인합니다.

## 로컬에서 테스트하기 (선택)

Wrangler CLI가 설치되어 있다면:

```bash
npm install -g wrangler
cp .dev.vars.example .dev.vars   # 그 다음 .dev.vars 파일에 실제 키 입력
wrangler dev
```

`.dev.vars`는 `.gitignore`에 포함되어 있어 실수로 커밋되지 않습니다.

## 트러블슈팅

- 화면에 "STOCK_API_KEY가 설정되지 않았습니다" 오류가 뜨면 3번 단계의 Secret 등록과
  재배포를 다시 확인하세요.
- 공공데이터포털은 활용신청 후 API 키가 실제로 활성화되기까지 다소 시간이 걸릴 수 있습니다.
- 하루 호출 한도를 초과하면 data.go.kr에서 오류를 반환합니다. 이 화면은 새로고침 시에만
  호출하도록 만들어져 있어 평소 사용으로는 한도에 걸리지 않습니다.
- 빌드 로그에 `npx wrangler deploy`가 실패로 뜬다면 `wrangler.toml`의 `main`, `[assets]`
  설정이 올바른지 확인하세요 (Pages 전용 `pages_build_output_dir` 키는 더 이상 사용하지 않습니다).
