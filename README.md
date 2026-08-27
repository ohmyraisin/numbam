# 아기 이유식 레시피북

plan.md 기준으로 만든 GitHub Pages 배포용 정적 사이트입니다.

## 현재 구조
- index.html: 레시피 목록 페이지
- 404.html: 잘못된 주소 접근 시 안내 페이지
- recipes/: 레시피 상세 페이지
- assets/styles.css: 공통 스타일
- recipes_origin/: 레시피 원본 Markdown

## 로컬에서 보기
브라우저로 index.html 파일을 열면 바로 확인할 수 있습니다.

## 레시피 추가 방법
`recipes/*.html`과 `index.html` 카드는 스크립트가 생성하므로 직접 편집하지 않습니다.
Markdown 원본만 추가한 뒤 스크립트를 실행하세요.

1. 레시피 원본 추가
- recipes_origin/ 에 slug 규칙(영문 소문자 + 하이픈)으로 Markdown 파일 추가
- 필수 항목: title, slug, 재료, 조리과정
- 선택 항목: youtube_url, instagram_url, blog_url, image_url, image_alt, image_urls, image_alts, tags, summary

2. 스크립트 실행
- npm run build:recipes
- `recipes_origin/*.md` 전체를 다시 읽어 `recipes/{slug}.html`을 생성/갱신합니다.
- 동시에 `index.html`의 카드 목록(AUTO_RECIPE_CARDS 마커 사이)도 slug 오름차순으로 다시 씁니다.

3. 결과 확인
- recipes/{slug}.html 생성 여부와 index.html 카드 링크를 확인합니다.
- 상세 페이지는 텍스트(재료/조리과정)가 먼저, 영상/블로그/이미지가 아래에 배치됩니다.

주의:
- slug를 바꾸면 이전 slug의 HTML 파일이 그대로 남습니다. 스크립트는 파일을 지우지 않으므로 직접 삭제하세요.
- `index.html`의 AUTO_RECIPE_CARDS 마커 사이는 매 실행마다 덮어쓰이므로 직접 수정하지 마세요.

## GitHub Pages 배포(처음 하는 경우)
1. GitHub에서 새 Public 저장소를 만듭니다.
2. 이 폴더 전체를 해당 저장소에 push 합니다.
3. GitHub 저장소 Settings > Pages 로 이동합니다.
4. Build and deployment에서 Source를 Deploy from a branch로 선택합니다.
5. Branch를 main /(root)로 선택하고 Save 합니다.
6. 1~3분 후 표시되는 사이트 URL로 접속해 확인합니다.

## 도메인 연결(선택)
1. Settings > Pages > Custom domain에 도메인을 입력합니다.
2. 도메인 서비스에서 안내된 DNS 레코드(CNAME 또는 A)를 설정합니다.
3. HTTPS 사용 가능 상태가 될 때까지 기다린 뒤 접속 확인합니다.

## 운영 메모
- 링크 공유 중심 운영이므로 검색 노출 최소화를 위해 noindex 메타를 유지합니다.
- 완전 비공개는 GitHub Pages 단독으로 불가능합니다.
- 영상 비공개/삭제 시 상세 페이지에 대체 안내 문구를 표시하세요.

## Markdown 변경 시 HTML 자동 업데이트
`recipes_origin/*.md` 파일을 수정하면 `recipes/*.html`을 자동으로 다시 생성할 수 있습니다.

1. 최초 1회 생성
- npm run build:recipes

2. 감시 모드(자동 업데이트)
- npm run watch:recipes

3. 상세 로그 모드(verbose)
- 1회 실행: npm run build:recipes -- --verbose
- 감시 실행: npm run watch:recipes -- --verbose

주의:
- Markdown frontmatter에 `title`, `slug`는 필수입니다.
- 외부 콘텐츠는 `youtube_url`, `instagram_url`, `blog_url`, `image_url`을 함께 또는 선택적으로 사용할 수 있습니다.
- 인스타그램 릴스/게시물은 `instagram_url`에 넣으세요. `youtube_url`은 유튜브 주소만 인식합니다.
  (`youtube_url`에 인스타그램 링크를 넣으면 경고를 출력하고 `instagram_url`로 처리합니다.)
- 이미지 설명이 필요하면 `image_alt`를 함께 입력하세요.
- 이미지가 2장 이상이면 `image_urls`, `image_alts`를 콤마로 구분해 입력하세요.
