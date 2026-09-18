// GitHub Actions에서 실행되는 스크립트.
// data.go.kr(금융위원회_주식시세정보)을 호출해 public/data.json으로 저장한다.
// API 키는 GitHub Secrets(STOCK_API_KEY)에서 환경변수로 주입된다.
import { writeFile } from "node:fs/promises";

const STOCKS = [
  { code: "005930", name: "삼성전자" },
  { code: "000660", name: "SK하이닉스" },
];

function formatDate(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchStockHistory(apiKey, code, beginBasDt, endBasDt) {
  const url = new URL(
    "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo"
  );
  url.searchParams.set("serviceKey", apiKey);
  url.searchParams.set("resultType", "json");
  url.searchParams.set("numOfRows", "100");
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("likeSrtnCd", code);
  url.searchParams.set("beginBasDt", beginBasDt);
  url.searchParams.set("endBasDt", endBasDt);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`data.go.kr 응답 오류 (HTTP ${res.status})`);
  }

  const json = await res.json();
  const header = json?.response?.header;
  if (header && header.resultCode !== "00") {
    throw new Error(header.resultMsg || "공공데이터포털 API 오류");
  }

  const raw = json?.response?.body?.items?.item;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  // likeSrtnCd는 부분일치 검색이라 동일 코드만 남기고, 혹시 필터 결과가
  // 비면(코드 형식이 다른 예외 케이스) 원본 리스트를 그대로 사용한다.
  const filtered = list.filter((item) => item.srtnCd === code);
  const finalList = filtered.length > 0 ? filtered : list;

  finalList.sort((a, b) => a.basDt.localeCompare(b.basDt));
  return finalList;
}

async function main() {
  const apiKey = process.env.STOCK_API_KEY;
  if (!apiKey) {
    throw new Error("STOCK_API_KEY 환경변수(GitHub Secret)가 설정되지 않았습니다.");
  }

  const end = new Date();
  const begin = new Date();
  begin.setMonth(begin.getMonth() - 3);
  const beginBasDt = formatDate(begin);
  const endBasDt = formatDate(end);

  const stocks = await Promise.all(
    STOCKS.map(async ({ code, name }) => {
      const history = await fetchStockHistory(apiKey, code, beginBasDt, endBasDt);
      return { code, name, history };
    })
  );

  const payload = { updatedAt: new Date().toISOString(), stocks };
  await writeFile("public/data.json", JSON.stringify(payload, null, 2));
  console.log("public/data.json 갱신 완료:", payload.updatedAt);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
