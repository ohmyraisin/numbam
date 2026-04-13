#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, '레시피 모음');
const outputDir = path.join(projectRoot, 'recipes');
const indexPath = path.join(projectRoot, 'index.html');
const args = new Set(process.argv.slice(2));
const isWatchMode = args.has('--watch');
const isVerbose = args.has('--verbose');

function logVerbose(message) {
  if (isVerbose) {
    console.log(`[verbose] ${message}`);
  }
}

// HTML 문자열에 안전하게 넣기 위해 특수문자를 이스케이프한다.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// markdown frontmatter(--- ... ---)를 파싱하고 본문과 분리한다.
function parseFrontmatter(content, fileName) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error(`${fileName}: frontmatter(---) 블록이 필요합니다.`);
  }

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    frontmatter[key] = rawValue;
  }

  return {
    frontmatter,
    body: content.slice(match[0].length).trim()
  };
}

// 특정 "## 제목" 섹션의 내용만 잘라서 반환한다.
function parseSection(body, headingText) {
  const lines = body.split('\n');
  const heading = `## ${headingText}`;
  const startIndex = lines.findIndex((line) => line.trim() === heading);

  if (startIndex === -1) {
    return '';
  }

  const collected = [];
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    const current = lines[i];
    if (/^##\s+/.test(current.trim())) {
      break;
    }
    collected.push(current);
  }

  return collected.join('\n').trim();
}

// 재료 섹션의 불릿 목록(-, *)을 배열로 변환한다.
function parseBulletItems(sectionText) {
  return sectionText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter(Boolean);
}

// 조리과정 섹션의 번호 목록(1., 1))을 배열로 변환한다.
function parseOrderedItems(sectionText) {
  return sectionText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+[.)]\s+/.test(line))
    .map((line) => line.replace(/^\d+[.)]\s+/, '').trim())
    .filter(Boolean);
}

// youtube_url에서 영상 ID만 추출해 embed URL 생성에 사용한다.
function getYoutubeVideoId(url) {
  if (!url) {
    return '';
  }

  const matched = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return matched ? matched[1] : '';
}

// 배열 데이터를 ul 또는 ol HTML 문자열로 렌더링한다.
function renderList(items, type) {
  const tag = type === 'ol' ? 'ol' : 'ul';
  const listItems = items.map((item) => `        <li>${escapeHtml(item)}</li>`).join('\n');
  return `      <${tag}>\n${listItems}\n      </${tag}>`;
}

function parseTags(value) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function renderTags(tags, className = 'tag-list') {
  if (!tags.length) {
    return '';
  }

  const chips = tags
    .map((tag) => `        <span class="tag-chip">#${escapeHtml(tag)}</span>`)
    .join('\n');

  return `      <p class="${className}" aria-label="태그">\n${chips}\n      </p>`;
}

function buildIndexCard(recipe, index) {
  const order = String(index + 1).padStart(2, '0');
  const searchText = [recipe.title, recipe.summary, recipe.tags.join(' '), recipe.ingredients.join(' '), recipe.steps.join(' ')]
    .join(' ')
    .trim();
  const tagsAttr = recipe.tags.join(',');
  const tagsMarkup = renderTags(recipe.tags, 'tag-list');

  return `        <li class="card reveal recipe-item" data-search="${escapeHtml(searchText)}" data-tags="${escapeHtml(tagsAttr)}">\n          <p class="label">Recipe ${order}</p>\n          <h3>${escapeHtml(recipe.title)}</h3>\n          <p>${escapeHtml(recipe.summary)}</p>\n${tagsMarkup}\n          <a class="btn" href="recipes/${escapeHtml(recipe.slug)}.html">상세 보기</a>\n        </li>`;
}

