"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  ClipboardList,
  Flame,
  Megaphone,
  Search,
  Swords,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  trackNotificationEngagement,
  type UserNotification,
} from "@/lib/api/notificationApi";
import { useNotificationCenter } from "@/context/NotificationCenterContext";
import {
  getNotificationPresentation,
  getSafeNotificationRoute,
} from "@/lib/notificationPresentation";

import "./notifications.css";

type CategoryFilter = "all" | "battles" | "mocks" | "practice" | "announcements";

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return "Just now";
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    if (diffSeconds < 172800) return "Yesterday";
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return dateString;
  }
}

function getItemCategory(item: UserNotification): "battles" | "mocks" | "practice" | "announcements" | "other" {
  if (item.type?.startsWith("battle") || item.category === "battleInvites") {
    return "battles";
  }
  if (item.type === "new_mock" || item.category === "newMocks") {
    return "mocks";
  }
  if (
    item.type === "daily_practice" ||
    item.type === "streak_protection" ||
    item.category === "practice"
  ) {
    return "practice";
  }
  if (item.type === "announcement" || item.category === "announcements") {
    return "announcements";
  }
  return "other";
}

export default function NotificationsPage() {
  const router = useRouter();
  const { decrementUnread, clearUnread } = useNotificationCenter();

  const [items, setItems] = useState<UserNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Remove notification alert from avatar icon upon visiting /notifications (and persist read status)
  useEffect(() => {
    clearUnread();
    void markAllNotificationsRead().catch(() => {});

    void fetchNotifications()
      .then((data) => {
        setItems(data?.items || []);
        setUnreadCount(data?.unreadCount || 0);
      })
      .catch(() => {
        setItems([]);
        setUnreadCount(0);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [clearUnread]);

  const handleBack = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  }, [router]);

  const openNotification = async (item: UserNotification) => {
    if (openingId === item._id) return;

    const safeRoute = getSafeNotificationRoute(item.route);
    if (!safeRoute) return;

    setOpeningId(item._id);

    try {
      if (!item.read) {
        setItems((current) =>
          current.map((entry) =>
            entry._id === item._id ? { ...entry, read: true } : entry
          )
        );
        setUnreadCount((count) => Math.max(0, count - 1));
        decrementUnread();

        await markNotificationRead(item._id).catch(() => {});
      }

      router.push(safeRoute);
    } finally {
      setOpeningId(null);
    }
  };

  const markAll = async () => {
    await markAllNotificationsRead().catch(() => {});
    clearUnread();

    setItems((current) =>
      current.map((item) => ({
        ...item,
        read: true,
      }))
    );
    setUnreadCount(0);
  };

  const handleCardClick = (item: UserNotification) => {
    void trackNotificationEngagement(item._id, "opened", "in_app").catch(() => {});
    if (getSafeNotificationRoute(item.route)) {
      void openNotification(item);
    }
  };

  const handleNotificationAction = (item: UserNotification) => {
    void trackNotificationEngagement(item._id, "action_clicked", "in_app").catch(() => {});
    void openNotification(item);
  };

  // Category counts
  const counts = useMemo(() => {
    const res = {
      all: items.length,
      battles: 0,
      mocks: 0,
      practice: 0,
      announcements: 0,
      actionable: 0,
    };
    for (const item of items) {
      const cat = getItemCategory(item);
      if (cat in res) {
        res[cat as keyof typeof res]++;
      }
      if (getSafeNotificationRoute(item.route)) {
        res.actionable++;
      }
    }
    return res;
  }, [items]);

  // Filtered notifications
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (activeCategory !== "all") {
        const cat = getItemCategory(item);
        if (cat !== activeCategory) return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesBody = item.body?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesBody) return false;
      }
      return true;
    });
  }, [items, activeCategory, searchQuery]);

  return (
    <div className="notif-page">
      {/* Pinned Fixed Top: Header, Category Filter Pills, and Search Bar */}
      <header data-ui-chrome="header" className="notif-fixed-top">
        <div className="notif-header">
          <div className="notif-header-inner">
            <div className="notif-header-left">
              <button data-ui-button="icon"
                type="button"
                onClick={handleBack}
                className="notif-back-btn"
                aria-label="Go back"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="notif-header-title">
                <h1>Notifications</h1>
                <span className="notif-header-subtitle">
                  {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
                </span>
              </div>
            </div>

            {unreadCount > 0 && (
              <button data-ui-button="state"
                type="button"
                onClick={markAll}
                className="notif-read-all-btn"
                aria-label="Read all notifications"
              >
                <CheckCheck size={16} />
                <span>Read all</span>
              </button>
            )}
          </div>
        </div>

        {/* Pinned Controls Bar: Category Pills & Search */}
        {items.length > 0 && (
          <div className="notif-controls-bar">
            <div className="notif-controls-inner">
              <div className="notif-categories" role="tablist" aria-label="Notification categories">
                <button data-ui-button="state"
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === "all"}
                  onClick={() => setActiveCategory("all")}
                  className={`notif-category-chip ${activeCategory === "all" ? "is-active" : ""}`}
                >
                  <span>All</span>
                  <span className="notif-category-count">{counts.all}</span>
                </button>

                {counts.battles > 0 && (
                  <button data-ui-button="state"
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === "battles"}
                    onClick={() => setActiveCategory("battles")}
                    className={`notif-category-chip ${activeCategory === "battles" ? "is-active" : ""}`}
                  >
                    <Swords size={14} />
                    <span>Battles</span>
                    <span className="notif-category-count">{counts.battles}</span>
                  </button>
                )}

                {counts.mocks > 0 && (
                  <button data-ui-button="state"
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === "mocks"}
                    onClick={() => setActiveCategory("mocks")}
                    className={`notif-category-chip ${activeCategory === "mocks" ? "is-active" : ""}`}
                  >
                    <ClipboardList size={14} />
                    <span>Mocks</span>
                    <span className="notif-category-count">{counts.mocks}</span>
                  </button>
                )}

                {counts.practice > 0 && (
                  <button data-ui-button="state"
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === "practice"}
                    onClick={() => setActiveCategory("practice")}
                    className={`notif-category-chip ${activeCategory === "practice" ? "is-active" : ""}`}
                  >
                    <Flame size={14} />
                    <span>Practice</span>
                    <span className="notif-category-count">{counts.practice}</span>
                  </button>
                )}

                {counts.announcements > 0 && (
                  <button data-ui-button="state"
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === "announcements"}
                    onClick={() => setActiveCategory("announcements")}
                    className={`notif-category-chip ${activeCategory === "announcements" ? "is-active" : ""}`}
                  >
                    <Megaphone size={14} />
                    <span>Updates</span>
                    <span className="notif-category-count">{counts.announcements}</span>
                  </button>
                )}
              </div>

              <div className="notif-search-bar">
                <Search size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search notifications…"
                  aria-label="Search notifications"
                />
                {searchQuery && (
                  <button data-ui-button="secondary"
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="notif-search-clear"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Scrollable Body: Only Bottom Notification Items Scroll */}
      <main className="notif-scroll-body">
        <div className="notif-container">
          {/* Desktop PC Hero Banner */}
          <section className="notif-desktop-hero" aria-labelledby="notif-hero-title">
            <div className="notif-desktop-hero-top">
              <div className="notif-desktop-hero-copy">
                <h2 id="notif-hero-title">Notification Center</h2>
                <p>
                  Stay on top of 1v1 battle invites, mock test releases, and study streaks.
                </p>
              </div>
              <div className="notif-stats-row">
                <div className="notif-stat-pill">
                  <span>Total:</span>
                  <strong>{items.length}</strong>
                </div>
                <div className="notif-stat-pill">
                  <span>Unread:</span>
                  <strong>{unreadCount}</strong>
                </div>
                <div className="notif-stat-pill">
                  <span>Actionable:</span>
                  <strong>{counts.actionable}</strong>
                </div>
              </div>
            </div>
          </section>

          {/* List Content */}
        {loading ? (
          <div className="notif-list" aria-busy="true">
            {[1, 2, 3, 4].map((id) => (
              <div key={id} className="notif-skeleton">
                <div className="notif-sk-icon" />
                <div className="notif-sk-body">
                  <div className="notif-sk-line short" />
                  <div className="notif-sk-line medium" />
                  <div className="notif-sk-line full" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty-icon">
              <Bell size={28} />
            </div>
            <h3>No notifications yet</h3>
            <p>
              You&apos;re all caught up! When you receive battle duel challenges, mock releases, or streak reminders, they&apos;ll appear here.
            </p>
            <div className="notif-empty-actions">
              <Link href="/battle" className="notif-empty-link">
                <Swords size={16} />
                <span>1v1 Battle Arena</span>
              </Link>
              <Link href="/mock-test" className="notif-empty-link">
                <ClipboardList size={16} />
                <span>Mock Tests</span>
              </Link>
            </div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="notif-empty">
            <div className="notif-empty-icon">
              <Search size={26} />
            </div>
            <h3>No matching notifications</h3>
            <p>No notifications match your current filter or search criteria.</p>
            <div className="notif-empty-actions">
              <button data-ui-button="state"
                type="button"
                onClick={() => {
                  setActiveCategory("all");
                  setSearchQuery("");
                }}
                className="notif-empty-link"
              >
                Clear all filters
              </button>
            </div>
          </div>
        ) : (
          <div className="notif-list" role="feed" aria-label="Notifications list">
            {filteredItems.map((item) => {
              const { label, Icon } = getNotificationPresentation(item.type, item.category);
              const safeRoute = getSafeNotificationRoute(item.route);
              const category = getItemCategory(item);
              const isOpening = openingId === item._id;

              return (
                <div
                  key={item._id}
                  onClick={() => handleCardClick(item)}
                  className={`notif-card ${item.read ? "is-read" : "is-unread"}`}
                 role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.currentTarget.click(); } }}>
                  <div className={`notif-icon-wrap type-${category === "other" ? "default" : category === "battles" ? "battle" : category === "mocks" ? "mock" : category === "practice" ? "streak" : "announcement"}`}>
                    <Icon size={22} />
                    {!item.read && <span className="notif-unread-dot" aria-label="Unread" />}
                  </div>

                  <div className="notif-body">
                    <div className="notif-meta-row">
                      <span className="notif-tag">
                        {category === "battles"
                          ? "Battle Duel"
                          : category === "mocks"
                          ? "Mock Test"
                          : category === "practice"
                          ? "Practice"
                          : category === "announcements"
                          ? "Update"
                          : "Alert"}
                      </span>
                      <time
                        dateTime={item.createdAt}
                        title={new Date(item.createdAt).toLocaleString()}
                        className="notif-time"
                      >
                        {formatRelativeTime(item.createdAt)}
                      </time>
                    </div>

                    <h2 className="notif-title">{item.title}</h2>
                    <p className="notif-desc">{item.body}</p>
                  </div>

                  {safeRoute && label !== "View Battle" && label !== "Open" && label !== "View" && (
                    <div className="notif-action-row">
                      <button data-ui-button="primary"
                        type="button"
                        disabled={isOpening}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNotificationAction(item);
                        }}
                        className="notif-cta-btn"
                      >
                        {isOpening ? "Opening…" : label}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}
