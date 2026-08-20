// Builder — the main editor: chat on the left, live preview on the right.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  Globe,
  Loader2,
  Sparkles,
  ArrowUp,
  User,
  Bot,
  Wand2,
  RefreshCcw,
  AlertTriangle,
  Zap,
  ArrowLeft,
  Rocket,
  Download,
  Check,
  Cloud,
  GitBranch,
} from "lucide-react";
import GitHubUploadModal from "../components/modal/GitHubUploadModal";
import VercelDeployModal from "../components/modal/VercelDeployModal";
import { useAuth } from "../context/AuthContext";
import {
  getProject,
  updateProject,
  generateProject,
  apiError,
} from "../utils/api";
import { safePreviewHtml } from "../utils/safePreview";
import { FullScreenMessage, Logo } from "../assets/ui";
import { builderPageStyles as s } from "../assets/dummyStyles";

const devices = [
  { value: "desktop", icon: Monitor, label: "Desktop" },
  { value: "tablet", icon: Tablet, label: "Tablet" },
  { value: "mobile", icon: Smartphone, label: "Mobile" },
];

// Main builder page: loads the project, runs AI generation, and wires up the top bar, chat, and preview.
export default function BuilderPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, setUser } = useAuth();

  const [device, setDevice] = useState("desktop");
  const [name, setName] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [genError, setGenError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const debounceRef = useRef(null);
  const autoFiredForRef = useRef(null);

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadProject = useCallback(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getProject(id)
      .then((d) => setProject(d.project))
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (project) setName(project.name);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function runGenerate(prompt) {
    setGenError("");
    setGenerating(true);
    try {
      const { project: p, user: u } = await generateProject(id, prompt);
      setProject(p);
      if (u) setUser(u);
    } catch (err) {
      setGenError(apiError(err));
      // 402 = out of credits → take user straight to the pricing page
      if (err?.response?.status === 402) navigate("/pricing");
    } finally {
      setGenerating(false);
    }
  }

  async function savePatch(body) {
    setSaving(true);
    try {
      const { project: p } = await updateProject(id, body);
      setProject(p);
      setSavedAt(new Date());
      setSaveError("");
    } catch (err) {
      setSaveError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  // --- Auto-generate the very first time a project loads with a prompt
  // but no HTML yet. Uses intrinsic project state (no sessionStorage hops).
  useEffect(() => {
    if (!project) return;
    if (autoFiredForRef.current === project.id) return;
    autoFiredForRef.current = project.id;
    const needsFirstGen = Boolean(project.prompt) && !project.html;
    // First generation now costs 5 credits (vs 2 for iterations).
    const hasCredits = (user?.credits ?? 0) >= 5;
    if (needsFirstGen && hasCredits && !generating) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      runGenerate(project.prompt);
    }
  }, [project?.id, project?.prompt, project?.html]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save on name change (debounced)
  useEffect(() => {
    if (!project || name === project.name) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      savePatch({ name });
    }, 800);
    return () => clearTimeout(debounceRef.current);
  }, [name]); // eslint-disable-line react-hooks/exhaustive-deps

  // Surface generation errors inline in the chat as an assistant message.
  const chatMessages = useMemo(() => {
    const base = project?.messages || [];
    if (!genError) return base;
    return [
      ...base,
      {
        role: "assistant",
        text: `Generation failed: ${genError}\n\nCheck the server logs, then click Try again below.`,
        isError: true,
      },
    ];
  }, [project?.messages, genError]);

  function handleDownload() {
    if (!project?.html) return;
    const blob = new Blob([project.html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(project.name || "site").toLowerCase().replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }
  async function handleTogglePublish() {
    if (!project) return;
    await savePatch({ published: !project.published });
  }
  function handlePreview() {
    if (!project) return;
    window.open(`/preview/${project.id}`, "_blank", "noopener");
  }

  if (loading) {
    return (
      <FullScreenMessage>
        <Loader2 className={s.loadingSpinner} />
        Loading project...
      </FullScreenMessage>
    );
  }
  if (error) {
    return (
      <FullScreenMessage>
        <p className={s.errorTitle}>Couldn't load project</p>
        <p className={s.errorSub}>{apiError(error)}</p>
        <button
          onClick={() => navigate("/dashboard")}
          className={s.gradientButton + " mt-5 px-4 py-2 text-[13px]"}
        >
          Back to projects
        </button>
      </FullScreenMessage>
    );
  }
  if (!project) return null;

  // Cost depends on whether this is a first-build or an iteration
  const generationCost = project.html && project.html.length > 100 ? 2 : 5;
  const canRetry =
    Boolean(genError) && !generating && (user?.credits ?? 0) >= generationCost;

  return (
    <div className={s.container}>
      <BuilderTopbar
        project={project}
        name={name}
        setName={setName}
        device={device}
        setDevice={setDevice}
        devices={devices}
        user={user}
        saving={saving}
        savedAt={savedAt}
        saveError={saveError}
        generating={generating}
        onBack={() => navigate("/dashboard")}
        onBuyCredits={() => navigate("/pricing")}
        onPreview={handlePreview}
        onDownload={handleDownload}
        onShowGithub={() => setShowGithubModal(true)}
        onShowDeploy={() => setShowDeployModal(true)}
        onTogglePublish={handleTogglePublish}
      />

      {project.published && (
        <div className={s.publishedBanner}>
          <Globe className={s.iconSm} />
          Live in Community ·{" "}
          <Link
            to={`/preview/${project.id}`}
            className={s.publishedLink}
          >
            View preview
          </Link>
        </div>
      )}

      <div className={s.mainFlex}>
        <div className={s.chatPanel}>
          <BuilderChat
            messages={chatMessages}
            onGenerate={(p) => runGenerate(p)}
            generating={generating}
            credits={user?.credits ?? 0}
            cost={generationCost}
            retry={canRetry ? () => runGenerate(project.prompt) : null}
          />
        </div>
        <BuilderPreview
          html={project.html}
          device={device}
          generating={generating}
          canGenerate={
            !project.html &&
            !generating &&
            (user?.credits ?? 0) >= 5 &&
            Boolean(project.prompt)
          }
          onGenerate={() => runGenerate(project.prompt)}
        />
      </div>

      <div className={s.mobileWarning}>
        <Eye className={s.iconSm + " shrink-0"} />
        Builder works best on larger screens.{" "}
        <Link to="/dashboard" className={s.mobileWarningBack}>
          Back
        </Link>
      </div>

      <GitHubUploadModal
        open={showGithubModal}
        onClose={() => setShowGithubModal(false)}
        project={project}
      />
      <VercelDeployModal
        open={showDeployModal}
        onClose={() => setShowDeployModal(false)}
        project={project}
        onDeployed={(url) => {
          // Optimistically update local state so the deploy URL banner shows
          setProject((p) =>
            p
              ? { ...p, deployUrl: url, deployedAt: new Date().toISOString() }
              : p,
          );
        }}
      />
    </div>
  );
}

// BuilderChat — the left-hand chat panel where you prompt the AI to build/edit.
const suggestions = [
  "Make the hero section more vibrant",
  "Add a testimonials section",
  "Change to a warm colour palette",
  "Add a pricing table with 3 tiers",
];

function BuilderChat({
  messages = [],
  onGenerate,
  generating,
  credits = 0,
  retry,
  cost = 2, // 5 for first generation, 2 for iterations — set by parent
}) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, generating]);

  function handleSend(text) {
    const prompt = (text ?? input).trim();
    if (!prompt || credits < cost || generating) return;
    setInput("");
    onGenerate?.(prompt);
  }

  const outOfCredits = credits < cost;
  const empty = messages.length === 0;

  return (
    <div className={s.chatContainer}>
      <div className={s.chatHeader}>
        <div className={s.chatHeaderIcon}>
          <Sparkles className={s.chatHeaderIconInner} />
        </div>
        <div className={s.chatHeaderTitleContainer}>
          <h3 className={s.chatHeaderTitle}>AI Builder</h3>
          <p className={s.chatHeaderCredits}>
            {credits} {credits === 1 ? "credit" : "credits"} remaining
          </p>
        </div>
      </div>

      <div ref={listRef} className={s.chatMessages}>
        {empty && !generating && (
          <div className={s.emptyChat}>
            <p className={s.emptyChatSub}>Describe what you want to build.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <Message key={i} role={m.role} text={m.text} isError={m.isError} />
        ))}
        {generating && <TypingIndicator />}

        {retry && (
          <button
            onClick={retry}
            className={s.retryButton}
          >
            <RefreshCcw className={s.iconSm} /> Try generating again
          </button>
        )}

        {empty && !generating && (
          <div className={s.suggestionsContainer}>
            <p className={s.suggestionsLabel}>Try one of these:</p>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSend(suggestion)}
                className={s.suggestionButton}
              >
                <Wand2 className={s.suggestionIcon} />
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={s.chatInputArea}>
        {outOfCredits && (
          <div className={s.creditsWarning}>
            <Zap className={s.creditsWarningIcon} />
            <span className={s.creditsWarningText}>
              <span className={s.creditsWarningBold}>
                Need {cost - credits} more credit
                {cost - credits === 1 ? "" : "s"}.
              </span>{" "}
              This {cost === 5 ? "new site" : "change"} costs {cost}.
            </span>
            <button
              onClick={() => navigate("/pricing")}
              className={s.buyCreditsButton}
            >
              Buy credits
            </button>
          </div>
        )}
        <div className={s.inputContainer}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              outOfCredits
                ? "No credits left..."
                : "Describe your website or request changes..."
            }
            rows={2}
            disabled={outOfCredits || generating}
            className={s.textarea}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || generating || outOfCredits}
            className={`${s.sendButtonBase} ${
              input.trim() && !generating && !outOfCredits
                ? s.gradientButton
                : s.sendButtonDisabled
            }`}
            aria-label="Send"
          >
            <ArrowUp className={s.sendIcon} />
          </button>
        </div>
        <p className={s.inputHint}>
          Enter to send · Shift + Enter for new line
        </p>
      </div>
    </div>
  );
}

