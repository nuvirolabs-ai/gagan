import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminGroupLabel, recentAdminSearches, rememberAdminSearch, searchAdmin, type AdminSearchResult } from "../adminSearch";
import { CATALOGUE_IDENTITY_UNAVAILABLE } from "../navigation";
import { useAuth } from "../useAuth";

function shortcutLabel() {
  return typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl+K";
}

export default function CommandPalette() {
  const { permissions } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const restoreRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openRef = useRef(false);
  const suppressOpen = useRef(false);

  const results = useMemo(
    () => searchAdmin(query, { permissions, pathname: location.pathname }),
    [query, permissions, location.pathname],
  );
  const active = results.length ? Math.min(activeIndex, results.length - 1) : 0;
  const activeId = results[active] ? `command-option-${results[active].id}` : undefined;

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { setActiveIndex(0); }, [query, location.pathname]);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  const close = () => {
    suppressOpen.current = true;
    setOpen(false);
    setQuery("");
    const target = restoreRef.current;
    window.setTimeout(() => {
      target?.focus();
      suppressOpen.current = false;
    }, 0);
  };

  const openPalette = (invoker?: HTMLElement | null, keepQuery = false) => {
    if (suppressOpen.current || openRef.current) return;
    restoreRef.current = invoker ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setRecent(recentAdminSearches());
    if (!keepQuery) setQuery("");
    setOpen(true);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        event.stopPropagation();
        if (openRef.current) close();
        else openPalette();
        return;
      }
      if (!openRef.current || event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, []);

  const choose = (result: AdminSearchResult | undefined) => {
    if (!result?.route) return;
    rememberAdminSearch(query);
    navigate(result.route);
    close();
  };

  const onQueryKey = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    }
  };

  return <div className="command-search">
    <label className="command-search-field">
      <svg className="command-search-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M12.5 12.5 L17 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Search Gagan"
        aria-expanded={open}
        aria-controls="command-results"
        aria-activedescendant={open ? activeId : undefined}
        aria-autocomplete="list"
        placeholder="Type to search"
        autoComplete="off"
        spellCheck={false}
        value={query}
        onFocus={(event) => openPalette(event.currentTarget)}
        onChange={(event) => {
          setQuery(event.target.value);
          openPalette(event.currentTarget, true);
        }}
        onKeyDown={onQueryKey}
      />
      <kbd aria-hidden="true">{shortcutLabel()}</kbd>
    </label>
    {open && <>
      <div className="command-palette-backdrop" onMouseDown={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) close(); }} />
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Search Gagan">
        {!query.trim() && recent.length > 0 && <div className="command-recent">
          <span>Recent</span>
          {recent.map((item) => <button key={item} type="button" className="command-recent-chip" onClick={() => setQuery(item)}>{item}</button>)}
        </div>}
        {results.length > 0 ? <ul id="command-results" role="listbox" aria-label="Admin actions">
          {results.map((result, index) => {
            const unavailableResult = result.route == null;
            return <li key={result.id}>
              {unavailableResult ? <div id={`command-option-${result.id}`} role="option" aria-selected={index === active} aria-disabled="true" className={`command-option command-option-unavailable ${index === active ? "active" : ""}`}>
                <span className="command-option-kicker">{adminGroupLabel(result.group)}</span>
                <span className="command-option-label">{result.label}</span>
                <span className="command-option-status">{CATALOGUE_IDENTITY_UNAVAILABLE}</span>
                <span className="command-option-detail">{result.description}</span>
              </div> : <button id={`command-option-${result.id}`} type="button" role="option" aria-selected={index === active} className={`command-option ${index === active ? "active" : ""}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(result)}>
                <span className="command-option-kicker">{adminGroupLabel(result.group)} · {result.kind === "action" ? "Action" : "Page"}</span>
                <span className="command-option-label">{result.label}</span>
                <span className="command-option-detail">{result.description}</span>
              </button>}
            </li>;
          })}
        </ul> : query.trim() ? <p className="command-empty">No matching Admin action found.</p> : <p className="command-empty">Type in the search box to find an Admin page or action.</p>}
      </div>
    </>}
  </div>;
}