function updateIndexRecipeCards(recipes) {
  if (!fs.existsSync(indexPath)) {
    throw new Error(`index 파일이 없습니다: ${indexPath}`);
  }

  const startMarker = '<!-- AUTO_RECIPE_CARDS_START -->';
  const endMarker = '<!-- AUTO_RECIPE_CARDS_END -->';
  const indexHtml = fs.readFileSync(indexPath, 'utf8');

  if (!indexHtml.includes(startMarker) || !indexHtml.includes(endMarker)) {
    throw new Error('index.html에 자동 생성 마커가 없습니다.');
  }

  const cardsMarkup = recipes
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map((recipe, i) => buildIndexCard(recipe, i))
    .join('\n');

  const [head, rest] = indexHtml.split(startMarker);
  const [, tail] = rest.split(endMarker);
  const replaced = `${head}${startMarker}\n${cardsMarkup}\n        ${endMarker}${tail}`;

  fs.writeFileSync(indexPath, replaced, 'utf8');
  logVerbose(`index 카드 자동 갱신: ${recipes.length}개`);
}

function buildRecipeSummary(frontmatter, youtubeUrl, blogUrl) {
  if (frontmatter.summary) {
    return frontmatter.summary;
  }

  if (youtubeUrl) {
    return '재료와 조리과정을 먼저 읽고, 하단 영상으로 흐름을 확인하세요.';
  }

  if (blogUrl) {
    return '재료와 순서를 먼저 확인하고, 참고 링크를 통해 원문을 볼 수 있어요.';
  }

  return '재료와 조리과정을 확인해 보세요.';
}

// 링크 영역은 우선순위대로 렌더링한다: YouTube iframe > blog 링크 > 안내 문구.
function renderLinkSection(title, youtubeUrl, blogUrl) {
  const videoId = getYoutubeVideoId(youtubeUrl || '');
  const safeTitle = escapeHtml(title);

  if (videoId) {
    return `    <section class="card video-wrap reveal" aria-label="조리 영상">\n      <h2>영상</h2>\n      <iframe\n        src="https://www.youtube.com/embed/${escapeHtml(videoId)}"\n        title="${safeTitle} 조리 영상"\n        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"\n        referrerpolicy="strict-origin-when-cross-origin"\n        allowfullscreen>\n      </iframe>\n    </section>`;
  }

  if (blogUrl) {
    return `    <section class="card video-wrap reveal" aria-label="참고 링크">\n      <h2>참고 링크</h2>\n      <a href="${escapeHtml(blogUrl)}" target="_blank" rel="noopener noreferrer" class="btn">블로그에서 보기</a>\n    </section>`;
  }

  return `    <section class="card video-wrap reveal" aria-label="안내">\n      <h2>참고</h2>\n      <p>연결된 영상 또는 링크가 없습니다.</p>\n    </section>`;
}

// 레시피 한 건의 최종 HTML 문서를 템플릿으로 생성한다.
function buildHtml({ title, ingredients, steps, youtubeUrl, blogUrl, tags }) {
  const safeTitle = escapeHtml(title);
  const description = escapeHtml(`${title} 이유식 레시피입니다.`);
  const tagsMarkup = renderTags(tags, 'tag-list recipe-tags');

  return `<!doctype html>\n<html lang="ko">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>${safeTitle} | 아기 이유식 레시피북</title>\n  <meta name="description" content="${description}">\n  <meta name="robots" content="noindex, nofollow">\n  <link rel="stylesheet" href="../assets/styles.css">\n</head>\n<body>\n  <div class="page-bg" aria-hidden="true"></div>\n\n  <main class="recipe-main">\n    <header class="recipe-head reveal">\n      <a class="btn" href="../index.html">목록으로 돌아가기</a>\n      <h1>${safeTitle}</h1>\n      <p>먼저 텍스트 레시피를 읽고, 마지막에 영상 또는 참고 링크를 확인하세요.</p>\n${tagsMarkup ? `${tagsMarkup}\n` : ''}    </header>\n\n    <section class="card recipe-text reveal">\n      <h2>재료</h2>\n${renderList(ingredients, 'ul')}\n\n      <h2>조리과정</h2>\n${renderList(steps, 'ol')}\n    </section>\n\n${renderLinkSection(title, youtubeUrl, blogUrl)}\n  </main>\n\n  <script>\n    const observer = new IntersectionObserver((entries) => {\n      for (const entry of entries) {\n        if (entry.isIntersecting) {\n          entry.target.classList.add('show');\n          observer.unobserve(entry.target);\n        }\n      }\n    }, { threshold: 0.15 });\n\n    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));\n  </script>\n</body>\n</html>\n`;
}

