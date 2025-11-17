"use client";

import { useState, useEffect, useRef } from "react";

export default function RowActionsMenu({
  onEdit,
  onDelete,
  editLabel = "Edit",
  deleteLabel = "Delete",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function handleEdit() {
    setIsOpen(false);
    if (onEdit) onEdit();
  }

  function handleDelete() {
    setIsOpen(false);
    if (onDelete) onDelete();
  }

  return (
    <div ref={menuRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Three dots trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: "none",
          border: "1px solid transparent",
          padding: "0.25rem 0.5rem",
          cursor: "pointer",
          fontSize: "1.25rem",
          lineHeight: "1",
          borderRadius: "4px",
          color: "#6b7280",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        aria-label="Actions"
        aria-expanded={isOpen}
      >
        ⋮
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: "0",
            marginTop: "0.25rem",
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            minWidth: "150px",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {onEdit && (
            <button
              type="button"
              onClick={handleEdit}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.5rem 0.75rem",
                border: "none",
                backgroundColor: "transparent",
                cursor: "pointer",
                fontSize: "0.875rem",
                color: "#374151",
                display: "block",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {editLabel}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={handleDelete}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.5rem 0.75rem",
                border: "none",
                backgroundColor: "transparent",
                cursor: "pointer",
                fontSize: "0.875rem",
                color: "#dc2626",
                display: "block",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#fef2f2")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {deleteLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

