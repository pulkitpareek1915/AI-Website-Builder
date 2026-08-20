import mongoose from "mongoose";
import { Project } from "../models/Project.js";
import { enhancePrompt, generateSite, postProcess } from "../utils/services.js";
import { generateMockSite } from "../utils/mockGenerator.js";

// Checks whether a string is a valid MongoDB ObjectId.
function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Shared loader — used by every handler that operates on a single project.
// Exported so projectDeploy can reuse it.
export async function loadOwnedProject(req, res) {
  if (!isValidId(req.params.id)) {
    res.status(400).json({ error: "Invalid id" });
    return null;
  }
  const project = await Project.findById(req.params.id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return null;
  }
  if (project.user.toString() !== req.user._id.toString()) {
    res.status(403).json({ error: "Forbidden" });
    return null;
  }
  return project;
}

// Returns the current user's projects, newest first.
export async function list(req, res, next) {
  try {
    const list = await Project.find({ user: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(100);
    res.json({ projects: list.map((p) => p.toClient()) });
  } catch (err) {
    next(err);
  }
}

// Creates a new project from the user's prompt.
export async function create(req, res, next) {
  try {
    const prompt = (req.body.prompt || "").trim();
    const name = (req.body.name || "").trim();
    if (!prompt) return res.status(400).json({ error: "Prompt is required." });
    if (prompt.length > 2000)
      return res
        .status(400)
        .json({ error: "Prompt is too long (max 2000 characters)." });

    const project = await Project.create({
      user: req.user._id,
      name: name || prompt.split(/[.!?]/)[0].slice(0, 60) || "Untitled project",
      prompt,
      messages: [{ role: "user", text: prompt }],
    });
    res.status(201).json({ project: project.toClient() });
  } catch (err) {
    next(err);
  }
}

// Returns a single project the user owns.
export async function get(req, res, next) {
  try {
    const project = await loadOwnedProject(req, res);
    if (!project) return;
    res.json({ project: project.toClient() });
  } catch (err) {
    next(err);
  }
}

// Updates a project's name, HTML, or published status.
export async function update(req, res, next) {
  try {
    const project = await loadOwnedProject(req, res);
    if (!project) return;

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name || name.length > 80)
        return res.status(400).json({ error: "Name must be 1–80 characters." });
      project.name = name;
    }
    if (req.body.html !== undefined) {
      const html = String(req.body.html);
      if (html.length > 500_000)
        return res.status(400).json({ error: "HTML is too large." });
      project.html = html;
    }
    if (req.body.published !== undefined) {
      const published = Boolean(req.body.published);
      project.published = published;
      project.publishedAt = published ? new Date() : null;
    }
    await project.save();
    res.json({ project: project.toClient() });
  } catch (err) {
    next(err);
  }
}