// md 파일 1개를 읽어 파싱하고, 대응하는 recipes/{slug}.html을 갱신한다.
function convertMarkdownFile(filePath) {
  const fileName = path.basename(filePath);
  logVerbose(`읽는 중: 레시피 모음/${fileName}`);
  const raw = fs.readFileSync(filePath, 'utf8');
  const { frontmatter, body } = parseFrontmatter(raw, fileName);

  const title = frontmatter.title;
  const slug = frontmatter.slug;
  const youtubeUrl = frontmatter.youtube_url || '';
  const blogUrl = frontmatter.blog_url || '';
  const tags = parseTags(frontmatter.tags || '');

  if (!title || !slug) {
    throw new Error(`${fileName}: title, slug는 필수입니다.`);
  }

  const ingredients = parseBulletItems(parseSection(body, '재료'));
  const steps = parseOrderedItems(parseSection(body, '조리과정'));
  const summary = buildRecipeSummary(frontmatter, youtubeUrl, blogUrl);
  logVerbose(`요약: ${summary}`);

  if (!ingredients.length || !steps.length) {
    throw new Error(`${fileName}: 재료 또는 조리과정 섹션 파싱에 실패했습니다.`);
  }

  logVerbose(`파싱 완료: slug=${slug}, 태그=${tags.length}개, 재료=${ingredients.length}개, 조리과정=${steps.length}개`);

  const html = buildHtml({ title, ingredients, steps, youtubeUrl, blogUrl, tags });
  const outputPath = path.join(outputDir, `${slug}.html`);

  fs.writeFileSync(outputPath, html, 'utf8');
  console.log(`updated: recipes/${slug}.html`);

  return {
    title,
    slug,
    tags,
    summary,
    ingredients,
    steps
  };
}

// 레시피 소스 폴더의 모든 md를 순회하며 전체 HTML을 재생성한다.
function convertAllMarkdown() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`소스 폴더가 없습니다: ${sourceDir}`);
  }

  const files = fs.readdirSync(sourceDir)
    .filter((name) => name.endsWith('.md'))
    .sort();

  logVerbose(`전체 변환 대상: ${files.length}개 파일`);

  if (!files.length) {
    console.log('변환할 Markdown 파일이 없습니다.');
    return;
  }

  const recipes = [];

  for (const file of files) {
    const fullPath = path.join(sourceDir, file);
    recipes.push(convertMarkdownFile(fullPath));
  }

  updateIndexRecipeCards(recipes);
}

// 파일 저장 시 여러 이벤트가 연속 발생할 수 있어 debounce(120ms)로 묶어서 처리한다.
function watchMarkdown() {
  console.log('watching: 레시피 모음/*.md');

  let timer = null;
  fs.watch(sourceDir, (eventType, fileName) => {
    if (!fileName || !fileName.endsWith('.md')) {
      return;
    }

    logVerbose(`파일 이벤트 감지: type=${eventType}, file=${fileName}`);

    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      try {
        const fullPath = path.join(sourceDir, fileName);
        if (!fs.existsSync(fullPath)) {
          console.log(`skip: ${fileName} (삭제됨)`);
          return;
        }

        convertAllMarkdown();
      } catch (error) {
        console.error(`error: ${error.message}`);
      }
    }, 120);
  });
}

// 기본 실행: 1회 전체 생성 후, --watch 옵션이면 감시 모드를 유지한다.
function main() {
  try {
    if (isVerbose) {
      console.log('[verbose] 상세 로그 모드 활성화');
    }

    convertAllMarkdown();

    if (isWatchMode) {
      watchMarkdown();
    }
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exitCode = 1;
  }
}

main();
