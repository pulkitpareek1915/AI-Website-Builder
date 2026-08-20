// Community page — browse, sort, and like websites published by other users.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Eye,
  Loader2,
  Calendar,
  ExternalLink,
  Check,
} from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Card, ProjectThumbnail } from "../assets/ui";
import { getCommunity, likeCommunityProject, apiError } from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { communityPageStyles as s } from "../assets/dummyStyles";

const filters = [
  { label: "New", key: "new" },
  { label: "Most viewed", key: "views" },
  { label: "Most loved", key: "likes" },
];

// Main community page: fetches published projects and renders the sortable grid.
export default function CommunityPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sort, setSort] = useState("new");
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load the community projects whenever the sort changes.
  useEffect(() => {
    setLoading(true);
    setError("");
    getCommunity(sort)
      .then((data) => setProjects(data.projects || []))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [sort]);

  async function like(id) {
    // Optimistic update: flip the heart + adjust the count, then reconcile
    // with the server. On failure we roll back to the previous list.
    const prev = projects;
    setProjects((old) =>
      old.map((p) =>
        p.id === id
          ? {
              ...p,
              likedByMe: !p.likedByMe,
              likes: Math.max(0, (p.likes || 0) + (p.likedByMe ? -1 : 1)),
            }
          : p,
      ),
    );
    try {
      const data = await likeCommunityProject(id);
      setProjects((old) =>
        old.map((p) =>
          p.id === id ? { ...p, likes: data.likes, likedByMe: data.liked } : p,
        ),
      );
    } catch {
      setProjects(prev);
    }
  }

  return (
    <div className={s.container}>
      <Navbar />

      <section className={s.heroWrapper}>
        <div className={s.heroBg} style={s.heroBgStyle} />
        <div className={s.heroInner}>
          <h1 className={s.heroTitle}>Published Projects</h1>
          <p className={s.heroSub}>
            Real projects published by mintsite users. Click Open to view it
            live, or tap the heart to show some love.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className={s.filterBar}>
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setSort(f.key)}
                className={`${s.filterButtonBase} ${
                  sort === f.key ? s.filterButtonActive : s.filterButtonInactive
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <Card className={`${s.cardMessage} ${s.loadingText}`}>
              <Loader2 className={s.loadingSpinner} />
              Loading community projects...
            </Card>
          ) : error ? (
            <Card className={`${s.cardMessage} ${s.errorText}`}>
              Couldn't load community: {error}
            </Card>
          ) : projects.length === 0 ? (
            <Card className={`${s.cardMessage} ${s.emptyText}`}>
              No published projects yet. Be the first — create one and hit{" "}
              <span className={s.emptyHighlight}>Publish</span>.
            </Card>
          ) : (
            <div className={s.grid}>
              {projects.map((p) => (
                <CommunityCard
                  key={p.id}
                  project={p}
                  isLoggedIn={Boolean(user)}
                  onOpen={() => navigate(`/preview/${p.id}`)}
                  onLike={() => {
                    if (!user) {
                      navigate("/login");
                      return;
                    }
                    like(p.id);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}

// One project card: thumbnail, title, Open button, and like/heart toggle.
function CommunityCard({ project, isLoggedIn, onOpen, onLike }) {
  const initial = (project.author || "A").charAt(0).toUpperCase();
  const date = project.publishedAt
    ? new Date(project.publishedAt).toLocaleDateString()
    : "";
  const likedByMe = Boolean(project.likedByMe);

  return (
    <Card hover className={s.card}>
      {/* Thumbnail is clickable too — opens preview */}
      <button
        type="button"
        onClick={onOpen}
        className={s.thumbnailWrapper}
        aria-label={`Open ${project.name}`}
      >
        <ProjectThumbnail html={project.html} />
        <span className={s.websiteTag}>Website</span>
        {project.isOwn && (
          <span className={s.ownBadge}>
            <Check className={s.ownBadgeIcon} strokeWidth={3} />
            Published by you
          </span>
        )}
      </button>

      <div className={s.cardBody}>
        {project.isOwn && (
          <div className={s.ownIndicator}>
            <span className={s.ownDot} />
            Your project — live in community
          </div>
        )}
        <h3 className={s.projectTitle}>{project.name}</h3>

        <div className={s.actionRow}>
          {/* Open button — primary action */}
          <button
            onClick={onOpen}
            className={s.openButton}
          >
            <ExternalLink className={s.iconSm} /> Open
          </button>
          {/* Heart toggle — separate from Open. Red when liked. */}
          <button
            onClick={onLike}
            disabled={project.isOwn}
            title={
              project.isOwn
                ? "You can't like your own project"
                : likedByMe
                  ? "Unlike"
                  : isLoggedIn
                    ? "Like"
                    : "Sign in to like"
            }
            className={`${s.likeButtonBase} ${
              likedByMe ? s.likeButtonLiked : s.likeButtonUnliked
            } ${project.isOwn ? s.likeButtonOwn : ""}`}
          >
            <Heart
              className={`${s.likeIcon} ${
                likedByMe ? s.likeIconFilled : ""
              }`}
            />
            {project.likes ?? 0}
          </button>
        </div>

        <div className={s.footerRow}>
          <div className={s.authorInfo}>
            <div className={s.authorAvatar}>{initial}</div>
            <span className={s.authorName}>
              {project.author || "Anonymous"}
            </span>
          </div>
          <div className={s.metaGroup}>
            {date && (
              <span className={s.metaItem}>
                <Calendar className={s.iconXs} /> {date}
              </span>
            )}
            <span className={s.metaItem}>
              <Eye className={s.iconXs} /> {project.views ?? 0}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}