// Tiny markdown-ish renderer for assistant messages — handles bold,
// bullet lists, and paragraph breaks. Enough for our summaries.
function renderInline(text) {
  // bold: **text**
  const parts = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <strong key={`b-${i++}`} className="text-white">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

// Renders one message's text as paragraphs and bullet lists.
function MessageBody({ text }) {
  const blocks = [];
  let bullets = [];
  function flushBullets(key) {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul-${key}`} className={s.messageUl}>
        {bullets.map((b, i) => (
          <li key={i}>{renderInline(b)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  }
  const lines = (text || "").split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    if (m) {
      bullets.push(m[1]);
    } else {
      flushBullets(i);
      const trimmed = line.trim();
      if (trimmed) {
        blocks.push(
          <p key={`p-${i}`} className={s.messageP}>
            {renderInline(line)}
          </p>,
        );
      } else if (blocks.length) {
        blocks.push(<div key={`s-${i}`} className={s.messageSpacer} />);
      }
    }
  });
  flushBullets("end");
  return <div className={s.messageBodyWrapper}>{blocks}</div>;
}

// Renders one chat message bubble (user, assistant, or error).
function Message({ role, text, isError }) {
  const isUser = role === "user";
  if (isError) {
    return (
      <div className={s.messageContainer}>
        <div className={s.errorIconContainer}>
          <AlertTriangle className={s.errorIcon} />
        </div>
        <div className={s.errorMessage}>{text}</div>
      </div>
    );
  }
  return (
    <div className={`${s.messageContainer} ${isUser ? s.messageRowReverse : ""}`}>
      <div
        className={`${s.avatarBase} ${
          isUser ? s.avatarUser : s.avatarAssistant
        }`}
      >
        {isUser ? <User className={s.avatarIcon} /> : <Bot className={s.avatarIcon} />}
      </div>
      <div
        className={`${s.messageBubbleBase} ${
          isUser ? s.messageBubbleUser : s.messageBubbleAssistant
        }`}
      >
        {isUser ? text : <MessageBody text={text} />}
      </div>
    </div>
  );
}

// Shows animated dots while the AI is generating a reply.
function TypingIndicator() {
  return (
    <div className={s.typingContainer}>
      <div className={s.typingAvatar}>
        <Bot className={s.typingAvatarIcon} />
      </div>
      <div className={s.typingDotsContainer}>
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className={s.typingDot}
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

// BuilderPreview — the live iframe preview of the generated site.
const deviceWidths = {
  desktop: "w-full",
  tablet: "w-[768px] mx-auto",
  mobile: "w-[390px] mx-auto",
};

function BuilderPreview({
  html,
  device = "desktop",
  generating,
  canGenerate = false,
  onGenerate,
}) {
  const empty = !html;

  return (
    <div className={s.previewContainer}>
      <div
        className={`${s.previewInnerWrapper} ${deviceWidths[device] || ""}`}
      >
        <div className={s.previewBox}>
          {generating && (
            <div className={s.generatingOverlay}>
              <Loader2 className={s.generatingSpinner} />
              <p className={s.generatingText}>Generating your website...</p>
              <p className={s.generatingSub}>
                AI is enhancing your prompt and writing the HTML. This can take
                10–20 seconds.
              </p>
            </div>
          )}

          {empty && !generating ? (
            <EmptyState canGenerate={canGenerate} onGenerate={onGenerate} />
          ) : (
            <iframe
              title="preview"
              srcDoc={safePreviewHtml(html || "")}
              sandbox="allow-scripts allow-same-origin allow-modals allow-popups"
              className="w-full h-full border-0 bg-white"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Placeholder shown in the preview area before any site is generated.
function EmptyState({ canGenerate, onGenerate }) {
  return (
    <div className={s.emptyStateContainer}>
      <div className={s.emptyIconContainer}>
        <Zap className={s.emptyIcon} />
      </div>
      <h3 className={s.emptyTitle}>Your website will appear here</h3>
      <p className={s.emptyDesc}>
        Describe what you want to build in the chat panel — your AI-generated
        site will render here in seconds.
      </p>
      {canGenerate && (
        <button
          onClick={onGenerate}
          className={s.gradientButton + " px-4 py-2 text-[13px]"}
        >
          <Zap className={s.iconSm} /> Generate now
        </button>
      )}
    </div>
  );
}

// BuilderTopbar — builder's top bar: name, device toggle, save status, and actions.
function BuilderTopbar({
  project,
  name,
  setName,
  device,
  setDevice,
  devices,
  user,
  saving,
  savedAt,
  saveError,
  generating,
  onBack,
  onBuyCredits,
  onPreview,
  onDownload,
  onShowGithub,
  onShowDeploy,
  onTogglePublish,
}) {
  return (
    <header className={s.topbar}>
      <div className={s.topbarLeft}>
        <button
          onClick={onBack}
          className={s.topbarBack}
          aria-label="Back"
        >
          <ArrowLeft className={s.topbarBackIcon} />
        </button>
        <div className={s.topbarLogo}>
          <Logo />
        </div>
        <span className={s.topbarSlash}>/</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={s.topbarNameInput}
        />
      </div>

      <div className={s.deviceToggle}>
        {devices.map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onClick={() => setDevice(value)}
            title={label}
            className={`${s.deviceButtonBase} ${
              device === value ? s.deviceButtonActive : s.deviceButtonInactive
            }`}
          >
            <Icon className={s.deviceIcon} />
          </button>
        ))}
      </div>

      <div className={s.actionsContainer}>
        <SaveStatus
          saving={saving}
          savedAt={savedAt}
          error={saveError}
          generating={generating}
        />
        <button
          onClick={onBuyCredits}
          className={s.creditsButton}
          title="Buy more credits"
        >
          <Zap className={s.creditsIcon} />
          <span className={s.creditsLabel}>Credits :</span>
          <span className={s.creditsNumber}>{user?.credits ?? 0}</span>
        </button>
        <button
          onClick={onPreview}
          disabled={!project.html}
          title="Preview"
          className={s.actionButton}
        >
          <Eye className={s.actionButtonIcon} />
          <span className={s.actionButtonText}> Preview</span>
        </button>
        <button
          onClick={onDownload}
          disabled={!project.html}
          title="Download"
          className={s.actionButton}
        >
          <Download className={s.actionButtonIcon} />
          <span className={s.actionButtonText}> Download</span>
        </button>
        <button
          onClick={onShowGithub}
          disabled={!project.html}
          title="Push to a GitHub repo"
          className={s.githubButton}
        >
          <GitBranch className={s.actionButtonIcon} /> GitHub
        </button>
        <button
          onClick={onShowDeploy}
          disabled={!project.html}
          title="Deploy to Vercel (free hosting + shareable URL)"
          className={s.actionButton}
        >
          <Cloud className={s.actionButtonIcon} />
          <span className={s.actionButtonText}> Deploy</span>
        </button>
        <button
          onClick={onTogglePublish}
          disabled={!project.html || saving}
          className={`${s.publishButtonBase} ${
            project.published
              ? s.publishButtonPublished
              : s.gradientButton
          }`}
        >
          {project.published ? (
            <>
              <Check className={s.publishIcon} /> Published
            </>
          ) : (
            <>
              <Rocket className={s.publishIcon} /> Publish
            </>
          )}
        </button>
      </div>
    </header>
  );
}

// Shows the current save state: generating, saving, saved, or failed.
function SaveStatus({ saving, savedAt, error, generating }) {
  if (generating)
    return (
      <span className={s.saveStatusGenerating}>
        <Loader2 className={s.saveStatusSpinner} /> Generating…
      </span>
    );
  if (error)
    return (
      <span className={s.saveStatusError}>Save failed</span>
    );
  if (saving)
    return (
      <span className={s.saveStatusSaving}>Saving…</span>
    );
  if (savedAt)
    return (
      <span className={s.saveStatusSaved}>Saved</span>
    );
  return null;
}