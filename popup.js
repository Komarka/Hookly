(function () {
  const h = React.createElement;
  const TONES = ["Friendly", "Professional", "Direct"];
  const VARIATION_CLASSES = ["variation-a", "variation-b", "variation-c"];
  const BRAND_LOGO_URL = chrome.runtime.getURL("assets/logo.svg");
  const BUTTON_LOGO_URL = chrome.runtime.getURL("assets/logo-white.svg");

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

  function renderMessages(messagesWithScores, copiedIndex, onCopy) {
    return messagesWithScores.map((message, index) =>
      h(
        "article",
        { className: "card", key: `${message.text}-${index}` },
        h("p", { className: "card-message" }, message.text),
        h(
          "div",
          { className: "card-footer" },
          h(
            "div",
            { className: "card-meta" },
            h(
              "p",
              {
                className: `variation-label ${VARIATION_CLASSES[index] || VARIATION_CLASSES[0]}`
              },
              `Hook variation ${String.fromCharCode(65 + index)}`
            ),
            h(
              "div",
              { className: "score-row" },
              h("span", { className: "score-pill" }, `Human Score ${message.score}%`),
              h("span", { className: "score-label" }, message.label)
            )
          ),
          h(
            "button",
            {
              type: "button",
              className: `copy-button ${copiedIndex === index ? "copied" : ""}`.trim(),
              onClick: () => onCopy(message.text, index),
              title: "Copy message"
            },
            copiedIndex === index ? "\u2713 Copied" : "Copy"
          )
        )
      )
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
            h("div", { className: "skeleton-copy" })
          )
        )
      )
    );
  }

  function App() {
    const [tone, setTone] = React.useState("Friendly");
    const [profile, setProfile] = React.useState(null);
    const [messages, setMessages] = React.useState([]);
    const [copiedIndex, setCopiedIndex] = React.useState(null);
    const [isGenerating, setIsGenerating] = React.useState(false);
    const [status, setStatus] = React.useState("checking");
    const [errorMessage, setErrorMessage] = React.useState("");
    const [avatarFailed, setAvatarFailed] = React.useState(false);
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
          throw new Error(response.error || "Could not read this LinkedIn profile.");
        }

        setProfile(response.profile);
        setStatus(HooklyUtils.hasProfileIdentity(response.profile) ? "ready" : "missing-profile");
      } catch (error) {
        setStatus("error");
        setErrorMessage(error && error.message ? error.message : "Something went wrong while loading the profile.");
      }
    }

    async function handleGenerate() {
      if (!HooklyUtils.hasProfileIdentity(profile) || isGenerating) {
        return;
      }

      setIsGenerating(true);
      setMessages([]);
      setCopiedIndex(null);
      setErrorMessage("");
      setStatus("generating");

      try {
        const generatedMessages = await HooklyUtils.generateMessages(profile, tone);
        // Score all three generated options in parallel for a faster MVP flow.
        const messagesWithScores = await Promise.all(
          generatedMessages.map(async (text) => {
            const score = await HooklyUtils.getHumanScore(text);

            return {
              text,
              score,
              label: HooklyUtils.getScoreLabel(score)
            };
          })
        );

        setMessages(messagesWithScores);
        setStatus("done");
      } catch (error) {
        setStatus("error");
        setErrorMessage(error && error.message ? error.message : "Could not generate messages right now.");
      } finally {
        setIsGenerating(false);
      }
    }

    async function handleCopy(text, index) {
      try {
        await HooklyUtils.copyToClipboard(text);
        setCopiedIndex(index);
        window.setTimeout(() => {
          setCopiedIndex((current) => (current === index ? null : current));
        }, 1400);
      } catch (error) {
        setErrorMessage("Clipboard access failed. Copy manually from the card.");
      }
    }

    function renderStatusPanel() {
      if (errorMessage) {
        return h(
          "div",
          { className: "status-panel error" },
          h("p", { className: "status-title" }, "Action needed"),
          h("p", { className: "status-copy error-copy" }, errorMessage)
        );
      }

      if (status === "unsupported") {
        return h(
          "div",
          { className: "status-panel" },
          h("p", { className: "status-title" }, "Open a LinkedIn profile"),
          h(
            "p",
            { className: "status-copy" },
            "Hookly only works on LinkedIn profile pages for this MVP. Open a profile, then reopen the popup."
          )
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
            "LinkedIn changed the visible profile layout or the page is still loading. Refresh the page, then try again."
          )
        );
      }

      if (status === "generating") {
        return h(
          "div",
          { className: "status-panel" },
          h("p", { className: "status-title" }, "Generating outreach"),
          h(
            "p",
            { className: "status-copy" },
            "Hookly is creating 3 personalized messages and scoring them for natural tone."
          )
        );
      }

      return h(
        "div",
        { className: "status-panel" },
        h("p", { className: "status-title" }, profile ? "Profile ready" : "Start from LinkedIn"),
        h(
          "p",
          { className: "status-copy" },
          profile
            ? "Pick a tone and generate 3 cold message options built from the visible profile details."
            : "Open a LinkedIn profile to generate outreach options."
        )
      );
    }

    const canGenerate = HooklyUtils.hasProfileIdentity(profile) && !isGenerating;

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
            h("img", {
              className: "brand-logo",
              src: BRAND_LOGO_URL,
              alt: "Hookly"
            }),
            h("div", { className: "brand-text" }, "Hookly")
          )
        ),
        h(
          "main",
          { className: "content" },
          h("p", { className: "tagline" }, "Messages that get replies"),
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
                        onError: () => setAvatarFailed(true)
                      })
                  : h("span", { className: "profile-avatar-fallback" }, initialsFromProfile(profile))
              ),
              h(
                "div",
                { className: "profile-meta" },
                h("p", { className: "profile-name" }, profile.name || "LinkedIn profile"),
                h(
                  "p",
                  { className: "profile-headline" },
                  profile.headline || "Headline not found yet. Hookly will still work if the name is visible."
                )
              )
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
                  className: `tone-pill ${tone === toneOption ? "active" : ""}`.trim(),
                  onClick: () => setTone(toneOption),
                  disabled: isGenerating
                },
                toneOption
              )
            )
          ),
          h(
            "button",
            {
              type: "button",
              className: "generate-button",
              onClick: handleGenerate,
              disabled: !canGenerate
            },
            h("img", {
              className: "button-logo",
              src: BUTTON_LOGO_URL,
              alt: "",
              "aria-hidden": "true"
            }),
            isGenerating ? "Generating..." : "Generate message"
          ),
          renderStatusPanel(),
          h(
            "div",
            { className: "results-header" },
            h("p", { className: "section-label", style: { margin: 0 } }, "Variations"),
            h("div", { className: "results-rule" })
          ),
          isGenerating
            ? h(
                React.Fragment,
                null,
                h(LoadingCards),
                h("p", { className: "loading-note" }, "Scoring each message for natural tone...")
              )
            : messages.length > 0
              ? h("div", { className: "cards" }, renderMessages(messages, copiedIndex, handleCopy))
              : h(
                  "div",
                  { className: "status-panel" },
                  h("p", { className: "status-title" }, "No messages yet"),
                  h(
                    "p",
                    { className: "status-copy" },
                    "Hookly will generate 3 short personalized outreach options once you open a LinkedIn profile and click the main button."
                  )
                )
        )
      )
    );
  }

  const mountNode = document.getElementById("app");

  if (ReactDOM.createRoot) {
    ReactDOM.createRoot(mountNode).render(h(App));
  } else {
    ReactDOM.render(h(App), mountNode);
  }
})();
