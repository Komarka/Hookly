(function () {
  const API_KEY =
    window.HooklyEnv && typeof window.HooklyEnv.GROQ_API_KEY === "string"
      ? window.HooklyEnv.GROQ_API_KEY
      : "";

  const API_CONFIG = {
    apiKey: API_KEY,
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.1-8b-instant",
    generationTemperature: 0.9,
    scoreTemperature: 0.1,
    generationMaxTokens: 350,
    scoreMaxTokens: 30,
  };

  const GENERATION_SYSTEM_PROMPT =
    "You are an expert in cold outreach. Return concise, human-sounding LinkedIn outreach copy only.";

  function isLinkedInProfileUrl(url) {
    return /^https:\/\/www\.linkedin\.com\/(in|pub)\//i.test(url || "");
  }

  function hasProfileIdentity(profile) {
    return Boolean(profile && (profile.name || profile.headline));
  }

  function cleanMessageText(value) {
    return String(value || "")
      .replace(/^\s*["'`]+|["'`]+\s*$/g, "")
      .replace(/\r/g, "")
      .trim();
  }

  function clampScore(score) {
    if (!Number.isFinite(score)) {
      return 70;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function getScoreLabel(score) {
    if (score >= 86) {
      return "\uD83D\uDD25 Very natural";
    }

    if (score >= 71) {
      return "\uD83D\uDC4D Good";
    }

    if (score >= 51) {
      return "\uD83D\uDE10 Okay";
    }

    return "\uD83E\uDD16 Feels AI";
  }

  function getActiveTab() {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve((tabs && tabs[0]) || null);
      });
    });
  }

  function executeContentScript(tabId) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript(
        {
          target: { tabId },
          files: ["content.js"],
        },
        () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          resolve();
        },
      );
    });
  }

  async function requestProfileData(tabId) {
    await executeContentScript(tabId);

    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabId,
        { type: "HOOKLY_GET_PROFILE" },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(
              new Error(
                "Open a LinkedIn profile and refresh the page, then try again.",
              ),
            );
            return;
          }

          resolve(
            response || { success: false, error: "No profile data returned." },
          );
        },
      );
    });
  }

  function copyToClipboard(text) {
    return navigator.clipboard.writeText(text);
  }

  function createGenerationPrompt(profile, tone) {
    const experienceHighlights =
      Array.isArray(profile.experienceHighlights) && profile.experienceHighlights.length > 0
        ? profile.experienceHighlights.map((item, index) => `${index + 1}. ${item}`).join("\n")
        : "None";

    const recentActivity = Array.isArray(profile.recentActivity) && profile.recentActivity.length > 0
      ? profile.recentActivity.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "None";

    return `You are an expert in cold outreach.
Write 3 short cold messages that sound like they were written by a real person.

Context:
Name: ${profile.name || "Unknown"}
Headline: ${profile.headline || "Unknown"}
Company: ${profile.company || "Unknown"}
School: ${profile.school || "Unknown"}
Location: ${profile.location || "Unknown"}
About: ${profile.about || "Unknown"}
Experience highlights:
${experienceHighlights}
Recent activity:
${recentActivity}
Tone: ${tone}

Rules:
- each message must be short
- 1-2 lines max
- do not sound like AI
- do not sound spammy
- avoid generic phrases like "I would love to connect" or "Let's discuss collaboration"
- make each option meaningfully different
- each option must use at least one concrete hook from the profile context above
- prefer hooks from current company, experience, about, or recent activity when available
- if there is recent activity, at least 2 of the 3 messages must reference it directly
- mention a specific role, company, topic, post theme, or background detail instead of vague compliments
- never write generic lines like "your profile stands out" or "your background in tech caught my eye"
- make the message feel natural and reply-worthy

Return the result as a JSON array of 3 strings.`;
  }

  function createHumanScorePrompt(message) {
    return `Rate this cold message from 0 to 100 based on how human it sounds.

Criteria:
- natural
- not templated
- not spammy
- short and believable

Message:
"${message}"

Return only a number.`;
  }

  function extractTextFromProviderResponse(data) {
    const choice =
      data && Array.isArray(data.choices) && data.choices.length > 0
        ? data.choices[0]
        : null;

    if (!choice) {
      return null;
    }

    if (typeof choice.text === "string" && choice.text.trim()) {
      return choice.text.trim();
    }

    const message = choice.message;

    if (!message) {
      return null;
    }

    if (typeof message.content === "string" && message.content.trim()) {
      return message.content.trim();
    }

    if (Array.isArray(message.content)) {
      const text = message.content
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }

          if (part && typeof part.text === "string") {
            return part.text;
          }

          if (part && typeof part.content === "string") {
            return part.content;
          }

          return "";
        })
        .join("")
        .trim();

      if (text) {
        return text;
      }
    }

    return null;
  }

  async function fetchChatCompletion(systemPrompt, userPrompt, options) {
    if (!API_CONFIG.apiKey) {
      throw new Error(
        "Set GROQ_API_KEY in .env, run npm run sync-env, then reload the extension.",
      );
    }

    const response = await fetch(API_CONFIG.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_CONFIG.apiKey}`,
      },
      body: JSON.stringify({
        model: API_CONFIG.model,
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      let details = "";

      try {
        details = await response.text();
      } catch (error) {
        details = "";
      }

      throw new Error(
        `Groq API failed (${response.status}). ${details || "Check your API key, model, or endpoint."}`,
      );
    }

    const data = await response.json();
    const content = extractTextFromProviderResponse(data);

    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Groq returned an empty response.");
    }

    return content.trim();
  }

  function tryParseJsonArray(rawText) {
    try {
      const parsed = JSON.parse(rawText);

      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  function parseMessagesResponse(rawText) {
    // Prefer the requested JSON array format, then recover from common wrapped outputs.
    const directArray = tryParseJsonArray(rawText);
    const jsonCandidate =
      rawText.indexOf("[") !== -1 && rawText.lastIndexOf("]") !== -1
        ? rawText.slice(rawText.indexOf("["), rawText.lastIndexOf("]") + 1)
        : null;
    const wrappedArray = jsonCandidate
      ? tryParseJsonArray(jsonCandidate)
      : null;
    const parsedArray = directArray || wrappedArray;

    if (parsedArray) {
      const cleaned = parsedArray.map(cleanMessageText).filter(Boolean);

      return cleaned.slice(0, 3);
    }

    const quotedMatches = Array.from(rawText.matchAll(/"([^"]{8,})"/g))
      .map((match) => cleanMessageText(match[1]))
      .filter(Boolean);

    if (quotedMatches.length >= 3) {
      return quotedMatches.slice(0, 3);
    }

    const blocks = rawText
      .replace(/\r/g, "")
      .split(/\n\s*\n/)
      .map((block) =>
        cleanMessageText(block.replace(/^\s*(?:\d+[\).:-]?|[-*])\s*/gm, "")),
      )
      .filter(Boolean);

    if (blocks.length >= 3) {
      return blocks.slice(0, 3);
    }

    const lines = rawText
      .replace(/\r/g, "")
      .split("\n")
      .map((line) =>
        cleanMessageText(line.replace(/^\s*(?:\d+[\).:-]?|[-*])\s*/, "")),
      )
      .filter((line) => line && line.length > 14);

    return lines.slice(0, 3);
  }

  async function generateMessages(profile, tone) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const rawText = await fetchChatCompletion(
        GENERATION_SYSTEM_PROMPT,
        createGenerationPrompt(profile, tone),
        {
          temperature: API_CONFIG.generationTemperature,
          maxTokens: API_CONFIG.generationMaxTokens,
        },
      );

      const messages = parseMessagesResponse(rawText)
        .map(cleanMessageText)
        .filter(Boolean);

      if (messages.length === 3) {
        return messages;
      }
    }

    throw new Error(
      "Groq did not return 3 usable messages. Try again.",
    );
  }

  function parseHumanScore(rawText) {
    const numericMatch = String(rawText || "").match(/\d{1,3}/);

    if (!numericMatch) {
      return 70;
    }

    return clampScore(Number(numericMatch[0]));
  }

  async function getHumanScore(message) {
    try {
      const rawScore = await fetchChatCompletion(
        "You rate cold outreach based on how human and believable it sounds.",
        createHumanScorePrompt(message),
        {
          temperature: API_CONFIG.scoreTemperature,
          maxTokens: API_CONFIG.scoreMaxTokens,
        },
      );

      return parseHumanScore(rawScore);
    } catch (error) {
      // Scoring should degrade gracefully instead of blocking the generated messages.
      return 70;
    }
  }

  window.HooklyUtils = {
    API_CONFIG,
    clampScore,
    copyToClipboard,
    generateMessages,
    getActiveTab,
    getHumanScore,
    getScoreLabel,
    hasProfileIdentity,
    isLinkedInProfileUrl,
    requestProfileData,
  };
})();
