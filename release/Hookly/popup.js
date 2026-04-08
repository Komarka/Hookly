(function () {
  const h = React.createElement;
  const TONES = ["Friendly", "Professional", "Direct"];
  const VARIATION_CLASSES = ["variation-a", "variation-b", "variation-c"];
  const BUTTON_LOGO_URL = chrome.runtime.getURL("assets/logo-white.svg");
  const ALPHA_TRY_LIMIT = 20;
  const TRY_COUNT_STORAGE_KEY = "hookly-alpha-tries";
  const FEEDBACK_LINK = "https://www.linkedin.com/in/ilya-komar-js/";
  const FEEDBACK_EMAIL = "illyakomarka@gmail.com";

  function normalizeImageUrl(value) {
    const raw = String(value || "").trim();

    if (!raw) {
      return null;
    }

    const normalized = raw.replace(/&amp;/g, "&");

    try {
      const url = new URL(normalized, window.location.href);

      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.toString();
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  function initialsFromProfile(profile) {
    const seed = (profile && (profile.name || profile.headline)) || "H";

    return seed
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }

  function getTryCount() {
    try {
      const storedValue = window.localStorage.getItem(TRY_COUNT_STORAGE_KEY);
      const parsedValue = Number(storedValue || "0");

      if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        return 0;
      }

      return parsedValue;
    } catch (error) {
      return 0;
    }
  }

  function incrementTryCount() {
    const nextValue = Math.min(ALPHA_TRY_LIMIT, getTryCount() + 1);

    try {
      window.localStorage.setItem(TRY_COUNT_STORAGE_KEY, String(nextValue));
    } catch (error) {
      return nextValue;
    }

    return nextValue;
  }

  function renderWhyItWorks(items) {
    return h(
      "ul",
      { className: "why-list" },
      items.map((item, index) => h("li", { key: `${item}-${index}` }, item)),
    );
  }

  function renderMessages(
    messagesWithScores,
    copiedIndex,
    bestIndex,
    sharpeningIndex,
    onCopy,
    onMakeSharper,
  ) {
    return messagesWithScores.map((message, index) =>
      h(
        "article",
        {
          className: `card ${bestIndex === index ? "card-best" : ""}`.trim(),
          key: `${message.text}-${index}`,
        },
        h(
          "div",
          { className: "card-topline" },
          h(
            "p",
            {
              className: `variation-label ${VARIATION_CLASSES[index] || VARIATION_CLASSES[0]}`,
            },
            `Hook variation ${String.fromCharCode(65 + index)}`,
          ),
          bestIndex === index &&
            h("span", { className: "best-badge" }, "\uD83D\uDD25 Best option"),
        ),
        h("p", { className: "card-message" }, message.text),
        h(
          "div",
          { className: "why-block" },
          h("p", { className: "why-title" }, "Why it works"),
          renderWhyItWorks(message.whyItWorks || []),
        ),
        bestIndex === index &&
          message.shortVersion &&
          h(
            "div",
            { className: "short-version" },
            h("p", { className: "short-version-label" }, "Short version"),
            h("p", { className: "short-version-text" }, message.shortVersion),
          ),
        h(
          "div",
          { className: "card-footer" },
          h(
            "div",
            { className: "card-meta" },
            h(
              "div",
              { className: "score-row" },
              h(
                "span",
                { className: "score-pill" },
                `Human Score ${message.score}%`,
              ),
              h("span", { className: "score-label" }, message.label),
            ),
          ),
          h(
            "div",
            { className: "card-actions" },
            h(
              "button",
              {
                type: "button",
                className: "sharpen-button",
                onClick: () => onMakeSharper(index),
                disabled: sharpeningIndex === index,
                title: "Rewrite this version to sound tighter",
              },
              sharpeningIndex === index ? "Sharpening..." : "Make sharper",
            ),
            h(
              "button",
              {
                type: "button",
                className:
                  `copy-button ${copiedIndex === index ? "copied" : ""}`.trim(),
                onClick: () => onCopy(message.text, index),
                title: "Copy message",
              },
              copiedIndex === index ? "\u2713 Copied" : "Copy",
            ),
          ),
        ),
      ),
    );
  }

  function LoadingCards() {
    return h(
      "div",
      { className: "cards" },
      [0, 1, 2].map((index) =>
        h(
          "div",
          { className: "skeleton-card", key: index },
          h("div", { className: "skeleton-line large" }),
          h("div", { className: "skeleton-line medium" }),
          h(
            "div",
            { className: "skeleton-footer" },
            h("div", { className: "skeleton-tag" }),
            h("div", { className: "skeleton-copy" }),
          ),
        ),
      ),
    );
  }

  function App() {
    const [tone, setTone] = React.useState("Friendly");
    const [profile, setProfile] = React.useState(null);
    const [messages, setMessages] = React.useState([]);
    const [copiedIndex, setCopiedIndex] = React.useState(null);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [sharpeningIndex, setSharpeningIndex] = React.useState(null);
    const [status, setStatus] = React.useState("checking");
    const [errorMessage, setErrorMessage] = React.useState("");
    const [avatarFailed, setAvatarFailed] = React.useState(false);
    const [tryCount, setTryCount] = React.useState(getTryCount());
    const avatarUrl = normalizeImageUrl(profile && profile.imageUrl);

    React.useEffect(() => {
      initializePopup();
    }, []);

    React.useEffect(() => {
      setAvatarFailed(false);
    }, [avatarUrl]);

    async function initializePopup() {
      setStatus("checking");
      setErrorMessage("");

      try {
        const tab = await HooklyUtils.getActiveTab();

        if (!tab || !HooklyUtils.isLinkedInProfileUrl(tab.url)) {
          setProfile(null);
          setStatus("unsupported");
          return;
        }

        const response = await HooklyUtils.requestProfileData(tab.id);

        if (!response.success) {
          throw new Error(
            response.error || "Could not read this LinkedIn profile.",
          );
        }

        setProfile(response.profile);
        setStatus(
          HooklyUtils.hasProfileIdentity(response.profile)
            ? "ready"
            : "missing-profile",
        );
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error && error.message
            ? error.message
            : "Something went wrong while loading the profile.",
        );
      }
    }

    async function handleGenerate() {
      if (!HooklyUtils.hasProfileIdentity(profile) || isGenerating) {
        return;
      }

      setIsGenerating(true);
      setSharpeningIndex(null);
      setMessages([]);
      setCopiedIndex(null);
      setErrorMessage("");
      setStatus("generating");

      try {
        const generatedMessages = await HooklyUtils.generateMessages(
          profile,
          tone,
        );
        const messagesWithScores =
          await scoreAndDecorateMessages(generatedMessages);
        const nextTryCount = incrementTryCount();

        setTryCount(nextTryCount);
        setMessages(messagesWithScores);
        setStatus("done");
      } catch (error) {
        setStatus("error");
        setErrorMessage(
          error && error.message
            ? error.message
            : "Could not generate messages right now.",
        );
      } finally {
        setIsGenerating(false);
      }
    }

    async function scoreAndDecorateMessages(messageTexts) {
      const scoredMessages = await Promise.all(
        messageTexts.map(async (text) => {
          const score = await HooklyUtils.getHumanScore(text);

          return {
            text,
            score,
            label: HooklyUtils.getScoreLabel(score),
            whyItWorks: HooklyUtils.getWhyItWorks(text, profile),
            shortVersion: null,
          };
        }),
      );

      const bestPick = HooklyUtils.getBestMessage(scoredMessages);

      if (bestPick) {
        try {
          scoredMessages[bestPick.index] = {
            ...scoredMessages[bestPick.index],
            shortVersion: await HooklyUtils.generateShortVersion(
              scoredMessages[bestPick.index].text,
              tone,
            ),
          };
        } catch (error) {
          scoredMessages[bestPick.index] = {
            ...scoredMessages[bestPick.index],
            shortVersion: null,
          };
        }
      }

      return scoredMessages;
    }

    async function handleCopy(text, index) {
      try {
        await HooklyUtils.copyToClipboard(text);
        setCopiedIndex(index);
        window.setTimeout(() => {
          setCopiedIndex((current) => (current === index ? null : current));
        }, 1400);
      } catch (error) {
        setErrorMessage(
          "Clipboard access failed. Copy manually from the card.",
        );
      }
    }

    async function handleMakeSharper(index) {
      if (sharpeningIndex !== null || !messages[index]) {
        return;
      }

      setSharpeningIndex(index);
      setErrorMessage("");

      try {
        const sharperMessage = await HooklyUtils.makeMessageSharper(
          messages[index].text,
          tone,
        );
        const updatedTexts = messages.map((item, currentIndex) =>
          currentIndex === index ? sharperMessage : item.text,
        );
        const updatedMessages = await scoreAndDecorateMessages(updatedTexts);

        setMessages(updatedMessages);
      } catch (error) {
        setErrorMessage(
          error && error.message
            ? error.message
            : "Could not sharpen this message right now.",
        );
      } finally {
        setSharpeningIndex(null);
      }
    }

    function renderStatusPanel() {
      if (errorMessage) {
        return h(
          "div",
          { className: "status-panel error" },
          h("p", { className: "status-title" }, "Action needed"),
          h("p", { className: "status-copy error-copy" }, errorMessage),
        );
      }

      if (tryCount >= ALPHA_TRY_LIMIT) {
        return null;
      }

      if (status === "unsupported") {
        return h(
          "div",
          { className: "status-panel" },
          h("p", { className: "status-title" }, "Open a LinkedIn profile"),
          h(
            "p",
            { className: "status-copy" },
            "Hookly only works on LinkedIn profile pages for this MVP. Open a profile, then reopen the popup.",
          ),
        );
      }

      if (status === "missing-profile") {
        return h(
          "div",
          { className: "status-panel" },
          h("p", { className: "status-title" }, "Profile data is missing"),
          h(
            "p",
            { className: "status-copy" },
            "LinkedIn changed the visible profile layout or the page is still loading. Refresh the page, then try again.",
          ),
        );
      }

      if (status === "generating") {
        return h(
          "div",
          { className: "status-panel" },
          h("p", { className: "status-title" }, "Building your best opener"),
          h(
            "p",
            { className: "status-copy" },
            "Hookly is generating 3 options, scoring them, and picking the strongest one.",
          ),
        );
      }

      return h(
        "div",
        { className: "status-panel" },
        h(
          "p",
          { className: "status-title" },
          profile ? "Profile ready" : "Start from LinkedIn",
        ),
        h(
          "p",
          { className: "status-copy" },
          profile
            ? "Pick a tone and get 3 reply-focused openers built from the visible profile details."
            : "Open a LinkedIn profile to get reply-focused outreach options.",
        ),
      );
    }

    function renderAlphaLimitPanel() {
      return h(
        "div",
        { className: "status-panel alpha-limit-panel" },
        h("p", { className: "status-title" }, "Alpha limit reached"),
        h(
          "p",
          { className: "status-copy" },
          "This alpha version is capped for now. Thank you for trying Hookly.",
        ),
        h(
          "p",
          { className: "status-copy" },
          "It would be great to hear your feedback.",
        ),
        h(
          "p",
          { className: "alpha-feedback" },
          h(
            "a",
            {
              href: FEEDBACK_LINK,
              target: "_blank",
              rel: "noreferrer",
              className: "alpha-link",
            },
            "LinkedIn",
          ),
          " or ",
          h(
            "a",
            {
              href: `mailto:${FEEDBACK_EMAIL}`,
              className: "alpha-link",
            },
            FEEDBACK_EMAIL,
          ),
        ),
      );
    }

    const canGenerate =
      HooklyUtils.hasProfileIdentity(profile) &&
      !isGenerating &&
      tryCount < ALPHA_TRY_LIMIT;
    const bestPick = HooklyUtils.getBestMessage(messages);
    const bestIndex = bestPick ? bestPick.index : -1;

    return h(
      "div",
      { className: "hookly-app" },
      h(
        "div",
        { className: "shell" },
        h(
          "header",
          { className: "topbar" },
          h(
            "div",
            { className: "brand" },
            h("div", { className: "brand-text" }, "Hookly"),
            h("span", { className: "alpha-badge" }, "Alpha"),
          ),
        ),
        h(
          "main",
          { className: "content" },
          h(
            "p",
            { className: "tagline" },
            "Built to sound human, specific, and hard to ignore.",
          ),
          h(
            "p",
            { className: "disclosure-note" },
            "Visible LinkedIn profile details are read on this page and sent to Groq only when you click Get replies.",
          ),
          profile &&
            h(
              "section",
              { className: "profile-chip" },
              h(
                "div",
                { className: "profile-avatar" },
                avatarUrl && !avatarFailed
                  ? h("img", {
                      className: "profile-avatar-image",
                      src: avatarUrl,
                      alt: profile.name || "LinkedIn profile",
                      loading: "eager",
                      referrerPolicy: "no-referrer",
                      onError: () => setAvatarFailed(true),
                    })
                  : h(
                      "span",
                      { className: "profile-avatar-fallback" },
                      initialsFromProfile(profile),
                    ),
              ),
              h(
                "div",
                { className: "profile-meta" },
                h(
                  "p",
                  { className: "profile-name" },
                  profile.name || "LinkedIn profile",
                ),
                h(
                  "p",
                  { className: "profile-headline" },
                  profile.headline ||
                    "Headline not found yet. Hookly will still work if the name is visible.",
                ),
              ),
            ),
          h("p", { className: "section-label" }, "Select Tone"),
          h(
            "div",
            { className: "tone-row" },
            TONES.map((toneOption) =>
              h(
                "button",
                {
                  type: "button",
                  key: toneOption,
                  className:
                    `tone-pill ${tone === toneOption ? "active" : ""}`.trim(),
                  onClick: () => setTone(toneOption),
                  disabled: isGenerating,
                },
                toneOption,
              ),
            ),
          ),
          tryCount < ALPHA_TRY_LIMIT
            ? h(
                "button",
                {
                  type: "button",
                  className: "generate-button",
                  onClick: handleGenerate,
                  disabled: !canGenerate,
                },
                h("img", {
                  className: "button-logo",
                  src: BUTTON_LOGO_URL,
                  alt: "",
                  "aria-hidden": "true",
                }),
                isGenerating ? "Building..." : "Get replies",
              )
            : renderAlphaLimitPanel(),
          renderStatusPanel(),
          h(
            "div",
            { className: "results-header" },
            h(
              "p",
              { className: "section-label", style: { margin: 0 } },
              "Best openers",
            ),
            h("div", { className: "results-rule" }),
          ),
          h(
            "p",
            { className: "results-helper" },
            "Built to sound human, specific, and hard to ignore.",
          ),
          isGenerating
            ? h(
                React.Fragment,
                null,
                h(LoadingCards),
                h(
                  "p",
                  { className: "loading-note" },
                  "Scoring, ranking, and compressing the best option...",
                ),
              )
            : messages.length > 0
              ? h(
                  "div",
                  { className: "cards" },
                  renderMessages(
                    messages,
                    copiedIndex,
                    bestIndex,
                    sharpeningIndex,
                    handleCopy,
                    handleMakeSharper,
                  ),
                )
              : h(
                  "div",
                  { className: "status-panel" },
                  h("p", { className: "status-title" }, "No messages yet"),
                  h(
                    "p",
                    { className: "status-copy" },
                    "Hookly will generate 3 short, reply-focused options once you open a LinkedIn profile and click the main button.",
                  ),
                ),
        ),
      ),
    );
  }

  const mountNode = document.getElementById("app");

  if (ReactDOM.createRoot) {
    ReactDOM.createRoot(mountNode).render(h(App));
  } else {
    ReactDOM.render(h(App), mountNode);
  }
})();
