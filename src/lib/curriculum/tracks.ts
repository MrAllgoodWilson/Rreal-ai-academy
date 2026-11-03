import type { Track } from "./types";

/**
 * Rreal AI Academy curriculum: 5 tracks across 8 weeks.
 * Track -> Week -> Module -> Lesson -> Blocks (text, quiz, prompt lab, reflection)
 *
 * Content is authored here as typed data so it ships with the app, works offline,
 * and can be seeded into Supabase (see supabase/seed.sql generator in scripts/).
 */
export const TRACKS: Track[] = [
  // ───────────────────────────── TRACK 1 ─────────────────────────────
  {
    id: "foundations",
    level: 1,
    stage: "Absolute Beginner",
    name: "AI Foundations",
    tagline: "Zero jargon. Zero fear. Your first real wins with AI.",
    outcome: "Explain how AI works in plain English and write prompts that get great answers on the first try.",
    gradient: "from-cyan-400 to-sky-500",
    emoji: "🌱",
    certificateTitle: "Rreal Certified: AI Foundations",
    weeks: [
      {
        number: 1,
        title: "Meet AI",
        modules: [
          {
            id: "what-is-ai",
            title: "What AI Actually Is",
            description: "Kill the hype and the fear. Learn what's really happening when you talk to an AI.",
            lessons: [
              {
                id: "ai-in-plain-english",
                title: "AI in Plain English",
                minutes: 6,
                xp: 50,
                summary: "AI is a pattern machine. Here's what that means for you.",
                blocks: [
                  {
                    type: "text",
                    heading: "The one-sentence version",
                    body: "Modern AI chat tools are prediction machines. They've read a huge amount of text, and when you type something, they predict — one small piece at a time — the most helpful words to come next. They don't 'look things up' the way you do unless they're connected to search, and they don't 'think' like a person. But they are incredibly good at language, which makes them useful for writing, explaining, planning, brainstorming and much more.",
                  },
                  {
                    type: "keypoints",
                    heading: "Words you'll hear a lot",
                    items: [
                      "AI (Artificial Intelligence): software that does tasks we normally associate with human thinking.",
                      "LLM (Large Language Model): the kind of AI behind ChatGPT, Claude and Gemini. It's trained on text.",
                      "Prompt: whatever you type (or say) to the AI.",
                      "Output / response: what the AI gives back.",
                      "Hallucination: when the AI states something false with confidence. Always double-check facts that matter.",
                    ],
                  },
                  {
                    type: "quiz",
                    id: "q-ai-1",
                    question: "What is a Large Language Model mostly doing when it answers you?",
                    options: [
                      "Searching Google and copying the top result",
                      "Predicting the most likely helpful next words, piece by piece",
                      "Asking a human worker behind the scenes",
                      "Reading your mind",
                    ],
                    answer: 1,
                    explanation: "LLMs generate text by predicting what comes next, based on patterns learned during training.",
                  },
                  {
                    type: "quiz",
                    id: "q-ai-2",
                    question: "An AI tells you a confident statistic you've never heard of. What's the smart move?",
                    options: ["Trust it — AI doesn't make mistakes", "Verify it with a reliable source before you use it", "Ask it to repeat itself louder", "Delete the app"],
                    answer: 1,
                    explanation: "That's a possible hallucination. Treat AI like a brilliant intern: fast and helpful, but you check important work.",
                  },
                ],
              },
              {
                id: "what-ai-can-and-cant-do",
                title: "Superpowers & Blind Spots",
                minutes: 7,
                xp: 50,
                summary: "Know when to reach for AI — and when not to.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "AI is great at",
                    items: [
                      "First drafts: emails, posts, outlines, scripts",
                      "Explaining hard topics at your level ('explain like I'm 12')",
                      "Brainstorming 20 ideas in 10 seconds",
                      "Summarising long documents",
                      "Rewriting in a different tone or language",
                    ],
                  },
                  {
                    type: "keypoints",
                    heading: "AI struggles with",
                    items: [
                      "Facts after its training date (unless it has web search)",
                      "Exact math on big numbers (unless it uses a calculator tool)",
                      "Knowing things about you that you haven't told it",
                      "Making decisions that need human judgement, ethics or accountability",
                    ],
                  },
                  {
                    type: "tip",
                    body: "Rreal Rule #1: AI is your co-pilot, not your autopilot. You stay the pilot.",
                  },
                  {
                    type: "quiz",
                    id: "q-ai-3",
                    question: "Which task is the BEST fit for an AI assistant?",
                    options: [
                      "Deciding whether to fire an employee",
                      "Drafting three versions of a birthday invitation",
                      "Telling you today's exact stock price without any tools",
                      "Signing a legal contract for you",
                    ],
                    answer: 1,
                    explanation: "Creative drafting is a sweet spot. Big decisions and live data need a human or the right tools.",
                  },
                  { type: "reflect", prompt: "Name one task in your life or job that eats your time every week. Could AI draft the first version?" },
                ],
              },
            ],
          },
          {
            id: "first-chats",
            title: "Your First Conversations",
            description: "Hands-on: talk to AI, steer it, and fix bad answers.",
            lessons: [
              {
                id: "first-prompt",
                title: "Your First Great Prompt",
                minutes: 8,
                xp: 75,
                summary: "The difference between a vague prompt and a great one.",
                blocks: [
                  {
                    type: "example",
                    label: "Same request, two prompts",
                    bad: "write about dogs",
                    good: "You are a friendly pet-care writer. Write a 120-word Instagram caption for a new dog-walking business in Austin. Upbeat tone, 2 emojis max, end with a question to drive comments.",
                  },
                  {
                    type: "text",
                    heading: "Why the second one wins",
                    body: "It gives the AI a role, a clear task, who it's for, the format and length, and the vibe. AI can't read your mind — every detail you add removes a guess.",
                  },
                  {
                    type: "prompt-lab",
                    goal: "Write a prompt asking AI to help you plan a healthy weekly grocery list. Include a role, your situation, the format you want and at least one constraint (like budget).",
                    starter: "help me with groceries",
                    minScore: 55,
                  },
                ],
              },
              {
                id: "iterate-and-fix",
                title: "Steering & Fixing Bad Answers",
                minutes: 7,
                xp: 75,
                summary: "Great results come from conversation, not one-shot luck.",
                blocks: [
                  {
                    type: "text",
                    heading: "Talk back to it",
                    body: "If an answer is too long, too formal, or off-target, don't start over — tell it what to change. 'Shorter.' 'More casual.' 'Use bullet points.' 'You missed that I'm vegetarian.' The AI keeps the conversation in mind, so feedback compounds.",
                  },
                  {
                    type: "keypoints",
                    heading: "Power follow-ups",
                    items: [
                      "\"Give me 5 more options, all different from these.\"",
                      "\"What questions should I answer so you can do this better?\"",
                      "\"Rewrite for a 5th-grade reading level.\"",
                      "\"Point out any weak spots in what you just wrote.\"",
                    ],
                  },
                  {
                    type: "quiz",
                    id: "q-iter-1",
                    question: "The AI wrote a stiff, formal email. You wanted friendly. What's fastest?",
                    options: ["Close the chat and start a brand new one", "Reply: 'Make it warmer and more casual, keep it under 100 words.'", "Give up on AI for email", "Copy it and fix every word by hand"],
                    answer: 1,
                    explanation: "Follow-up instructions are the fastest way to steer. The AI remembers the context.",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        number: 2,
        title: "Prompting Like a Pro",
        modules: [
          {
            id: "prompting-foundations",
            title: "The Rreal Prompt Framework",
            description: "R.E.A.L. — Role, Expectation, Audience, Layout. Plus zero-shot, few-shot and role prompting.",
            lessons: [
              {
                id: "real-framework",
                title: "The R.E.A.L. Framework",
                minutes: 9,
                xp: 100,
                summary: "A memorable 4-part formula that works on every AI tool.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "R.E.A.L.",
                    items: [
                      "R — Role: who should the AI be? ('You are a senior recruiter…')",
                      "E — Expectation: the exact task and what success looks like.",
                      "A — Audience & context: who it's for, what they know, your situation.",
                      "L — Layout: the format — bullets, table, 3 options, word limit, tone.",
                    ],
                  },
                  {
                    type: "example",
                    label: "R.E.A.L. in action",
                    good: "Role: You are a career coach for people switching into tech.\nExpectation: Rewrite my resume summary so it gets interviews for junior data analyst roles.\nAudience: Hiring managers who skim for 6 seconds. I have 8 years in retail management.\nLayout: 3 versions, each under 60 words, no buzzwords.",
                  },
                  {
                    type: "prompt-lab",
                    goal: "Use R.E.A.L. to ask for a 7-day social media content plan for a small local bakery.",
                    minScore: 70,
                  },
                ],
              },
              {
                id: "zero-few-shot",
                title: "Zero-Shot, Few-Shot & Role Prompting",
                minutes: 9,
                xp: 100,
                summary: "Show, don't just tell — examples are the cheat code.",
                blocks: [
                  {
                    type: "text",
                    heading: "Zero-shot vs few-shot",
                    body: "Zero-shot means you just ask. Few-shot means you show 2–3 examples of exactly what you want first. Few-shot is magic for matching a style, a format, or a brand voice — the AI copies the pattern.",
                  },
                  {
                    type: "example",
                    label: "Few-shot product taglines",
                    good: "Write a tagline in the same style as these:\n• Coffee shop: \"Wake up. Show up.\"\n• Gym: \"Sweat now. Shine later.\"\n• Bookstore: ",
                  },
                  {
                    type: "quiz",
                    id: "q-fs-1",
                    question: "You want 20 product descriptions that all sound like your brand. Best technique?",
                    options: ["Zero-shot: 'write product descriptions'", "Few-shot: paste 2–3 of your best existing descriptions as examples", "Ask the AI to guess your brand", "Use all caps"],
                    answer: 1,
                    explanation: "Examples lock in voice and format far better than adjectives like 'on-brand'.",
                  },
                  {
                    type: "prompt-lab",
                    goal: "Write a few-shot prompt: give 2 example motivational one-liners in your style, then ask for 10 more.",
                    minScore: 65,
                  },
                ],
              },
              {
                id: "chain-of-thought",
                title: "Make It Think Step by Step",
                minutes: 8,
                xp: 100,
                summary: "Better reasoning with structure, checklists and self-review.",
                blocks: [
                  {
                    type: "text",
                    heading: "Ask for the steps",
                    body: "For anything with logic — budgets, plans, comparisons — ask the AI to work through it step by step, or to list its assumptions first. Then ask it to check its own answer. This reduces mistakes dramatically.",
                  },
                  {
                    type: "example",
                    label: "Self-check pattern",
                    good: "Compare these two phone plans for a family of 4. First list your assumptions, then compare step by step in a table, then give a recommendation. Finally, double-check your math and flag anything you're unsure about.",
                  },
                  {
                    type: "quiz",
                    id: "q-cot-1",
                    question: "Why ask an AI to 'list its assumptions first'?",
                    options: ["It makes the answer longer, which is always better", "You can spot wrong assumptions before they spoil the result", "It's required by law", "It turns off hallucinations completely"],
                    answer: 1,
                    explanation: "Visible assumptions let you correct the AI early. It reduces — but never fully eliminates — errors.",
                  },
                ],
              },
            ],
          },
          {
            id: "email-assistant-project",
            title: "Project: Your AI Email Assistant",
            description: "Build a reusable prompt that writes and replies to emails in your voice.",
            lessons: [
              {
                id: "build-email-assistant",
                title: "Build Your Email Assistant",
                minutes: 15,
                xp: 200,
                summary: "Your first portfolio piece: a reusable, voice-matched email prompt.",
                blocks: [
                  {
                    type: "text",
                    heading: "The mission",
                    body: "You'll craft a 'system prompt' — a reusable instruction set you paste at the start of any chat so the AI becomes your personal email assistant. Include: who you are, how you write (paste 2 real examples), rules (never invent facts, keep under 150 words, always end with a clear next step), and the format.",
                  },
                  {
                    type: "prompt-lab",
                    goal: "Write a reusable email-assistant prompt. Include a role, your voice examples, rules/constraints, and the output format. It will be saved to your Portfolio.",
                    minScore: 75,
                  },
                  { type: "reflect", prompt: "Which 3 emails will you test your new assistant on this week?" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────────── TRACK 2 ─────────────────────────────
  {
    id: "creator",
    level: 2,
    stage: "Beginner Creator",
    name: "Creative AI Studio",
    tagline: "Images, voices, music and scripts — create like a studio of ten.",
    outcome: "Produce on-brand images, narration and scroll-stopping scripts with AI — responsibly.",
    gradient: "from-violet-400 to-fuchsia-500",
    emoji: "🎨",
    certificateTitle: "Rreal Certified: Creative AI Producer",
    weeks: [
      {
        number: 3,
        title: "Images & Voice",
        modules: [
          {
            id: "ai-images",
            title: "Text-to-Image Mastery",
            description: "Subject, style, lighting, camera, composition — the visual prompt stack.",
            lessons: [
              {
                id: "image-prompt-stack",
                title: "The Visual Prompt Stack",
                minutes: 10,
                xp: 100,
                summary: "Describe images like a photographer and art director.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "Build image prompts in layers",
                    items: [
                      "Subject: who/what, doing what ('a barista pouring latte art')",
                      "Setting: where and when ('cozy corner café, morning')",
                      "Style: photo, 3D render, watercolor, anime, flat vector…",
                      "Lighting: golden hour, soft window light, neon, studio",
                      "Camera/composition: close-up, wide shot, 35mm, top-down, rule of thirds",
                      "Format: aspect ratio — 9:16 for Reels/TikTok, 1:1 for feed, 16:9 for YouTube",
                    ],
                  },
                  {
                    type: "example",
                    label: "Layered image prompt",
                    bad: "coffee picture",
                    good: "Close-up photo of a barista's hands pouring heart-shaped latte art, cozy café, warm golden morning window light, shallow depth of field, 35mm, vertical 9:16, natural colors",
                  },
                  {
                    type: "prompt-lab",
                    goal: "Write a layered image prompt for a thumbnail promoting a fitness coaching app. Include subject, setting, style, lighting, composition and aspect ratio.",
                    minScore: 60,
                  },
                ],
              },
              {
                id: "brand-visual-system",
                title: "Consistent Brand Visuals",
                minutes: 9,
                xp: 100,
                summary: "Keep characters, colors and style consistent across 50 images.",
                blocks: [
                  {
                    type: "text",
                    heading: "Consistency is the pro move",
                    body: "Random beautiful images don't build a brand. Create a 'style card': 3–5 fixed phrases (palette, style, lighting, mood) you paste into every prompt. Many tools also support reference images or saved characters — use them so your mascot or product looks the same every time.",
                  },
                  {
                    type: "quiz",
                    id: "q-brand-1",
                    question: "What's a 'style card' for AI images?",
                    options: ["A paid subscription tier", "A reusable set of style phrases you add to every prompt for consistency", "A type of credit card", "A filter that removes watermarks"],
                    answer: 1,
                    explanation: "Reusing exact style phrases (and reference images) keeps visuals on-brand.",
                  },
                ],
              },
            ],
          },
          {
            id: "voice-audio",
            title: "AI Voice, Narration & Music",
            description: "Text-to-speech, voice design, music beds — and consent.",
            lessons: [
              {
                id: "narration-that-sounds-human",
                title: "Narration That Sounds Human",
                minutes: 9,
                xp: 100,
                summary: "Write for the ear: pacing, pauses and emphasis.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "Scripts for AI voices",
                    items: [
                      "Short sentences. One idea each.",
                      "Use punctuation to control pace: commas = short pause, periods = longer, '…' = dramatic beat.",
                      "Spell tricky words phonetically if the voice mispronounces them.",
                      "Pick a voice that matches the audience: energetic for hooks, calm for tutorials.",
                    ],
                  },
                  {
                    type: "prompt-lab",
                    goal: "Ask AI to rewrite a paragraph of your choice into a 30-second voiceover script optimised for text-to-speech (short sentences, pauses, emphasis).",
                    minScore: 60,
                  },
                ],
              },
              {
                id: "voice-cloning-consent",
                title: "Voice Cloning & Consent",
                minutes: 7,
                xp: 100,
                summary: "Powerful, and it comes with rules.",
                blocks: [
                  {
                    type: "text",
                    heading: "Only clone voices you have rights to",
                    body: "Voice cloning lets you narrate in your own voice without recording every line. Only clone your own voice or voices you have written permission to use. Cloning someone else without consent can break laws and platform rules, and it destroys trust.",
                  },
                  {
                    type: "quiz",
                    id: "q-voice-1",
                    question: "Which voice can you ethically clone for your channel?",
                    options: ["A famous celebrity's, because they're public", "Your own, or one you have written permission to use", "Your friend's, without asking — it's a surprise", "Any voice from a YouTube video"],
                    answer: 1,
                    explanation: "Consent is the rule. Public figures still own their likeness and voice.",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        number: 4,
        title: "Scripts, Hooks & Responsibility",
        modules: [
          {
            id: "scripts-hooks",
            title: "Viral Hook Engineering",
            description: "The first 2 seconds decide everything.",
            lessons: [
              {
                id: "hook-formulas",
                title: "7 Hook Formulas",
                minutes: 10,
                xp: 125,
                summary: "Proven openers you can generate on demand.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "Hook formulas",
                    items: [
                      "Contrarian: \"Stop doing X. Do this instead.\"",
                      "Curiosity gap: \"Nobody talks about this AI setting…\"",
                      "Result first: \"I made 30 videos in 10 minutes. Here's how.\"",
                      "Mistake: \"You're using ChatGPT wrong if…\"",
                      "List: \"3 free AI tools that feel illegal to know\"",
                      "Story: \"Last week a client asked me something wild…\"",
                      "Direct callout: \"If you run a small business, watch this.\"",
                    ],
                  },
                  {
                    type: "prompt-lab",
                    goal: "Ask AI for 10 hooks for a 30-second video about your niche. Specify the audience, platform, 3 formulas to use, and a max of 12 words per hook.",
                    minScore: 70,
                  },
                ],
              },
              {
                id: "script-structure",
                title: "Hook → Value → CTA Scripts",
                minutes: 10,
                xp: 125,
                summary: "Structure 15–60 second scripts that keep people watching.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "Short-form script skeleton",
                    items: [
                      "0–2s HOOK: stop the scroll",
                      "2–20s VALUE: 1–3 punchy steps or one insight",
                      "Pattern interrupts every 3–5s: new visual, zoom, on-screen text",
                      "Last 3s CTA: follow, comment a keyword, or visit link",
                    ],
                  },
                  {
                    type: "quiz",
                    id: "q-script-1",
                    question: "Where should the hook go in a short-form video?",
                    options: ["After the intro music", "In the first 1–2 seconds", "At the very end", "In the caption only"],
                    answer: 1,
                    explanation: "Most viewers decide to stay or scroll almost instantly.",
                  },
                ],
              },
            ],
          },
          {
            id: "ethics-rights",
            title: "AI Ethics, Copyright & Disclosure",
            description: "Create boldly and stay out of trouble.",
            lessons: [
              {
                id: "create-responsibly",
                title: "Create Responsibly",
                minutes: 9,
                xp: 125,
                summary: "Disclosure labels, copyright basics, deepfakes and privacy.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "The responsible creator checklist",
                    items: [
                      "Label realistic AI content — major platforms require or encourage AI disclosure for realistic synthetic media.",
                      "Don't impersonate real people or create misleading deepfakes.",
                      "Check each tool's license for commercial use of what you generate.",
                      "Never paste private customer data or passwords into public AI tools.",
                      "Copyright rules for AI-generated work vary by country and are still evolving — add your own human creativity.",
                    ],
                  },
                  {
                    type: "quiz",
                    id: "q-ethics-1",
                    question: "You made a hyper-realistic AI video of a product demo. Best practice?",
                    options: ["Hide that it's AI so it performs better", "Use the platform's AI-content label / disclose it", "Claim it was filmed on an iPhone", "Post it on someone else's account"],
                    answer: 1,
                    explanation: "Disclosure protects your account and your audience's trust.",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────────── TRACK 3 ─────────────────────────────
  {
    id: "producer",
    level: 3,
    stage: "Intermediate Producer",
    name: "AI Video & Social Automation",
    tagline: "Script, render, caption and schedule a month of content in an afternoon.",
    outcome: "Run an end-to-end AI short-form video pipeline from idea to scheduled post.",
    gradient: "from-orange-400 to-rose-500",
    emoji: "🎬",
    certificateTitle: "Rreal Certified: AI Social Video Producer",
    weeks: [
      {
        number: 5,
        title: "AI Video Production",
        modules: [
          {
            id: "short-video",
            title: "Text-to-Video & Avatars",
            description: "How generative video works and how to direct it.",
            lessons: [
              {
                id: "directing-ai-video",
                title: "Directing AI Video Models",
                minutes: 12,
                xp: 150,
                summary: "Shot lists, motion prompts and stitching 4-second clips into stories.",
                blocks: [
                  {
                    type: "text",
                    heading: "Think in shots, not videos",
                    body: "Text-to-video and image-to-video tools generate short clips (often 4–10 seconds). Pros plan a shot list, generate each shot separately with a consistent style card, then edit them together. Motion prompts describe camera movement ('slow push-in', 'orbit left') and subject action ('steam rising from cup').",
                  },
                  {
                    type: "keypoints",
                    heading: "Motion prompt checklist",
                    items: ["Subject + action", "Camera move: push-in, pan, orbit, handheld, static", "Speed & mood: slow-motion, energetic", "Consistent style card + aspect ratio 9:16"],
                  },
                  {
                    type: "prompt-lab",
                    goal: "Write a 4-shot list for a 20-second vertical video about a coffee brand. Each shot: subject+action, camera move, duration, on-screen text.",
                    minScore: 65,
                  },
                ],
              },
              {
                id: "studio-first-video",
                title: "Studio Lab: Build Your First Video",
                minutes: 15,
                xp: 200,
                summary: "Use the Rreal Studio to go from idea to captioned vertical preview.",
                blocks: [
                  {
                    type: "text",
                    heading: "Open the Studio",
                    body: "Head to Studio (in the menu). Pick a niche and platform, generate hooks, turn your favourite into a scene-by-scene script, and watch the animated vertical preview with burned-in captions. Save it to your Portfolio when you're happy.",
                  },
                  {
                    type: "quiz",
                    id: "q-studio-1",
                    question: "Why generate hooks before the full script?",
                    options: ["Hooks are optional", "The hook decides retention; the rest of the script should serve it", "Scripts can't be generated", "It's cheaper"],
                    answer: 1,
                    explanation: "Lead with the hook, then build value that pays it off.",
                  },
                ],
              },
            ],
          },
          {
            id: "captions",
            title: "Auto-Captions & Accessible Video",
            description: "Captions boost reach and make your content usable for everyone.",
            lessons: [
              {
                id: "captions-that-convert",
                title: "Captions That Convert",
                minutes: 9,
                xp: 125,
                summary: "Many viewers watch on mute. Captions are not optional.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "Caption rules",
                    items: [
                      "Burn in captions for short-form — many people scroll with sound off.",
                      "2–5 words per line, big, high-contrast, inside the safe zone (away from UI buttons).",
                      "Always proofread auto-captions: names and jargon get mangled.",
                      "Add alt text / descriptions where the platform allows — that's accessibility for blind viewers.",
                    ],
                  },
                  {
                    type: "quiz",
                    id: "q-cap-1",
                    question: "Where should burned-in captions sit on a vertical video?",
                    options: ["Bottom edge, under the like button", "In the safe zone, roughly the middle third", "Top-left corner, tiny", "Nowhere — captions are distracting"],
                    answer: 1,
                    explanation: "Platform UI covers the edges; the center safe zone stays readable.",
                  },
                ],
              },
              {
                id: "repurposing",
                title: "One Video, Ten Posts",
                minutes: 9,
                xp: 125,
                summary: "Repurpose a long video into clips, carousels and threads with AI.",
                blocks: [
                  {
                    type: "prompt-lab",
                    goal: "Write a prompt that turns a pasted video transcript into: 5 short clip ideas with timestamps, 1 carousel outline, and 3 captions with hashtags.",
                    minScore: 70,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        number: 6,
        title: "Posting & Automation Pipeline",
        modules: [
          {
            id: "pipeline",
            title: "Scheduling & Automation",
            description: "Content calendars, schedulers and no-code automations.",
            lessons: [
              {
                id: "content-calendar",
                title: "AI Content Calendar",
                minutes: 10,
                xp: 150,
                summary: "Plan 30 days of posts with themes, pillars and batching.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "Content pillars",
                    items: ["Pick 3–4 pillars (Teach, Behind-the-scenes, Proof/Results, Personal)", "Rotate pillars daily", "Batch-create: script 10, record/generate 10, schedule 10", "Export your schedule to your calendar (Studio supports .ics export)"],
                  },
                  {
                    type: "prompt-lab",
                    goal: "Ask AI for a 30-day content calendar as a table: date, pillar, hook, format, platform, CTA. Include your niche and posting frequency.",
                    minScore: 70,
                  },
                ],
              },
              {
                id: "no-code-automation",
                title: "No-Code Automation Basics",
                minutes: 11,
                xp: 150,
                summary: "Triggers, actions and webhooks — automate the boring parts.",
                blocks: [
                  {
                    type: "text",
                    heading: "Trigger → Action",
                    body: "Automation tools (like Zapier, Make or n8n) connect apps: WHEN something happens (trigger: a new row in a spreadsheet) THEN do something (action: generate a caption with AI, then send it to your scheduler). A webhook is just a URL that one app calls to tell another app 'something happened'.",
                  },
                  {
                    type: "quiz",
                    id: "q-auto-1",
                    question: "In 'When a new video lands in Drive, write a caption and schedule it', what's the trigger?",
                    options: ["Write a caption", "Schedule it", "A new video lands in Drive", "The internet"],
                    answer: 2,
                    explanation: "The trigger is the event that starts the automation.",
                  },
                ],
              },
            ],
          },
          {
            id: "analytics",
            title: "Analytics & Iteration",
            description: "Read the numbers, let AI find the patterns.",
            lessons: [
              {
                id: "analytics-loop",
                title: "The Analytics Feedback Loop",
                minutes: 9,
                xp: 150,
                summary: "Retention, watch-time and saves — and how to improve them.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "Metrics that matter",
                    items: ["Hook rate / 3-second hold", "Average watch time & retention curve", "Shares and saves (stronger than likes)", "Follows per view"],
                  },
                  {
                    type: "prompt-lab",
                    goal: "Write a prompt asking AI to analyse a pasted table of your last 10 posts' metrics, find patterns in the top 3, and suggest 5 new hooks based on them.",
                    minScore: 70,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────────── TRACK 4 ─────────────────────────────
  {
    id: "engineer",
    level: 4,
    stage: "Advanced Builder",
    name: "AI Dependencies & Integrations",
    tagline: "APIs, keys, JSON, webhooks, costs and MCP — the plumbing of real AI products.",
    outcome: "Connect AI models to apps safely: call APIs, structure outputs, handle limits and costs.",
    gradient: "from-lime-400 to-emerald-500",
    emoji: "🛠️",
    certificateTitle: "Rreal Certified: AI Integration Specialist",
    weeks: [
      {
        number: 7,
        title: "APIs, Data & Infrastructure",
        modules: [
          {
            id: "apis-keys",
            title: "APIs & Keys",
            description: "What an API call is and how to keep secrets secret.",
            lessons: [
              {
                id: "what-is-an-api",
                title: "What an API Call Really Is",
                minutes: 10,
                xp: 150,
                summary: "Request, response, endpoints, headers — demystified.",
                blocks: [
                  {
                    type: "text",
                    heading: "A restaurant order",
                    body: "An API is a menu for software. Your app (the customer) sends a request to an endpoint (the waiter) with headers (who you are — your API key) and a body (your order — the prompt). The service sends back a response (your meal — usually JSON). Every AI product you use is built from calls like this.",
                  },
                  {
                    type: "example",
                    label: "Shape of an AI API request",
                    good: "POST https://api.anthropic.com/v1/messages\nHeaders: x-api-key: $ANTHROPIC_API_KEY, anthropic-version: 2023-06-01\nBody: { \"model\": \"…\", \"max_tokens\": 500, \"messages\": [{\"role\":\"user\",\"content\":\"Hello\"}] }",
                  },
                  {
                    type: "quiz",
                    id: "q-api-1",
                    question: "In an API request, what usually proves who you are?",
                    options: ["The body", "An API key in a header", "The URL's color", "Your IP address only"],
                    answer: 1,
                    explanation: "Keys go in headers. Treat them like passwords.",
                  },
                ],
              },
              {
                id: "secrets-env",
                title: "Environment Variables & Secret Safety",
                minutes: 9,
                xp: 150,
                summary: "Never ship a key in frontend code or a public repo.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "Secret hygiene",
                    items: [
                      "Store keys in environment variables (.env) — never hard-code them.",
                      "Add .env to .gitignore so it never reaches GitHub.",
                      "Call AI APIs from your server, not the browser — browser code is public.",
                      "Rotate a key immediately if it leaks; set spending limits.",
                    ],
                  },
                  {
                    type: "quiz",
                    id: "q-env-1",
                    question: "You accidentally pushed your API key to a public GitHub repo. First move?",
                    options: ["Delete the commit and hope", "Revoke/rotate the key in the provider dashboard immediately", "Make the repo private and continue", "Email GitHub"],
                    answer: 1,
                    explanation: "Bots scan public repos within minutes. Rotate first, clean history second.",
                  },
                ],
              },
            ],
          },
          {
            id: "json-webhooks",
            title: "JSON, Schemas & Webhooks",
            description: "Make AI output machine-readable and event-driven.",
            lessons: [
              {
                id: "structured-output",
                title: "Structured Output with JSON Schemas",
                minutes: 11,
                xp: 175,
                summary: "Get AI to return data your code can trust.",
                blocks: [
                  {
                    type: "text",
                    heading: "From prose to data",
                    body: "Apps need data, not paragraphs. Ask for JSON, give an exact schema (field names, types, allowed values), and validate the result in code (e.g. with Zod). Many APIs offer native structured-output or tool-use modes that enforce a schema for you.",
                  },
                  {
                    type: "prompt-lab",
                    goal: "Write a prompt that extracts {name, email, company, intent: 'buy'|'support'|'other'} from a pasted customer email and returns ONLY valid JSON matching that schema.",
                    minScore: 70,
                  },
                ],
              },
              {
                id: "webhooks-deep",
                title: "Webhooks & Event-Driven AI",
                minutes: 10,
                xp: 175,
                summary: "Verify signatures, respond fast, process async.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "Webhook best practices",
                    items: ["Verify the signature (e.g. Stripe-Signature) before trusting the payload", "Respond 2xx quickly, do heavy AI work in a background job", "Make handlers idempotent — the same event may arrive twice", "Log event IDs for debugging"],
                  },
                  {
                    type: "quiz",
                    id: "q-wh-1",
                    question: "Why make webhook handlers idempotent?",
                    options: ["Providers may retry and deliver the same event more than once", "It makes them faster", "JSON requires it", "To save disk space"],
                    answer: 0,
                    explanation: "Retries happen. Processing an event twice must not double-charge or double-post.",
                  },
                ],
              },
            ],
          },
          {
            id: "limits-cost-mcp",
            title: "Rate Limits, Costs & MCP",
            description: "Run AI in production without surprises.",
            lessons: [
              {
                id: "tokens-costs-limits",
                title: "Tokens, Costs & Rate Limits",
                minutes: 10,
                xp: 175,
                summary: "Budget tokens, back off on 429s, cache aggressively.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "Production survival kit",
                    items: ["Tokens ≈ word pieces; you pay for input + output tokens", "Set max_tokens and choose the smallest model that does the job", "On HTTP 429 (rate limit), retry with exponential backoff + jitter", "Cache repeated prompts/results; use prompt caching where offered"],
                  },
                  {
                    type: "quiz",
                    id: "q-rl-1",
                    question: "Your app gets HTTP 429 from an AI API. Best response?",
                    options: ["Retry instantly in a tight loop", "Retry with exponential backoff and jitter", "Switch to a random API key", "Show the user a stack trace"],
                    answer: 1,
                    explanation: "Backoff spreads load and respects the provider's limits.",
                  },
                ],
              },
              {
                id: "mcp-intro",
                title: "Model Context Protocol (MCP)",
                minutes: 10,
                xp: 175,
                summary: "The USB-C port for connecting AI to tools and data.",
                blocks: [
                  {
                    type: "text",
                    heading: "One standard, many tools",
                    body: "MCP is an open protocol that lets AI apps connect to tools and data sources (files, databases, calendars, CRMs) through 'MCP servers'. Instead of custom code for every integration, a model can discover and call tools that any MCP server exposes — with the user's permission.",
                  },
                  {
                    type: "quiz",
                    id: "q-mcp-1",
                    question: "What does an MCP server provide to an AI app?",
                    options: ["Electricity", "Tools and data the model can use through a standard protocol", "A new LLM", "Video rendering only"],
                    answer: 1,
                    explanation: "MCP standardises how AI apps reach tools and context.",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },

  // ───────────────────────────── TRACK 5 ─────────────────────────────
  {
    id: "architect",
    level: 5,
    stage: "Elite Architect",
    name: "Autonomous Agents & Capstone",
    tagline: "Design agents that plan, use tools and work together — then prove it.",
    outcome: "Architect safe multi-agent systems and earn the Rreal Certified AI Professional credential.",
    gradient: "from-amber-300 to-orange-500",
    emoji: "🏆",
    certificateTitle: "Rreal Certified: AI Agent Architect",
    weeks: [
      {
        number: 8,
        title: "Agents & Certification",
        modules: [
          {
            id: "tools-agents",
            title: "Tool Calling & Single Agents",
            description: "The loop that turns a chatbot into an agent.",
            lessons: [
              {
                id: "agent-loop",
                title: "The Agent Loop",
                minutes: 12,
                xp: 200,
                summary: "Think → act (call a tool) → observe → repeat.",
                blocks: [
                  {
                    type: "text",
                    heading: "From answering to doing",
                    body: "Tool calling lets a model request actions: 'search_web', 'send_email', 'query_database'. Your code runs the tool and returns the result; the model decides the next step. Loop until the goal is met. That loop — with good tools, clear instructions and stop conditions — is an agent.",
                  },
                  {
                    type: "keypoints",
                    heading: "Agent design checklist",
                    items: ["Clear goal + definition of done", "Small, well-described tools with strict input schemas", "Guardrails: permissions, spending caps, human approval for risky actions", "Max-iteration limit and logging of every step"],
                  },
                  {
                    type: "prompt-lab",
                    goal: "Write a system prompt for a customer-support agent with 3 tools (lookup_order, issue_refund, escalate_to_human). Define when to use each, refund limits, and when a human must approve.",
                    minScore: 75,
                  },
                ],
              },
              {
                id: "agent-safety",
                title: "Guardrails & Human-in-the-Loop",
                minutes: 10,
                xp: 200,
                summary: "Autonomy with accountability.",
                blocks: [
                  {
                    type: "quiz",
                    id: "q-guard-1",
                    question: "Which action should ALWAYS require human approval in a marketing agent?",
                    options: ["Drafting a caption", "Spending ad budget above a set limit", "Summarising analytics", "Suggesting hashtags"],
                    answer: 1,
                    explanation: "Irreversible or costly actions need a human checkpoint.",
                  },
                  {
                    type: "keypoints",
                    heading: "Defend against prompt injection",
                    items: ["Treat web pages, emails and files the agent reads as untrusted data", "Never let retrieved text grant new permissions", "Separate read tools from write tools; least privilege"],
                  },
                ],
              },
            ],
          },
          {
            id: "multi-agent",
            title: "Multi-Agent Systems",
            description: "Orchestrators, specialists and handoffs.",
            lessons: [
              {
                id: "orchestrator-pattern",
                title: "The Orchestrator Pattern",
                minutes: 12,
                xp: 200,
                summary: "One planner, many specialists.",
                blocks: [
                  {
                    type: "text",
                    heading: "Divide and conquer",
                    body: "An orchestrator agent breaks a goal into subtasks and delegates to specialists (researcher, writer, editor, publisher), each with its own tools and instructions. It gathers results, checks quality, and decides what's next. Use multiple agents when tasks are parallel or need different expertise — not just because you can.",
                  },
                  {
                    type: "prompt-lab",
                    goal: "Design (in a prompt) a 4-agent content team: orchestrator, researcher, scriptwriter, editor. Define each role, inputs/outputs, handoff format (JSON), and a quality gate.",
                    minScore: 75,
                  },
                ],
              },
              {
                id: "evals",
                title: "Evaluating Agents",
                minutes: 10,
                xp: 200,
                summary: "If you can't measure it, you can't ship it.",
                blocks: [
                  {
                    type: "keypoints",
                    heading: "Evaluation toolkit",
                    items: ["Golden test set of real tasks with expected outcomes", "Automatic checks (schema valid? cost? steps?) + LLM-as-judge rubrics", "Track success rate, cost per task and latency over time", "Re-run evals on every prompt or model change"],
                  },
                  {
                    type: "quiz",
                    id: "q-eval-1",
                    question: "You changed your agent's system prompt. What should happen before shipping?",
                    options: ["Nothing", "Re-run your eval set and compare results", "Increase max_tokens", "Ask the agent if it's better"],
                    answer: 1,
                    explanation: "Evals catch regressions that 'it looks fine' misses.",
                  },
                ],
              },
            ],
          },
          {
            id: "capstone",
            title: "Capstone & Certification Exam",
            description: "Prove mastery. Earn your credential.",
            lessons: [
              {
                id: "capstone-exam",
                title: "Rreal Certified Professional Exam",
                minutes: 20,
                xp: 500,
                summary: "A cumulative exam across all five tracks. Score 80%+ to certify.",
                blocks: [
                  { type: "text", heading: "Exam rules", body: "Answer every question. You need 80% or higher. You can retake after reviewing — learning is the point." },
                  { type: "quiz", id: "x-1", question: "Which prompt element most improves brand-voice consistency?", options: ["ALL CAPS", "2–3 examples (few-shot)", "Longer greetings", "Emojis"], answer: 1, explanation: "Examples lock in voice." },
                  { type: "quiz", id: "x-2", question: "Best aspect ratio for TikTok/Reels/Shorts?", options: ["16:9", "1:1", "9:16", "4:3"], answer: 2, explanation: "Vertical 9:16." },
                  { type: "quiz", id: "x-3", question: "Where should an AI API key live in a web app?", options: ["In frontend JavaScript", "In a server-side environment variable", "In the README", "In the image alt text"], answer: 1, explanation: "Server-side env vars keep secrets private." },
                  { type: "quiz", id: "x-4", question: "Webhook handlers should be…", options: ["Slow and thorough before responding", "Idempotent and signature-verified", "Public without checks", "Written in CSS"], answer: 1, explanation: "Verify, respond fast, tolerate retries." },
                  { type: "quiz", id: "x-5", question: "An agent wants to issue a $5,000 refund. Your design should…", options: ["Let it, agents are smart", "Require human approval above a threshold", "Crash the agent", "Ask the customer to approve"], answer: 1, explanation: "Human-in-the-loop for high-risk actions." },
                  { type: "quiz", id: "x-6", question: "What should you do with realistic AI-generated video on social platforms?", options: ["Disclose / label it as AI", "Say it's real", "Remove captions", "Nothing"], answer: 0, explanation: "Disclosure builds trust and follows platform policy." },
                  { type: "quiz", id: "x-7", question: "HTTP 429 means…", options: ["Success", "Rate limited — back off and retry", "Wrong password", "Server is on fire"], answer: 1, explanation: "Too many requests." },
                  { type: "quiz", id: "x-8", question: "MCP is best described as…", options: ["A video codec", "An open protocol connecting AI apps to tools and data", "A type of GPU", "A social network"], answer: 1, explanation: "A standard for tool/context integration." },
                  { type: "quiz", id: "x-9", question: "Which is a hallucination?", options: ["The AI admits it doesn't know", "The AI invents a fake citation confidently", "The AI asks a clarifying question", "The AI uses bullet points"], answer: 1, explanation: "Confident fabrication = hallucination." },
                  { type: "quiz", id: "x-10", question: "Captions on short-form video primarily help…", options: ["Only deaf viewers", "Everyone — including the many viewers watching on mute, and deaf/hard-of-hearing viewers", "Nobody", "SEO only"], answer: 1, explanation: "Captions are accessibility and growth." },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
