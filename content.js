(function () {
  const TOPCARD_SELECTORS = [
    "section[componentkey*='Topcard']",
    "div[componentkey*='Topcard']",
    "main section[componentkey*='Topcard']"
  ];

  const PROFILE_PHOTO_SELECTORS = [
    "img[src*='profile-displayphoto']",
    "img[src*='profile-framedphoto']",
    "img[src*='profile-displayphoto-shrink']",
    "img[src*='profile-displayphoto-scale']"
  ];

  const NAME_SELECTORS = [
    "main h1",
    "main h2",
    ".text-heading-xlarge.inline.t-24.v-align-middle.break-words",
    ".text-heading-xlarge"
  ];

  const HEADLINE_SELECTORS = [
    ".pv-text-details__left-panel .text-body-medium.break-words",
    ".pv-text-details__left-panel .text-body-medium",
    ".ph5 .text-body-medium.break-words",
    ".ph5 .text-body-medium",
    "main section div.text-body-medium.break-words",
    "main section div.text-body-medium",
    ".mt2 .text-body-medium",
    ".mt2 [dir='ltr']"
  ];

  const ABOUT_SECTION_SELECTORS = [
    "section[componentkey*='About']",
    "div[componentkey*='About']"
  ];

  const ACTIVITY_SECTION_SELECTORS = [
    "section[componentkey*='Activity']",
    "div[componentkey*='Activity']"
  ];

  const HEADING_GROUPS = {
    about: ["about", "\u043e\u0431\u0449\u0438\u0435 \u0441\u0432\u0435\u0434\u0435\u043d\u0438\u044f"],
    activity: ["activity", "\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f"],
    experience: ["experience", "\u043e\u043f\u044b\u0442 \u0440\u0430\u0431\u043e\u0442\u044b"],
    featured: ["featured", "\u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u043e\u0432\u0430\u043d\u043e"],
    interests: ["interests", "\u0438\u043d\u0442\u0435\u0440\u0435\u0441\u044b"]
  };

  const SHARED_ACTIVITY_PATTERNS = [
    /\bshared this\b/i,
    /\breposted this\b/i,
    /\bshared\b/i,
    /\breshared\b/i,
    /\bcommented on this\b/i,
    /\breacted to this\b/i,
    /\b\u043f\u043e\u0434\u0435\u043b\u0438\u043b/i,
    /\b\u043f\u043e\u0434\u0435\u043b\u0438\u043b\u0430\u0441/i,
    /\b\u0440\u0435\u043f\u043e\u0441\u0442/i,
    /\b\u043f\u0440\u043e\u043a\u043e\u043c\u043c\u0435\u043d\u0442/i,
    /\b\u043e\u0442\u0440\u0435\u0430\u0433\u0438\u0440/i
  ];

  const UI_NOISE_PATTERNS = [
    /^activity$/i,
    /^\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f$/i,
    /^show translation$/i,
    /^\u043f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u043f\u0435\u0440\u0435\u0432\u043e\u0434$/i,
    /^like$/i,
    /^\u043d\u0440\u0430\u0432\u0438\u0442\u0441\u044f$/i,
    /^comment$/i,
    /^\u043a\u043e\u043c\u043c\u0435\u043d\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c$/i,
    /^repost$/i,
    /^share$/i,
    /^\u043f\u043e\u0434\u0435\u043b\u0438\u0442\u044c\u0441\u044f$/i,
    /^send$/i,
    /^\u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c$/i,
    /^follow$/i,
    /^\u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0442\u044c$/i
  ];

  function isVisible(element) {
    if (!element) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  }

  function cleanText(value) {
    if (!value) {
      return null;
    }

    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized || null;
  }

  function normalizeForMatch(value) {
    return (cleanText(value || "") || "")
      .toLowerCase()
      .replace(/[.,:;!?()[\]{}"'`]+/g, "")
      .replace(/\s+/g, " ");
  }

  function readElementText(element) {
    if (!element) {
      return null;
    }

    return cleanText(element.innerText || element.textContent);
  }

  function findVisibleText(selector) {
    const elements = document.querySelectorAll(selector);

    for (const element of elements) {
      if (!isVisible(element)) {
        continue;
      }

      const text = readElementText(element);

      if (text) {
        return text;
      }
    }

    return null;
  }

  function findText(selectorList, options) {
    const settings = options || {};

    for (const selector of selectorList) {
      const elements = document.querySelectorAll(selector);

      for (const element of elements) {
        if (settings.visibleOnly && !isVisible(element)) {
          continue;
        }

        const text = readElementText(element);

        if (text) {
          return text;
        }
      }
    }

    return null;
  }

  function getProfileMain() {
    return (
      document.querySelector("main[role='main'][data-sdui-screen*='profile']") ||
      document.querySelector("[role='main'][data-sdui-screen*='profile']") ||
      document.querySelector("main[role='main']") ||
      document.querySelector("[role='main']") ||
      document.querySelector("main")
    );
  }

  function getCurrentProfilePath() {
    return window.location.pathname.replace(/\/+$/, "");
  }

  function isOwnProfileLink(href) {
    if (!href) {
      return false;
    }

    try {
      const url = new URL(href, window.location.origin);
      return url.pathname.replace(/\/+$/, "") === getCurrentProfilePath();
    } catch (error) {
      return false;
    }
  }

  function getImageArea(image) {
    if (!image) {
      return 0;
    }

    const width = image.naturalWidth || image.width || image.clientWidth || 0;
    const height = image.naturalHeight || image.height || image.clientHeight || 0;

    return width * height;
  }

  function scoreProfilePhoto(image, options) {
    if (!image || !isVisible(image)) {
      return -1;
    }

    const settings = options || {};
    let score = 0;
    const area = getImageArea(image);
    const src = image.currentSrc || image.src || "";
    const nearestProfileLink = image.closest("a[href]");

    score += Math.min(area, 200000);

    if (src.includes("profile-framedphoto")) {
      score += 50000;
    }

    if (src.includes("profile-displayphoto")) {
      score += 40000;
    }

    if (nearestProfileLink && isOwnProfileLink(nearestProfileLink.href)) {
      score += 250000;
    }

    if (settings.preferOwnProfile && nearestProfileLink && isOwnProfileLink(nearestProfileLink.href)) {
      score += 250000;
    }

    return score;
  }

  function findBestProfilePhoto(root, options) {
    if (!root) {
      return null;
    }

    const candidates = [];

    for (const selector of PROFILE_PHOTO_SELECTORS) {
      for (const image of root.querySelectorAll(selector)) {
        candidates.push(image);
      }
    }

    let bestImage = null;
    let bestScore = -1;

    for (const image of candidates) {
      const score = scoreProfilePhoto(image, options);

      if (score > bestScore) {
        bestImage = image;
        bestScore = score;
      }
    }

    return bestImage;
  }

  function getProfilePhoto(container) {
    const containerPhoto = findBestProfilePhoto(container, { preferOwnProfile: true });

    if (containerPhoto) {
      return containerPhoto;
    }

    const profileMain = getProfileMain();
    const mainPhoto = findBestProfilePhoto(profileMain, { preferOwnProfile: true });

    if (mainPhoto) {
      return mainPhoto;
    }

    return findBestProfilePhoto(document, { preferOwnProfile: false });
  }

  function collectStructuralContainers(root) {
    if (!root) {
      return [];
    }

    const containers = [];
    const seen = new Set();
    const candidates = root.querySelectorAll("section, article, div[componentkey]");

    for (const candidate of candidates) {
      if (!isVisible(candidate) || seen.has(candidate)) {
        continue;
      }

      seen.add(candidate);
      containers.push(candidate);
    }

    return containers;
  }

  function scoreTopCardCandidate(container) {
    let score = 0;
    const heading = container.querySelector("h1, h2");
    const headingText = readElementText(heading);
    const photo = getProfilePhoto(container);

    if (headingText) {
      score += 3;
    }

    if (photo) {
      score += 3;
    }

    const profileLinks = Array.from(container.querySelectorAll("a[href]")).filter((link) =>
      isOwnProfileLink(link.href)
    );

    if (profileLinks.length > 0) {
      score += 4;
    }

    const paragraphs = Array.from(container.querySelectorAll("p")).filter((node) => readElementText(node));

    if (paragraphs.length >= 2) {
      score += 2;
    }

    return score;
  }

  function getTopCard() {
    const profileMain = getProfileMain();
    const candidates = collectStructuralContainers(profileMain);
    let bestCandidate = null;
    let bestScore = 0;

    for (const candidate of candidates.slice(0, 25)) {
      const score = scoreTopCardCandidate(candidate);

      if (score > bestScore) {
        bestCandidate = candidate;
        bestScore = score;
      }
    }

    if (bestCandidate) {
      return bestCandidate;
    }

    for (const selector of TOPCARD_SELECTORS) {
      const node = document.querySelector(selector);

      if (node) {
        return node;
      }
    }

    return null;
  }

  function findTopCardName(topCard) {
    if (!topCard) {
      return null;
    }

    const heading = topCard.querySelector("h1, h2");
    return readElementText(heading);
  }

  function isLikelyMetaLine(text) {
    if (!text) {
      return false;
    }

    const normalized = normalizeForMatch(text);

    if (!normalized || normalized.length < 3) {
      return false;
    }

    if (/^[\u00b7\u2022\-|\d\s]+$/.test(text)) {
      return false;
    }

    if (normalized.includes("contact info") || normalized.includes("\u043a\u043e\u043d\u0442\u0430\u043a\u0442")) {
      return false;
    }

    if (normalized.includes("message") || normalized.includes("\u0441\u043e\u043e\u0431\u0449\u0435\u043d\u0438\u0435")) {
      return false;
    }

    if (normalized.includes("followers") || normalized.includes("\u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u044e\u0449")) {
      return false;
    }

    return true;
  }

  function findTopCardHeadline(topCard, name) {
    if (!topCard) {
      return null;
    }

    const nameMatch = normalizeForMatch(name);
    const paragraphs = Array.from(topCard.querySelectorAll("p, div, span"));

    for (const node of paragraphs) {
      const text = readElementText(node);

      if (!isLikelyMetaLine(text)) {
        continue;
      }

      if (normalizeForMatch(text) === nameMatch) {
        continue;
      }

      if (text.length < 4 || text.length > 220) {
        continue;
      }

      return text;
    }

    return null;
  }

  function findTopCardMeta(topCard, headline) {
    if (!topCard) {
      return {
        company: null,
        school: null,
        location: null
      };
    }

    const lines = Array.from(topCard.querySelectorAll("p, span, a"))
      .map(readElementText)
      .filter(Boolean)
      .filter(isLikelyMetaLine)
      .filter((text) => text !== headline);

    let company = null;
    let school = null;
    let location = null;

    for (const text of lines) {
      if (!company && text.includes(" \u00b7 ")) {
        const parts = text.split(" \u00b7 ").map(cleanText).filter(Boolean);

        if (parts.length >= 1) {
          company = parts[0] || null;
        }

        if (parts.length >= 2) {
          school = parts.slice(1).join(" \u00b7 ");
        }

        continue;
      }

      if (!location && text.includes(",") && text.length > 8) {
        location = text;
      }
    }

    return {
      company,
      school,
      location
    };
  }

  function getSectionBySelectors(selectorList) {
    for (const selector of selectorList) {
      const node = document.querySelector(selector);

      if (node) {
        return node;
      }
    }

    return null;
  }

  function findSectionByHeadingTexts(headingTexts) {
    const profileMain = getProfileMain();

    if (!profileMain) {
      return null;
    }

    const targetHeadings = headingTexts.map(normalizeForMatch);
    const containers = collectStructuralContainers(profileMain);

    for (const container of containers) {
      const heading = container.querySelector("h1, h2, h3");
      const headingText = normalizeForMatch(readElementText(heading));

      if (!headingText) {
        continue;
      }

      if (
        targetHeadings.includes(headingText) ||
        targetHeadings.some((candidate) => headingText.startsWith(candidate + " "))
      ) {
        return container;
      }
    }

    return null;
  }

  function extractAboutText() {
    const section =
      findSectionByHeadingTexts(HEADING_GROUPS.about) ||
      getSectionBySelectors(ABOUT_SECTION_SELECTORS);

    if (!section) {
      return null;
    }

    const expandable = section.querySelector("[data-testid='expandable-text-box']");
    const candidates = expandable
      ? [expandable]
      : Array.from(section.querySelectorAll("p, span, div"));

    for (const candidate of candidates) {
      const text = readElementText(candidate);

      if (!text || text.length < 30) {
        continue;
      }

      if (normalizeForMatch(text) === normalizeForMatch(readElementText(section.querySelector("h1, h2, h3")))) {
        continue;
      }

      return text.slice(0, 700);
    }

    return null;
  }

  function isNoiseText(text) {
    if (!text) {
      return true;
    }

    const normalized = normalizeForMatch(text);

    return UI_NOISE_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  function takeUniqueLines(lines, limit) {
    const result = [];
    const seen = new Set();

    for (const line of lines) {
      const text = cleanText(line);

      if (!text) {
        continue;
      }

      const normalized = normalizeForMatch(text);

      if (!normalized || seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      result.push(text);

      if (result.length === limit) {
        break;
      }
    }

    return result;
  }

  function collectMeaningfulTexts(root, limit) {
    if (!root) {
      return [];
    }

    const lines = Array.from(root.querySelectorAll("p, span, a"))
      .map(readElementText)
      .filter(Boolean)
      .filter((text) => !isNoiseText(text))
      .filter((text) => text.length >= 4 && text.length <= 260);

    return takeUniqueLines(lines, limit);
  }

  function summarizeCardText(root, limit) {
    return collectMeaningfulTexts(root, limit).join(" | ");
  }

  function isSharedActivityCard(card, text) {
    const cardText = `${readElementText(card) || ""} ${text || ""}`;
    return SHARED_ACTIVITY_PATTERNS.some((pattern) => pattern.test(cardText));
  }

  function extractActivityContext() {
    const section =
      findSectionByHeadingTexts(HEADING_GROUPS.activity) ||
      getSectionBySelectors(ACTIVITY_SECTION_SELECTORS);

    if (!section) {
      return {
        authored: [],
        shared: []
      };
    }

    const authored = [];
    const shared = [];
    const seen = new Set();
    const cards = Array.from(section.querySelectorAll("article, li, div[role='listitem']"));

    for (const card of cards) {
      const text = summarizeCardText(card, 4);

      if (!text || text.length < 30) {
        continue;
      }

      const normalized = normalizeForMatch(text);

      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);

      if (isSharedActivityCard(card, text)) {
        shared.push(text.slice(0, 260));
      } else {
        authored.push(text.slice(0, 260));
      }

      if (authored.length >= 3 && shared.length >= 3) {
        break;
      }
    }

    return {
      authored: authored.slice(0, 3),
      shared: shared.slice(0, 3)
    };
  }

  function extractExperienceHighlights() {
    const section = findSectionByHeadingTexts(HEADING_GROUPS.experience);

    if (!section) {
      return [];
    }

    const highlights = [];
    const seen = new Set();
    const items = Array.from(section.querySelectorAll("li"));

    for (const item of items) {
      const lines = Array.from(item.querySelectorAll("p, span, a"))
        .map(readElementText)
        .filter(Boolean)
        .filter(isLikelyMetaLine);

      if (lines.length < 2) {
        continue;
      }

      const summary = lines.slice(0, 3).join(" | ");

      if (summary.length < 10 || seen.has(summary)) {
        continue;
      }

      seen.add(summary);
      highlights.push(summary);

      if (highlights.length === 3) {
        break;
      }
    }

    return highlights;
  }

  function extractLatestWorkplace(experienceHighlights) {
    const first = Array.isArray(experienceHighlights) ? experienceHighlights[0] : null;

    if (!first) {
      return null;
    }

    const parts = first.split(" | ").map(cleanText).filter(Boolean);

    return {
      summary: first,
      role: parts[0] || null,
      company: parts[1] || null
    };
  }

  function extractFeaturedHighlights() {
    const section = findSectionByHeadingTexts(HEADING_GROUPS.featured);

    if (!section) {
      return [];
    }

    const highlights = [];
    const cards = Array.from(section.querySelectorAll("li, article, a[href]"));

    for (const card of cards) {
      const text = summarizeCardText(card, 3);

      if (!text || text.length < 12) {
        continue;
      }

      highlights.push(text.slice(0, 220));

      if (highlights.length === 3) {
        break;
      }
    }

    return takeUniqueLines(highlights, 3);
  }

  function extractInterestsHighlights() {
    const section = findSectionByHeadingTexts(HEADING_GROUPS.interests);

    if (!section) {
      return [];
    }

    const highlights = [];
    const items = Array.from(section.querySelectorAll("li, a[href], article"));

    for (const item of items) {
      const text = summarizeCardText(item, 2);

      if (!text || text.length < 4) {
        continue;
      }

      highlights.push(text.slice(0, 180));

      if (highlights.length === 5) {
        break;
      }
    }

    return takeUniqueLines(highlights, 5);
  }

  function getProfileData() {
    const topCard = getTopCard();
    const profilePhoto = getProfilePhoto(topCard);
    const activityContext = extractActivityContext();
    const name =
      findTopCardName(topCard) ||
      findText(NAME_SELECTORS, { visibleOnly: true }) ||
      findText(NAME_SELECTORS) ||
      findVisibleText("h1") ||
      cleanText(document.title.replace(/\s*\|\s*LinkedIn.*$/i, ""));

    let headline =
      findTopCardHeadline(topCard, name) ||
      findText(HEADLINE_SELECTORS, { visibleOnly: true }) ||
      findText(HEADLINE_SELECTORS);

    if (headline === name) {
      headline = null;
    }

    const meta = findTopCardMeta(topCard, headline);
    const experienceHighlights = extractExperienceHighlights();

    return {
      name,
      headline,
      company: meta.company,
      school: meta.school,
      location: meta.location,
      about: extractAboutText(),
      experienceHighlights,
      latestWorkplace: extractLatestWorkplace(experienceHighlights),
      featuredHighlights: extractFeaturedHighlights(),
      interestsHighlights: extractInterestsHighlights(),
      recentActivity: activityContext.authored,
      sharedActivity: activityContext.shared,
      imageUrl: profilePhoto ? profilePhoto.currentSrc || profilePhoto.src || null : null,
      url: window.location.href
    };
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || request.type !== "HOOKLY_GET_PROFILE") {
      return;
    }

    try {
      sendResponse({
        success: true,
        profile: getProfileData()
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error && error.message ? error.message : "Could not read this LinkedIn profile."
      });
    }
  });
})();
