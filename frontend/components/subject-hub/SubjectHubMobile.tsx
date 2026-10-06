"use client";

import defaultStyles from "@/components/SubjectHub.module.css";
import { ArrowLeft, ArrowUpDown, Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { MobileTopicCard } from "./MobileTopicCard";
import type { SubjectHubView } from './useSubjectHubView';

export function SubjectHubMobile({ view }: { view: SubjectHubView }) {
  const {
    config,
    CATEGORIES,
    router,
    searchQuery,
    setSearchQuery,
    mobileCategory,
    setMobileCategory,
    mobileFilterOpen,
    setMobileFilterOpen,
    sortBy,
    setSortBy,
    sortMenuOpen,
    setSortMenuOpen,
    sortOptions,
    mobileTopics,
    isChapterMode,
  } = view;

  return (
    <div className={`${defaultStyles.mobileContainer} ${defaultStyles.oledMobile}`}>
      {/* Mobile Topbar */}
      <header data-ui-chrome="header" data-hub-part="mobileTopbar" className={`${defaultStyles.mobileTopbar} ${defaultStyles.oledMobileTopbar}`}>
        <button
          data-ui-button="icon"
          type="button"
          className={defaultStyles.mobileBackBtn}
          onClick={() => router.replace("/")}
          aria-label="Back"
        >
          <ArrowLeft size={20} strokeWidth={2.2} />
        </button>
        <span className={defaultStyles.mobileTopbarTitle}>
          {config.label}
        </span>
        {/* Header Right: Filter Button & Dropdown */}
        <div className={defaultStyles.mobileHeaderFilterWrap}>
          <button
            data-ui-button="icon"
            data-hub-part="mobileFilterToggle"
            type="button"
            className={`${defaultStyles.mobileHeaderFilterBtn} ${mobileFilterOpen ? defaultStyles.mobileHeaderFilterBtnActive : ""} ${mobileCategory !== "all" ? defaultStyles.mobileHeaderFilterHasSelection : ""}`}
            onClick={() => setMobileFilterOpen((prev) => !prev)}
            aria-label="Filter topics"
            aria-expanded={mobileFilterOpen}
            aria-haspopup="menu"
            title="Filter topics"
          >
            <SlidersHorizontal size={19} strokeWidth={2.2} />
            {mobileCategory !== "all" && (
              <span className={defaultStyles.filterActiveDot} aria-hidden="true" />
            )}
          </button>

          {/* Filter Dropdown Popover */}
          <div
            data-hub-part="mobileTabsScroll"
            className={`${defaultStyles.mobileFilterDropdown} ${mobileFilterOpen ? defaultStyles.mobileFilterDropdownOpen : ""}`}
            aria-label="Filter categories"
          >
            <div className={defaultStyles.mobileFilterDropdownHeader}>
              <span>Filter by Priority</span>
              {mobileCategory !== "all" && (
                <button
                  type="button"
                  className={defaultStyles.mobileFilterResetBtn}
                  onClick={() => {
                    setMobileCategory("all");
                  }}
                >
                  Reset
                </button>
              )}
            </div>
            <div className={defaultStyles.mobileFilterOptionsList}>
              {[{ id: "all", label: "All" }, ...CATEGORIES].map((cat) => {
                const isSelected = mobileCategory === cat.id;
                return (
                  <button
                    data-ui-button="state"
                    key={cat.id}
                    type="button"
                    className={`${defaultStyles.mobileFilterOptionItem} ${isSelected ? defaultStyles.mobileFilterOptionItemActive : ""}`}
                    onClick={() => {
                      setMobileCategory(cat.id);
                      setMobileFilterOpen(false);
                    }}
                    aria-pressed={isSelected}
                  >
                    <span className={defaultStyles.mobileFilterOptionLabel}>{cat.label}</span>
                    {isSelected && (
                      <Check size={14} strokeWidth={2.6} className={defaultStyles.mobileFilterCheckIcon} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {mobileFilterOpen && (
        <div
          className={defaultStyles.mobileFilterBackdrop}
          onClick={() => setMobileFilterOpen(false)}
          aria-hidden="true"
        />
      )}

      {sortMenuOpen && (
        <div
          className={defaultStyles.mobileFilterBackdrop}
          onClick={() => setSortMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <div data-hub-part="mobileBody" className={defaultStyles.mobileBody}>
        {/* Search */}
        <div data-hub-part="mobileSearchRow" className={`${defaultStyles.mobileSearchRow} ${defaultStyles.oledSearchRow}`}>
          <Search className={defaultStyles.mobileSearchIcon} size={16} />
          <input
            type="text"
            className={defaultStyles.mobileSearchInput}
            placeholder={config.mobileSearchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search topics"
          />
          {searchQuery ? (
            <div className={defaultStyles.mobileSearchRightActions}>
              <button
                type="button"
                className={defaultStyles.mobileSearchClearBtn}
                onClick={() => setSearchQuery("")}
                aria-label="Clear Search"
              >
                <X size={11} />
              </button>
            </div>
          ) : null}
        </div>

        {/* OLED Metadata & Sort Bar */}
        {(() => {
          const totalQuestions = (mobileTopics ?? []).reduce((sum, t) => {
            const detail = config.mobileTopicDetails?.[t.slug];
            return sum + (detail?.questionCount ?? 0);
          }, 0);
          return (
            <div className={defaultStyles.oledMetaBar}>
              <span className={defaultStyles.oledMetaCount}>
                {mobileTopics?.length ?? 0} topics · {totalQuestions.toLocaleString()} questions
              </span>
              <div className={defaultStyles.oledSortWrap}>
                <button
                  type="button"
                  className={`${defaultStyles.oledSortBtn} ${sortMenuOpen ? defaultStyles.oledSortBtnActive : ""}`}
                  onClick={() => setSortMenuOpen((prev) => !prev)}
                  aria-label="Sort topics"
                  aria-expanded={sortMenuOpen}
                >
                  <ArrowUpDown size={12} strokeWidth={2.2} />
                  <span>Sort</span>
                  <ChevronDown size={11} strokeWidth={2.2} />
                </button>

                {sortMenuOpen && (
                  <div className={defaultStyles.oledSortDropdown} role="menu">
                    {sortOptions.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`${defaultStyles.oledSortOption} ${sortBy === opt.id ? defaultStyles.oledSortOptionActive : ""}`}
                        onClick={() => {
                          setSortBy(opt.id);
                          setSortMenuOpen(false);
                        }}
                      >
                        <span>{opt.label}</span>
                        {sortBy === opt.id && <Check size={13} strokeWidth={2.5} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Topic Cards */}
        <div className={defaultStyles.oledTopicScrollArea}>
          <div className={defaultStyles.oledTopicGrid}>
            {(mobileTopics ?? []).map((topic) => {
              const detail = config.mobileTopicDetails?.[topic.slug];
              return (
                <MobileTopicCard
                  key={topic.id}
                  href={isChapterMode ? `${config.chapterBasePrefix}/${topic.slug}` : `${topic.routeBase}`}
                  slug={topic.slug}
                  name={topic.name}
                  icon={topic.icon}
                  accent={detail?.color ?? topic.color}
                  detail={detail}
                />
              );
            })}
          </div>
          {mobileTopics?.length === 0 && (
            <p role="status" className={defaultStyles.mobileTopicCount}>
              No topics found. Try another search or filter.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
