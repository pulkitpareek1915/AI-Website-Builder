// Preview page — full-screen view of a single published or owned site.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Heart, Sparkles, Loader2 } from "lucide-react";
import { Logo, FullScreenMessage } from "../assets/ui";
import {
  getCommunityProject,
  likeCommunityProject,
  getProject,
  apiError,
} from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { safePreviewHtml } from "../utils/safePreview";
import { previewPageStyles as s } from "../assets/dummyStyles";

// Loads one project by its id and shows it full-screen with view/like actions.
export default function PreviewPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        // Try public community endpoint first (works for everyone)
        const { project: p } = await getCommunityProject(id);
        if (!cancelled) setProject(p);
      } catch {
        // Fallback: if signed in, try owner endpoint (works for drafts you own)
        if (user) {
          try {
            const { project: p } = await getProject(id);
            if (!cancelled) setProject(p);
          } catch (err) {
            if (!cancelled) setError(apiError(err));
          }
        } else if (!cancelled) {
          setError("This preview isn't public yet.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  // Sends a like for the current project and updates the like count.
  async function handleLike() {
    if (!project || liking) return;
    setLiking(true);
    try {
      const { likes } = await likeCommunityProject(project.id);
      setProject((p) => ({ ...p, likes }));
    } catch {
      // ignore
    } finally {
      setLiking(false);
    }
  }

  if (loading) {
    return (
      <FullScreenMessage>
        <Loader2 className={s.loadingSpinner} />
        Loading preview...
      </FullScreenMessage>
    );
  }
  if (error || !project) {
    return (
      <FullScreenMessage>
        <p className={s.errorTitle}>Preview unavailable</p>
        <p className={s.errorMessage}>
          {error || "Project not found"}
        </p>
        <Link
          to="/community"
          className={s.errorButton}
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Browse community
        </Link>
      </FullScreenMessage>
    );
  }

  return (
    <div className={s.container}>
      <header className={s.header}>
        <Link
          to="/community"
          className={s.backLink}
        >
          <ArrowLeft className={s.backIcon} /> Community
        </Link>
        <div className={s.logoWrapper}>
          <Logo />
        </div>
        <div className={s.projectInfo}>
          <p className={s.projectName}>{project.name}</p>
          <p className={s.projectAuthor}>
            by {project.author || "Anonymous"}
          </p>
        </div>
        <div className={s.actions}>
          {typeof project.views === "number" && (
            <span className={s.viewsBadge}>
              <Eye className={s.viewsIcon} /> {project.views}
            </span>
          )}
          <button
            onClick={handleLike}
            disabled={liking}
            className={s.likeButton}
          >
            <Heart className={s.likeIcon} />
            {project.likes ?? 0}
          </button>
        </div>
      </header>

      <div className={s.previewArea}>
        {project.html ? (
          <iframe
            title={project.name}
            srcDoc={safePreviewHtml(project.html)}
            sandbox="allow-scripts allow-same-origin allow-modals allow-popups"
            className={s.iframe}
          />
        ) : (
          <div className={s.emptyContainer}>
            <Sparkles className={s.emptyIcon} />
            This project has no generated HTML yet.
          </div>
        )}
      </div>
    </div>
  );
}