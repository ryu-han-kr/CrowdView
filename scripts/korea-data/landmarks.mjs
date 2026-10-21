// 지역별 대표 관광지(랜드마크) → src/data/korea/landmarks.json
// 고른 목록(아래 LIST, 이름 5개 언어)에 한국관광공사 TourAPI(KorService2 searchKeyword2)의 사진·좌표를 붙인다.
// 외국어 TourAPI(EngService2 등)는 활용신청이 따로라 이름 번역은 목록에 직접 적었다.
// 사용: node scripts/korea-data/landmarks.mjs   (DATA_GO_KR_KEY: .env.local 또는 환경변수). 실행당 호출 약 120건
// ONLY_NEW=1 이면 landmarks.json에 이미 있는 곳은 다시 찾지 않고 그대로 둔다 (새로 넣은 곳만 호출)
import fs from "node:fs";
import path from "node:path";

if (!process.env.DATA_GO_KR_KEY && fs.existsSync(".env.local")) {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const KEY = process.env.DATA_GO_KR_KEY;
if (!KEY) {
  console.error("DATA_GO_KR_KEY가 없어요");
  process.exit(1);
}

// [id, 지역, 종류, 한국어, English, 日本語, 简体, 繁體, 검색어(이름과 다를 때), 관광공사 contentid(검색이 엉뚱한 곳을 고를 때 고정)]
// 종류: history 역사·문화 · nature 자연 · city 도시·거리 · fun 놀이·체험 · sea 바다
const LIST = [
  ["gyeongbokgung", "서울", "history", "경복궁", "Gyeongbokgung Palace", "景福宮", "景福宫", "景福宮"],
  ["changdeokgung", "서울", "history", "창덕궁", "Changdeokgung Palace", "昌徳宮", "昌德宫", "昌德宮", "창덕궁과 후원"],
  ["bukchon", "서울", "history", "북촌한옥마을", "Bukchon Hanok Village", "北村韓屋村", "北村韩屋村", "北村韓屋村"],
  ["namsan-tower", "서울", "city", "남산 N서울타워", "Namsan N Seoul Tower", "南山Nソウルタワー", "南山N首尔塔", "南山N首爾塔", "남산공원", "126485"],
  ["lotte-tower", "서울", "city", "롯데월드타워 서울스카이", "Lotte World Tower Seoul Sky", "ロッテワールドタワー ソウルスカイ", "乐天世界塔 首尔天空", "樂天世界塔 首爾天空", "서울스카이"],
  ["ddp", "서울", "city", "동대문디자인플라자", "Dongdaemun Design Plaza", "東大門デザインプラザ", "东大门设计广场", "東大門設計廣場", "동대문디자인플라자"],
  ["yeouido-park", "서울", "nature", "여의도한강공원", "Yeouido Hangang Park", "汝矣島漢江公園", "汝矣岛汉江公园", "汝矣島漢江公園"],
  ["insadong", "서울", "city", "인사동", "Insadong", "仁寺洞", "仁寺洞", "仁寺洞", "인사동", "264353"],
  ["haeundae", "부산", "sea", "해운대해수욕장", "Haeundae Beach", "海雲台海水浴場", "海云台海水浴场", "海雲台海水浴場"],
  ["gwangalli", "부산", "sea", "광안리해수욕장", "Gwangalli Beach", "広安里海水浴場", "广安里海水浴场", "廣安里海水浴場"],
  ["gamcheon", "부산", "city", "감천문화마을", "Gamcheon Culture Village", "甘川文化村", "甘川文化村", "甘川文化村"],
  ["haedong-yonggungsa", "부산", "history", "해동용궁사", "Haedong Yonggungsa Temple", "海東龍宮寺", "海东龙宫寺", "海東龍宮寺"],
  ["taejongdae", "부산", "nature", "태종대", "Taejongdae", "太宗台", "太宗台", "太宗臺"],
  ["jagalchi", "부산", "city", "자갈치시장", "Jagalchi Market", "チャガルチ市場", "札嘎其市场", "札嘎其市場", "자갈치", "132190"],
  ["wolmido", "인천", "sea", "월미도", "Wolmido Island", "月尾島", "月尾岛", "月尾島", "월미도"],
  ["e-world", "대구", "fun", "이월드 83타워", "E-World 83 Tower", "Eワールド 83タワー", "E-World 83塔", "E-World 83塔", "이월드"],
  ["kim-kwangseok-street", "대구", "city", "김광석 다시그리기길", "Kim Kwang-seok Street", "金光石通り", "金光石街", "金光石街", "김광석다시그리기길"],
  ["palgongsan", "대구", "nature", "팔공산", "Palgongsan Mountain", "八公山", "八公山", "八公山", "팔공산", "127659"],
  ["acc", "광주", "city", "국립아시아문화전당", "Asia Culture Center", "国立アジア文化殿堂", "国立亚洲文化殿堂", "國立亞洲文化殿堂"],
  ["mudeungsan", "광주", "nature", "무등산국립공원", "Mudeungsan National Park", "無等山国立公園", "无等山国立公园", "無等山國立公園", "무등산", "127575"],
  ["yangnim", "광주", "history", "양림동 역사문화마을", "Yangnim-dong Historic Village", "楊林洞歴史文化村", "杨林洞历史文化村", "楊林洞歷史文化村", "양림동"],
  ["expo-park", "대전", "city", "엑스포과학공원 한빛탑", "Expo Science Park Hanbit Tower", "エキスポ科学公園 ハンビッタワー", "世博科学公园 韩光塔", "世博科學公園 韓光塔", "한빛탑"],
  ["jangtaesan", "대전", "nature", "장태산자연휴양림", "Jangtaesan Recreational Forest", "長泰山自然休養林", "长泰山自然休养林", "長泰山自然休養林"],
  ["daewangam", "울산", "sea", "대왕암공원", "Daewangam Park", "大王岩公園", "大王岩公园", "大王岩公園"],
  ["taehwagang", "울산", "nature", "태화강 국가정원", "Taehwagang National Garden", "太和江国家庭園", "太和江国家庭园", "太和江國家庭園", "태화강"],
  ["ganjeolgot", "울산", "sea", "간절곶", "Ganjeolgot Cape", "艮絶串", "艮绝串", "艮絕串"],
  ["sejong-arboretum", "세종", "nature", "국립세종수목원", "Sejong National Arboretum", "国立世宗樹木園", "国立世宗树木园", "國立世宗樹木園"],
  ["sejong-lake", "세종", "nature", "세종호수공원", "Sejong Lake Park", "世宗湖水公園", "世宗湖水公园", "世宗湖水公園"],
  ["everland", "경기", "fun", "에버랜드", "Everland", "エバーランド", "爱宝乐园", "愛寶樂園"],
  ["hwaseong", "경기", "history", "수원 화성", "Suwon Hwaseong Fortress", "水原華城", "水原华城", "水原華城", "수원화성"],
  ["folk-village", "경기", "history", "한국민속촌", "Korean Folk Village", "韓国民俗村", "韩国民俗村", "韓國民俗村"],
  ["petite-france", "경기", "fun", "쁘띠프랑스", "Petite France", "プチフランス", "小法国村", "小法國村"],
  ["imjingak", "경기", "history", "임진각 평화누리", "Imjingak Peace Park", "臨津閣 平和ヌリ公園", "临津阁和平世界", "臨津閣和平世界", "임진각", "127548"],
  ["nami", "강원", "nature", "남이섬", "Nami Island", "南怡島", "南怡岛", "南怡島"],
  ["seoraksan", "강원", "nature", "설악산국립공원", "Seoraksan National Park", "雪嶽山国立公園", "雪岳山国立公园", "雪嶽山國立公園", "설악산"],
  ["gyeongpo", "강원", "sea", "경포해변", "Gyeongpo Beach", "鏡浦海辺", "镜浦海边", "鏡浦海邊", "경포해수욕장", "128758"],
  ["jeongdongjin", "강원", "sea", "정동진", "Jeongdongjin", "正東津", "正东津", "正東津", "정동진"],
  ["ojukheon", "강원", "history", "오죽헌", "Ojukheon House", "烏竹軒", "乌竹轩", "烏竹軒", "오죽헌", "129784"],
  ["cheongnamdae", "충북", "history", "청남대", "Cheongnamdae", "青南台", "青南台", "青南臺"],
  ["dodamsambong", "충북", "nature", "단양 도담삼봉", "Dodamsambong Peaks", "島潭三峰", "岛潭三峰", "島潭三峰", "도담삼봉"],
  ["beopjusa", "충북", "history", "속리산 법주사", "Beopjusa Temple", "法住寺", "法住寺", "法住寺", "법주사"],
  ["gongsanseong", "충남", "history", "공주 공산성", "Gongsanseong Fortress", "公山城", "公山城", "公山城", "공산성"],
  ["gungnamji", "충남", "history", "부여 궁남지", "Gungnamji Pond", "宮南池", "宫南池", "宮南池", "궁남지"],
  ["daecheon", "충남", "sea", "대천해수욕장", "Daecheon Beach", "大川海水浴場", "大川海水浴场", "大川海水浴場"],
  ["independence-hall", "충남", "history", "독립기념관", "Independence Hall of Korea", "独立記念館", "独立纪念馆", "獨立紀念館"],
  ["jeonju-hanok", "전북", "history", "전주한옥마을", "Jeonju Hanok Village", "全州韓屋村", "全州韩屋村", "全州韓屋村", "전주 한옥마을", "264284"],
  ["naejangsan", "전북", "nature", "내장산국립공원", "Naejangsan National Park", "内蔵山国立公園", "内藏山国立公园", "內藏山國立公園", "내장산", "126237"],
  ["gunsan-time", "전북", "history", "군산 시간여행마을", "Gunsan Time Travel Village", "群山時間旅行村", "群山时间旅行村", "群山時間旅行村", "시간여행", "2649961"],
  ["suncheonman", "전남", "nature", "순천만습지", "Suncheonman Bay Wetland", "順天湾湿地", "顺天湾湿地", "順天灣濕地", "순천만습지", "126730"],
  ["odongdo", "전남", "sea", "여수 오동도", "Odongdo Island", "梧桐島", "梧桐岛", "梧桐島", "오동도", "128025"],
  ["juknokwon", "전남", "nature", "담양 죽녹원", "Juknokwon Bamboo Garden", "竹緑苑", "竹绿苑", "竹綠苑", "죽녹원"],
  ["boseong-tea", "전남", "nature", "보성 대한다원", "Boseong Green Tea Field", "宝城茶畑 大韓茶園", "宝城绿茶园", "寶城綠茶園", "대한다원"],
  ["bulguksa", "경북", "history", "불국사", "Bulguksa Temple", "仏国寺", "佛国寺", "佛國寺"],
  ["seokguram", "경북", "history", "석굴암", "Seokguram Grotto", "石窟庵", "石窟庵", "石窟庵"],
  ["donggung-wolji", "경북", "history", "경주 동궁과 월지", "Donggung Palace and Wolji Pond", "東宮と月池", "东宫与月池", "東宮與月池", "동궁과 월지"],
  ["cheomseongdae", "경북", "history", "첨성대", "Cheomseongdae Observatory", "瞻星台", "瞻星台", "瞻星臺"],
  ["hahoe", "경북", "history", "안동 하회마을", "Andong Hahoe Village", "安東河回村", "安东河回村", "安東河回村", "하회마을"],
  ["jinjuseong", "경남", "history", "진주성", "Jinjuseong Fortress", "晋州城", "晋州城", "晉州城"],
  ["windy-hill", "경남", "sea", "거제 바람의 언덕", "Windy Hill, Geoje", "巨済 風の丘", "巨济 风之丘", "巨濟 風之丘", "바람의 언덕"],
  ["german-village", "경남", "city", "남해 독일마을", "German Village, Namhae", "南海ドイツ村", "南海德国村", "南海德國村", "독일마을"],
  ["seongsan", "제주", "nature", "성산일출봉", "Seongsan Ilchulbong", "城山日出峰", "城山日出峰", "城山日出峰"],
  ["hallasan", "제주", "nature", "한라산국립공원", "Hallasan National Park", "漢拏山国立公園", "汉拿山国立公园", "漢拏山國立公園", "한라산"],
  ["udo", "제주", "sea", "우도", "Udo Island", "牛島", "牛岛", "牛島", "우도"],
  ["hyeopjae", "제주", "sea", "협재해수욕장", "Hyeopjae Beach", "挟才海水浴場", "挟才海水浴场", "挾才海水浴場"],
  ["manjanggul", "제주", "nature", "만장굴", "Manjanggul Lava Tube", "万丈窟", "万丈窟", "萬丈窟"],
  ["seopjikoji", "제주", "sea", "섭지코지", "Seopjikoji", "涉地可支", "涉地可支", "涉地可支"],
  // 10/21 추가: 유명 산(nature)·해수욕장(sea)·사찰(history)
  ["bukhansan", "서울", "nature", "북한산국립공원", "Bukhansan National Park", "北漢山国立公園", "北汉山国立公园", "北漢山國立公園", "북한산"],
  ["dobongsan", "서울", "nature", "도봉산", "Dobongsan Mountain", "道峰山", "道峰山", "道峰山"],
  ["inwangsan", "서울", "nature", "인왕산", "Inwangsan Mountain", "仁王山", "仁王山", "仁王山"],
  ["jirisan", "경남", "nature", "지리산국립공원", "Jirisan National Park", "智異山国立公園", "智异山国立公园", "智異山國立公園", "지리산 천왕봉", "250411"],
  ["deogyusan", "전북", "nature", "덕유산국립공원", "Deogyusan National Park", "徳裕山国立公園", "德裕山国立公园", "德裕山國立公園", "덕유산", "126238"],
  ["odaesan", "강원", "nature", "오대산국립공원", "Odaesan National Park", "五台山国立公園", "五台山国立公园", "五臺山國立公園", "오대산", "125591"],
  ["sobaeksan", "충북", "nature", "소백산국립공원", "Sobaeksan National Park", "小白山国立公園", "小白山国立公园", "小白山國立公園", "소백산", "125813"],
  ["chiaksan", "강원", "nature", "치악산국립공원", "Chiaksan National Park", "雉岳山国立公園", "雉岳山国立公园", "雉嶽山國立公園", "치악산", "125587"],
  ["gyeryongsan", "충남", "nature", "계룡산국립공원", "Gyeryongsan National Park", "鶏龍山国立公園", "鸡龙山国立公园", "雞龍山國立公園", "계룡산", "125817"],
  ["wolchulsan", "전남", "nature", "월출산국립공원", "Wolchulsan National Park", "月出山国立公園", "月出山国立公园", "月出山國立公園", "월출산"],
  ["juwangsan", "경북", "nature", "주왕산국립공원", "Juwangsan National Park", "周王山国立公園", "周王山国立公园", "周王山國立公園", "주왕산"],
  ["taebaeksan", "강원", "nature", "태백산국립공원", "Taebaeksan National Park", "太白山国立公園", "太白山国立公园", "太白山國立公園", "태백산"],
  ["maisan", "전북", "nature", "마이산", "Maisan Mountain", "馬耳山", "马耳山", "馬耳山", "마이산", "126235"],
  ["songjeong", "부산", "sea", "송정해수욕장", "Songjeong Beach", "松亭海水浴場", "松亭海水浴场", "松亭海水浴場"],
  ["dadaepo", "부산", "sea", "다대포해수욕장", "Dadaepo Beach", "多大浦海水浴場", "多大浦海水浴场", "多大浦海水浴場"],
  ["songdo-beach", "부산", "sea", "송도해수욕장", "Songdo Beach", "松島海水浴場", "松岛海水浴场", "松島海水浴場"],
  ["eurwangni", "인천", "sea", "을왕리해수욕장", "Eurwangni Beach", "乙旺里海水浴場", "乙旺里海水浴场", "乙旺里海水浴場"],
  ["sokcho-beach", "강원", "sea", "속초해수욕장", "Sokcho Beach", "束草海水浴場", "束草海水浴场", "束草海水浴場"],
  ["naksan-beach", "강원", "sea", "낙산해수욕장", "Naksan Beach", "洛山海水浴場", "洛山海水浴场", "洛山海水浴場"],
  ["mallipo", "충남", "sea", "만리포해수욕장", "Mallipo Beach", "万里浦海水浴場", "万里浦海水浴场", "萬里浦海水浴場"],
  ["kkotji", "충남", "sea", "꽃지해수욕장", "Kkotji Beach", "コッチ海水浴場", "花地海水浴场", "花地海水浴場"],
  ["byeonsan", "전북", "sea", "변산해수욕장", "Byeonsan Beach", "辺山海水浴場", "边山海水浴场", "邊山海水浴場"],
  ["yeongildae", "경북", "sea", "영일대해수욕장", "Yeongildae Beach", "迎日台海水浴場", "迎日台海水浴场", "迎日臺海水浴場"],
  ["hamdeok", "제주", "sea", "함덕해수욕장", "Hamdeok Beach", "咸徳海水浴場", "咸德海水浴场", "咸德海水浴場"],
  ["woljeongri", "제주", "sea", "월정리해변", "Woljeong-ri Beach", "月汀里海辺", "月汀里海边", "月汀里海邊", "월정리"],
  ["gwakji", "제주", "sea", "곽지해수욕장", "Gwakji Beach", "郭支海水浴場", "郭支海水浴场", "郭支海水浴場"],
  ["iho-tewoo", "제주", "sea", "이호테우해수욕장", "Iho Tewoo Beach", "梨湖テウ海水浴場", "梨湖Tewoo海水浴场", "梨湖Tewoo海水浴場", "이호테우"],
  ["jungmun-beach", "제주", "sea", "중문색달해수욕장", "Jungmun Saekdal Beach", "中文穡達海水浴場", "中文穑达海水浴场", "中文穡達海水浴場", "중문색달"],
  ["jogyesa", "서울", "history", "조계사", "Jogyesa Temple", "曹渓寺", "曹溪寺", "曹溪寺"],
  ["bongeunsa", "서울", "history", "봉은사", "Bongeunsa Temple", "奉恩寺", "奉恩寺", "奉恩寺"],
  ["jeondeungsa", "인천", "history", "전등사", "Jeondeungsa Temple", "伝灯寺", "传灯寺", "傳燈寺"],
  ["yongmunsa", "경기", "history", "양평 용문사", "Yongmunsa Temple (Yangpyeong)", "龍門寺（楊平）", "龙门寺（杨平）", "龍門寺（楊平）", "용문사"],
  ["beomeosa", "부산", "history", "범어사", "Beomeosa Temple", "梵魚寺", "梵鱼寺", "梵魚寺"],
  ["donghwasa", "대구", "history", "동화사", "Donghwasa Temple", "桐華寺", "桐华寺", "桐華寺"],
  ["naksansa", "강원", "history", "낙산사", "Naksansa Temple", "洛山寺", "洛山寺", "洛山寺"],
  ["woljeongsa", "강원", "history", "월정사", "Woljeongsa Temple", "月精寺", "月精寺", "月精寺", "월정사", "125772"],
  ["guinsa", "충북", "history", "구인사", "Guinsa Temple", "救仁寺", "救仁寺", "救仁寺"],
  ["magoksa", "충남", "history", "마곡사", "Magoksa Temple", "麻谷寺", "麻谷寺", "麻谷寺"],
  ["sudeoksa", "충남", "history", "수덕사", "Sudeoksa Temple", "修徳寺", "修德寺", "修德寺"],
  ["naesosa", "전북", "history", "내소사", "Naesosa Temple", "来蘇寺", "来苏寺", "來蘇寺"],
  ["songgwangsa", "전남", "history", "송광사", "Songgwangsa Temple", "松広寺", "松广寺", "松廣寺"],
  ["seonamsa", "전남", "history", "선암사", "Seonamsa Temple", "仙巌寺", "仙岩寺", "仙巖寺"],
  ["hwaeomsa", "전남", "history", "화엄사", "Hwaeomsa Temple", "華厳寺", "华严寺", "華嚴寺"],
  ["daeheungsa", "전남", "history", "대흥사", "Daeheungsa Temple", "大興寺", "大兴寺", "大興寺"],
  ["baegyangsa", "전남", "history", "백양사", "Baegyangsa Temple", "白羊寺", "白羊寺", "白羊寺"],
  ["buseoksa", "경북", "history", "부석사", "Buseoksa Temple", "浮石寺", "浮石寺", "浮石寺"],
  ["jikjisa", "경북", "history", "직지사", "Jikjisa Temple", "直指寺", "直指寺", "直指寺"],
  ["haeinsa", "경남", "history", "해인사", "Haeinsa Temple", "海印寺", "海印寺", "海印寺"],
  ["tongdosa", "경남", "history", "통도사", "Tongdosa Temple", "通度寺", "通度寺", "通度寺"],
  ["ssanggyesa", "경남", "history", "쌍계사", "Ssanggyesa Temple", "双磎寺", "双溪寺", "雙磎寺"],
  ["boriam", "경남", "history", "남해 보리암", "Boriam Hermitage", "菩提庵", "菩提庵", "菩提庵", "보리암"],
];

async function search(keyword) {
  const qs = new URLSearchParams({ serviceKey: KEY, pageNo: "1", numOfRows: "20", MobileOS: "ETC", MobileApp: "CrowdView", _type: "json", keyword });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://apis.data.go.kr/B551011/KorService2/searchKeyword2?${qs}`, { signal: AbortSignal.timeout(15_000) });
      const json = await res.json();
      const items = json.response?.body?.items?.item;
      return Array.isArray(items) ? items : items ? [items] : [];
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
}

const norm = (s) => String(s).replace(/\s|\(.*?\)|\[.*?\]/g, "");
// 주소 첫 낱말로 지역 확인 (예: 충청북도 → 충북)
const REGION_RE = {
  서울: /^서울/, 부산: /^부산/, 인천: /^인천/, 대구: /^대구/, 광주: /^(광주|전남광주)/, 대전: /^대전/, 울산: /^울산/, 세종: /^세종/,
  경기: /^경기/, 강원: /^강원/, 충북: /^(충청북도|충북)/, 충남: /^(충청남도|충남)/, 전북: /^(전북|전라북도)/, 전남: /^(전라남도|전남)/,
  경북: /^(경상북도|경북)/, 경남: /^(경상남도|경남)/, 제주: /^제주/,
};
// 관광지(12)·문화시설(14)·레포츠(28)만, 이름에 가게·숙소 같은 말이 있으면 뺀다
const TYPES = new Set(["12", "14", "28"]);
const NOT_SPOT = /점$|호텔|리조트|수련원|묘지|공예|특산|도서관|전시관|카페|나이트워크|축제|체험관/;
const out = [];
const missing = [];
const prevFile = path.join("src", "data", "korea", "landmarks.json");
const prev = new Map(process.env.ONLY_NEW && fs.existsSync(prevFile) ? JSON.parse(fs.readFileSync(prevFile, "utf8")).map((l) => [l.id, l]) : []);
for (const [id, region, kind, ko, en, ja, zhCN, zhTW, q, cid] of LIST) {
  if (prev.has(id)) {
    out.push({ ...prev.get(id), region, kind, n: { ko, en, ja, "zh-CN": zhCN, "zh-TW": zhTW } });
    continue;
  }
  const key = norm(q ?? ko);
  const found = await search(q ?? ko);
  const pinned = cid && found.find((r) => String(r.contentid) === cid);
  const items = found.filter(
    (r) => r.firstimage && Number(r.mapy) > 33 && REGION_RE[region].test(String(r.addr1)) && TYPES.has(String(r.contenttypeid)) && !NOT_SPOT.test(norm(r.title)),
  );
  const score = (r) => (norm(r.title) === key ? 100 : norm(r.title).startsWith(key) ? 60 : norm(r.title).includes(key) ? 40 : 0) + (String(r.contenttypeid) === "12" ? 10 : 0);
  const hit = pinned || items.sort((a, b) => score(b) - score(a))[0];
  if (!hit) {
    missing.push(ko);
    continue;
  }
  out.push({
    id,
    region,
    kind,
    n: { ko, en, ja, "zh-CN": zhCN, "zh-TW": zhTW },
    lat: Math.round(Number(hit.mapy) * 1e5) / 1e5,
    lng: Math.round(Number(hit.mapx) * 1e5) / 1e5,
    img: String(hit.firstimage).replace(/^http:/, "https:"),
    cid: String(hit.contentid),
  });
  console.log(`${ko} → ${hit.title}`);
}
if (missing.length) console.warn(`못 찾음: ${missing.join(", ")}`);
const dir = path.join("src", "data", "korea");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "landmarks.json"), JSON.stringify(out));
console.log(`완료 ${out.length}/${LIST.length}`);
