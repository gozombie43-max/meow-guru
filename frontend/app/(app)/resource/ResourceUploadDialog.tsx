import { X } from "lucide-react";
import type { CSSProperties } from "react";
import { resourceTabs, subjects, type ResourceTab, type SubjectId } from "./resource-model";

type Props = {
  activeSubject: SubjectId;
  activeTab: ResourceTab;
  onBeginUpload: (subject: SubjectId, tab: ResourceTab) => void;
  onClose: () => void;
};

export default function ResourceUploadDialog({ activeSubject, activeTab, onBeginUpload, onClose }: Props) {
  return (
    <div className="res-modal-backdrop">
      <div className="res-modal" role="dialog" aria-modal="true" aria-labelledby="res-upload-title">
        <div className="res-modal-header">
          <div>
            <p className="res-modal-eyebrow">Upload Document</p>
            <h2 id="res-upload-title" className="res-modal-title">Where to add?</h2>
          </div>
          <button data-ui-button="state" type="button" className="res-modal-close" onClick={onClose} aria-label="Close modal">
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>

        <div className="res-modal-options">
          {subjects.flatMap((subject) => resourceTabs.map((tab) => {
            const Icon = subject.Icon;
            const isCurrent = subject.id === activeSubject && tab === activeTab;
            return (
              <button data-ui-button="state" key={`${subject.id}-${tab}`} type="button" className={`res-modal-option ${isCurrent ? "current" : ""}`} style={{ "--subject-accent": subject.accent } as CSSProperties} onClick={() => onBeginUpload(subject.id, tab)}>
                <span className="res-modal-option-icon"><Icon size={16} strokeWidth={2.3} /></span>
                <span className="res-modal-option-label"><strong>{subject.label}</strong> {tab}</span>
              </button>
            );
          }))}
        </div>

        <button data-ui-button="secondary" type="button" className="res-modal-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
