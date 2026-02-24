# VamSer 통합 기획서 (NamuWiki 연동판)

## 1) 참조 범위
기준 문서:
- https://namu.wiki/w/Vampire%20Survivors

기준 문서에서 `https://namu.wiki/w/Vampire%20Survivors/` 접두사로 연결된 하위 문서(총 16개) 전부 참조:
1. https://namu.wiki/w/Vampire%20Survivors/%EB%8A%A5%EB%A0%A5%EC%B9%98
2. https://namu.wiki/w/Vampire%20Survivors/%EB%9E%9C%EB%8D%A4%20%EC%9D%B4%EB%B2%A4%ED%8A%B8
3. https://namu.wiki/w/Vampire%20Survivors/%EB%B9%84%EB%B0%80
4. https://namu.wiki/w/Vampire%20Survivors/%EC%8A%A4%ED%85%8C%EC%9D%B4%EC%A7%80
5. https://namu.wiki/w/Vampire%20Survivors/%EC%95%84%EB%A5%B4%EC%B9%B4%EB%82%98
6. https://namu.wiki/w/Vampire%20Survivors/%EC%95%84%EC%9D%B4%ED%85%9C
7. https://namu.wiki/w/Vampire%20Survivors/%EC%95%84%EC%9D%B4%ED%85%9C/%EC%9D%BC%EB%B0%98%20%EB%AC%B4%EA%B8%B0
8. https://namu.wiki/w/Vampire%20Survivors/%EC%95%84%EC%9D%B4%ED%85%9C/%EC%9E%A5%EC%8B%A0%EA%B5%AC
9. https://namu.wiki/w/Vampire%20Survivors/%EC%95%84%EC%9D%B4%ED%85%9C/%EC%A7%84%ED%99%94%20%EB%AC%B4%EA%B8%B0
10. https://namu.wiki/w/Vampire%20Survivors/%EC%96%B4%EB%93%9C%EB%B2%A4%EC%B2%98
11. https://namu.wiki/w/Vampire%20Survivors/%EC%9A%B0%ED%99%94%EC%A7%91
12. https://namu.wiki/w/Vampire%20Survivors/%EC%9E%A0%EA%B8%88%20%ED%95%B4%EC%A0%9C
13. https://namu.wiki/w/Vampire%20Survivors/%EC%BA%90%EB%A6%AD%ED%84%B0
14. https://namu.wiki/w/Vampire%20Survivors/%EC%BB%AC%EB%A0%89%EC%85%98
15. https://namu.wiki/w/Vampire%20Survivors/%ED%95%9C%EA%B3%84%EB%8F%8C%ED%8C%8C
16. https://namu.wiki/w/Vampire%20Survivors/%ED%99%A9%EA%B8%88%EC%95%8C

## 2) 문서 분석 요약 (기획 반영 포인트)
- 능력치: 이동/투사체/쿨다운/탐지(자석) 등 수치형 성장 축이 핵심
- 랜덤 이벤트: 시간 구간별 변주(웨이브/특수 이벤트)가 런의 리듬을 만든다
- 비밀/잠금해제/컬렉션: 메타 목표가 장기 플레이 동기를 만든다
- 스테이지: 맵 구조와 스폰 규칙이 난이도 체감의 대부분을 차지
- 아이템(일반 무기/장신구/진화무기): 빌드 완성의 핵심은 조합과 진화
- 아르카나: 룰을 바꾸는 강한 패시브 계층(빌드 방향성 결정)
- 캐릭터: 시작 무기/기본 스탯 차별화로 플레이 스타일 분화
- 한계돌파/황금알: 엔드게임 수직 성장(파워 판타지)
- 우화집(베스티어리): 적 정보 제공은 학습 난이도 완화에 유효
- 어드벤처: 별도 목표를 가진 모드 확장 여지 확인

## 3) 게임 제품 정의
- 장르: 탑다운 오토어택 생존 액션
- 세션 길이: 10~20분(웹 최적화), 확장 모드에서 장기 생존 지원
- 조작: 이동 중심(키보드/마우스/터치 조이스틱)
- 목표: 생존 + 빌드 완성 + 보스 처치(또는 무한 생존)

## 4) 코어 루프
1. 이동으로 포지셔닝
2. 자동 공격으로 적 처치
3. 경험치 보석 획득
4. 레벨업에서 3지선다 선택
5. 무기+장신구 조합 완성
6. 진화/보스 페이즈 대응
7. 결과/해금 진행

## 5) 시스템 기획 (HTML 구현 기준)
- 전투
  - 다중 무기 슬롯 + 자동 발사
  - 접촉 피해, 피격 이펙트, 플로팅 데미지 텍스트
- 성장
  - 능력치 계층: 공격/유틸/생존
  - 아르카나 계층: 룰 변경형 특수 패시브(중반 이후 해금)
  - 한계돌파 계층: 최대레벨 이후 반복 강화
- 콘텐츠
  - 적 타입(잡몹/엘리트/보스)
  - 스테이지 기믹(지형, 이벤트, 스폰 변형)
- 메타
  - 잠금해제 목록, 비밀 코드/조건, 컬렉션 진행률
  - 캐릭터 해금/고유 특성

## 6) 모드 구조
- Normal: 표준 난이도
- Hyper: 적 이속/체력/스폰 상승 + 보상 상승
- Endless: 클리어 없이 무한 진행
- Adventure(후속): 독립 규칙셋 시나리오 모드

## 7) 콘텐츠 우선순위 로드맵
1. 무기 진화 조합표 완성 (일반 무기 + 장신구 매핑)
2. 캐릭터 6종 이상 + 시작 무기/기본 스탯 분화
3. 아르카나 8종 이상 구현 (빌드 방향성 강화)
4. 잠금해제/컬렉션 UI + 저장
5. 랜덤 이벤트/비밀 요소 추가
6. 한계돌파 + 황금알식 엔드게임 성장

## 8) 현재 코드 반영 상태
- 반영됨
  - 자동공격, 레벨업 선택, 다중 무기/패시브, 보스/웨이브, 모바일 입력, 전체화면
  - 모드 선택(Normal/Hyper/Endless/Adventure)
  - 진화 무기(조건식 + 상자 트리거)
  - 아르카나 8종(레벨 구간 선택)
  - 잠금해제/컬렉션/우화집(로컬 저장)
  - 캐릭터 6종, 스테이지 선택, 비밀 코드 시스템

## 9) 구현 원칙
- 정보 밀도보다 가독성 우선(HUD 충돌 최소화)
- 입력 일관성 우선(모바일/데스크톱 동일한 전술 가능)
- 성장 체감 우선(레벨업 1회마다 즉시 강해졌다고 느끼게)
- 후반 피로도 관리(이펙트 과밀 방지, 프레임 안정성 유지)
