"use client";

import MicIcon from "@/components/MicIcon";
import defaultStyles from "@/components/SubjectHub.module.css";

import { ArrowLeft, ArrowUpDown, Check, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

import { MobileTopicCard } from "./MobileTopicCard";
import { MobileTopicRow } from './MobileTopicRow';
import type { SubjectHubView } from './useSubjectHubView';

export function SubjectHubMobile({ view }: { view: SubjectHubView }) {
 const { config, CATEGORIES, router, searchQuery, setSearchQuery, isListening, toggleVoiceSearch, activeCategory, setActiveCategory, mobileCategory, setMobileCategory, mobileFilterOpen, setMobileFilterOpen, sortBy, setSortBy, sortMenuOpen, setSortMenuOpen, sortOptions, oledMobile, mobileStyles, mobileTopics, isChapterMode, filteredTopics } = view;
 return (<div className={`${mobileStyles.mobileContainer} ${oledMobile ? defaultStyles.oledMobile : defaultStyles.fixedTopicsMobile}`}>
        {/* Mobile Topbar */}
        <header data-ui-chrome="header" data-hub-part="mobileTopbar" className={`${mobileStyles.mobileTopbar} ${oledMobile ? defaultStyles.oledMobileTopbar : ""}`}>
          <button data-ui-button="icon"
            type="button"
            className={mobileStyles.mobileBackBtn}
            onClick={() => router.replace("/")}
            aria-label="Back"
          >
            <ArrowLeft size={20} strokeWidth={2.2} />
          </button>
          <span className={mobileStyles.mobileTopbarTitle}>
            {oledMobile ? config.label : `${config.label} Topics`}
          </span>
          {/* Header Right: Filter Button & Dropdown */}
          <div className={defaultStyles.mobileHeaderFilterWrap}>
            <button
              data-ui-button="icon"
              data-hub-part="mobileFilterToggle"
              type="button"
              className={`${defaultStyles.mobileHeaderFilterBtn} ${mobileFilterOpen ? defaultStyles.mobileHeaderFilterBtnActive : ""} ${(oledMobile ? mobileCategory !== "all" : activeCategory !== "very-high") ? defaultStyles.mobileHeaderFilterHasSelection : ""}`}
              onClick={() => setMobileFilterOpen((prev) => !prev)}
              aria-label="Filter topics"
              aria-expanded={mobileFilterOpen}
              aria-haspopup="menu"
              title="Filter topics"
            >
              <SlidersHorizontal size={19} strokeWidth={2.2} />
              {(oledMobile ? mobileCategory !== "all" : activeCategory !== "very-high") && (
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
                {(oledMobile ? mobileCategory !== "all" : activeCategory !== "very-high") && (
                  <button
                    type="button"
                    className={defaultStyles.mobileFilterResetBtn}
                    onClick={() => {
                      if (oledMobile) setMobileCategory("all");
                      else setActiveCategory("very-high");
                    }}
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className={defaultStyles.mobileFilterOptionsList}>
                {(oledMobile ? [{ id: "all", label: "All" }, ...CATEGORIES] : CATEGORIES).map((cat) => {
                  const isSelected = (oledMobile ? mobileCategory : activeCategory) === cat.id;
                  return (
                    <button
                      data-ui-button="state"
                      key={cat.id}
                      type="button"
                      className={`${defaultStyles.mobileFilterOptionItem} ${isSelected ? defaultStyles.mobileFilterOptionItemActive : ""}`}
                      onClick={() => {
                        if (oledMobile) setMobileCategory(cat.id);
                        else setActiveCategory(cat.id);
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

        <div data-hub-part="mobileBody" className={mobileStyles.mobileBody}>
          {/* Search */}
          <div data-hub-part="mobileSearchRow" className={`${mobileStyles.mobileSearchRow} ${oledMobile ? defaultStyles.oledSearchRow : ""}`}>
            <Search className={mobileStyles.mobileSearchIcon} size={16} />
            <input
              type="text"
              className={mobileStyles.mobileSearchInput}
              placeholder={
                isListening
                  ? "Listening... speak topic"
                  : config.mobileSearchPlaceholder
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search topics"
            />
            {searchQuery ? (
              <div className={mobileStyles.mobileSearchRightActions}>
                <button
                  type="button"
                  className={mobileStyles.mobileSearchClearBtn}
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear Search"
                >
                  <X size={11} />
                </button>
              </div>
            ) : !oledMobile ? (
              <div className={mobileStyles.mobileSearchRightActions}>
                <span className={mobileStyles.mobileSearchDivider} aria-hidden="true" />
                <button data-ui-button="state" data-ui-shape="icon"
                  type="button"
                  className={`${mobileStyles.mobileMicBtn} ${isListening ? mobileStyles.mobileMicBtnListening : ""}`}
                  onClick={toggleVoiceSearch}
                  aria-label={isListening ? "Stop voice search" : "Voice search"}
                  title={isListening ? "Listening..." : "Voice search"}
                >
                  <MicIcon size={16} />
                </button>
              </div>
            ) : null}
          </div>

          {/* OLED Metadata & Sort Bar */}
          {oledMobile && (() => {
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

          {/* TOPICS Section Header for non-OLED */}
          {!oledMobile && (
            <div data-hub-part="mobileTopicsTitle" className={mobileStyles.mobileTopicsTitle}>TOPICS</div>
          )}

          {/* Topic Cards / Rows */}
          {oledMobile ? (
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
                <p role="status" className={mobileStyles.mobileTopicCount}>
                  No topics found. Try another search or filter.
                </p>
              )}
            </div>
          ) : (
            <div data-hub-part="mobileTopicGroup" className={mobileStyles.mobileTopicGroup}>
              {!isChapterMode && (
                <div data-hub-part="mobileTabsScroll" className={mobileStyles.mobileTabsScroll}>
                  {CATEGORIES.map((cat) => (
                    <button data-ui-button="state"
                      key={cat.id}
                      type="button"
                      className={`${mobileStyles.mobileTabBtn} ${
                        activeCategory === cat.id ? mobileStyles.mobileTabActive : ""
                      }`}
                      onClick={() => setActiveCategory(cat.id)}
                      aria-pressed={activeCategory === cat.id}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}
              {filteredTopics.map((topic) => (
                <MobileTopicRow
                  key={topic.id}
                  href={isChapterMode ? `${config.chapterBasePrefix}/${topic.slug}` : `${topic.routeBase}`}
                  color={topic.color}
                  Icon={topic.icon}
                  name={topic.name}
                  quiet={false}
                  detail={config.mobileTopicDetails?.[topic.slug]}
                  styles={mobileStyles}
                />
              ))}
            </div>
          )}
        </div>
      </div>);
}
