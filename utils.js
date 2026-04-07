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
    "You write sharp LinkedIn cold outreach. Return only valid JSON: an array of 3 strings. No numbering. No commentary.";

  function isLinkedInProfileUrl(url) {
    return /^https:\/\/www\.linkedin\.com\/(in|pub)\//i.test(url || "");
  }

  function hasProfileIdentity(profile) {
    return Boolean(profile && (profile.name || profile.headline));
  }

  function cleanMessageText(value) {
    return String(value || "")
      .replace(/^\s*(?:\d+[\).:-]?|[-*])\s*/g, "")
      .replace(/^\s*["'`]+|["'`]+\s*$/g, "")
      .replace(/\r/g, "")
      .trim();
  }

  function cleanInlineText(value) {
    return cleanMessageText(value)
      .replace(/\s+/g, " ")
      .replace(/\n+/g, " ")
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
    const company = profile.company || "Unknown";
    const school = profile.school || "Unknown";
    const location = profile.location || "Unknown";
    const about = profile.about || "None";

    const latestWorkplace = profile.latestWorkplace
      ? [
          profile.latestWorkplace.role || "Unknown role",
          profile.latestWorkplace.company || "Unknown company",
          profile.latestWorkplace.summary || ""
        ]
          .filter(Boolean)
          .join(" | ")
      : "None";

    const experienceHighlights =
      Array.isArray(profile.experienceHighlights) && profile.experienceHighlights.length > 0
        ? profile.experienceHighlights.map((item, index) => `${index + 1}. ${item}`).join("\n")
        : "None";

    const featuredHighlights =
      Array.isArray(profile.featuredHighlights) && profile.featuredHighlights.length > 0
        ? profile.featuredHighlights.map((item, index) => `${index + 1}. ${item}`).join("\n")
        : "None";

    const interestsHighlights =
      Array.isArray(profile.interestsHighlights) && profile.interestsHighlights.length > 0
        ? profile.interestsHighlights.map((item, index) => `${index + 1}. ${item}`).join("\n")
        : "None";

    const recommendationsHighlights =
      Array.isArray(profile.recommendationsHighlights) && profile.recommendationsHighlights.length > 0
        ? profile.recommendationsHighlights.map((item, index) => `${index + 1}. ${item}`).join("\n")
        : "None";

    const recentActivity = Array.isArray(profile.recentActivity) && profile.recentActivity.length > 0
      ? profile.recentActivity.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "None";

    const sharedActivity = Array.isArray(profile.sharedActivity) && profile.sharedActivity.length > 0
      ? profile.sharedActivity.map((item, index) => `${index + 1}. ${item}`).join("\n")
      : "None";

    return `You are an expert at writing short cold outreach messages that get replies.

Your task is to write 3 distinct LinkedIn outreach messages.

Context:
Name: ${profile.name || "Unknown"}
Headline: ${profile.headline || "Unknown"}
Tone: ${tone}
Location: ${location}
Current company: ${company}
Education: ${school}
About: ${about}
Latest workplace: ${latestWorkplace}
Experience highlights:
${experienceHighlights}
Featured highlights:
${featuredHighlights}
Interests:
${interestsHighlights}
Recommendations:
${recommendationsHighlights}
Recent authored activity:
${recentActivity}
Shared or reposted activity:
${sharedActivity}

Goal:
Write messages that feel human, sharp, specific, and hard to ignore.

Core rules:
- write exactly 3 options
- each option must be exactly 1 short sentence
- each option must be no more than 25 words
- each option must use a different angle
- every option must include a hook:
  - observation, opinion, contrast, or specific curiosity
- at least 1 of the 3 options must use contrast or rarity
  - for example: "most people don't...", "very few...", "rarely...", "unlike others..."
- the message should create a reason to reply
- sound like a smart human, not a template
- do NOT ask questions
- the message should contain an opinion or observation and be interesting on its own
- each message must contain a concrete thought or observation
- if the message could apply to almost anyone, it is weak
- do NOT use placeholders like [industry] or [topic]
- if there is not enough data for a specific angle, rephrase the message instead of using placeholders or vague abstractions
- use the profile context above to anchor the message in something real and specific
- prefer the strongest available specifics: current role, company, recent work, featured content, recommendations, interests, location, or authored activity
- if using sharedActivity, describe it as something they shared or reposted, not something they wrote
- never mention a field label literally (for example: "Location", "Company", "Headline", "About")
- never use corrupted, partial, or obviously broken text fragments from scraped data
- remove intros, explanations, and extra detail
- keep only the core idea and the hook
- make the message sound like a comment, not the start of a conversation
- do NOT offer help
- do NOT sell anything
- delete the last clause if it does not make the message stronger
- make the person stand out relative to others when the profile supports it
- each message should read like a punchline
- remove any word that does not make the message stronger
- if the sentence can be shortened, shorten it
- mentally compress the sentence by roughly 30% after drafting it
- make the message dense and confident
- do not end softly
- do not explain the point; show it
- remove intro words, explanations, and softening words
- do not end with a question
- if a draft ends with a question, rewrite it as a statement
- end like a conclusion, not an invitation
- if the profile context includes numbers, durations, counts, or concrete facts, prefer using them

Do NOT:
- use polite networking filler
- use empty praise
- ask broad generic questions
- sound corporate
- sound like AI
- sound like small talk

Avoid phrases like:
- "I'd love to discuss"
- "Would love to hear your thoughts"
- "Would you be open to"
- "I came across your profile"
- "Your background caught my attention"
- "I would value your feedback"
- "What are your thoughts on"
- "Did you know"
- "Let's connect"
- "collaboration"
- "something interesting"
- "fascinating"
- "recently came across"
- "your profile suggests"
- "I'd love"
- "interesting"
- "impressive"
- "likely"
- "seems"

Tone instructions:
Friendly:
- warm
- casual
- light
- natural

Professional:
- clear
- polished
- concise
- confident

Direct:
- shortest
- sharpest
- start with the hook
- no soft opener unless necessary

Return ONLY valid JSON in this exact format:
[
  "message option 1",
  "message option 2",
  "message option 3"
]`;
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

  function createSharpenPrompt(message, tone) {
    return `You are improving a LinkedIn outreach opener.

Rewrite this message to make it sharper.

Rules:
- shorter
- more confident
- remove filler
- remove soft wording
- keep it human
- keep the same core idea
- do not sound spammy
- do not add a question unless absolutely necessary

Tone: ${tone}

Message:
"${message}"

Return only the rewritten message.`;
  }

  function createShortVersionPrompt(message, tone) {
    return `Create an ultra-short LinkedIn opener version of this message.

Rules:
- one sentence only
- maximum 16 words
- keep the hook
- sound human
- concise and confident

Tone: ${tone}

Message:
"${message}"

Return only the short version.`;
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

  function getBestMessage(messagesWithScores) {
    if (!Array.isArray(messagesWithScores) || messagesWithScores.length === 0) {
      return null;
    }

    let bestIndex = 0;

    for (let index = 1; index < messagesWithScores.length; index += 1) {
      if ((messagesWithScores[index].score || 0) > (messagesWithScores[bestIndex].score || 0)) {
        bestIndex = index;
      }
    }

    return {
      index: bestIndex,
      message: messagesWithScores[bestIndex]
    };
  }

  function collectProfileSignals(profile) {
    const values = [
      profile && profile.headline,
      profile && profile.company,
      profile && profile.school,
      profile && profile.location,
      profile && profile.about,
      profile && profile.latestWorkplace && profile.latestWorkplace.role,
      profile && profile.latestWorkplace && profile.latestWorkplace.company
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .match(/[a-zа-яё0-9.+#/-]{4,}/gi);

    return Array.from(new Set(values || [])).slice(0, 40);
  }

  function getWhyItWorks(message, profile) {
    const text = cleanInlineText(message);
    const normalized = text.toLowerCase();
    const bullets = [];
    const profileSignals = collectProfileSignals(profile);

    if (/\b(most|few|rare|rarely|unlike)\b/i.test(text)) {
      bullets.push("uses contrast");
    }

    if (profileSignals.some((signal) => normalized.includes(signal.toLowerCase()))) {
      bullets.push("specific to profile");
    }

    if (/\d/.test(text)) {
      bullets.push("grounds itself in a concrete fact");
    }

    if (text.split(/\s+/).filter(Boolean).length <= 12) {
      bullets.push("easy to read fast");
    }

    if (bullets.length < 3 && !/\b(would|could|maybe|perhaps|interesting|impressive)\b/i.test(text)) {
      bullets.push("sounds natural");
    }

    if (bullets.length < 3) {
      bullets.push("lands with a clear point");
    }

    return bullets.slice(0, 3);
  }

  async function makeMessageSharper(message, tone) {
    const rewritten = await fetchChatCompletion(
      "You rewrite outreach into tighter, more confident lines. Return only the rewritten message.",
      createSharpenPrompt(message, tone),
      {
        temperature: 0.7,
        maxTokens: 80,
      },
    );

    return cleanInlineText(rewritten);
  }

  async function generateShortVersion(message, tone) {
    const shortVersion = await fetchChatCompletion(
      "You compress outreach to one sharp sentence. Return only the short version.",
      createShortVersionPrompt(message, tone),
      {
        temperature: 0.6,
        maxTokens: 50,
      },
    );

    return cleanInlineText(shortVersion);
  }

  window.HooklyUtils = {
    API_CONFIG,
    clampScore,
    copyToClipboard,
    generateMessages,
    generateShortVersion,
    getActiveTab,
    getBestMessage,
    getHumanScore,
    getScoreLabel,
    getWhyItWorks,
    hasProfileIdentity,
    isLinkedInProfileUrl,
    makeMessageSharper,
    requestProfileData,
  };
})();
