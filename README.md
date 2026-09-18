# 삼성전자 · SK하이닉스 주가 대시보드

금융위원회_주식시세정보(공공데이터포털) API를 사용해 삼성전자(005930), SK하이닉스(000660)의
시세를 보여주는 대시보드입니다. **GitHub Actions(스케줄 실행) + GitHub Pages(정적 호스팅)**만으로
동작하며, 별도 클라우드 계정이 필요 없습니다.

## ⚠️ 데이터 성격 (중요)

이 API는 **실시간 시세가 아닌 일별 시세**입니다. 원본 데이터 자체가 기준일 다음 영업일
오후에 한 번 갱신되므로, 이 화면도 그에 맞춰 **평일 KST 15:30에 한 번씩 자동으로
스냅샷을 받아와 보여주는 방식**입니다. 장중 실시간 체결가가 필요하다면
한국투자증권 Open API(웹소켓) 등 별도 연동이 필요합니다.

## 구조

```
public/                       정적 프론트엔드 (HTML/CSS/JS) — GitHub Pages가 그대로 서빙
public/data.json               스케줄 실행 때마다 새로 생성되는 시세 스냅샷 (커밋되지 않음)
scripts/fetch-quotes.mjs       data.go.kr을 호출해 public/data.json을 만드는 스크립트
.github/workflows/deploy.yml   스케줄/수동 실행 → 데이터 갱신 → GitHub Pages 배포
```

동작 흐름은 이렇습니다.

1. GitHub Actions가 평일 KST 15:30(및 필요 시 수동 실행)에 깨어남
2. `STOCK_API_KEY`(GitHub Secret)로 `scripts/fetch-quotes.mjs`가 data.go.kr 호출
3. 결과를 `public/data.json`으로 저장
4. `public/` 전체를 GitHub Pages에 배포
5. 브라우저는 그냥 `data.json`을 정적 파일로 읽기만 함 — 브라우저가 API 키를 직접
   다루는 일은 전혀 없습니다.

API 키는 코드 어디에도 없고, **GitHub Secrets**에만 저장됩니다.

## 설정 방법

### 1) GitHub Secret 등록

저장소 → **Settings → Secrets and variables → Actions → New repository secret**
- Name: `STOCK_API_KEY`
- Value: 공공데이터포털에서 발급받은 서비스키(디코딩된 일반 인증키)

### 2) GitHub Pages 소스 설정

저장소 → **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 선택합니다.

### 3) 워크플로 첫 실행

저장소 → **Actions** 탭 → **"시세 갱신 및 배포"** 워크플로 선택 → **Run workflow**로
수동 실행합니다. (스케줄을 기다리지 않고 바로 확인하기 위함입니다.)

### 4) 접속 확인

실행이 끝나면 **Settings → Pages** 상단에 표시되는 주소
(`https://<계정>.github.io/<저장소명>/` 형태)로 접속해 정상 동작하는지 확인합니다.

## 로컬에서 데이터 스크립트만 테스트하기 (선택)

```bash
STOCK_API_KEY=발급받은_키 node scripts/fetch-quotes.mjs
```

`public/data.json`이 생성되면, `public/` 폴더를 아무 정적 서버로 띄워 화면을 확인할 수 있습니다.
(`public/data.json`은 `.gitignore`에 포함되어 있어 커밋되지 않습니다.)

## 트러블슈팅

- 화면에 "데이터 파일을 찾을 수 없습니다" 오류가 뜨면 워크플로가 아직 한 번도 성공하지
  않은 상태입니다. Actions 탭에서 실행 로그를 확인하세요.
- 워크플로가 `STOCK_API_KEY 환경변수가 설정되지 않았습니다` 오류로 실패하면 1번 단계의
  Secret 등록을 다시 확인하세요.
- 공공데이터포털은 활용신청 후 API 키가 실제로 활성화되기까지 다소 시간이 걸릴 수 있습니다.
- 화면의 "다시 불러오기" 버튼은 새 데이터를 즉시 가져오는 게 아니라, 마지막으로 배포된
  `data.json` 스냅샷을 다시 읽어오는 버튼입니다. 최신 데이터를 강제로 받고 싶다면
  Actions 탭에서 워크플로를 수동 실행(Run workflow)하세요.
