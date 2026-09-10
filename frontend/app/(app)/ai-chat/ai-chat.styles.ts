import css from "styled-jsx/css";

export const aiChatStyles = css`
        .ai-chat-page {
          --surface: #ffffff;
          --surface-soft: var(--light-canvas);
          --surface-muted: var(--light-surface-muted);
          --ink: var(--light-text);
          --muted: var(--light-text-muted);
          --line: var(--light-border);
          --accent: var(--light-accent);
          --accent-dark: var(--light-accent-hover);
          --topbar-bg: rgba(255, 255, 255, 0.75);
          --input-bg: #ffffff;
          --bubble-ai: var(--light-surface-muted);
          --bubble-user: var(--light-accent);
          --bubble-user-text: #ffffff;
          --bubble-ai-text: var(--light-text);
          --surface-transparent: rgba(255, 255, 255, 0);

          height: 100dvh;
          overflow: hidden;
          display: grid;
          grid-template-columns: 288px minmax(0, 1fr);
          background: var(--surface);
          color: var(--ink);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }

        .ai-chat-page.ios-theme-dark {
          --surface: var(--dark-surface);
          --surface-soft: var(--dark-surface);
          --surface-muted: var(--dark-surface-muted);
          --ink: var(--dark-text);
          --muted: var(--dark-text-muted);
          --line: var(--dark-border);
          --accent: var(--dark-accent);
          --accent-dark: #0060cc;
          --topbar-bg: rgba(0, 0, 0, 0.75);
          --input-bg: var(--dark-surface);
          --bubble-ai: var(--dark-surface-muted);
          --bubble-user: var(--dark-accent);
          --bubble-user-text: var(--dark-text);
          --bubble-ai-text: var(--dark-text);
          --surface-transparent: rgba(0, 0, 0, 0);
        }

        :global(body.ai-chat-route.has-bottom-nav) {
          padding-bottom: 0 !important;
        }

        .ai-chat-page.sidebar-collapsed {
          grid-template-columns: 76px minmax(0, 1fr);
        }

        .ai-sidebar {
          background: var(--surface-soft);
          border-right: 1px solid var(--line);
          display: flex;
          flex-direction: column;
          min-width: 0;
          transition: width 180ms ease, transform 180ms ease;
        }

        .sidebar-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 35;
          border: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }

        .ai-sidebar.is-collapsed {
          width: 76px;
        }

        .ai-sidebar.is-collapsed .new-chat span,
        .ai-sidebar.is-collapsed .sidebar-search,
        .ai-sidebar.is-collapsed .sidebar-section,
        .ai-sidebar.is-collapsed .sidebar-footer div {
          display: none;
        }

        .sidebar-head {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px;
        }

        .icon-btn,
        .composer-tool,
        .send-btn,
        .clear-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          cursor: pointer;
        }

        .icon-btn {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: transparent;
          color: var(--ink);
        }

        .icon-btn:hover,
        .history-item:hover,
        .new-chat:hover {
          background: #e8e8eb;
        }

        .new-chat {
          height: 38px;
          flex: 1;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #202123;
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          gap: 10px;
          padding: 0 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .sidebar-search {
          margin: 2px 14px 12px;
          height: 38px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--surface);
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
          color: var(--muted);
        }

        .sidebar-search input {
          border: 0;
          background: transparent;
          outline: none;
          width: 100%;
          min-width: 0;
          font-size: 13px;
          color: var(--ink);
        }

        .sidebar-section {
          padding: 8px 10px;
          overflow-y: auto;
          flex: 1;
        }

        .section-label {
          padding: 8px 8px 6px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }

        .history-item {
          width: 100%;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: var(--ink);
          display: block;
          padding: 10px 9px;
          text-align: left;
          font-size: 13px;
          cursor: pointer;
        }

        .history-item span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .history-item.is-active {
          background: var(--surface-muted);
          font-weight: 600;
        }

        .history-skeletons {
          display: grid;
          gap: 9px;
          padding: 7px 9px;
        }

        .history-skeletons > span:not(.sr-only) {
          height: 34px;
          border-radius: 8px;
          background: linear-gradient(90deg, var(--surface-muted) 25%, var(--surface) 38%, var(--surface-muted) 63%);
          background-size: 400% 100%;
          animation: historySkeletonShimmer 1.35s ease infinite;
        }

        @keyframes historySkeletonShimmer {
          to { background-position: -100% 0; }
        }

        .sidebar-footer {
          border-top: 1px solid var(--line);
          padding: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--ink);
        }

        .mini-avatar,
        .assistant-avatar,
        .assistant-mark {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .mini-avatar,
        .assistant-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: var(--accent);
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
        }

        .sidebar-footer strong,
        .sidebar-footer span {
          display: block;
          font-size: 13px;
          line-height: 1.3;
        }

        .sidebar-footer span {
          color: var(--muted);
          font-size: 12px;
        }

        .chat-workspace {
          min-width: 0;
          height: 100dvh;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto;
          background: var(--surface);
          position: relative;
        }

        .chat-workspace.is-empty {
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .chat-workspace.is-empty .chat-topbar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 10;
        }

        .chat-workspace.is-empty .chat-scroll {
          flex: none;
          min-height: auto;
          padding-bottom: 0;
          overflow: visible;
        }

        .chat-workspace.is-empty .welcome-panel {
          min-height: auto;
          padding: 0 0 30px;
        }

        .chat-workspace.is-empty .composer-wrap {
          flex: none;
          padding-top: 0;
        }

        .chat-topbar {
          height: 58px;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 0 22px;
          background: var(--topbar-bg);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
        }

        .topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .mobile-menu {
          display: none;
        }

        .chat-title {
          font-size: 16px;
          font-weight: 700;
          line-height: 1.2;
        }

        .chat-status {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--muted);
          font-size: 12px;
        }

        .chat-status span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent);
        }

        .clear-btn {
          gap: 7px;
          height: 36px;
          padding: 0 12px;
          border-radius: 8px;
          background: var(--surface-soft);
          color: var(--ink);
          font-size: 13px;
          font-weight: 600;
        }

        .clear-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .chat-scroll {
          min-height: 0;
          overflow-y: auto;
          scroll-behavior: smooth;
          padding-bottom: 18px;
        }

        .welcome-panel {
          min-height: 100%;
          width: min(860px, calc(100% - 48px));
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 48px 0 34px;
        }

        .assistant-mark {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          background: var(--accent);
          color: #ffffff;
          margin: 0 auto 20px;
        }

        .welcome-panel h1 {
          text-align: center;
          font-size: clamp(30px, 4vw, 46px);
          line-height: 1.08;
          font-weight: 750;
          letter-spacing: 0;
          color: var(--ink);
          margin: 0;
        }

        .welcome-panel p {
          width: min(620px, 100%);
          text-align: center;
          margin: 14px auto 0;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.6;
        }

        .message-list {
          width: min(900px, calc(100% - 40px));
          margin: 0 auto;
          padding: 28px 0 34px;
        }

        .message-row {
          display: flex;
          gap: 14px;
          margin-bottom: 26px;
        }

        .user-row {
          justify-content: flex-end;
        }

        .message-bubble {
          max-width: min(70%, 720px);
          border-radius: 18px;
          padding: 12px 15px;
          font-size: 15px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .user-bubble {
          background: var(--bubble-user);
          color: var(--bubble-user-text);
          border-bottom-right-radius: 4px;
        }

        .assistant-message {
          flex: 1;
          min-width: 0;
        }

        .answer-summary {
          display: inline-block;
          max-width: 100%;
          margin-bottom: 10px;
          border-radius: 8px;
          background: var(--bubble-ai);
          padding: 10px 14px;
          color: var(--bubble-ai-text);
          font-size: 14px;
          line-height: 1.55;
        }

        .answer-card {
          border: 1px solid var(--line);
          border-radius: 8px;
          overflow: hidden;
          background: var(--surface);
        }

        .answer-head {
          height: 44px;
          padding: 0 14px;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--surface-soft);
          color: var(--ink);
          font-size: 13px;
          font-weight: 700;
        }

        .answer-head button {
          border: 0;
          background: transparent;
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        }

        .answer-body {
          padding: 16px 18px 18px;
          color: var(--ink);
          font-size: 15px;
          line-height: 1.75;
        }

        .answer-body :global(p) {
          margin: 0 0 12px;
        }

        .answer-body :global(p:last-child) {
          margin-bottom: 0;
        }

        .answer-body :global(ol),
        .answer-body :global(ul) {
          padding-left: 22px;
          margin: 10px 0 12px;
        }

        .answer-body :global(li) {
          margin-bottom: 6px;
        }

        .answer-body :global(code) {
          background: var(--surface-muted);
          border-radius: 5px;
          padding: 2px 5px;
          font-size: 13px;
        }

        .answer-body :global(pre) {
          overflow-x: auto;
          background: #f2f2f2;
          border-radius: 8px;
          padding: 12px 14px;
          margin: 10px 0;
        }

        .answer-body :global(.katex-display) {
          overflow: auto hidden;
          text-align: left;
          margin: 0.75em 0;
          padding-bottom: 0.2em;
        }

        .typing-card {
          height: 32px;
          min-width: auto;
          background: transparent;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 6px;
        }

        .typing-card span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent, #38bdf8);
          animation: typingBounce 900ms infinite ease-in-out;
        }

        .typing-card span:nth-child(2) {
          animation-delay: 150ms;
        }

        .typing-card span:nth-child(3) {
          animation-delay: 300ms;
        }

        .composer-wrap {
          width: min(900px, calc(100% - 40px));
          margin: 0 auto;
          padding: 14px 0 18px;
          background: linear-gradient(180deg, var(--surface-transparent), var(--surface) 22%);
        }

        .composer {
          min-height: 58px;
          border: 1px solid var(--line);
          border-radius: 20px;
          background: var(--input-bg);
          display: flex;
          flex-direction: column;
          padding: 8px 12px 10px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
        }

        .composer-row {
          display: flex;
          align-items: flex-end;
          gap: 6px;
        }

        .attachment-panel {
          margin-bottom: 8px;
          padding: 4px 8px;
        }

        .attachment-chip {
          display: inline-flex;
          align-items: center;
        }

        .image-preview-wrapper {
          position: relative;
          width: 56px;
          height: 56px;
          border-radius: 12px;
          overflow: hidden;
          background: var(--surface-soft);
          cursor: pointer;
        }

        .image-preview-wrapper :global(.attachment-thumb) {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .remove-image-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          border: 0;
          border-radius: 50%;
          background: var(--topbar-bg);
          color: var(--ink);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(4px);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .remove-image-btn:hover {
          background: var(--surface);
        }

        .file-preview-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 8px 12px;
          background: #fafafa;
        }

        .file-preview-wrapper .file-icon {
          background: #effaf6;
          color: var(--accent-dark);
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .file-info {
          flex: 1;
          min-width: 0;
        }

        .file-info strong,
        .file-info span {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-info strong {
          color: var(--ink);
          font-size: 13px;
          font-weight: 600;
        }

        .file-info span {
          color: var(--muted);
          font-size: 11px;
        }

        .remove-file-btn {
          width: 28px;
          height: 28px;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .remove-file-btn:hover {
          background: var(--surface-muted);
          color: var(--ink);
        }

        .attachment-error {
          display: inline-flex;
          align-items: center;
          min-height: 34px;
          border: 1px solid #fecaca;
          border-radius: 8px;
          background: #fef2f2;
          color: #991b1b;
          padding: 0 10px;
          font-size: 13px;
          font-weight: 600;
        }

        .file-input {
          display: none;
        }

        .composer textarea {
          flex: 1;
          min-width: 0;
          max-height: 160px;
          resize: none;
          border: 0;
          outline: 0;
          background: transparent;
          color: var(--ink);
          padding: 10px 4px 8px;
          font: inherit;
          font-size: 15px;
          line-height: 1.5;
        }

        .composer textarea::placeholder {
          color: var(--muted);
        }

        .composer-tool {
          width: 38px;
          height: 38px;
          border-radius: 8px;
          background: transparent;
          color: #52525b;
          flex: 0 0 auto;
        }

        .composer-tool:hover {
          background: #f2f2f2;
        }

        .send-btn {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: #171717;
          color: white;
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2px;
          margin-right: 4px;
        }

        .send-btn:hover:not(:disabled) {
          background: var(--dark-canvas);
        }

        .send-btn:disabled {
          background: #d4d4d8;
          color: #a1a1aa;
          cursor: not-allowed;
        }

        .send-btn .send-icon {
          width: 18px;
          height: 18px;
        }

        .composer-note {
          margin-top: 8px;
          text-align: center;
          color: var(--muted);
          font-size: 12px;
        }

        .image-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(4px);
          padding: 24px;
        }

        .image-modal-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
          border-radius: 12px;
          overflow: hidden;
          background: var(--dark-canvas);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .image-modal-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 40px;
          height: 40px;
          border: 0;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.5);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s;
        }

        .image-modal-close:hover {
          background: rgba(0, 0, 0, 0.8);
        }

        .image-modal-img {
          max-width: 100%;
          max-height: 90vh;
          object-fit: contain;
          display: block;
        }

        @keyframes typingBounce {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.45;
          }
          50% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        @media (max-width: 900px) {
          .ai-chat-page {
            grid-template-columns: 1fr;
            width: 100%;
            height: 100dvh;
            overflow: hidden;
          }

          .sidebar-backdrop {
            display: block;
          }

          .ai-chat-page.sidebar-collapsed {
            grid-template-columns: 1fr;
          }

          .ai-sidebar {
            position: fixed;
            inset: 0 auto 0 0;
            width: min(82vw, 320px);
            padding-top: var(--safe-top);
            z-index: 40;
            transform: translateX(-100%);
            box-shadow: 18px 0 44px rgba(15, 23, 42, 0.18);
          }

          .ai-sidebar:not(.is-collapsed) {
            transform: translateX(0);
          }

          .ai-sidebar.is-collapsed {
            transform: translateX(-100%);
            width: min(82vw, 320px);
          }

          .mobile-menu {
            display: inline-flex;
          }

          .chat-topbar {
            height: auto;
            min-height: calc(56px + var(--safe-top));
            padding: calc(8px + var(--safe-top)) 12px 8px;
            align-items: center;
            gap: 10px;
          }

          .topbar-left {
            flex: 1 1 auto;
            min-width: 0;
            gap: 10px;
          }

          .topbar-left > div {
            min-width: 0;
          }

          .chat-title,
          .chat-status {
            min-width: 0;
          }

          .chat-status {
            line-height: 1.35;
          }

          .clear-btn {
            flex: 0 0 auto;
            padding: 0 10px;
          }

          .welcome-panel {
            width: min(100% - 28px, 720px);
            justify-content: flex-start;
            padding-top: 42px;
          }

          .message-list,
          .composer-wrap {
            width: calc(100% - 24px);
          }

          .chat-scroll {
            padding-bottom: 24px;
          }

          .message-bubble {
            max-width: 88%;
          }

          .composer-wrap {
            padding: 12px 0 calc(16px + var(--safe-bottom));
            background: linear-gradient(180deg, var(--surface-transparent), var(--surface) 28%);
          }

          .mic-btn {
            display: none;
          }
        }

        @media (max-width: 420px) {
          .chat-topbar {
            padding-inline: 8px;
          }

          .icon-btn {
            width: 36px;
            height: 36px;
          }

          .chat-title {
            font-size: 15px;
          }

          .chat-status {
            font-size: 11px;
          }

          .clear-btn {
            width: 38px;
            padding: 0;
          }

          .clear-btn svg {
            width: 17px;
            height: 17px;
          }

          .clear-btn {
            font-size: 0;
            gap: 0;
          }

          .message-list,
          .composer-wrap,
          .welcome-panel {
            width: calc(100% - 16px);
          }

          .chat-scroll {
            padding-bottom: 24px;
          }

          .message-bubble {
            max-width: 86%;
            font-size: 14px;
            padding: 10px 13px;
          }

          .assistant-avatar {
            display: none;
          }

          .message-row {
            gap: 8px;
          }

          .composer {
            min-height: 54px;
            gap: 6px;
            padding: 8px;
          }

          .composer-tool,
          .send-btn {
            width: 36px;
            height: 36px;
          }
        }
      `;