// Deletes a project the user owns.
export async function remove(req, res, next) {
  try {
    const project = await loadOwnedProject(req, res);
    if (!project) return;
    await project.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// Strip script/style + tags + collapse whitespace. Used by the skeleton guard.
function visibleText(html) {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Builds or edits the site's HTML via the AI, then saves and charges credits.
export async function generate(req, res, next) {
  try {
    const project = await loadOwnedProject(req, res);
    if (!project) return;
    // Cost: first generation = 5 credits, iteration = 2 credits.
    const isFirstGeneration = !project.html || project.html.length < 100;
    const cost = isFirstGeneration ? 5 : 2;
    if ((req.user.credits ?? 0) < cost)
      return res.status(402).json({
        error: `You need at least ${cost} credit${cost === 1 ? "" : "s"} ${isFirstGeneration ? "for a new site" : "for changes"}. Top up to continue.`,
        cost,
      });
    const prompt = (req.body.prompt || "").trim();
    if (!prompt) return res.status(400).json({ error: "Prompt is required." });
    if (prompt.length > 2000)
      return res
        .status(400)
        .json({ error: "Prompt is too long (max 2000 characters)." });

    // Don't duplicate the user message if the project was just seeded with it.
    const last = project.messages[project.messages.length - 1];
    if (!last || last.role !== "user" || last.text !== prompt) {
      project.messages.push({ role: "user", text: prompt });
    }

    // For iterations, the "original" prompt is what defines the brand.
    const originalPrompt = project.prompt || prompt;

    // Only enhance into a full brand brief on the FIRST build. On iterations
    // (regenerate / "improve it" / any edit) we pass the raw request instead —
    // re-enhancing would invent a brand-new brand and make a different site.
    let brief;
    if (isFirstGeneration) {
      const enhanceResult = await enhancePrompt(prompt);
      project.enhancedPrompt = enhanceResult.text;
      brief = enhanceResult.text;
    } else {
      brief = prompt;
    }

    const genResult = await generateSite(brief, {
      previousHtml: project.html,
      history: project.messages,
      originalPrompt,
    });

    // Decide what to save. The #1 rule: NEVER destroy a working site on an edit
    // that didn't come back clean. `source === "llm"` means a real model
    // answered; anything else is the offline template.
    const isRealLlm = genResult.source === "llm";
    const tooShort = !genResult.html || genResult.html.length < 500;
    const visibleLen = visibleText(genResult.html).length;
    const hasAnyHeading = /<h[1-3]\b/i.test(genResult.html || "");
    const sectionCount = (genResult.html?.match(/<section\b/gi) || []).length;
    const badOutput =
      tooShort || visibleLen < 200 || (!hasAnyHeading && sectionCount < 1);
    const truncated = Boolean(genResult.truncated);
    const hadWorkingSite = Boolean(project.html && project.html.length > 200);

    // `outcome` drives the saved HTML, the chat reply, and whether we charge.
    let outcome;
    if (hadWorkingSite && (!isRealLlm || badOutput || truncated)) {
      // Edit that failed / came back broken or cut off → keep the current site.
      outcome = "keptPrevious";
    } else if (!isRealLlm || badOutput) {
      // First build with no usable AI output → show the complete offline template.
      // (When source isn't "llm", genResult.html already IS that template.)
      project.html = isRealLlm
        ? postProcess(generateMockSite(originalPrompt))
        : genResult.html;
      outcome = "template";
    } else if (truncated) {
      // First build that came back a little cut off → save the on-brand partial,
      // but treat it as not-fully-successful (honest message, no charge).
      project.html = genResult.html;
      outcome = "incomplete";
    } else {
      project.html = genResult.html;
      outcome = "saved";
    }
    if (outcome !== "saved")
      console.warn(
        `[generate] outcome=${outcome} source=${genResult.source} htmlLen=${genResult.html?.length || 0}`,
      );

    let assistantText;
    if (outcome === "saved") {
      assistantText =
        genResult.summary && genResult.summary.length > 20
          ? genResult.summary
          : "Done — I built your site.";
    } else if (outcome === "keptPrevious") {
      assistantText =
        "That update came back incomplete, so I kept your current site unchanged — please try again in a moment.";
    } else if (outcome === "incomplete") {
      assistantText =
        "Your site is ready, but it came out a little cut off — try again and I'll complete it.";
    } else if (genResult.source === "mock-no-key") {
      assistantText =
        "No AI provider is configured on the server, so I used a starter template.";
    } else {
      assistantText =
        "The AI was busy just now, so I used a starter template — please try again in a moment.";
    }

    project.messages.push({ role: "assistant", text: assistantText });
    if (!project.prompt) project.prompt = prompt;
    await project.save();

    // Charge credits only for a genuinely complete AI build/edit.
    if (outcome === "saved") {
      req.user.credits = Math.max(0, req.user.credits - cost);
      await req.user.save();
    }

    res.json({ project: project.toClient(), user: req.user.toClient() });
  } catch (err) {
    next(err);
  }
}
